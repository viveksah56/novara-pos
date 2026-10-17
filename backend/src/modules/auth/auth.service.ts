import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Prisma } from "../../../prisma/generated/client/client.js";

import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";
import type { LoginInput, RegisterInput } from "@modules/auth/auth.schemas.js";

const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_MINUTES * 60;
const REFRESH_TTL_SECONDS = env.REFRESH_TOKEN_DAYS * 24 * 60 * 60;
const BCRYPT_ROUNDS = 12;

type TokenPair = { accessToken: string; refreshToken: string };

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
): Promise<void> {
  await client.refreshToken.create({
    data: {
      id: pair.refreshId,
      userId,
      familyId,
      tokenHash: hashToken(pair.refreshToken),
      expiresAt: pair.expiresAt,
    },
  });
}

export async function register(input: RegisterInput): Promise<{ tokens: TokenPair; userId: string }> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const familyId = randomUUID();

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true },
    });
    const tenant = await transaction.tenant.create({ data: { name: input.businessName } });
    await transaction.branch.create({
      data: { tenantId: tenant.id, name: input.branchName, timezone: "Asia/Kathmandu" },
    });
    await transaction.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
    });

    const tokens = createTokenPair(user.id, familyId);
    await storeRefreshToken(transaction, user.id, tokens, familyId);
    return { tokens, userId: user.id };
  });
}

export async function login(input: LoginInput): Promise<{ tokens: TokenPair; userId: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true, isActive: true },
  });
  const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

  if (!user || !user.isActive || !passwordMatches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const familyId = randomUUID();
  const tokens = createTokenPair(user.id, familyId);
  await prisma.refreshToken.create({
    data: {
      id: tokens.refreshId,
      userId: user.id,
      familyId,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: tokens.expiresAt,
    },
  });
  return { tokens, userId: user.id };
}

export async function rotateRefreshToken(token: string): Promise<TokenPair> {
  const claims = parseRefreshToken(token);
  const tokenHash = hashToken(token);

  const result = await prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });

    if (
      !storedToken ||
      storedToken.id !== claims.tokenId ||
      storedToken.userId !== claims.userId ||
      storedToken.familyId !== claims.familyId
    ) {
      return { kind: "invalid" as const };
    }

    if (storedToken.revokedAt) {
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
      where: { id: storedToken.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revokeResult.count !== 1) {
      await transaction.refreshToken.updateMany({
        where: { familyId: storedToken.familyId, userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: "reused" as const };
    }

    const tokens = createTokenPair(user.id, storedToken.familyId);
    await storeRefreshToken(transaction, user.id, tokens, storedToken.familyId);
    return { kind: "success" as const, tokens };
  });

  if (result.kind !== "success") {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Your session has expired. Please sign in again.");
  }
  return result.tokens;
}

export async function revokeRefreshToken(token: string | undefined): Promise<void> {
  if (!token) return;

  try {
    const claims = parseRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { userId: true, familyId: true },
    });
    if (!stored || stored.userId !== claims.userId || stored.familyId !== claims.familyId) return;

    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Logout is intentionally idempotent for expired or malformed cookies.
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
              branches: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, timezone: true } },
            },
          },
          branchAssignments: { select: { branchId: true, branch: { select: { id: true, name: true, timezone: true } } } },
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
