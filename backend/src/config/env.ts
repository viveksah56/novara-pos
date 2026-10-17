import { createHmac } from "node:crypto";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

const nodeEnv = process.env.NODE_ENV ?? "development";
const environmentFile = nodeEnv === "production" ? ".env.production" : nodeEnv === "test" ? ".env.test.local" : ".env.local";
loadDotEnv({ path: environmentFile });

function required(name: "DATABASE_URL" | "JWT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const nodeEnvironment = nodeEnvironmentSchema.parse(process.env.NODE_ENV ?? "development");
const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long.");

function tokenSecret(purpose: "access" | "refresh"): string {
  return createHmac("sha256", jwtSecret).update(`novara:${purpose}-token:v1`).digest("hex");
}

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

for (const origin of corsOrigins) {
  z.url().parse(origin);
}
const appOrigin = z.url().parse(process.env.APP_ORIGIN ?? corsOrigins[0] ?? "http://localhost:3000");

const positiveInteger = (value: string | undefined, fallback: number, name: string): number => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
};

export const env = {
  NODE_ENV: nodeEnvironment,
  PORT: positiveInteger(process.env.PORT, 8000, "PORT"),
  CORS_ORIGIN: corsOrigins,
  APP_ORIGIN: new URL(appOrigin).origin,
  RESEND_API_KEY: process.env.RESEND_API_KEY?.trim() || undefined,
  EMAIL_FROM: process.env.EMAIL_FROM?.trim() || "Novara <no-reply@novara.app>",
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: jwtSecret,
  ACCESS_TOKEN_SECRET: tokenSecret("access"),
  REFRESH_TOKEN_SECRET: tokenSecret("refresh"),
  ACCESS_TOKEN_MINUTES: positiveInteger(process.env.ACCESS_TOKEN_MINUTES, 15, "ACCESS_TOKEN_MINUTES"),
  REFRESH_TOKEN_DAYS: positiveInteger(process.env.REFRESH_TOKEN_DAYS, 14, "REFRESH_TOKEN_DAYS"),
  SUPER_ADMIN_EMAILS: (process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  /** @deprecated Use SUPER_ADMIN_EMAILS. */
  PLATFORM_ADMIN_EMAILS: (process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  isProd: nodeEnvironment === "production",
};

export type AppEnvironment = typeof env;
