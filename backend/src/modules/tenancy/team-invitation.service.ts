import { createHash, randomBytes } from "node:crypto";
import type { BusinessRole } from "../../../prisma/generated/client/client.js";
import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { logger } from "@lib/logger.js";
import { prisma } from "@lib/prisma.js";
import { hashAccountPassword, issueSession, type SessionMetadata } from "@modules/auth/auth.service.js";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export async function getTeamInvitationPreview(token: string) {
  const invitation = await prisma.teamInvitation.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: { email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, tenant: { select: { name: true, status: true } }, branches: { select: { branch: { select: { name: true, isActive: true } } } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.tenant.status !== "ACTIVE" || invitation.branches.some(({ branch }) => !branch.isActive)) {
    throw new HttpError(404, "INVITATION_INVALID", "This invitation link is invalid or has expired.");
  }
  return { email: invitation.email, role: invitation.role, businessName: invitation.tenant.name, branches: invitation.branches.map(({ branch }) => branch.name), expiresAt: invitation.expiresAt };
}

export async function createTeamInvitation(input: {
  tenantId: string;
  email: string;
  role: BusinessRole;
  branchIds: string[];
  invitedById: string;
}) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "novara"."Tenant" WHERE "id" = ${input.tenantId}::uuid FOR UPDATE`;
    const branches = await transaction.branch.findMany({ where: { tenantId: input.tenantId, id: { in: input.branchIds }, isActive: true }, select: { id: true } });
    if (branches.length !== new Set(input.branchIds).size) throw new HttpError(400, "INVALID_BRANCH", "One or more selected active branches are not part of this business.");
    const user = await transaction.user.findUnique({ where: { email: input.email }, select: { id: true, isActive: true } });
    if (user && !user.isActive) throw new HttpError(409, "ACCOUNT_DISABLED", "This email belongs to a disabled Novara account.");
    if (user?.isActive && await transaction.membership.findUnique({ where: { tenantId_userId: { tenantId: input.tenantId, userId: user.id } }, select: { isActive: true } }).then((membership) => membership?.isActive)) {
      throw new HttpError(409, "MEMBERSHIP_EXISTS", "This person already has active access to the business.");
    }
    const tenant = await transaction.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, select: { planId: true, name: true, subscription: { select: { plan: { select: { maxStaff: true } } } } } });
    const plan = tenant.subscription?.plan ?? (tenant.planId ? await transaction.subscriptionPlan.findUnique({ where: { id: tenant.planId }, select: { maxStaff: true } }) : null);
    const activeCount = await transaction.membership.count({ where: { tenantId: input.tenantId, isActive: true } });
    const pendingCount = await transaction.teamInvitation.count({ where: { tenantId: input.tenantId, email: { not: input.email }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (plan?.maxStaff !== null && plan?.maxStaff !== undefined && activeCount + pendingCount >= plan.maxStaff) throw new HttpError(402, "PLAN_STAFF_LIMIT", `Your current plan allows ${plan.maxStaff} active or invited team members.`);
    await transaction.teamInvitation.updateMany({ where: { tenantId: input.tenantId, email: input.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return transaction.teamInvitation.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        role: input.role,
        tokenHash: tokenHash(rawToken),
        invitedById: input.invitedById,
        expiresAt,
        branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
      },
      include: { branches: { select: { branchId: true } } },
    });
  });

  const invited = await prisma.teamInvitation.findUniqueOrThrow({ where: { id: invitation.id }, select: { id: true, email: true, role: true, expiresAt: true, tenant: { select: { name: true } } } });
  await prisma.auditLog.create({ data: { userId: input.invitedById, action: "team.invite", metadata: { tenantId: input.tenantId, invitationId: invitation.id, email: input.email, role: input.role, branchIds: input.branchIds } } });

  const inviteUrl = new URL("/accept-invite", env.APP_ORIGIN);
  inviteUrl.searchParams.set("token", rawToken);
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") {
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      throw new HttpError(503, "EMAIL_NOT_CONFIGURED", "Team invitations cannot be sent until email delivery is configured.");
    }
    logger.warn({ invitationId: invitation.id, email: invitation.email }, "Team invitation created for local development; email delivery is not configured");
    return { ...invited, inviteUrl: inviteUrl.toString() };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [invited.email],
        subject: `Join ${invited.tenant.name} on Novara`,
        html: `<p>You have been invited to join <strong>${escapeHtml(invited.tenant.name)}</strong> as ${escapeHtml(invited.role.toLowerCase().replaceAll("_", " "))}.</p><p><a href="${inviteUrl.toString()}">Accept invitation</a></p><p>This link expires in seven days. If you were not expecting this invitation, you can ignore this message.</p>`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  } catch (error) {
    await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    logger.error({ err: error, invitationId: invitation.id }, "Failed to send team invitation email");
    throw new HttpError(502, "INVITATION_EMAIL_FAILED", "We could not send the invitation email. Please try again.");
  }
  return invited;
}

export async function acceptTeamInvitation(input: { token: string; name?: string; password?: string; userId?: string }, metadata: SessionMetadata = {}) {
  const digest = tokenHash(input.token);
  const invitationPreview = await prisma.teamInvitation.findUnique({ where: { tokenHash: digest }, select: { id: true, email: true } });
  if (!invitationPreview) throw new HttpError(400, "INVITATION_INVALID", "This invitation link is invalid or has expired.");
  const invitedUser = await prisma.user.findFirst({ where: { email: { equals: invitationPreview.email, mode: "insensitive" } }, select: { id: true, isActive: true } });
  let userId = input.userId;
  let newUser = false;
  let passwordHash: string | undefined;
  if (invitedUser) {
    if (!invitedUser.isActive) throw new HttpError(403, "ACCOUNT_DISABLED", "This Novara account has been disabled. Contact support.");
    if (!userId || userId !== invitedUser.id) throw new HttpError(401, "INVITATION_SIGN_IN_REQUIRED", "Sign in with the invited email address to accept this invitation.");
  } else {
    if (userId) throw new HttpError(409, "INVITED_EMAIL_MISMATCH", "This invitation email does not match your signed-in account.");
    if (!input.name || !input.password) throw new HttpError(400, "INVITATION_ACCOUNT_REQUIRED", "Enter your name and create a password to accept this invitation.");
    passwordHash = await hashAccountPassword(input.password);
    newUser = true;
  }

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "novara"."TeamInvitation" WHERE "id" = ${invitationPreview.id}::uuid FOR UPDATE`;
    const invitation = await transaction.teamInvitation.findUnique({ where: { id: invitationPreview.id }, include: { branches: { select: { branchId: true } } } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw new HttpError(400, "INVITATION_INVALID", "This invitation link is invalid or has expired.");
    await transaction.$queryRaw`SELECT "id" FROM "novara"."Tenant" WHERE "id" = ${invitation.tenantId}::uuid FOR UPDATE`;
    const tenant = await transaction.tenant.findUniqueOrThrow({ where: { id: invitation.tenantId }, select: { status: true, name: true, planId: true, subscription: { select: { plan: { select: { maxStaff: true } } } } } });
    if (tenant.status !== "ACTIVE") throw new HttpError(403, "BUSINESS_SUSPENDED", "This business is not accepting team invitations right now.");
    if (!invitation.branches.length) throw new HttpError(409, "INVITATION_BRANCHES_REQUIRED", "Ask the inviter to issue a new invitation with branch access.");
    const branchCount = await transaction.branch.count({ where: { tenantId: invitation.tenantId, id: { in: invitation.branches.map(({ branchId }) => branchId) }, isActive: true } });
    if (branchCount !== invitation.branches.length) throw new HttpError(409, "INVITATION_BRANCH_INACTIVE", "One of the invited branches is no longer available.");
    const plan = tenant.subscription?.plan ?? (tenant.planId ? await transaction.subscriptionPlan.findUnique({ where: { id: tenant.planId }, select: { maxStaff: true } }) : null);
    const activeCount = await transaction.membership.count({ where: { tenantId: invitation.tenantId, isActive: true } });
    let resolvedUserId = userId;
    if (newUser) {
      const createdUser = await transaction.user.create({ data: { email: invitation.email, name: input.name!, passwordHash: passwordHash! }, select: { id: true } });
      resolvedUserId = createdUser.id;
    }
    if (!resolvedUserId) throw new HttpError(401, "INVITATION_SIGN_IN_REQUIRED", "Sign in with the invited email address to accept this invitation.");
    const membership = await transaction.membership.findUnique({ where: { tenantId_userId: { tenantId: invitation.tenantId, userId: resolvedUserId } }, select: { id: true, isActive: true } });
    if (membership?.isActive) throw new HttpError(409, "MEMBERSHIP_EXISTS", "This account already has active access to this business.");
    if (plan?.maxStaff !== null && plan?.maxStaff !== undefined && activeCount >= plan.maxStaff) throw new HttpError(402, "PLAN_STAFF_LIMIT", "This business has reached its team member limit.");
    const newMembership = membership
      ? await transaction.membership.update({ where: { id: membership.id }, data: { role: invitation.role, isActive: true } })
      : await transaction.membership.create({ data: { tenantId: invitation.tenantId, userId: resolvedUserId, role: invitation.role } });
    await transaction.branchAssignment.deleteMany({ where: { membershipId: newMembership.id } });
    await transaction.branchAssignment.createMany({ data: invitation.branches.map(({ branchId }) => ({ tenantId: invitation.tenantId, membershipId: newMembership.id, branchId })), skipDuplicates: true });
    await transaction.teamInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await transaction.auditLog.create({ data: { userId: resolvedUserId, action: "team.invitation.accept", metadata: { tenantId: invitation.tenantId, invitationId: invitation.id, role: invitation.role, branchIds: invitation.branches.map(({ branchId }) => branchId) } } });
    return { userId: resolvedUserId, tenantId: invitation.tenantId, businessName: tenant.name, role: invitation.role };
  });
  const tokens = newUser ? await issueSession(result.userId, metadata) : undefined;
  return { ...result, tokens, newUser };
}
