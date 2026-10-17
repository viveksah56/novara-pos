import type { RequestHandler } from "express";

import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { sendSuccess } from "@lib/response.js";
import { changePassword, getAuthUser, getProfile, login, register, requestPasswordReset, resetPassword, revokeRefreshToken, rotateRefreshToken } from "@modules/auth/auth.service.js";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "@modules/auth/auth.schemas.js";
import { acceptTeamInvitation, getTeamInvitationPreview } from "@modules/tenancy/team-invitation.service.js";

const accessCookieName = "novara_access";
const refreshCookieName = "novara_refresh";
const refreshCookiePath = "/api/v1/auth";
const isProduction = env.isProd;

function sessionDestination(user: Awaited<ReturnType<typeof getProfile>>, requestedTenantId?: string) {
  if (user.isPlatformAdmin || user.platformRole === "SUPER_ADMIN") return { activeTenantId: null, homeRoute: "/admin" };
  if (user.platformRole === "SUPPORT_AGENT") return { activeTenantId: null, homeRoute: "/admin/support" };
  const activeMembership = user.memberships.find(({ tenant }) => tenant.id === requestedTenantId && tenant.status === "ACTIVE")
    ?? user.memberships.find(({ tenant }) => tenant.status === "ACTIVE");
  const homeRoute = activeMembership ? ({
    OWNER: "/dashboard", MANAGER: "/dashboard", CASHIER: "/pos", WAITER: "/tables",
    KITCHEN_STAFF: "/kitchen", INVENTORY_MANAGER: "/inventory",
  } as const)[activeMembership.role] : "/onboarding";
  return { activeTenantId: activeMembership?.tenant.id ?? null, homeRoute };
}

function setSessionCookies(response: Parameters<RequestHandler>[1], accessToken: string, refreshToken: string): void {
  response.cookie(accessCookieName, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env.ACCESS_TOKEN_MINUTES * 60 * 1000,
  });
  response.cookie(refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: refreshCookiePath,
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookies(response: Parameters<RequestHandler>[1]): void {
  response.clearCookie(accessCookieName, { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/" });
  response.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: refreshCookiePath,
  });
}

export const registerController: RequestHandler = async (request, response) => {
  const result = await register(request.body as RegisterInput, { ip: request.ip, userAgent: request.get("user-agent") });
  const user = await getProfile(result.userId);
  setSessionCookies(response, result.tokens.accessToken, result.tokens.refreshToken);
  sendSuccess(response, { user, ...sessionDestination(user) }, 201);
};

export const loginController: RequestHandler = async (request, response) => {
  const result = await login(request.body as LoginInput, { ip: request.ip, userAgent: request.get("user-agent") });
  const user = await getAuthUser(result.userId);
  setSessionCookies(response, result.tokens.accessToken, result.tokens.refreshToken);
  sendSuccess(response, { user, ...sessionDestination(user, request.get("x-tenant-id")) });
};

export const refreshController: RequestHandler = async (request, response) => {
  const refreshToken: unknown = request.cookies?.[refreshCookieName];
  if (typeof refreshToken !== "string") {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Your session has expired. Please sign in again.");
  }
  const tokens = await rotateRefreshToken(refreshToken, { ip: request.ip, userAgent: request.get("user-agent") });
  setSessionCookies(response, tokens.accessToken, tokens.refreshToken);
  sendSuccess(response, { authenticated: true });
};

export const logoutController: RequestHandler = async (request, response) => {
  const refreshToken: unknown = request.cookies?.[refreshCookieName];
  clearSessionCookies(response);
  await revokeRefreshToken(typeof refreshToken === "string" ? refreshToken : undefined, { ip: request.ip, userAgent: request.get("user-agent") });
  sendSuccess(response, { loggedOut: true });
};

export const meController: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  const user = await getProfile(userId);
  sendSuccess(response, { user, ...sessionDestination(user, request.get("x-tenant-id")) });
};

export const forgotPasswordController: RequestHandler = async (request, response) => {
  const { email } = request.body as { email: string };
  await requestPasswordReset(email, { ip: request.ip, userAgent: request.get("user-agent") });
  sendSuccess(response, { message: "If an account exists for that email, a reset link has been sent." });
};

export const resetPasswordController: RequestHandler = async (request, response) => {
  await resetPassword(request.body as ResetPasswordInput, { ip: request.ip, userAgent: request.get("user-agent") });
  clearSessionCookies(response);
  sendSuccess(response, { passwordReset: true });
};

export const changePasswordController: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  const body = request.body as { currentPassword: string; newPassword: string };
  await changePassword(userId, body.currentPassword, body.newPassword, { ip: request.ip, userAgent: request.get("user-agent") });
  clearSessionCookies(response);
  sendSuccess(response, { passwordChanged: true });
};

export const teamInvitationPreviewController: RequestHandler = async (request, response) => {
  const token = typeof request.params.token === "string" ? request.params.token : "";
  sendSuccess(response, { invitation: await getTeamInvitationPreview(token) });
};

export const acceptTeamInvitationController: RequestHandler = async (request, response) => {
  const result = await acceptTeamInvitation({ ...request.body, userId: request.auth?.userId }, { ip: request.ip, userAgent: request.get("user-agent") });
  if (result.tokens) setSessionCookies(response, result.tokens.accessToken, result.tokens.refreshToken);
  const user = await getAuthUser(result.userId);
  sendSuccess(response, { accepted: true, invitation: { tenantId: result.tenantId, businessName: result.businessName, role: result.role }, user, ...sessionDestination(user, result.tenantId) }, 200);
};
