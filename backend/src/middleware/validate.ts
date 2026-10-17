import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { HttpError } from "@lib/http-error.js";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body as unknown);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors as Record<string, string[]>;
      next(new HttpError(400, "VALIDATION_ERROR", "Please check the submitted fields.", details));
      return;
    }
    request.body = result.data;
    next();
  };
}
