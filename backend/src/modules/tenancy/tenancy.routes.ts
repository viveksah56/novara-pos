import { Router, type Request } from "express";
import { Prisma, type BusinessRole } from "../../../prisma/generated/client/client.js";
import { z } from "zod";

import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";
import { sendSuccess } from "@lib/response.js";
import { requireAuth } from "@middleware/auth.js";

const businessProfileSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  legalName: z.string().trim().max(180).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.union([z.email().max(320), z.literal("")]).nullable().transform((value) => value || null).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  logoUrl: z.union([z.url().max(1000), z.literal("")]).nullable().transform((value) => value || null).optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one business profile field to update.");
const branchSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, "Use 2 to 4 uppercase letters."),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kathmandu"),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  serviceChargeRate: z.coerce.number().min(0).max(100).optional(),
  taxRegistrationNumber: z.string().trim().max(80).nullable().optional(),
  receiptHeader: z.string().trim().max(500).nullable().optional(),
  receiptFooter: z.string().trim().max(500).nullable().optional(),
  businessDayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  allowNegativeStock: z.boolean().optional(),
  requireShift: z.boolean().optional(),
  requirePaymentReference: z.boolean().optional(),
  shiftVarianceTolerance: z.coerce.number().min(0).max(100_000_000).optional(),
  cashierMaxDiscountPercent: z.coerce.number().min(0).max(100).optional(),
});

function tenantIdFrom(request: Request): string {
  const candidate = request.params.tenantId ?? request.get("x-tenant-id") ?? request.query.tenantId;
  if (typeof candidate !== "string" || !z.uuid().safeParse(candidate).success) {
    throw new HttpError(400, "TENANT_CONTEXT_REQUIRED", "Select a business workspace and try again.");
  }
  return candidate;
}

function userIdFrom(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return userId;
}

type TenantContext = { id: string; role: BusinessRole; status: "ACTIVE" | "SUSPENDED"; currency: string; branchIds: string[] };
async function tenantContext(request: Request, roles?: BusinessRole[]): Promise<TenantContext> {
  const tenantId = tenantIdFrom(request);
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId: userIdFrom(request) } },
    select: {
      role: true,
      isActive: true,
      tenant: { select: { id: true, status: true, currency: true, branches: { where: { isActive: true }, select: { id: true } } } },
      branchAssignments: { where: { branch: { isActive: true } }, select: { branchId: true } },
    },
  });
  if (!membership) throw new HttpError(403, "TENANT_ACCESS_DENIED", "You do not have access to this business.");
  if (!membership.isActive) throw new HttpError(403, "MEMBERSHIP_INACTIVE", "Your access to this business has been deactivated.");
  if (membership.tenant.status !== "ACTIVE") throw new HttpError(403, "BUSINESS_SUSPENDED", "This business workspace is suspended.");
  if (roles && !roles.includes(membership.role)) throw new HttpError(403, "ROLE_FORBIDDEN", "Your role cannot perform this action.");
  return {
    id: tenantId,
    role: membership.role,
    status: membership.tenant.status,
    currency: membership.tenant.currency,
    branchIds: membership.role === "OWNER" ? membership.tenant.branches.map(({ id }) => id) : membership.branchAssignments.map(({ branchId }) => branchId),
  };
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function writeAudit(client: Prisma.TransactionClient, userId: string, action: string, metadata: Prisma.InputJsonObject, request: Request) {
  await client.auditLog.create({
    data: {
      userId,
      action,
      metadata,
      ip: request.ip?.slice(0, 64),
      userAgent: request.get("user-agent")?.slice(0, 512),
    },
  });
}

