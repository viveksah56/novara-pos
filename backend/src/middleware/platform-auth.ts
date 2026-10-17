import type { RequestHandler } from "express";
import { HttpError } from "@lib/http-error.js";
import { getPlatformRole, type PlatformRole } from "@modules/platform/platform.service.js";

export function requirePlatformRole(...allowedRoles: PlatformRole[]): RequestHandler {
  return async (request, _response, next) => {
    const userId = request.auth?.userId;
    if (!userId) {
      next(new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue."));
      return;
    }
    try {
      const role = await getPlatformRole(userId);
      if (!role || !allowedRoles.includes(role)) {
        next(new HttpError(403, "PLATFORM_ACCESS_REQUIRED", "You do not have access to the platform console."));
        return;
      }
      request.platformRole = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}
