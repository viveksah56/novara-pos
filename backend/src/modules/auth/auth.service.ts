import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Prisma } from "../../../prisma/generated/client/client.js";

import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";
import { logger } from "@lib/logger.js";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "@modules/auth/auth.schemas.js";

const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_MINUTES * 60;
const REFRESH_TTL_SECONDS = env.REFRESH_TOKEN_DAYS * 24 * 60 * 60;
const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("novara-dummy-password-not-for-login", BCRYPT_ROUNDS);
const LOGIN_LIMIT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type TokenPair = { accessToken: string; refreshToken: string };
export type SessionMetadata = { ip?: string; userAgent?: string };

async function writeAudit(
  client: Prisma.TransactionClient,
  userId: string | null,
  action: string,
  metadata: SessionMetadata = {},
): Promise<void> {
  await client.auditLog.create({
    data: { userId, action, ip: metadata.ip?.slice(0, 64), userAgent: metadata.userAgent?.slice(0, 512) },
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createTokenPair(userId: string, familyId: string): TokenPair & { refreshId: string; expiresAt: Date } {
  const refreshId = randomUUID();
  const accessToken = jwt.sign({}, env.ACCESS_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TTL_SECONDS,
    subject: userId,
  });
  const refreshToken = jwt.sign({ familyId }, env.REFRESH_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: REFRESH_TTL_SECONDS,
    jwtid: refreshId,
    subject: userId,
  });

  return {
    accessToken,
    refreshToken,
    refreshId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
  };
}

function parseRefreshToken(token: string): { userId: string; tokenId: string; familyId: string } {
  try {
    const payload = jwt.verify(token, env.REFRESH_TOKEN_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string" || typeof payload.familyId !== "string") {
      throw new Error("Invalid refresh token claims");
    }
    return { userId: payload.sub, tokenId: payload.jti, familyId: payload.familyId };
  } catch {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Your session has expired. Please sign in again.");
  }
}

async function storeRefreshToken(
  client: Prisma.TransactionClient,
  userId: string,
  pair: TokenPair & { refreshId: string; expiresAt: Date },
  familyId: string,
  metadata: SessionMetadata = {},
): Promise<void> {
  await client.refreshToken.create({
    data: {
      id: pair.refreshId,
      userId,
      familyId,
      tokenHash: hashToken(pair.refreshToken),
      expiresAt: pair.expiresAt,
      ip: metadata.ip?.slice(0, 64),
      userAgent: metadata.userAgent?.slice(0, 512),
    },
  });
}

export async function hashAccountPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function issueSession(userId: string, metadata: SessionMetadata = {}): Promise<TokenPair> {
  const familyId = randomUUID();
  const tokens = createTokenPair(userId, familyId);
  await prisma.$transaction(async (transaction) => {
    await storeRefreshToken(transaction, userId, tokens, familyId, metadata);
    await writeAudit(transaction, userId, "auth.session.created", metadata);
  });
  return tokens;
}

export async function register(input: RegisterInput, metadata: SessionMetadata = {}): Promise<{ tokens: TokenPair; userId: string }> {
  if (env.SUPER_ADMIN_EMAILS.includes(input.email.trim().toLowerCase())) {
    throw new HttpError(409, "PLATFORM_ADMIN_REGISTRATION_DISABLED", "This email is reserved for a platform administrator and cannot be registered publicly.");
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const familyId = randomUUID();
  const tenantSlug = input.businessName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "workspace";
  const branchCode = input.branchName.normalize("NFKD").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase().padEnd(2, "B");

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash },
        select: { id: true },
      });
      let slug = tenantSlug;
      let suffix = 2;
      while (await transaction.tenant.findUnique({ where: { slug }, select: { id: true } })) {
        slug = `${tenantSlug}-${suffix++}`;
      }
      const tenant = await transaction.tenant.create({ data: { name: input.businessName, slug } });
      await transaction.branch.create({
        data: { tenantId: tenant.id, name: input.branchName, code: branchCode, timezone: "Asia/Kathmandu" },
      });
      await transaction.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
      });
      await writeAudit(transaction, user.id, "auth.register", metadata);

      const trialPlan = await transaction.subscriptionPlan.findFirst({
        where: { isActive: true, trialDays: { gt: 0 } },
        orderBy: [{ trialDays: "desc" }, { priceMonthly: "asc" }],
        select: { id: true, trialDays: true },
      });
      if (trialPlan) {
        const trialEndsAt = new Date(Date.now() + trialPlan.trialDays * 24 * 60 * 60 * 1000);
        await transaction.tenant.update({ where: { id: tenant.id }, data: { planId: trialPlan.id } });
        await transaction.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: trialPlan.id,
            status: "TRIALING",
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
          },
        });
      }

      const tokens = createTokenPair(user.id, familyId);
      await storeRefreshToken(transaction, user.id, tokens, familyId, metadata);
      return { tokens, userId: user.id };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new HttpError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists. Sign in or use a different email.");
    }
    throw error;
  }
}