export const tenantRouter = Router();
tenantRouter.use(requireAuth);
tenantRouter.get("/current", async (request, response) => {
  const context = await tenantContext(request, ["OWNER", "MANAGER"]);
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: context.id },
    select: { id: true, name: true, slug: true, status: true, currency: true, legalName: true, phone: true, email: true, address: true, logoUrl: true, createdAt: true, updatedAt: true },
  });
  sendSuccess(response, { tenant });
});
tenantRouter.patch("/current", async (request, response) => {
  const context = await tenantContext(request, ["OWNER"]);
  const input = businessProfileSchema.parse(request.body);
  const tenant = await prisma.$transaction(async (transaction) => {
    const before = await transaction.tenant.findUniqueOrThrow({ where: { id: context.id } });
    const updated = await transaction.tenant.update({ where: { id: context.id }, data: input, select: { id: true, name: true, slug: true, status: true, currency: true, legalName: true, phone: true, email: true, address: true, logoUrl: true, updatedAt: true } });
    await writeAudit(transaction, userIdFrom(request), "tenant.update", { before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(updated)) }, request);
    return updated;
  });
  sendSuccess(response, { tenant });
});

export const branchRouter = Router({ mergeParams: true });
branchRouter.use(requireAuth);
branchRouter.get("/", async (request, response) => {
  const context = await tenantContext(request);
  const includeInactive = request.query.includeInactive === "true" && context.role === "OWNER";
  const branches = await prisma.branch.findMany({
    where: {
      tenantId: context.id,
      ...(includeInactive ? {} : { isActive: true }),
      ...(context.role === "OWNER" ? {} : { id: { in: context.branchIds } }),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  sendSuccess(response, { branches });
});

branchRouter.post("/", async (request, response) => {
  const context = await tenantContext(request, ["OWNER"]);
  const input = branchSettingsSchema.parse(request.body);
  if (!validTimezone(input.timezone)) throw new HttpError(400, "INVALID_TIMEZONE", "Choose a valid IANA time zone.", { timezone: ["Choose a valid IANA time zone."] });

  try {
    const branch = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "novara_database"."Tenant" WHERE "id" = ${context.id}::uuid FOR UPDATE`;
      const subscription = await transaction.subscription.findUnique({ where: { tenantId: context.id }, include: { plan: { select: { maxBranches: true } } } });
      const tenant = await transaction.tenant.findUniqueOrThrow({ where: { id: context.id }, select: { planId: true, currency: true } });
      const plan = subscription?.plan ?? (tenant.planId ? await transaction.subscriptionPlan.findUnique({ where: { id: tenant.planId }, select: { maxBranches: true } }) : null);
      const [activeCount, firstBranch] = await Promise.all([
        transaction.branch.count({ where: { tenantId: context.id, isActive: true } }),
        transaction.branch.findFirst({ where: { tenantId: context.id }, orderBy: { createdAt: "asc" } }),
      ]);
      const maxBranches = plan?.maxBranches ?? (plan ? null : 1);
      if (maxBranches !== null && activeCount >= maxBranches) throw new HttpError(402, "PLAN_LIMIT", `Your current plan allows ${maxBranches} active branch${maxBranches === 1 ? "" : "es"}. Upgrade your plan to add another.`);
      const inherited = firstBranch ? {
        currency: firstBranch.currency,
        taxRate: firstBranch.taxRate,
        taxInclusive: firstBranch.taxInclusive,
        serviceChargeRate: firstBranch.serviceChargeRate,
        taxRegistrationNumber: firstBranch.taxRegistrationNumber,
        receiptHeader: firstBranch.receiptHeader,
        receiptFooter: firstBranch.receiptFooter,
        businessDayStart: firstBranch.businessDayStart,
        allowNegativeStock: firstBranch.allowNegativeStock,
        requireShift: firstBranch.requireShift,
        requirePaymentReference: firstBranch.requirePaymentReference,
        shiftVarianceTolerance: firstBranch.shiftVarianceTolerance,
        cashierMaxDiscountPercent: firstBranch.cashierMaxDiscountPercent,
      } : { currency: tenant.currency };
      const { name, code, timezone, ...settings } = input;
      const createdBranch = await transaction.branch.create({
        data: { tenantId: context.id, name, code, timezone, ...inherited, ...settings, address: input.address ?? null, phone: input.phone ?? null },
      });
      await writeAudit(transaction, userIdFrom(request), "branch.create", { branchId: createdBranch.id, name: createdBranch.name, code: createdBranch.code }, request);
      return createdBranch;
    });
    sendSuccess(response, { branch }, 201);
  } catch (error) {
    if (isUniqueConstraint(error)) throw new HttpError(409, "BRANCH_CONFLICT", "A branch with this name or code already exists.", { code: ["Choose a unique branch name and code."] });
    throw error;
  }
});

branchRouter.get("/:id", async (request, response) => {
  const context = await tenantContext(request);
  const id = z.uuid().parse(request.params.id);
  const branch = await prisma.branch.findFirst({ where: { id, tenantId: context.id } });
  if (!branch || (context.role !== "OWNER" && (!branch.isActive || !context.branchIds.includes(branch.id)))) {
    throw new HttpError(404, "BRANCH_NOT_FOUND", "The branch could not be found.");
  }
  sendSuccess(response, { branch });
});

branchRouter.patch("/:id", async (request, response) => {
  const context = await tenantContext(request, ["OWNER"]);
  const id = z.uuid().parse(request.params.id);
  const input = branchSettingsSchema.partial().strict().parse(request.body);
  if (input.timezone && !validTimezone(input.timezone)) throw new HttpError(400, "INVALID_TIMEZONE", "Choose a valid IANA time zone.", { timezone: ["Choose a valid IANA time zone."] });
  try {
    const branch = await prisma.$transaction(async (transaction) => {
      const before = await transaction.branch.findFirst({ where: { id, tenantId: context.id } });
      if (!before) throw new HttpError(404, "BRANCH_NOT_FOUND", "The branch could not be found.");
      const updated = await transaction.branch.update({ where: { id }, data: input });
      await writeAudit(transaction, userIdFrom(request), "branch.update", { branchId: id, before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(updated)) }, request);
      return updated;
    });
    sendSuccess(response, { branch });
  } catch (error) {
    if (isUniqueConstraint(error)) throw new HttpError(409, "BRANCH_CONFLICT", "A branch with this name or code already exists.", { code: ["Choose a unique branch name and code."] });
    throw error;
  }
});

branchRouter.post("/:id/deactivate", async (request, response) => {
  const context = await tenantContext(request, ["OWNER"]);
  const id = z.uuid().parse(request.params.id);
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "novara_database"."Tenant" WHERE "id" = ${context.id}::uuid FOR UPDATE`;
    const branch = await transaction.branch.findFirst({ where: { id, tenantId: context.id } });
    if (!branch) throw new HttpError(404, "BRANCH_NOT_FOUND", "The branch could not be found.");
    if (!branch.isActive) return { branch, changed: false };
    const activeCount = await transaction.branch.count({ where: { tenantId: context.id, isActive: true } });
    if (activeCount <= 1) throw new HttpError(409, "LAST_ACTIVE_BRANCH", "At least one active branch must remain in this workspace.");
    const [openShift, openOrder] = await Promise.all([
      transaction.shift.findFirst({ where: { tenantId: context.id, branchId: id, status: "OPEN" }, select: { id: true } }),
      transaction.salesOrder.findFirst({ where: { tenantId: context.id, branchId: id, status: "OPEN" }, select: { id: true } }),
    ]);
    if (openShift || openOrder) throw new HttpError(409, "BRANCH_HAS_OPEN_OPERATIONS", "Close all shifts and open orders before deactivating this branch.");
    const updated = await transaction.branch.update({ where: { id }, data: { isActive: false } });
    await transaction.auditLog.create({ data: { userId: userIdFrom(request), action: "branch.deactivate", metadata: { branchId: id, name: branch.name }, ip: request.ip?.slice(0, 64), userAgent: request.get("user-agent")?.slice(0, 512) } });
    return { branch: updated, changed: true };
  });
  sendSuccess(response, { branch: result.branch, deactivated: !result.branch.isActive });
});
