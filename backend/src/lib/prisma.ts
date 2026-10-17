import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/client/client.js";

import { env } from "@config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const prismaGlobal = globalThis as typeof globalThis & { novaraPrisma?: PrismaClient };

export const prisma = prismaGlobal.novaraPrisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  prismaGlobal.novaraPrisma = prisma;
}
