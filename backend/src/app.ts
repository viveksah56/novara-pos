import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "@config/env.js";
import { errorEnvelope } from "@lib/response.js";
import { errorHandler } from "@middleware/errors.js";
import { requestId } from "@middleware/request-id.js";
import { csrfProtection } from "@middleware/csrf.js";
import { apiRouter } from "@routes/index.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(csrfProtection);

  app.get("/health", (_request, response) => response.status(200).json({ data: { status: "ok" }, status: "success" }));
  app.get("/ready", async (_request, response, next) => {
    try {
      const { prisma } = await import("@lib/prisma.js");
      await prisma.$queryRaw`SELECT 1`;
      response.status(200).json({ data: { status: "ready" }, status: "success" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/", (_request, response) => response.status(200).json(
      { data: { status: "ok", message: "Welcome to CafeOS" }, status: "success" })
  );
  app.use("/api/v1", apiRouter);
  app.use((request, response) => {
    response.status(404).json(errorEnvelope("NOT_FOUND", "The requested endpoint was not found.", request.id));
  });
  app.use(errorHandler);

  return app;
}
