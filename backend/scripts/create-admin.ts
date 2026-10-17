import bcrypt from "bcryptjs";
import { env } from "@config/env.js";
import { prisma } from "@lib/prisma.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Novara Platform Admin";

async function createAdmin() {
  if (!email || !password || !email.includes("@") || password.length < 16) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters) before running this command.");
  }
  if (!env.SUPER_ADMIN_EMAILS.includes(email)) {
    throw new Error("ADMIN_EMAIL must also be listed in SUPER_ADMIN_EMAILS.");
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new Error("That email already belongs to a user. This command will not replace existing credentials.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({ data: { name, email, passwordHash, emailVerifiedAt: new Date() }, select: { id: true } });
    await transaction.platformStaff.create({ data: { userId: user.id, role: "SUPER_ADMIN" } });
    await transaction.auditLog.create({ data: { userId: user.id, action: "platform.admin.create", metadata: { email } } });
  });
  console.info(`Created platform administrator ${email}. The password was not written to logs.`);
}

try {
  await createAdmin();
} finally {
  await prisma.$disconnect();
}
