import bcrypt from "bcryptjs";
import { env } from "@config/env.js";
import { prisma } from "@lib/prisma.js";

const demoPassword = process.env.DEMO_PASSWORD;

const demoTenantId = "00000000-0000-4000-8000-000000000101";
const demoBranchId = "00000000-0000-4000-8000-000000000102";

const demoAccounts = [
  { id: "00000000-0000-4000-8000-000000000201", name: "Novara Demo Owner", email: "owner@novara.test", role: "OWNER" },
  { id: "00000000-0000-4000-8000-000000000202", name: "Novara Demo Manager", email: "manager@novara.test", role: "MANAGER" },
  { id: "00000000-0000-4000-8000-000000000203", name: "Novara Demo Cashier", email: "cashier@novara.test", role: "CASHIER" },
  { id: "00000000-0000-4000-8000-000000000204", name: "Novara Demo Waiter", email: "waiter@novara.test", role: "WAITER" },
  { id: "00000000-0000-4000-8000-000000000205", name: "Novara Demo Kitchen", email: "kitchen@novara.test", role: "KITCHEN_STAFF" },
  { id: "00000000-0000-4000-8000-000000000206", name: "Novara Demo Inventory", email: "inventory@novara.test", role: "INVENTORY_MANAGER" },
] as const;
const demoSuperAdmin = { id: "00000000-0000-4000-8000-000000000207", name: "Novara Demo Super Admin", email: "admin@novara.test" };

async function seedDemoAccounts(): Promise<void> {
  const databaseHost = new URL(env.DATABASE_URL).hostname;
  if (env.isProd || !["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
    throw new Error("Demo accounts can only be seeded into a local development database.");
  }
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error("Set DEMO_PASSWORD in backend/.env.local to at least 12 characters.");
  }

  const accountIdsByEmail = new Map<string, string>([...demoAccounts.map(({ email, id }) => [email, id] as const), [demoSuperAdmin.email, demoSuperAdmin.id] as const]);
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

    for (const account of demoAccounts) {
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

    const platformAdmin = await transaction.user.upsert({
      where: { id: demoSuperAdmin.id },
      create: { id: demoSuperAdmin.id, name: demoSuperAdmin.name, email: demoSuperAdmin.email, passwordHash },
      update: { name: demoSuperAdmin.name, email: demoSuperAdmin.email, passwordHash, isActive: true },
      select: { id: true },
    });
    await transaction.platformStaff.upsert({
      where: { userId: platformAdmin.id },
      create: { userId: platformAdmin.id, role: "SUPER_ADMIN" },
      update: { role: "SUPER_ADMIN" },
    });
  });

  console.info(`Seeded ${demoAccounts.length} Novara demo business accounts and one platform Super Admin in the local development database.`);
}

try {
  await seedDemoAccounts();
} finally {
  await prisma.$disconnect();
}
