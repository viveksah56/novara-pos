import { existsSync, readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/client/client.js";
import { Pool } from "pg";

import { env } from "@config/env.js";

const caPath = process.env.DATABASE_SSL_CA_PATH?.trim()
  || (env.NODE_ENV === "production" ? "/etc/secrets/supabase-root.crt" : undefined);

let adapter: PrismaPg;
if (caPath && existsSync(caPath)) {
  const connectionUrl = new URL(env.DATABASE_URL);
  for (const parameter of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword"]) {
    connectionUrl.searchParams.delete(parameter);
  }

  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: {
      ca: readFileSync(caPath, "utf8"),
      rejectUnauthorized: true,
    },
  });
  adapter = new PrismaPg(pool, { schema: "novara_database" });
} else {
  adapter = new PrismaPg({ connectionString: env.DATABASE_URL }, { schema: "novara_database" });
}

const prismaGlobal = globalThis as typeof globalThis & { novaraPrisma?: PrismaClient };

export const prisma = prismaGlobal.novaraPrisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  prismaGlobal.novaraPrisma = prisma;
}
