import pino from "pino";

import { env } from "@config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: "novara-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: ["password", "*.password", "accessToken", "refreshToken", "*.cookie", "req.headers.cookie"],
    censor: "[REDACTED]",
  },
});
