import type { RequestHandler } from "express";

import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const csrfProtection: RequestHandler = (request, _response, next) => {
  if (!mutatingMethods.has(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  const forwardedHost = request.get("x-forwarded-host");
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    originHost = undefined;
  }

  if (
    !origin ||
    !env.CORS_ORIGIN.includes(origin) ||
    request.get("x-requested-with") !== "XMLHttpRequest" ||
    (forwardedHost && originHost !== forwardedHost)
  ) {
    next(new HttpError(403, "CSRF_REJECTED", "This request could not be verified."));
    return;
  }

  next();
};
