import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";
import type { PlatformRole } from "../../constants/system-constants.js";

export type { PlatformRole } from "../../constants/system-constants.js";

export async function getPlatformRole(userId: string): Promise<PlatformRole | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { email: true, platformStaff: { select: { role: true } } },
  });
  if (!user) return null;
  if (env.SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) return "SUPER_ADMIN";
  return user.platformStaff?.role ?? null;
}

export async function getPlatformOverview() {
  const [businesses, activeBusinesses, suspendedBusinesses, users, plans, unassignedBusinesses, recentBusinesses, subscriptions, trialsEndingSoon, pastDueSubscriptions] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count(),
    prisma.subscriptionPlan.count({ where: { isActive: true } }),
    prisma.tenant.count({ where: { planId: null } }),
    prisma.tenant.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: businessSelect }),
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, select: { plan: { select: { priceMonthly: true, currency: true } } } }),
    prisma.subscription.count({ where: { status: "TRIALING", trialEndsAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) } } }),
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
  ]);
  const revenueByCurrency = new Map<string, number>();
  for (const subscription of subscriptions) {
    const currency = subscription.plan.currency;
    revenueByCurrency.set(currency, (revenueByCurrency.get(currency) ?? 0) + Number(subscription.plan.priceMonthly));
  }
  const monthlyRecurringRevenue = [...revenueByCurrency].map(([currency, amount]) => ({ currency, amount }));
  return { metrics: { businesses, activeBusinesses, suspendedBusinesses, users, activePlans: plans, unassignedBusinesses, trialsEndingSoon, pastDueSubscriptions, monthlyRecurringRevenue }, recentBusinesses };
}

const businessSelect = {
  id: true, name: true, status: true, currency: true, planId: true, createdAt: true,
  plan: { select: { id: true, name: true, priceMonthly: true, currency: true } },
  _count: { select: { branches: true, memberships: true } },
} as const;

export async function listBusinesses(search = "") {
  return prisma.tenant.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: businessSelect,
  });
}

export async function getBusiness(id: string) {
  const business = await prisma.tenant.findUnique({
    where: { id },
    select: {
      ...businessSelect,
      branches: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, timezone: true, createdAt: true } },
      memberships: { orderBy: { createdAt: "asc" }, take: 25, select: { role: true, user: { select: { id: true, name: true, email: true, isActive: true } } } },
    },
  });
  if (!business) throw new HttpError(404, "BUSINESS_NOT_FOUND", "The business could not be found.");
  return business;
}

export async function updateBusiness(id: string, input: { status?: "ACTIVE" | "SUSPENDED"; planId?: string | null }) {
  if (input.planId) {
    const plan = await prisma.subscriptionPlan.findFirst({ where: { id: input.planId, isActive: true }, select: { id: true } });
    if (!plan) throw new HttpError(400, "PLAN_NOT_AVAILABLE", "Choose an active subscription plan.");
  }
  try {
    return await prisma.tenant.update({ where: { id }, data: input, select: businessSelect });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      throw new HttpError(404, "BUSINESS_NOT_FOUND", "The business could not be found.");
    }
    throw error;
  }
}

export async function listPlans() {
  return prisma.subscriptionPlan.findMany({
    orderBy: [{ isActive: "desc" }, { priceMonthly: "asc" }],
    include: { _count: { select: { tenants: true } } },
  });
}

export async function createPlan(input: {
  name: string; description?: string | null; priceMonthly: number; currency: string; trialDays: number; maxBranches: number | null; maxStaff: number | null;
}) {
  return prisma.subscriptionPlan.create({ data: input });
}

export async function updatePlan(id: string, input: Partial<{
  name: string; description: string | null; priceMonthly: number; currency: string; trialDays: number; maxBranches: number | null; maxStaff: number | null; isActive: boolean;
}>) {
  try {
    return await prisma.subscriptionPlan.update({ where: { id }, data: input, include: { _count: { select: { tenants: true } } } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      throw new HttpError(404, "PLAN_NOT_FOUND", "The plan could not be found.");
    }
    throw error;
  }
}

export async function deletePlan(id: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id }, select: { _count: { select: { tenants: true } } } });
  if (!plan) throw new HttpError(404, "PLAN_NOT_FOUND", "The plan could not be found.");
  if (plan._count.tenants > 0) throw new HttpError(409, "PLAN_IN_USE", "This plan is assigned to businesses. Deactivate it instead.");
  await prisma.subscriptionPlan.delete({ where: { id } });
  return { id, deleted: true as const };
}

export async function listSupportAgents() {
  return prisma.platformStaff.findMany({ where: { role: "SUPPORT_AGENT" }, orderBy: { createdAt: "desc" }, select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, isActive: true } } } });
}

