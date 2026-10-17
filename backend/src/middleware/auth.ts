import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const accessToken = request.cookies?.novara_access;

  if (typeof accessToken !== "string") {
    next(new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue."));
    return;
  }

  try {
    const payload = jwt.verify(accessToken, env.ACCESS_TOKEN_SECRET) as JwtPayload;
    if (typeof payload.sub !== "string") {
      throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }

    const activeUser = await prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
      select: { id: true },
    });

    if (!activeUser) {
      throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    }

    request.auth = { userId: activeUser.id };
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue."));
  }
};

export const optionalAuth: RequestHandler = async (request, _response, next) => {
  const accessToken = request.cookies?.novara_access;
  if (typeof accessToken !== "string") { next(); return; }
  try {
    const payload = jwt.verify(accessToken, env.ACCESS_TOKEN_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
    if (typeof payload.sub !== "string") { next(); return; }
    const activeUser = await prisma.user.findFirst({ where: { id: payload.sub, isActive: true }, select: { id: true } });
    if (activeUser) request.auth = { userId: activeUser.id };
  } catch {
    // Invitation acceptance can start a new session; invalid optional cookies are ignored.
  }
  next();
};
