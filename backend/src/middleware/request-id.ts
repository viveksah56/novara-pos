import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestId: RequestHandler = (request, response, next) => {
  const suppliedId = request.get("x-request-id");
  const id = suppliedId && /^[\w-]{1,80}$/.test(suppliedId) ? suppliedId : randomUUID();
  request.id = id;
  response.setHeader("X-Request-Id", id);
  next();
};