export async function addSupportAgent(email: string) {
  const normalizedEmail = email.toLowerCase();
  if (env.SUPER_ADMIN_EMAILS.includes(normalizedEmail)) throw new HttpError(409, "SUPER_ADMIN_ACCOUNT", "A configured Super Admin cannot be assigned as a Support Agent.");
  const user = await prisma.user.findFirst({ where: { email: normalizedEmail, isActive: true }, select: { id: true } });
  if (!user) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Create the account first, then assign it as a Support Agent.");
  const existing = await prisma.platformStaff.findUnique({ where: { userId: user.id }, select: { role: true } });
  if (existing?.role === "SUPER_ADMIN") throw new HttpError(409, "SUPER_ADMIN_ACCOUNT", "A Super Admin cannot be changed to a Support Agent.");
  return prisma.platformStaff.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: "SUPPORT_AGENT" },
    update: { role: "SUPPORT_AGENT" },
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, isActive: true } } },
  });
}

export async function removeSupportAgent(userId: string) {
  const result = await prisma.platformStaff.deleteMany({ where: { userId, role: "SUPPORT_AGENT" } });
  if (!result.count) throw new HttpError(404, "SUPPORT_AGENT_NOT_FOUND", "The Support Agent could not be found.");
  return { userId, removed: true as const };
}

export async function searchPlatform(query: string, includePlans: boolean) {
  const [businesses, plans] = await Promise.all([
    prisma.tenant.findMany({ where: { name: { contains: query, mode: "insensitive" } }, take: 8, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true } }),
    includePlans ? prisma.subscriptionPlan.findMany({ where: { name: { contains: query, mode: "insensitive" }, isActive: true }, take: 5, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  return { businesses, plans };
}

export async function getSystemHealth() {
  const checkedAt = new Date().toISOString();
  let database: "operational" | "degraded" = "operational";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "degraded";
  }
  return {
    status: database === "operational" ? "operational" as const : "degraded" as const,
    services: [{ name: "API service", status: "operational" as const }, { name: "PostgreSQL", status: database }],
    runtime: { nodeVersion: process.version, uptimeSeconds: Math.floor(process.uptime()), environment: env.NODE_ENV },
    checkedAt,
  };
}

const ticketSelect = {
  id: true, tenantId: true, type: true, priority: true, status: true, subject: true, message: true, createdAt: true, updatedAt: true,
  tenant: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export async function createPlatformTicket(userId: string, input: { tenantId?: string; type: "COMPLAINT" | "FEEDBACK" | "SUPPORT"; subject: string; message: string }) {
  if (input.tenantId) {
    const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId: input.tenantId, userId } }, select: { id: true, isActive: true } });
    if (!membership?.isActive) throw new HttpError(403, "TENANT_ACCESS_DENIED", "You cannot submit a ticket for this business.");
  }
  return prisma.platformTicket.create({ data: { ...input, createdById: userId }, select: ticketSelect });
}

export async function listMyPlatformTickets(userId: string) {
  return prisma.platformTicket.findMany({ where: { createdById: userId }, orderBy: { createdAt: "desc" }, take: 100, select: ticketSelect });
}

export async function listTenantComplaints(userId: string, tenantId: string) {
  const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { role: true, isActive: true } });
  if (!membership?.isActive || !["OWNER", "MANAGER"].includes(membership.role)) {
    throw new HttpError(403, "ROLE_FORBIDDEN", "Only a business Owner or Manager can review its complaints.");
  }
  return prisma.platformTicket.findMany({ where: { tenantId, type: "COMPLAINT" }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 100, select: ticketSelect });
}

export async function updateTenantComplaint(userId: string, tenantId: string, ticketId: string, input: { status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" }) {
  const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { role: true, isActive: true } });
  if (!membership?.isActive || !["OWNER", "MANAGER"].includes(membership.role)) {
    throw new HttpError(403, "ROLE_FORBIDDEN", "Only a business Owner or Manager can update its complaints.");
  }
  const result = await prisma.platformTicket.updateMany({ where: { id: ticketId, tenantId, type: "COMPLAINT" }, data: input });
  if (!result.count) throw new HttpError(404, "COMPLAINT_NOT_FOUND", "The complaint could not be found in this business workspace.");
  return prisma.platformTicket.findUniqueOrThrow({ where: { id: ticketId }, select: ticketSelect });
}

export async function listPlatformTickets(search = "") {
  return prisma.platformTicket.findMany({ where: search ? { OR: [{ subject: { contains: search, mode: "insensitive" } }, { createdBy: { email: { contains: search, mode: "insensitive" } } }, { tenant: { name: { contains: search, mode: "insensitive" } } }] } : undefined, orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }], take: 200, select: ticketSelect });
}

export async function updatePlatformTicket(id: string, input: { status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"; priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" }, actorRole: PlatformRole) {
  const existing = await prisma.platformTicket.findUnique({ where: { id }, select: { type: true, tenantId: true } });
  if (!existing) throw new HttpError(404, "TICKET_NOT_FOUND", "The complaint or feedback item could not be found.");
  if (existing.type === "COMPLAINT" && existing.tenantId && actorRole !== "SUPER_ADMIN") {
    throw new HttpError(403, "BUSINESS_MANAGER_REQUIRED", "A Super Admin, business Owner, or Manager must update this complaint.");
  }
  try { return await prisma.platformTicket.update({ where: { id }, data: input, select: ticketSelect }); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") throw new HttpError(404, "TICKET_NOT_FOUND", "The complaint or feedback item could not be found.");
    throw error;
  }
}
