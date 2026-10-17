import bcrypt from "bcryptjs";
import { env } from "@config/env.js";
import { prisma } from "@lib/prisma.js";
import { userSeedData } from "../prisma/data/user-seed-data.js";

const demoPassword = process.env.DEMO_PASSWORD;

const demoTenantId = "00000000-0000-4000-8000-000000000101";
const demoBranchId = "00000000-0000-4000-8000-000000000102";

const businessAccounts = userSeedData.filter((account) => account.scope === "BUSINESS");
const platformAccounts = userSeedData.filter((account) => account.scope === "PLATFORM");

async function seedDemoAccounts(): Promise<void> {
  const databaseHost = new URL(env.DATABASE_URL).hostname;
  if (env.isProd || !["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
    throw new Error("Demo accounts can only be seeded into a local development database.");
  }
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error("Set DEMO_PASSWORD in backend/.env.local to at least 12 characters.");
  }

  const accountIdsByEmail = new Map<string, string>(userSeedData.map(({ email, id }) => [email, id] as const));
  const existingAccounts = await prisma.user.findMany({
    where: { email: { in: [...accountIdsByEmail.keys()] } },
    select: { id: true, email: true },
  });
  const conflictingAccount = existingAccounts.find((account) => accountIdsByEmail.get(account.email) !== account.id);
  if (conflictingAccount) {
    throw new Error(`Refusing to overwrite an existing non-demo account: ${conflictingAccount.email}`);
  }

  const passwordHash = await bcrypt.hash(demoPassword, 12);

  await prisma.$transaction(async (transaction) => {
    await transaction.tenant.upsert({
      where: { id: demoTenantId },
      create: { id: demoTenantId, name: "Novara Demo Cafe", currency: "NPR" },
      update: { name: "Novara Demo Cafe", currency: "NPR", status: "ACTIVE" },
    });

    await transaction.branch.upsert({
      where: { id: demoBranchId },
      create: { id: demoBranchId, tenantId: demoTenantId, name: "Demo Branch", timezone: "Asia/Kathmandu" },
      update: { tenantId: demoTenantId, name: "Demo Branch", timezone: "Asia/Kathmandu" },
    });

    for (const account of businessAccounts) {
      const user = await transaction.user.upsert({
        where: { id: account.id },
        create: { id: account.id, name: account.name, email: account.email, passwordHash },
        update: { name: account.name, email: account.email, passwordHash, isActive: true },
        select: { id: true },
      });
      const membership = await transaction.membership.upsert({
        where: { tenantId_userId: { tenantId: demoTenantId, userId: user.id } },
        create: { tenantId: demoTenantId, userId: user.id, role: account.role },
        update: { role: account.role },
        select: { id: true, role: true },
      });

      if (membership.role !== "OWNER") {
        await transaction.branchAssignment.upsert({
          where: { membershipId_branchId: { membershipId: membership.id, branchId: demoBranchId } },
          create: { tenantId: demoTenantId, membershipId: membership.id, branchId: demoBranchId },
          update: { tenantId: demoTenantId },
        });
      }
    }

    for (const account of platformAccounts) {
      const user = await transaction.user.upsert({
        where: { id: account.id },
        create: { id: account.id, name: account.name, email: account.email, passwordHash },
        update: { name: account.name, email: account.email, passwordHash, isActive: true },
        select: { id: true },
      });
      await transaction.platformStaff.upsert({
        where: { userId: user.id },
        create: { userId: user.id, role: account.role },
        update: { role: account.role },
      });
    }
  });

  console.info(`Seeded ${userSeedData.length} Novara demo accounts across all business and platform roles in the local development database.`);
}

try {
  await seedDemoAccounts();
} finally {
  await prisma.$disconnect();
}
