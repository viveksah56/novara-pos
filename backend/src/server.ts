import { createApp } from "./app.js";
import { env } from "@config/env.js";
import { logger } from "@lib/logger.js";
import { prisma } from "@lib/prisma.js";

const app = createApp();
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "API listening"));

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down API");

  server.close(async (error) => {
    if (error) logger.error({ err: error }, "HTTP server close failed");
    await prisma.$disconnect();
    process.exit(error ? 1 : 0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
