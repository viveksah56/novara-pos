import type { ErrorRequestHandler } from "express";
import { Prisma } from "../../prisma/generated/client/client.js";
import { ZodError } from "zod";

import { logger } from "@lib/logger.js";
import { HttpError } from "@lib/http-error.js";

function isInvalidJsonBody(error: unknown): error is Error & { type: string } {
  return error instanceof Error && "type" in error && error.type === "entity.parse.failed";
}

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      data: null,
      status: "error",
      error: { code: error.code, message: error.message, details: error.details, requestId: request.id },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      data: null,
      status: "error",
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the submitted fields.",
        details: error.flatten().fieldErrors as Record<string, string[]>,
        requestId: request.id,
      },
    });
    return;
  }

  if (isInvalidJsonBody(error)) {
    response.status(400).json({
      data: null,
      status: "error",
      error: { code: "INVALID_JSON", message: "The request body must be valid JSON.", requestId: request.id },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({
      data: null,
      status: "error",
      error: { code: "RESOURCE_CONFLICT", message: "An account with this information already exists.", requestId: request.id },
    });
    return;
  }

  logger.error({ requestId: request.id, err: error }, "Unhandled request error");
  response.status(500).json({
    data: null,
    status: "error",
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again.", requestId: request.id },
  });
};