export async function login(input: LoginInput, metadata: SessionMetadata = {}): Promise<{ tokens: TokenPair; userId: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, isActive: true, lockedUntil: true },
  });
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.isActive || !passwordMatches || (user.lockedUntil && user.lockedUntil > new Date())) {
    if (user?.isActive && !passwordMatches && (!user.lockedUntil || user.lockedUntil <= new Date())) {
      const isLocked = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.user.update({
          where: { id: user.id },
          data: { failedLoginCount: { increment: 1 } },
          select: { failedLoginCount: true },
        });
        if (updated.failedLoginCount < LOGIN_LIMIT) return false;
        await transaction.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + LOCKOUT_MS) } });
        await writeAudit(transaction, user.id, "auth.login.locked", metadata);
        return true;
      });
      if (isLocked) logger.warn({ userId: user.id }, "Account temporarily locked after failed login attempts");
    }
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const familyId = randomUUID();
  const tokens = createTokenPair(user.id, familyId);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await storeRefreshToken(transaction, user.id, tokens, familyId, metadata);
    await writeAudit(transaction, user.id, "auth.login", metadata);
  });
  return { tokens, userId: user.id };
}

export async function requestPasswordReset(email: string, metadata: SessionMetadata = {}): Promise<void> {
  const startedAt = Date.now();
  const waitForEnumerationFloor = async () => {
    const remaining = 250 - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  };
  const user = await prisma.user.findFirst({ where: { email, isActive: true }, select: { id: true, email: true, name: true } });
  if (!user) {
    await waitForEnumerationFloor();
    return;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.$transaction(async (transaction) => {
    await transaction.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await transaction.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    await writeAudit(transaction, user.id, "auth.password_reset.requested", metadata);
  });

  if (!env.RESEND_API_KEY) {
    logger.error({ userId: user.id }, "Password reset email is not configured");
    await waitForEnumerationFloor();
    return;
  }

  const resetUrl = new URL("/reset-password", env.APP_ORIGIN);
  resetUrl.searchParams.set("token", rawToken);
  void (async () => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [user.email],
        subject: "Reset your Novara password",
        text: `Hello ${user.name},\n\nUse this secure link to reset your password within 30 minutes:\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) logger.error({ userId: user.id, status: response.status }, "Password reset email provider rejected the request");
    } catch (error) {
      logger.error({ err: error, userId: user.id }, "Password reset email could not be delivered");
    }
  })();
  await waitForEnumerationFloor();
}

export async function resetPassword(input: ResetPasswordInput, metadata: SessionMetadata = {}): Promise<void> {
  const tokenHash = hashToken(input.token);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    const resetToken = await transaction.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      throw new HttpError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or expired. Request a new one.");
    }
    const marked = await transaction.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (marked.count !== 1) throw new HttpError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or expired. Request a new one.");
    await transaction.user.update({ where: { id: resetToken.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await transaction.refreshToken.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: now } });
    await transaction.passwordResetToken.updateMany({ where: { userId: resetToken.userId, usedAt: null }, data: { usedAt: now } });
    await writeAudit(transaction, resetToken.userId, "auth.password_reset.completed", metadata);
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, metadata: SessionMetadata = {}): Promise<void> {
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, "CURRENT_PASSWORD_INCORRECT", "Your current password is incorrect.");
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await transaction.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(transaction, userId, "auth.password.changed", metadata);
  });
}

export async function rotateRefreshToken(token: string, metadata: SessionMetadata = {}): Promise<TokenPair> {
  const claims = parseRefreshToken(token);
  const tokenHash = hashToken(token);

  const result = await prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true, usedAt: true },
    });

    if (
      !storedToken ||
      storedToken.id !== claims.tokenId ||
      storedToken.userId !== claims.userId ||
      storedToken.familyId !== claims.familyId
    ) {
      return { kind: "invalid" as const };
    }

    if (storedToken.revokedAt || storedToken.usedAt) {
      await transaction.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: "reused" as const };
    }

    if (storedToken.expiresAt <= new Date()) {
      await transaction.refreshToken.update({ where: { id: storedToken.id }, data: { revokedAt: new Date() } });
      return { kind: "invalid" as const };
    }

    const user = await transaction.user.findFirst({
      where: { id: storedToken.userId, isActive: true },
      select: { id: true },
    });
    if (!user) {
      await transaction.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: "invalid" as const };
    }

    const revokeResult = await transaction.refreshToken.updateMany({
      where: { id: storedToken.id, revokedAt: null, usedAt: null },
      data: { usedAt: new Date(), revokedAt: new Date() },
    });
    if (revokeResult.count !== 1) {
      await transaction.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: "reused" as const };
    }

    const tokens = createTokenPair(user.id, storedToken.familyId);
    await storeRefreshToken(transaction, user.id, tokens, storedToken.familyId, metadata);
    return { kind: "success" as const, tokens };
  });

  if (result.kind !== "success") {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Your session has expired. Please sign in again.");
  }
  return result.tokens;
}

export async function revokeRefreshToken(token: string | undefined, metadata: SessionMetadata = {}): Promise<string | undefined> {
  if (!token) return undefined;

  try {
    const claims = parseRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { userId: true, familyId: true },
    });
    if (!stored || stored.userId !== claims.userId || stored.familyId !== claims.familyId) return undefined;

    await prisma.$transaction(async (transaction) => {
      await transaction.refreshToken.updateMany({
        where: { userId: stored.userId, familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(transaction, stored.userId, "auth.logout", metadata);
    });
    return stored.userId;
  } catch {
    // Logout is intentionally idempotent for expired or malformed cookies.
    return undefined;
  }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      platformStaff: { select: { role: true } },
      memberships: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          tenant: {
            select: {
              id: true,
              name: true,
              status: true,
              currency: true,
              branches: { where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true, timezone: true } },
            },
          },
          branchAssignments: { where: { branch: { isActive: true } }, select: { branchId: true, branch: { select: { id: true, name: true, code: true, timezone: true } } } },
        },
      },
    },
  });

  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    platformRole: env.SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) ? "SUPER_ADMIN" as const : user.platformStaff?.role ?? null,
    isPlatformAdmin: env.SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()),
    memberships: user.memberships.map((membership) => ({
      ...membership,
      tenant: {
        ...membership.tenant,
        branches:
          membership.role === "OWNER"
            ? membership.tenant.branches
            : membership.branchAssignments.map((assignment) => assignment.branch),
      },
      branchAssignments: membership.branchAssignments.map(({ branchId }) => ({ branchId })),
    })),
  };
}

export async function getAuthUser(userId: string) {
  return getProfile(userId);
}
