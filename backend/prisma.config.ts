import { config as loadDotEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const nodeEnv = process.env.NODE_ENV ?? "development";
const environmentFile = nodeEnv === "production" ? ".env.production" : nodeEnv === "test" ? ".env.test.local" : ".env.local";
loadDotEnv({ path: environmentFile });

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the session-mode connection for schema changes. DATABASE_URL remains
    // the application runtime connection and may use Supavisor transaction mode.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
