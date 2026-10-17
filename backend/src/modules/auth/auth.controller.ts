import type { RequestHandler } from "express";

import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { sendSuccess } from "@lib/response.js";
import { getAuthUser, getProfile, login, register, revokeRefreshToken, rotateRefreshToken } from "@modules/auth/auth.service.js";
import type { LoginInput, RegisterInput } from "@modules/auth/auth.schemas.js";

const accessCookieName = "novara_access";
const refreshCookieName = "novara_refresh";
const refreshCookiePath = "/api/v1/auth";
const isProduction = env.isProd;

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
  const result = await register(request.body as RegisterInput);
  const user = await getProfile(result.userId);
  setSessionCookies(response, result.tokens.accessToken, result.tokens.refreshToken);
  sendSuccess(response, { user }, 201);
};

export const loginController: RequestHandler = async (request, response) => {
  const result = await login(request.body as LoginInput);
  const user = await getAuthUser(result.userId);
  setSessionCookies(response, result.tokens.accessToken, result.tokens.refreshToken);
  sendSuccess(response, { user });
};

export const refreshController: RequestHandler = async (request, response) => {
  const refreshToken: unknown = request.cookies?.[refreshCookieName];
  if (typeof refreshToken !== "string") {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Your session has expired. Please sign in again.");
  }
  const tokens = await rotateRefreshToken(refreshToken);
  setSessionCookies(response, tokens.accessToken, tokens.refreshToken);
  sendSuccess(response, { authenticated: true });
};

export const logoutController: RequestHandler = async (request, response) => {
  const refreshToken: unknown = request.cookies?.[refreshCookieName];
  clearSessionCookies(response);
  await revokeRefreshToken(typeof refreshToken === "string" ? refreshToken : undefined);
  sendSuccess(response, { loggedOut: true });
};

export const meController: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  sendSuccess(response, { user: await getProfile(userId) });
};
