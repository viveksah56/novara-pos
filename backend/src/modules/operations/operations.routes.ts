import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "@lib/prisma.js";
import { HttpError } from "@lib/http-error.js";
import { sendSuccess } from "@lib/response.js";
import { requireAuth } from "@middleware/auth.js";
import { Prisma } from "../../../prisma/generated/client/client.js";
import { createTeamInvitation } from "@modules/tenancy/team-invitation.service.js";
import { businessDateKey, localBusinessDateRange } from "@lib/business-time.js";
import { BUSINESS_ROLE_VALUES, MEASURE_UNIT_VALUES, PAYMENT_METHOD_VALUES, STOCK_ADJUSTMENT_TYPE_VALUES, type BusinessRole } from "../../constants/system-constants.js";

const uuid = z.string().uuid();
const nonEmptyName = z.string().trim().min(2).max(160);
const categorySchema = z.object({ name: nonEmptyName, sortOrder: z.number().int().min(0).default(0), isActive: z.boolean().optional() });
const productSchema = z.object({ name: nonEmptyName, categoryId: uuid.nullable().optional(), description: z.string().trim().max(1000).nullable().optional(), sku: z.string().trim().max(80).nullable().optional(), price: z.number().min(0).max(100_000_000), isAvailable: z.boolean().default(true) });
const modifierOptionSchema = z.object({ id: uuid.optional(), name: z.string().trim().min(1).max(120), priceDelta: z.number().min(-100_000_000).max(100_000_000).default(0), isDefault: z.boolean().default(false), isActive: z.boolean().default(true), sortOrder: z.number().int().min(0).default(0), effects: z.array(z.object({ ingredientId: uuid, quantityDelta: z.number().finite() })).max(100).default([]) }).superRefine((option, context) => { if (new Set(option.effects.map((effect) => effect.ingredientId)).size !== option.effects.length) context.addIssue({ code: "custom", path: ["effects"], message: "An ingredient can only have one effect per option." }); });
const modifierGroupSchema = z.object({ name: z.string().trim().min(1).max(120), minSelect: z.number().int().min(0).max(20).default(0), maxSelect: z.number().int().min(1).max(20).default(1), sortOrder: z.number().int().min(0).default(0), isActive: z.boolean().default(true), options: z.array(modifierOptionSchema).min(1).max(100) }).superRefine((group, context) => { if (group.maxSelect < group.minSelect) context.addIssue({ code: "custom", path: ["maxSelect"], message: "Maximum selections cannot be less than minimum selections." }); if (new Set(group.options.map((option) => option.name.toLowerCase())).size !== group.options.length) context.addIssue({ code: "custom", path: ["options"], message: "Option names must be unique within a group." }); });
const ingredientSchema = z.object({ name: nonEmptyName, unit: z.enum(MEASURE_UNIT_VALUES), unitCost: z.number().min(0).max(100_000_000).nullable().optional(), isActive: z.boolean().optional() });
const supplierSchema = z.object({ name: nonEmptyName, email: z.email().nullable().optional(), phone: z.string().trim().max(40).nullable().optional(), address: z.string().trim().max(500).nullable().optional(), isActive: z.boolean().optional() });
const expenseCategorySchema = z.object({ name: z.string().trim().min(2).max(100), isActive: z.boolean().optional() });
const expenseSchema = z.object({ branchId: uuid, categoryId: uuid, amount: z.number().positive().max(100_000_000), expenseDate: z.iso.date(), description: z.string().trim().min(2).max(1000), paymentMethod: z.enum(PAYMENT_METHOD_VALUES), reference: z.string().trim().max(120).nullable().optional() });
const purchaseSchema = z.object({ branchId: uuid, supplierId: uuid, reference: z.string().trim().max(80).nullable().optional(), notes: z.string().trim().max(1000).nullable().optional(), items: z.array(z.object({ ingredientId: uuid, quantity: z.number().positive().max(999_999_999.999), unit: z.enum(MEASURE_UNIT_VALUES).default("EACH"), unitFactor: z.number().positive().max(999_999_999.999).default(1), unitCost: z.number().min(0).max(100_000_000) })).min(1).max(100) }).superRefine(({ items }, context) => {
  if (new Set(items.map((item) => item.ingredientId)).size !== items.length) context.addIssue({ code: "custom", path: ["items"], message: "Combine duplicate ingredients into one purchase line." });
});
const recipeSchema = z.object({ productId: uuid, notes: z.string().trim().max(1000).nullable().optional(), ingredients: z.array(z.object({ ingredientId: uuid, quantity: z.number().positive() })).min(1).max(100) });
const salesOrderSchema = z.object({ branchId: uuid, tableId: uuid.optional(), guestCount: z.number().int().min(1).max(100).optional(), clientCreatedAt: z.iso.datetime().optional(), clientOrderId: z.string().trim().min(8).max(80).optional(), items: z.array(z.object({ productId: uuid, quantity: z.number().positive().max(100), optionIds: z.array(uuid).max(20).default([]), note: z.string().trim().max(200).optional() })).min(1).max(100) });
const diningTableSchema = z.object({ branchId: uuid, name: z.string().trim().min(1).max(80), section: z.string().trim().max(100).nullable().optional(), seats: z.number().int().min(1).max(100).default(2), sortOrder: z.number().int().min(0).default(0), isActive: z.boolean().default(true) });

type TenantScope = { role: BusinessRole; branchIds: string[] };
async function tenantScope(userId: string, tenantId: string, roles?: BusinessRole[]): Promise<TenantScope> {
  const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { role: true, isActive: true, tenant: { select: { status: true, branches: { where: { isActive: true }, select: { id: true } } } }, branchAssignments: { where: { branch: { isActive: true } }, select: { branchId: true } } } });
  if (!membership) throw new HttpError(403, "TENANT_ACCESS_DENIED", "You do not have access to this business.");
  if (!membership.isActive) throw new HttpError(403, "MEMBERSHIP_INACTIVE", "Your access to this business has been deactivated.");
  if (membership.tenant.status !== "ACTIVE") throw new HttpError(403, "BUSINESS_SUSPENDED", "This business workspace is suspended.");
  if (roles && !roles.includes(membership.role)) throw new HttpError(403, "ROLE_FORBIDDEN", "Your role cannot perform this action.");
  return { role: membership.role, branchIds: membership.role === "OWNER" ? membership.tenant.branches.map(({ id }) => id) : membership.branchAssignments.map(({ branchId }) => branchId) };
}
async function branchAccess(tenantId: string, branchId: string, scope: TenantScope) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId, isActive: true } });
  if (!branch) throw new HttpError(404, "BRANCH_NOT_FOUND", "The branch could not be found.");
  if (scope.role !== "OWNER" && !scope.branchIds.includes(branchId)) throw new HttpError(404, "BRANCH_NOT_FOUND", "The branch could not be found.");
  return branch;
}
function params(request: Request) { return { tenantId: uuid.parse(request.params.tenantId), userId: request.auth?.userId }; }
function getUserId(userId: string | undefined) { if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue."); return userId; }
const ownerManager: BusinessRole[] = ["OWNER", "MANAGER"];
const inventoryRoles: BusinessRole[] = ["OWNER", "MANAGER", "INVENTORY_MANAGER"];
const orderRoles: BusinessRole[] = ["OWNER", "MANAGER", "CASHIER", "WAITER"];
const menuReadRoles: BusinessRole[] = ["OWNER", "MANAGER", "CASHIER", "WAITER", "INVENTORY_MANAGER"];
const paymentRoles: BusinessRole[] = ["OWNER", "MANAGER", "CASHIER"];
const expenseRoles: BusinessRole[] = ["OWNER", "MANAGER"];

export const operationsRouter = Router();
operationsRouter.use(requireAuth);

operationsRouter.get("/:tenantId/subscription", async (request, response) => {
  const { tenantId, userId } = params(request);
  await tenantScope(getUserId(userId), tenantId);
  const subscription = await prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
  sendSuccess(response, { subscription });
});
operationsRouter.post("/:tenantId/subscription", async (request, response) => {
  const { tenantId, userId } = params(request);
  await tenantScope(getUserId(userId), tenantId, ["OWNER"]);
  const { planId } = z.object({ planId: uuid }).parse(request.body);
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw new HttpError(404, "PLAN_NOT_AVAILABLE", "Choose an active subscription plan.");
  const now = new Date();
  const trialing = Number(plan.priceMonthly) > 0 && plan.trialDays > 0;
  if (Number(plan.priceMonthly) > 0 && !trialing) throw new HttpError(409, "PAYMENT_NOT_CONFIGURED", "Online checkout is not set up yet. Please contact Novara support to activate this plan.");
  const periodEnd = trialing ? new Date(now.getTime() + plan.trialDays * 86_400_000) : null;
  const subscription = await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenantId }, data: { planId: plan.id } });
    return tx.subscription.upsert({ where: { tenantId }, create: { tenantId, planId, status: trialing ? "TRIALING" : "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd, trialEndsAt: periodEnd }, update: { planId, status: trialing ? "TRIALING" : "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd, trialEndsAt: periodEnd, canceledAt: null }, include: { plan: true } });
  });
  sendSuccess(response, { subscription }, 201);
});

operationsRouter.get("/:tenantId/expense-categories", async (request, response) => {
  const { tenantId, userId } = params(request);
  await tenantScope(getUserId(userId), tenantId, expenseRoles);
  const categories = await prisma.expenseCategory.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  sendSuccess(response, { categories });
});
operationsRouter.post("/:tenantId/expense-categories", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  await tenantScope(actorId, tenantId, expenseRoles);
  const input = expenseCategorySchema.parse(request.body);
  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.expenseCategory.create({ data: { ...input, tenantId } });
    await tx.auditLog.create({ data: { userId: actorId, action: "expense.category.create", metadata: { tenantId, categoryId: created.id, name: created.name } } });
    return created;
  });
  sendSuccess(response, { category }, 201);
});
operationsRouter.get("/:tenantId/expenses", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, expenseRoles);
  const query = z.object({ branchId: uuid.optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), includeVoided: z.enum(["true", "false"]).optional() }).parse(request.query);
  if (query.branchId) await branchAccess(tenantId, query.branchId, scope);
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined;
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined;
  if (from && to && from > to) throw new HttpError(400, "INVALID_DATE_RANGE", "The start date must be before the end date.");
  const expenses = await prisma.expense.findMany({
    where: { tenantId, ...(query.branchId ? { branchId: query.branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }), ...(query.includeVoided === "true" ? {} : { voidedAt: null }), ...(from || to ? { expenseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    include: { category: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } }, voidedBy: { select: { id: true, name: true } } },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }], take: 1000,
  });
  sendSuccess(response, { expenses });
});
operationsRouter.post("/:tenantId/expenses", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, expenseRoles);
  const input = expenseSchema.parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  const expenseDate = new Date(`${input.expenseDate}T00:00:00.000Z`);
  const tomorrow = new Date(); tomorrow.setUTCHours(0, 0, 0, 0); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (expenseDate > tomorrow) throw new HttpError(400, "EXPENSE_DATE_IN_FUTURE", "Expense date cannot be more than one day in the future.");
  if (!await prisma.expenseCategory.findFirst({ where: { id: input.categoryId, tenantId, isActive: true } })) throw new HttpError(400, "INVALID_EXPENSE_CATEGORY", "Choose an active expense category in this business.");
  const expense = await prisma.$transaction(async (tx) => {
    const shift = input.paymentMethod === "CASH" ? await tx.shift.findFirst({ where: { tenantId, branchId: input.branchId, userId: actorId, status: "OPEN" }, orderBy: { openedAt: "desc" } }) : null;
    let cashMovementId: string | undefined;
    if (shift) {
      const movement = await tx.cashMovement.create({ data: { tenantId, branchId: input.branchId, shiftId: shift.id, type: "PAY_OUT", amount: input.amount, reference: input.reference, note: input.description, createdById: actorId } });
      await tx.shift.update({ where: { id: shift.id }, data: { expectedCash: { decrement: input.amount } } });
      cashMovementId = movement.id;
    }
    const created = await tx.expense.create({ data: { tenantId, branchId: input.branchId, categoryId: input.categoryId, amount: input.amount, expenseDate, description: input.description, paymentMethod: input.paymentMethod, reference: input.reference, createdById: actorId, ...(shift ? { shiftId: shift.id } : {}), ...(cashMovementId ? { cashMovementId } : {}) }, include: { category: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "expense.create", metadata: { tenantId, expenseId: created.id, branchId: input.branchId, amount: input.amount, paymentMethod: input.paymentMethod, cashMovementId } } });
    return created;
  });
  sendSuccess(response, { expense }, 201);
});
operationsRouter.post("/:tenantId/expenses/:id/void", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, expenseRoles);
  const id = uuid.parse(request.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(request.body);
  const expense = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Expense" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const row = await tx.expense.findFirst({ where: { id, tenantId }, include: { cashMovement: { include: { reversedBy: true, shift: { select: { status: true } } } } } });
    if (!row) throw new HttpError(404, "EXPENSE_NOT_FOUND", "Expense not found.");
    await branchAccess(tenantId, row.branchId, scope);
    if (row.voidedAt) throw new HttpError(409, "EXPENSE_ALREADY_VOIDED", "This expense has already been voided.");
    if (row.cashMovement && !row.cashMovement.reversedBy) {
      const reversal = await tx.cashMovement.create({ data: { tenantId, branchId: row.branchId, shiftId: row.cashMovement.shiftId, type: "PAY_IN", amount: row.cashMovement.amount, reference: `VOID-${row.id}`, note: `Reversal of expense: ${reason}`, reversalOfId: row.cashMovement.id, createdById: actorId } });
      if (row.cashMovement.shift.status === "OPEN") await tx.shift.update({ where: { id: row.cashMovement.shiftId }, data: { expectedCash: { increment: row.cashMovement.amount } } });
      void reversal;
    }
    const updated = await tx.expense.update({ where: { id }, data: { voidedAt: new Date(), voidedById: actorId, voidReason: reason }, include: { category: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true, email: true } }, voidedBy: { select: { id: true, name: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "expense.void", metadata: { tenantId, expenseId: id, reason } } });
    return updated;
  });
  sendSuccess(response, { expense });
});
operationsRouter.get("/:tenantId/reports/expenses", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, expenseRoles);
  const query = z.object({ branchId: uuid.optional(), from: z.iso.date(), to: z.iso.date() }).parse(request.query);
  if (query.branchId) await branchAccess(tenantId, query.branchId, scope);
  const from = new Date(`${query.from}T00:00:00.000Z`); const to = new Date(`${query.to}T23:59:59.999Z`);
  if (from > to) throw new HttpError(400, "INVALID_DATE_RANGE", "The start date must be before the end date.");
  const expenses = await prisma.expense.findMany({ where: { tenantId, voidedAt: null, expenseDate: { gte: from, lte: to }, ...(query.branchId ? { branchId: query.branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { category: { select: { id: true, name: true } } }, orderBy: { expenseDate: "asc" }, take: 10_000 });
  const totals = new Map<string, { categoryId: string; category: string; month: string; total: number }>();
  for (const expense of expenses) { const month = expense.expenseDate.toISOString().slice(0, 7); const key = `${month}:${expense.categoryId}`; const item = totals.get(key) ?? { categoryId: expense.categoryId, category: expense.category.name, month, total: 0 }; item.total += Number(expense.amount); totals.set(key, item); }
  sendSuccess(response, { range: { from, to }, total: expenses.reduce((sum, row) => sum + Number(row.amount), 0), byCategoryAndMonth: [...totals.values()].sort((a, b) => a.month.localeCompare(b.month) || b.total - a.total) });
});

operationsRouter.get("/:tenantId/team", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const memberships = await prisma.membership.findMany({ where: { tenantId, ...(scope.role === "MANAGER" ? { branchAssignments: { some: { branchId: { in: scope.branchIds } } } } : {}) }, include: { user: { select: { id: true, name: true, email: true, isActive: true } }, branchAssignments: { select: { branchId: true, branch: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } });
  sendSuccess(response, { memberships });
});
operationsRouter.get("/:tenantId/team/invitations", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const invitations = await prisma.teamInvitation.findMany({
    where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, ...(scope.role === "MANAGER" ? { branches: { some: { branchId: { in: scope.branchIds } } } } : {}) },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, branches: { select: { branchId: true, branch: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(response, { invitations });
});
operationsRouter.post("/:tenantId/team/invitations", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); const scope = await tenantScope(actorId, tenantId, ownerManager);
  const input = z.object({ email: z.email().transform((email) => email.toLowerCase()), role: z.enum(BUSINESS_ROLE_VALUES), branchIds: z.array(uuid).min(1).max(100) }).parse(request.body);
  if (scope.role === "MANAGER" && ["OWNER", "MANAGER"].includes(input.role)) throw new HttpError(403, "ROLE_FORBIDDEN", "Managers cannot invite Owners or other Managers.");
  if (scope.role === "MANAGER" && input.branchIds.some((id) => !scope.branchIds.includes(id))) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You can only invite staff to your branches.");
  const invitation = await createTeamInvitation({ tenantId, invitedById: actorId, ...input });
  sendSuccess(response, { invitation }, 201);
});
operationsRouter.delete("/:tenantId/team/invitations/:invitationId", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); const scope = await tenantScope(actorId, tenantId, ownerManager);
  const invitationId = uuid.parse(request.params.invitationId);
  const invitation = await prisma.teamInvitation.findFirst({ where: { id: invitationId, tenantId }, include: { branches: { select: { branchId: true } } } });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt) throw new HttpError(404, "INVITATION_NOT_FOUND", "Pending invitation not found.");
  if (scope.role === "MANAGER" && invitation.branches.some(({ branchId }) => !scope.branchIds.includes(branchId))) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You can only revoke invitations for your branches.");
  await prisma.$transaction(async (transaction) => {
    await transaction.teamInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
    await transaction.auditLog.create({ data: { userId: actorId, action: "team.invite.revoke", metadata: { tenantId, invitationId } } });
  });
  sendSuccess(response, { invitationId, revoked: true });
});
operationsRouter.patch("/:tenantId/team/:membershipId", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); const scope = await tenantScope(actorId, tenantId, ownerManager);
  const membershipId = uuid.parse(request.params.membershipId);
  const input = z.object({ role: z.enum(BUSINESS_ROLE_VALUES).optional(), branchIds: z.array(uuid).min(1).max(100).optional() }).refine((body) => body.role !== undefined || body.branchIds !== undefined).parse(request.body);
  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId }, select: { id: true, userId: true, role: true, branchAssignments: { select: { branchId: true } } } });
  if (!target) throw new HttpError(404, "MEMBERSHIP_NOT_FOUND", "Team member not found.");
  if (target.userId === actorId && input.role) throw new HttpError(409, "SELF_ROLE_CHANGE_FORBIDDEN", "You cannot change your own business role.");
  if (scope.role === "MANAGER" && (target.role === "OWNER" || target.role === "MANAGER" || input.role === "OWNER" || input.role === "MANAGER" || target.branchAssignments.some(({ branchId }) => !scope.branchIds.includes(branchId)))) throw new HttpError(403, "ROLE_FORBIDDEN", "You cannot manage this member or grant that role.");
  if (input.role === "OWNER" && scope.role !== "OWNER") throw new HttpError(403, "ROLE_FORBIDDEN", "Only an Owner can grant business ownership.");
  const branchIds = input.branchIds ?? target.branchAssignments.map(({ branchId }) => branchId);
  if (input.branchIds) {
    const branches = await prisma.branch.findMany({ where: { tenantId, id: { in: branchIds }, isActive: true }, select: { id: true } });
    if (branches.length !== new Set(branchIds).size) throw new HttpError(400, "INVALID_BRANCH", "Choose active branches from this business.");
    if (scope.role === "MANAGER" && branchIds.some((id) => !scope.branchIds.includes(id))) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You can only assign this member to your branches.");
  }
  if (input.role && input.role !== "OWNER" && branchIds.length === 0) throw new HttpError(400, "BRANCH_REQUIRED", "Assign at least one active branch to every non-owner team member.");
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "novara_database"."Tenant" WHERE "id" = ${tenantId}::uuid FOR UPDATE`;
    if (target.role === "OWNER" && input.role && input.role !== "OWNER" && await transaction.membership.count({ where: { tenantId, role: "OWNER", isActive: true } }) <= 1) throw new HttpError(409, "LAST_OWNER_REQUIRED", "A business must retain at least one active Owner.");
    const before = await transaction.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { branchAssignments: true } });
    const membership = await transaction.membership.update({ where: { id: membershipId }, data: { ...(input.role ? { role: input.role } : {}) } });
    if (input.branchIds) {
      await transaction.branchAssignment.deleteMany({ where: { membershipId } });
      await transaction.branchAssignment.createMany({ data: branchIds.map((branchId) => ({ tenantId, membershipId, branchId })), skipDuplicates: true });
    }
    await transaction.auditLog.create({ data: { userId: actorId, action: "team.member.update", metadata: { tenantId, membershipId, before: { role: before.role, branchIds: before.branchAssignments.map(({ branchId }) => branchId) }, after: { role: membership.role, branchIds } } } });
    return membership;
  });
  sendSuccess(response, { membership: await prisma.membership.findUniqueOrThrow({ where: { id: updated.id }, include: { user: { select: { id: true, name: true, email: true, isActive: true } }, branchAssignments: { include: { branch: { select: { name: true } } } } } }) });
});
operationsRouter.delete("/:tenantId/team/:membershipId", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); const scope = await tenantScope(actorId, tenantId, ownerManager);
  const membershipId = uuid.parse(request.params.membershipId);
  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId }, select: { id: true, userId: true, role: true, isActive: true, branchAssignments: { select: { branchId: true } } } });
  if (!target || !target.isActive) throw new HttpError(404, "MEMBERSHIP_NOT_FOUND", "Active team member not found.");
  if (target.userId === actorId) throw new HttpError(409, "SELF_DEACTIVATION_FORBIDDEN", "You cannot remove your own business access.");
  if (scope.role === "MANAGER" && (target.role === "OWNER" || target.role === "MANAGER" || target.branchAssignments.some(({ branchId }) => !scope.branchIds.includes(branchId)))) throw new HttpError(403, "ROLE_FORBIDDEN", "You cannot deactivate this team member.");
  if (await prisma.shift.findFirst({ where: { tenantId, userId: target.userId, status: "OPEN" }, select: { id: true } })) throw new HttpError(409, "OPEN_SHIFT_MUST_CLOSE", "Close this member’s open register shift before deactivating their access.");
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "novara_database"."Tenant" WHERE "id" = ${tenantId}::uuid FOR UPDATE`;
    if (target.role === "OWNER" && await transaction.membership.count({ where: { tenantId, role: "OWNER", isActive: true } }) <= 1) throw new HttpError(409, "LAST_OWNER_REQUIRED", "A business must retain at least one active Owner.");
    await transaction.membership.update({ where: { id: membershipId }, data: { isActive: false } });
    await transaction.auditLog.create({ data: { userId: actorId, action: "team.member.deactivate", metadata: { tenantId, membershipId, memberId: target.userId } } });
  });
  sendSuccess(response, { membershipId, isActive: false });
});
operationsRouter.post("/:tenantId/team/:membershipId/reactivate", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); const scope = await tenantScope(actorId, tenantId, ownerManager);
  const membershipId = uuid.parse(request.params.membershipId);
  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId }, select: { id: true, role: true, isActive: true, branchAssignments: { select: { branchId: true } } } });
  if (!target) throw new HttpError(404, "MEMBERSHIP_NOT_FOUND", "Team member not found.");
  if (target.isActive) throw new HttpError(409, "MEMBERSHIP_ALREADY_ACTIVE", "This member already has active access.");
  if (scope.role === "MANAGER" && (target.role === "OWNER" || target.role === "MANAGER" || target.branchAssignments.some(({ branchId }) => !scope.branchIds.includes(branchId)))) throw new HttpError(403, "ROLE_FORBIDDEN", "You cannot reactivate this team member.");
  if (!target.branchAssignments.length || await prisma.branch.count({ where: { tenantId, id: { in: target.branchAssignments.map(({ branchId }) => branchId) }, isActive: true } }) === 0) throw new HttpError(409, "ACTIVE_BRANCH_REQUIRED", "Assign at least one active branch before restoring this member.");
  await prisma.$transaction(async (transaction) => {
    await transaction.membership.update({ where: { id: membershipId }, data: { isActive: true } });
    await transaction.auditLog.create({ data: { userId: actorId, action: "team.member.reactivate", metadata: { tenantId, membershipId } } });
  });
  sendSuccess(response, { membershipId, isActive: true });
});

operationsRouter.get("/:tenantId/categories", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, menuReadRoles); sendSuccess(response, { categories: await prisma.category.findMany({ where: { tenantId }, include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }) }); });
operationsRouter.post("/:tenantId/categories", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const input = categorySchema.parse(request.body); sendSuccess(response, { category: await prisma.category.create({ data: { ...input, tenantId } }) }, 201); });
operationsRouter.patch("/:tenantId/categories/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const id = uuid.parse(request.params.id); const input = categorySchema.partial().extend({ isActive: z.boolean().optional() }).parse(request.body); const result = await prisma.category.updateMany({ where: { id, tenantId }, data: input }); if (!result.count) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found."); sendSuccess(response, { category: await prisma.category.findUniqueOrThrow({ where: { id } }) }); });
operationsRouter.delete("/:tenantId/categories/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ["OWNER"]); const id = uuid.parse(request.params.id); const result = await prisma.category.deleteMany({ where: { id, tenantId } }); if (!result.count) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found."); sendSuccess(response, { id, deleted: true }); });

operationsRouter.get("/:tenantId/products", async (request, response) => {
  const { tenantId, userId } = params(request);
  await tenantScope(getUserId(userId), tenantId, menuReadRoles);
  const products = await prisma.product.findMany({
    where: { tenantId },
    include: {
      category: { select: { id: true, name: true } },
      recipe: { include: { ingredients: { select: { ingredientId: true, quantity: true } } } },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          group: {
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
                include: { recipeEffects: { include: { ingredient: { select: { id: true, name: true, unit: true, unitCost: true } } } } },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  sendSuccess(response, { products });
});
operationsRouter.post("/:tenantId/products", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const input = productSchema.parse(request.body); if (input.categoryId && !await prisma.category.findFirst({ where: { id: input.categoryId, tenantId } })) throw new HttpError(400, "INVALID_CATEGORY", "Choose a category in this business."); sendSuccess(response, { product: await prisma.product.create({ data: { ...input, tenantId } }) }, 201); });
operationsRouter.patch("/:tenantId/products/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const id = uuid.parse(request.params.id); const input = productSchema.partial().parse(request.body); if (input.categoryId && !await prisma.category.findFirst({ where: { id: input.categoryId, tenantId } })) throw new HttpError(400, "INVALID_CATEGORY", "Choose a category in this business."); const result = await prisma.product.updateMany({ where: { id, tenantId }, data: input }); if (!result.count) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found."); sendSuccess(response, { product: await prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true } }) }); });
operationsRouter.delete("/:tenantId/products/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const id = uuid.parse(request.params.id); const result = await prisma.product.deleteMany({ where: { id, tenantId } }); if (!result.count) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found."); sendSuccess(response, { id, deleted: true }); });

operationsRouter.get("/:tenantId/modifier-groups", async (request, response) => {
  const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, menuReadRoles);
  const groups = await prisma.modifierGroup.findMany({
    where: { tenantId },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: { recipeEffects: { include: { ingredient: { select: { id: true, name: true, unit: true } } } } },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  sendSuccess(response, { groups });
});
operationsRouter.post("/:tenantId/modifier-groups", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); await tenantScope(actorId, tenantId, ownerManager);
  const input = modifierGroupSchema.parse(request.body);
  const ingredientIds = [...new Set(input.options.flatMap((option) => option.effects.map((effect) => effect.ingredientId)))];
  if (ingredientIds.length && await prisma.ingredient.count({ where: { tenantId, id: { in: ingredientIds } } }) !== ingredientIds.length) throw new HttpError(400, "INVALID_INGREDIENT", "Modifier effects must use ingredients from this business.");
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.modifierGroup.create({ data: { tenantId, name: input.name, minSelect: input.minSelect, maxSelect: input.maxSelect, sortOrder: input.sortOrder, isActive: input.isActive, options: { create: input.options.map(({ name, priceDelta, isDefault, isActive, sortOrder, effects }) => ({ name, priceDelta, isDefault, isActive, sortOrder, recipeEffects: { create: effects.map((effect) => ({ ingredientId: effect.ingredientId, quantityDelta: effect.quantityDelta })) } })) } }, include: { options: { include: { recipeEffects: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "menu.modifier_group.create", metadata: { tenantId, groupId: created.id } } });
    return created;
  });
  sendSuccess(response, { group }, 201);
});
operationsRouter.patch("/:tenantId/modifier-groups/:id", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); await tenantScope(actorId, tenantId, ownerManager);
  const id = uuid.parse(request.params.id);
  const input = modifierGroupSchema.partial().extend({ options: modifierGroupSchema.shape.options.optional() }).refine((value) => value.name !== undefined || value.minSelect !== undefined || value.maxSelect !== undefined || value.sortOrder !== undefined || value.isActive !== undefined || value.options !== undefined).parse(request.body);
  const before = await prisma.modifierGroup.findFirst({ where: { id, tenantId }, include: { options: true } });
  if (!before) throw new HttpError(404, "MODIFIER_GROUP_NOT_FOUND", "Modifier group not found.");
  const minSelect = input.minSelect ?? before.minSelect; const maxSelect = input.maxSelect ?? before.maxSelect;
  if (maxSelect < minSelect) throw new HttpError(400, "INVALID_SELECTION_RANGE", "Maximum selections cannot be less than minimum selections.");
  if (input.options) {
    const ingredientIds = [...new Set(input.options.flatMap((option) => option.effects.map((effect) => effect.ingredientId)))];
    if (ingredientIds.length && await prisma.ingredient.count({ where: { tenantId, id: { in: ingredientIds } } }) !== ingredientIds.length) throw new HttpError(400, "INVALID_INGREDIENT", "Modifier effects must use ingredients from this business.");
  }
  const group = await prisma.$transaction(async (tx) => {
    const updated = await tx.modifierGroup.update({ where: { id }, data: { name: input.name, minSelect: input.minSelect, maxSelect: input.maxSelect, sortOrder: input.sortOrder, isActive: input.isActive, ...(input.options ? { options: { deleteMany: {}, create: input.options.map(({ name, priceDelta, isDefault, isActive, sortOrder, effects }) => ({ name, priceDelta, isDefault, isActive, sortOrder, recipeEffects: { create: effects.map((effect) => ({ ingredientId: effect.ingredientId, quantityDelta: effect.quantityDelta })) } })) } } : {}) }, include: { options: { include: { recipeEffects: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "menu.modifier_group.update", metadata: { tenantId, groupId: id } } });
    return updated;
  });
  sendSuccess(response, { group });
});
operationsRouter.put("/:tenantId/products/:id/modifier-groups", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); await tenantScope(actorId, tenantId, ownerManager);
  const productId = uuid.parse(request.params.id); const { groupIds } = z.object({ groupIds: z.array(uuid).max(50) }).parse(request.body);
  if (new Set(groupIds).size !== groupIds.length) throw new HttpError(400, "DUPLICATE_MODIFIER_GROUP", "Each modifier group can be attached only once.");
  const [product, groupCount] = await Promise.all([prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } }), prisma.modifierGroup.count({ where: { id: { in: groupIds }, tenantId, isActive: true } })]);
  if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  if (groupCount !== groupIds.length) throw new HttpError(400, "INVALID_MODIFIER_GROUP", "Choose active modifier groups from this business.");
  await prisma.$transaction(async (tx) => {
    await tx.productModifierGroup.deleteMany({ where: { productId } });
    if (groupIds.length) await tx.productModifierGroup.createMany({ data: groupIds.map((groupId, sortOrder) => ({ productId, groupId, sortOrder })) });
    await tx.auditLog.create({ data: { userId: actorId, action: "menu.product.modifiers.update", metadata: { tenantId, productId, groupIds } } });
  });
  sendSuccess(response, { modifierGroups: await prisma.productModifierGroup.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, include: { group: { include: { options: true } } } }) });
});
operationsRouter.put("/:tenantId/modifier-options/:id/recipe", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId); await tenantScope(actorId, tenantId, ownerManager);
  const optionId = uuid.parse(request.params.id); const { effects } = z.object({ effects: z.array(z.object({ ingredientId: uuid, quantityDelta: z.number().finite() })).max(100) }).parse(request.body);
  if (new Set(effects.map((effect) => effect.ingredientId)).size !== effects.length) throw new HttpError(400, "DUPLICATE_INGREDIENT_EFFECT", "Use one effect per ingredient.");
  const option = await prisma.modifierOption.findFirst({ where: { id: optionId, group: { tenantId } }, select: { id: true } });
  if (!option) throw new HttpError(404, "MODIFIER_OPTION_NOT_FOUND", "Modifier option not found.");
  const ingredientIds = [...new Set(effects.map((effect) => effect.ingredientId))];
  if (ingredientIds.length && await prisma.ingredient.count({ where: { tenantId, id: { in: ingredientIds } } }) !== ingredientIds.length) throw new HttpError(400, "INVALID_INGREDIENT", "Modifier effects must use ingredients from this business.");
  await prisma.$transaction(async (tx) => {
    await tx.modifierOptionRecipeItem.deleteMany({ where: { optionId } });
    if (effects.length) await tx.modifierOptionRecipeItem.createMany({ data: effects.map((effect) => ({ optionId, ingredientId: effect.ingredientId, quantityDelta: effect.quantityDelta })) });
    await tx.auditLog.create({ data: { userId: actorId, action: "menu.modifier_option.recipe.update", metadata: { tenantId, optionId, effects } } });
  });
  sendSuccess(response, { option: await prisma.modifierOption.findUniqueOrThrow({ where: { id: optionId }, include: { recipeEffects: { include: { ingredient: true } } } }) });
});

operationsRouter.get("/:tenantId/ingredients", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, inventoryRoles); sendSuccess(response, { ingredients: await prisma.ingredient.findMany({ where: { tenantId }, orderBy: { name: "asc" } }) }); });
operationsRouter.post("/:tenantId/ingredients", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, inventoryRoles); sendSuccess(response, { ingredient: await prisma.ingredient.create({ data: { ...ingredientSchema.parse(request.body), tenantId } }) }, 201); });
operationsRouter.patch("/:tenantId/ingredients/:id", async (request, response) => {
  const { tenantId, userId } = params(request);
  await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const input = ingredientSchema.partial().parse(request.body);
  const update = await prisma.ingredient.updateMany({ where: { id, tenantId }, data: input });
  if (!update.count) throw new HttpError(404, "INGREDIENT_NOT_FOUND", "Ingredient not found.");
  sendSuccess(response, { ingredient: await prisma.ingredient.findUniqueOrThrow({ where: { id } }) });
});
operationsRouter.get("/:tenantId/recipes", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ["OWNER", "MANAGER", "INVENTORY_MANAGER"]); sendSuccess(response, { recipes: await prisma.recipe.findMany({ where: { tenantId }, include: { product: { select: { id: true, name: true } }, ingredients: { include: { ingredient: { select: { id: true, name: true, unit: true } } } } }, orderBy: { updatedAt: "desc" } }) }); });
operationsRouter.put("/:tenantId/recipes", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const input = recipeSchema.parse(request.body); if (!await prisma.product.findFirst({ where: { id: input.productId, tenantId } })) throw new HttpError(400, "INVALID_PRODUCT", "Choose a product in this business."); const ingredientCount = await prisma.ingredient.count({ where: { id: { in: input.ingredients.map(({ ingredientId }) => ingredientId) }, tenantId } }); if (ingredientCount !== new Set(input.ingredients.map(({ ingredientId }) => ingredientId)).size) throw new HttpError(400, "INVALID_INGREDIENT", "One or more ingredients do not belong to this business."); const recipe = await prisma.recipe.upsert({ where: { productId: input.productId }, create: { tenantId, productId: input.productId, notes: input.notes, ingredients: { create: input.ingredients } }, update: { notes: input.notes, ingredients: { deleteMany: {}, create: input.ingredients } }, include: { ingredients: { include: { ingredient: true } }, product: true } }); sendSuccess(response, { recipe }); });

operationsRouter.get("/:tenantId/orders", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const orders = await prisma.salesOrder.findMany({
    where: {
      tenantId,
      ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }),
    },
    include: {
      branch: { select: { id: true, name: true } },
      createdBy: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: { tenantId, isActive: true },
            select: { role: true },
            take: 1,
          },
        },
      },
      table: { select: { id: true, name: true, section: true } },
      items: { include: { modifiers: true, product: { select: { id: true, name: true, sku: true } } } },
      ...(scope.role === "CASHIER" ? { payments: { where: { createdById: getUserId(userId) }, select: { createdById: true, method: true, amount: true, createdAt: true } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  sendSuccess(response, {
    orders: orders.map(({ createdBy, ...order }) => ({
      ...order,
      createdBy: { id: createdBy.id, name: createdBy.name, role: createdBy.memberships[0]?.role ?? null },
    })),
  });
});

operationsRouter.get("/:tenantId/tables", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const tables = await prisma.diningTable.findMany({
    where: { tenantId, isActive: true, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) },
    include: { branch: { select: { id: true, name: true } }, orders: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 1, select: { id: true, status: true, totalAmount: true, billRequestedAt: true, createdAt: true, guestCount: true, createdBy: { select: { id: true, name: true } } } } },
    orderBy: [{ branchId: "asc" }, { section: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  sendSuccess(response, { tables: tables.map(({ orders, ...table }) => ({ ...table, status: !orders[0] ? "FREE" : orders[0].billRequestedAt ? "BILL_REQUESTED" : "OCCUPIED", openOrder: orders[0] ?? null })) });
});

operationsRouter.post("/:tenantId/tables", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ownerManager);
  const input = diningTableSchema.parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  const table = await prisma.diningTable.create({ data: { ...input, tenantId } });
  sendSuccess(response, { table }, 201);
});

operationsRouter.patch("/:tenantId/tables/:id", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ownerManager);
  const id = uuid.parse(request.params.id);
  const input = diningTableSchema.omit({ branchId: true }).partial().refine((value) => Object.keys(value).length > 0).parse(request.body);
  const current = await prisma.diningTable.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!current) throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found.");
  await branchAccess(tenantId, current.branchId, scope);
  if (input.isActive === false && await prisma.salesOrder.findFirst({ where: { tableId: id, status: "OPEN" }, select: { id: true } })) throw new HttpError(409, "TABLE_HAS_OPEN_ORDER", "Close or move the open order before deactivating this table.");
  const table = await prisma.diningTable.update({ where: { id }, data: input });
  sendSuccess(response, { table });
});

operationsRouter.post("/:tenantId/orders", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, orderRoles);
  const requestBody = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const input = salesOrderSchema.parse({ ...requestBody, clientOrderId: request.get("Idempotency-Key") ?? requestBody.clientOrderId ?? undefined, clientCreatedAt: request.get("X-Offline-Created-At") ?? requestBody.clientCreatedAt ?? undefined });
  const branch = await branchAccess(tenantId, input.branchId, scope);
  const offlineOrigin = request.get("X-Offline-Order") === "1";
  const serverNow = new Date();
  const requestedCreationTime = input.clientCreatedAt ? new Date(input.clientCreatedAt) : serverNow;
  const oldestAllowedTime = serverNow.getTime() - 7 * 86_400_000;
  const createdAt = offlineOrigin ? new Date(Math.min(serverNow.getTime(), Math.max(oldestAllowedTime, requestedCreationTime.getTime()))) : serverNow;
  if (input.tableId) {
    const table = await prisma.diningTable.findFirst({ where: { id: input.tableId, tenantId, branchId: input.branchId, isActive: true }, select: { id: true } });
    if (!table) throw new HttpError(404, "TABLE_NOT_FOUND", "Choose an active table in this branch.");
  }
  if (input.clientOrderId) {
    const existing = await prisma.salesOrder.findUnique({ where: { tenantId_clientOrderId: { tenantId, clientOrderId: input.clientOrderId } }, include: { items: { include: { modifiers: { select: { optionId: true } }, product: { select: { id: true, name: true, sku: true } } } }, branch: { select: { id: true, name: true } }, createdBy: { select: { id: true } } } });
    if (existing) {
      await branchAccess(tenantId, existing.branchId, scope);
      const expectedItems = input.items.map((item) => ({ productId: item.productId, quantity: item.quantity, optionIds: [...item.optionIds].sort(), note: item.note ?? null })).sort((left, right) => left.productId.localeCompare(right.productId));
      const actualItems = existing.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), optionIds: item.modifiers.map((modifier) => modifier.optionId).filter((id): id is string => Boolean(id)).sort(), note: item.note ?? null })).sort((left, right) => left.productId.localeCompare(right.productId));
      const sameItems = JSON.stringify(expectedItems) === JSON.stringify(actualItems);
      if (existing.branchId !== input.branchId || existing.createdBy.id !== actorId || (existing.tableId ?? undefined) !== input.tableId || !sameItems) throw new HttpError(422, "IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used for a different order.");
      return sendSuccess(response, { order: existing });
    }
  }

  const productIds = [...new Set(input.items.map(({ productId }) => productId))];
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds }, isAvailable: true },
    include: {
      recipe: { include: { ingredients: { include: { ingredient: { select: { id: true, unitCost: true } } } } } },
      modifierGroups: {
        where: { group: { isActive: true } },
        include: {
          group: {
            include: {
              options: {
                where: { isActive: true },
                include: { recipeEffects: { include: { ingredient: { select: { id: true, name: true, unitCost: true } } } } },
              },
            },
          },
        },
      },
    },
  });
  if (products.length !== productIds.length) throw new HttpError(400, "INVALID_PRODUCT", "One or more products are unavailable in this business.");

  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
  const productById = new Map(products.map((product) => [product.id, product]));
  const items = input.items.map((requested) => {
    const product = productById.get(requested.productId)!;
    const optionIds = new Set(requested.optionIds);
    if (optionIds.size !== requested.optionIds.length) throw new HttpError(400, "DUPLICATE_MODIFIER_OPTION", "Select each modifier option once.");
    const groups = product.modifierGroups.map(({ group }) => group);
    const selectedOptions = groups.flatMap((group) => group.options.filter((option) => optionIds.has(option.id)).map((option) => ({ group, option })));
    if (selectedOptions.length !== optionIds.size) throw new HttpError(400, "INVALID_MODIFIER_OPTION", "One or more options are not available for this product.");
    for (const group of groups) {
      const selectedCount = selectedOptions.filter(({ group: selectedGroup }) => selectedGroup.id === group.id).length;
      if (selectedCount < group.minSelect || selectedCount > group.maxSelect) throw new HttpError(400, "MODIFIER_SELECTION_REQUIRED", `Choose between ${group.minSelect} and ${group.maxSelect} options for ${group.name}.`);
    }
    const unitPrice = Number(product.price) + selectedOptions.reduce((sum, { option }) => sum + Number(option.priceDelta), 0);
    if (unitPrice < 0) throw new HttpError(400, "INVALID_MODIFIER_PRICE", "Modifier choices cannot make an item price negative.");
    const consumption = new Map<string, { quantity: number; unitCost: number | null }>();
    for (const line of product.recipe?.ingredients ?? []) consumption.set(line.ingredientId, { quantity: (consumption.get(line.ingredientId)?.quantity ?? 0) + Number(line.quantity), unitCost: line.ingredient.unitCost === null ? null : Number(line.ingredient.unitCost) });
    for (const { option } of selectedOptions) for (const effect of option.recipeEffects) consumption.set(effect.ingredientId, { quantity: (consumption.get(effect.ingredientId)?.quantity ?? 0) + Number(effect.quantityDelta), unitCost: effect.ingredient.unitCost === null ? null : Number(effect.ingredient.unitCost) });
    const effectiveConsumption = [...consumption.values()];
    if (effectiveConsumption.some(({ quantity }) => quantity < -0.0005)) throw new HttpError(400, "INVALID_RECIPE_EFFECT", "Selected modifier effects reduce an ingredient below zero.");
    const costIsKnown = effectiveConsumption.length > 0 && effectiveConsumption.every(({ quantity, unitCost }) => quantity <= 0.0005 || unitCost !== null);
    const unitCost = costIsKnown ? effectiveConsumption.reduce((sum, line) => sum + Math.max(0, line.quantity) * (line.unitCost ?? 0), 0) : null;
    return {
      productId: requested.productId,
      quantity: requested.quantity,
      unitPrice,
      lineTotal: roundMoney(unitPrice * requested.quantity),
      unitCost,
      modifiers: selectedOptions.map(({ group, option }) => ({ optionId: option.id, groupName: group.name, optionName: option.name, priceDelta: option.priceDelta, effects: { create: option.recipeEffects.map((effect) => ({ ingredientId: effect.ingredientId, ingredientName: effect.ingredient.name, quantityDelta: effect.quantityDelta })) } })),
    };
  });
  const subtotalAmount = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const serviceChargeAmount = roundMoney(subtotalAmount * Number(branch.serviceChargeRate) / 100);
  const taxBase = subtotalAmount + (branch.taxInclusive ? 0 : serviceChargeAmount);
  const taxAmount = branch.taxInclusive
    ? roundMoney(subtotalAmount - subtotalAmount / (1 + Number(branch.taxRate) / 100))
    : roundMoney(taxBase * Number(branch.taxRate) / 100);
  const totalAmount = roundMoney(subtotalAmount + serviceChargeAmount + (branch.taxInclusive ? 0 : taxAmount));
  const order = await prisma.$transaction(async (tx) => {
    if (input.tableId) {
      await tx.$queryRaw`SELECT "id" FROM "novara_database"."DiningTable" WHERE "id" = ${input.tableId}::uuid AND "tenantId" = ${tenantId}::uuid AND "branchId" = ${input.branchId}::uuid FOR UPDATE`;
      if (await tx.salesOrder.findFirst({ where: { tableId: input.tableId, status: "OPEN" }, select: { id: true } })) throw new HttpError(409, "TABLE_OCCUPIED", "This table already has an open order. Open that order to add more items.");
    }
    const created = await tx.salesOrder.create({
      data: {
        tenantId, branchId: input.branchId, createdById: actorId, subtotalAmount,
        ...(input.tableId ? { tableId: input.tableId } : {}), ...(input.guestCount ? { guestCount: input.guestCount } : {}),
        taxRate: branch.taxRate, taxAmount, taxInclusive: branch.taxInclusive,
        serviceChargeRate: branch.serviceChargeRate, serviceChargeAmount, currency: branch.currency,
        totalAmount, clientOrderId: input.clientOrderId, offlineOrigin, createdAt,
        items: { create: items.map(({ modifiers, ...item }, index) => ({ ...item, note: input.items[index]?.note, ...(!input.tableId ? { sentToKitchenAt: new Date() } : {}), modifiers: { create: modifiers } })) },
      },
      include: { items: { include: { modifiers: true, product: { select: { id: true, name: true, sku: true } } } }, branch: { select: { id: true, name: true } } },
    });
    await tx.auditLog.create({ data: { userId: actorId, action: "order.create", metadata: { tenantId, branchId: input.branchId, orderId: created.id, clientOrderId: input.clientOrderId, offlineOrigin, clientClockDriftMs: offlineOrigin ? Math.abs(serverNow.getTime() - requestedCreationTime.getTime()) : undefined, totalAmount: totalAmount.toFixed(2) } } });
    return created;
  });
  sendSuccess(response, { order }, 201);
});

operationsRouter.post("/:tenantId/orders/:id/items", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, orderRoles);
  const id = uuid.parse(request.params.id);
  const input = z.object({ items: z.array(z.object({ productId: uuid, quantity: z.number().positive().max(100), optionIds: z.array(uuid).max(20).default([]), note: z.string().trim().max(200).optional() })).min(1).max(100) }).parse(request.body);
  const existing = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!existing) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, existing.branchId, scope);
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: productIds }, isAvailable: true },
    include: { modifierGroups: { where: { group: { isActive: true } }, include: { group: { include: { options: { where: { isActive: true } } } } } } },
  });
  if (products.length !== productIds.length) throw new HttpError(400, "INVALID_PRODUCT", "One or more products are unavailable in this business.");
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = input.items.map((line) => {
    const product = byId.get(line.productId)!; const optionIds = new Set(line.optionIds);
    if (optionIds.size !== line.optionIds.length) throw new HttpError(400, "DUPLICATE_MODIFIER_OPTION", "Select each modifier option once.");
    const groups = product.modifierGroups.map(({ group }) => group);
    const options = groups.flatMap((group) => group.options.filter((option) => optionIds.has(option.id)).map((option) => ({ group, option })));
    if (options.length !== optionIds.size) throw new HttpError(400, "INVALID_MODIFIER_OPTION", "One or more modifier options are unavailable.");
    for (const group of groups) { const count = options.filter((item) => item.group.id === group.id).length; if (count < group.minSelect || count > group.maxSelect) throw new HttpError(400, "MODIFIER_SELECTION_REQUIRED", `Choose between ${group.minSelect} and ${group.maxSelect} options for ${group.name}.`); }
    const unitPrice = Number(product.price) + options.reduce((sum, item) => sum + Number(item.option.priceDelta), 0);
    if (unitPrice < 0) throw new HttpError(400, "INVALID_MODIFIER_PRICE", "Modifier choices cannot make an item price negative.");
    return { productId: line.productId, quantity: line.quantity, unitPrice, lineTotal: Math.round(unitPrice * line.quantity * 100) / 100, note: line.note, modifiers: options.map(({ group, option }) => ({ groupName: group.name, optionName: option.name, optionId: option.id, priceDelta: option.priceDelta })) };
  });
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."SalesOrder" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const order = await tx.salesOrder.findFirst({ where: { id, tenantId }, include: { branch: { select: { taxRate: true, taxInclusive: true, serviceChargeRate: true, currency: true } } } });
    if (!order || order.status !== "OPEN") throw new HttpError(409, "ORDER_NOT_OPEN", "Items can only be added to an open order.");
    for (const line of lines) {
      await tx.salesOrderItem.create({ data: { orderId: id, productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal, note: line.note, modifiers: { create: line.modifiers } } });
    }
    const subtotal = Math.round((Number(order.subtotalAmount) + lines.reduce((sum, line) => sum + line.lineTotal, 0)) * 100) / 100;
    const serviceCharge = Math.round(subtotal * Number(order.branch.serviceChargeRate) / 100 * 100) / 100;
    const taxBase = subtotal + (order.branch.taxInclusive ? 0 : serviceCharge);
    const tax = order.branch.taxInclusive ? Math.round((subtotal - subtotal / (1 + Number(order.branch.taxRate) / 100)) * 100) / 100 : Math.round(taxBase * Number(order.branch.taxRate) / 100 * 100) / 100;
    const total = Math.round((subtotal + serviceCharge + (order.branch.taxInclusive ? 0 : tax)) * 100) / 100;
    const result = await tx.salesOrder.update({ where: { id }, data: { subtotalAmount: subtotal, serviceChargeAmount: serviceCharge, taxAmount: tax, totalAmount: total }, include: { items: { include: { modifiers: true, product: { select: { id: true, name: true, sku: true } } } }, table: { select: { id: true, name: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "order.items.add", metadata: { tenantId, orderId: id, count: lines.length, totalAmount: total } } });
    return result;
  });
  sendSuccess(response, { order: updated });
});

operationsRouter.post("/:tenantId/orders/:id/complete", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  // Waiters may place service orders but cannot take payment or complete a sale.
  const scope = await tenantScope(actorId, tenantId, paymentRoles);
  const id = uuid.parse(request.params.id);

  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  const branch = await branchAccess(tenantId, order.branchId, scope);

  const payment = z.object({
    method: z.enum(PAYMENT_METHOD_VALUES).default("CASH"),
    cashReceived: cashAmount.optional(),
    reference: z.string().trim().max(120).optional(),
    payments: z.array(z.object({ method: z.enum(PAYMENT_METHOD_VALUES), amount: cashAmount, tendered: cashAmount.optional(), reference: z.string().trim().max(120).optional() })).max(10).optional(),
  }).parse(request.body ?? {});
  const completed = await prisma.$transaction(async (tx) => {
    const current = await tx.salesOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            modifiers: { include: { effects: { include: { ingredient: { select: { unitCost: true } } } } } },
            product: {
              include: {
                recipe: {
                  include: {
                    ingredients: {
                      include: { ingredient: { select: { unitCost: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!current) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
    if (current.status !== "OPEN") throw new HttpError(409, "ORDER_NOT_OPEN", "Only open orders can be completed.");
    const currentShift = await tx.shift.findFirst({ where: { tenantId, branchId: current.branchId, userId: actorId, status: "OPEN" } });
    if (branch.requireShift && !currentShift) throw new HttpError(409, "SHIFT_REQUIRED", "Open a cash drawer shift before completing a sale.");
    const total = Number(current.totalAmount);
    const paymentLines = payment.payments ?? (total > 0 ? [{ method: payment.method, amount: total, ...(payment.method === "CASH" ? { tendered: payment.cashReceived ?? total } : {}), ...(payment.reference ? { reference: payment.reference } : {}) }] : []);
    const paidAmount = Math.round(paymentLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
    if (paidAmount < total - 0.01) throw new HttpError(400, "INSUFFICIENT_PAYMENT", "Payments must cover the full order total.");
    if (paidAmount > total + 0.01) throw new HttpError(400, "PAYMENT_EXCEEDS_DUE", "Applied payment amounts cannot exceed the order total. Record cash change as tendered cash.");
    for (const line of paymentLines) {
      if (line.method === "CASH" && (line.tendered ?? line.amount) < line.amount) throw new HttpError(400, "INSUFFICIENT_PAYMENT", "Cash tendered must cover its applied payment amount.");
      if (line.method !== "CASH" && branch.requirePaymentReference && !line.reference) throw new HttpError(400, "PAYMENT_REFERENCE_REQUIRED", "Enter a payment reference for each card, transfer, or digital wallet payment.");
    }
    const cashAmountApplied = paymentLines.filter((line) => line.method === "CASH").reduce((sum, line) => sum + line.amount, 0);
    const cashTendered = paymentLines.filter((line) => line.method === "CASH").reduce((sum, line) => sum + (line.tendered ?? line.amount), 0);
    const cashChange = cashTendered - cashAmountApplied;

    const ingredientUsage = new Map<string, number>();
    const ingredientCostFallback = new Map<string, number | null>();
    for (const item of current.items) {
      const perUnit = new Map<string, number>();
      for (const recipeLine of item.product.recipe?.ingredients ?? []) { perUnit.set(recipeLine.ingredientId, (perUnit.get(recipeLine.ingredientId) ?? 0) + Number(recipeLine.quantity)); ingredientCostFallback.set(recipeLine.ingredientId, recipeLine.ingredient.unitCost === null ? null : Number(recipeLine.ingredient.unitCost)); }
      for (const modifier of item.modifiers) for (const effect of modifier.effects) { perUnit.set(effect.ingredientId, (perUnit.get(effect.ingredientId) ?? 0) + Number(effect.quantityDelta)); ingredientCostFallback.set(effect.ingredientId, effect.ingredient.unitCost === null ? null : Number(effect.ingredient.unitCost)); }
      for (const [ingredientId, quantity] of perUnit) {
        if (quantity < -0.0005) throw new HttpError(409, "INVALID_RECIPE_EFFECT", "Selected modifier effects produce a negative ingredient quantity.");
        if (quantity <= 0.0005) continue;
        ingredientUsage.set(ingredientId, (ingredientUsage.get(ingredientId) ?? 0) + quantity * Number(item.quantity));
      }
    }
    const costIngredientIds = [...ingredientCostFallback.keys()];
    for (const ingredientId of [...costIngredientIds].sort()) {
      await tx.stockLevel.upsert({ where: { branchId_ingredientId: { branchId: current.branchId, ingredientId } }, create: { tenantId, branchId: current.branchId, ingredientId, quantity: 0 }, update: {} });
      await tx.$queryRaw`SELECT "id" FROM "novara_database"."StockLevel" WHERE "branchId" = ${current.branchId}::uuid AND "ingredientId" = ${ingredientId}::uuid FOR UPDATE`;
    }
    const branchStockCosts = new Map((await tx.stockLevel.findMany({ where: { tenantId, branchId: current.branchId, ingredientId: { in: costIngredientIds } }, select: { ingredientId: true, averageCost: true } })).map((row) => [row.ingredientId, Number(row.averageCost)]));
    for (const item of current.items) {
      const usageByIngredient = new Map<string, number>();
      for (const recipeLine of item.product.recipe?.ingredients ?? []) usageByIngredient.set(recipeLine.ingredientId, (usageByIngredient.get(recipeLine.ingredientId) ?? 0) + Number(recipeLine.quantity));
      for (const modifier of item.modifiers) for (const effect of modifier.effects) usageByIngredient.set(effect.ingredientId, (usageByIngredient.get(effect.ingredientId) ?? 0) + Number(effect.quantityDelta));
      let unitCost = 0;
      let isCostComplete = usageByIngredient.size > 0;
      for (const [ingredientId, quantity] of usageByIngredient) {
        if (quantity <= 0.0005) continue;
        const averageCost = branchStockCosts.get(ingredientId);
        const fallbackCost = ingredientCostFallback.get(ingredientId);
        const cost = averageCost && averageCost > 0 ? averageCost : fallbackCost;
        if (cost === undefined || cost === null) { isCostComplete = false; break; }
        unitCost += quantity * cost;
      }
      await tx.salesOrderItem.update({ where: { id: item.id }, data: { unitCost: isCostComplete ? new Prisma.Decimal(unitCost).toDecimalPlaces(4) : null } });
    }

    // Claim the order before applying stock changes; any failure rolls this update back.
    const transition = await tx.salesOrder.updateMany({ where: { id, tenantId, status: "OPEN" }, data: { status: "COMPLETED", completedAt: new Date(), paymentMethod: paymentLines.length === 1 ? paymentLines[0].method : null, paidAmount: total, cashReceived: cashAmountApplied > 0 ? cashTendered : null, cashChange: cashAmountApplied > 0 ? cashChange : null, shiftId: currentShift?.id } });
    if (transition.count !== 1) throw new HttpError(409, "ORDER_NOT_OPEN", "This order has already been completed or cancelled.");

    if (cashAmountApplied > 0 && currentShift) {
      await tx.shift.update({ where: { id: currentShift.id }, data: { expectedCash: { increment: cashAmountApplied } } });
    }
    for (const line of paymentLines) await tx.payment.create({ data: {
      tenantId,
      orderId: id,
      branchId: current.branchId,
      shiftId: currentShift?.id,
      method: line.method,
      amount: line.amount,
      tendered: line.method === "CASH" ? line.tendered ?? line.amount : null,
      changeGiven: line.method === "CASH" ? (line.tendered ?? line.amount) - line.amount : null,
      reference: line.reference,
      createdById: actorId,
    } });

    for (const [ingredientId, rawQuantity] of ingredientUsage) {
      const quantity = Math.round(rawQuantity * 1000) / 1000;
      if (branch.allowNegativeStock || current.offlineOrigin) {
        await tx.stockLevel.upsert({
          where: { branchId_ingredientId: { branchId: current.branchId, ingredientId } },
          create: { tenantId, branchId: current.branchId, ingredientId, quantity: -quantity },
          update: { quantity: { decrement: quantity } },
        });
      } else {
        const updated = await tx.stockLevel.updateMany({
          where: { tenantId, branchId: current.branchId, ingredientId, quantity: { gte: quantity } },
          data: { quantity: { decrement: quantity } },
        });
        if (updated.count !== 1) throw new HttpError(409, "INSUFFICIENT_STOCK", "An ingredient does not have enough stock to complete this order.");
      }
      await tx.stockMovement.create({
        data: { tenantId, branchId: current.branchId, ingredientId, salesOrderId: id, createdById: actorId, type: "RECIPE_USAGE", quantity: -quantity, note: `${current.offlineOrigin ? "Offline order" : "Order"} ${id}` },
      });
    }
    await tx.auditLog.create({ data: { userId: actorId, action: "order.complete", metadata: { tenantId, branchId: current.branchId, orderId: id, amount: total.toFixed(2), paymentMethods: paymentLines.map(({ method }) => method) } } });

    return tx.salesOrder.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { modifiers: true, product: { select: { id: true, name: true } } } }, branch: { select: { id: true, name: true } } },
    });
  });
  sendSuccess(response, { order: completed });
});

operationsRouter.post("/:tenantId/orders/:id/cancel", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const id = uuid.parse(request.params.id);
  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, order.branchId, scope);
  const update = await prisma.salesOrder.updateMany({ where: { id, tenantId, status: "OPEN" }, data: { status: "CANCELLED" } });
  if (update.count !== 1) throw new HttpError(409, "ORDER_NOT_OPEN", "Only open orders can be cancelled.");
  sendSuccess(response, { orderId: id, cancelled: true });
});

operationsRouter.post("/:tenantId/orders/:id/refunds", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({
    reason: z.string().trim().min(3).max(500),
    restock: z.boolean().default(false),
    method: z.enum(["CASH", "CARD", "OTHER"]).default("CASH"),
    items: z.array(z.object({ orderItemId: uuid, quantity: z.number().positive().max(100) })).min(1).max(100),
  }).superRefine(({ items }, context) => {
    if (new Set(items.map(({ orderItemId }) => orderItemId)).size !== items.length) context.addIssue({ code: "custom", path: ["items"], message: "Each order line can appear only once." });
  }).parse(request.body);

  const orderScope = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!orderScope) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  const branch = await branchAccess(tenantId, orderScope.branchId, scope);

  const refund = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."SalesOrder" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const order = await tx.salesOrder.findFirst({
      where: { id, tenantId },
      include: { items: { include: { modifiers: { include: { effects: true } }, product: { include: { recipe: { include: { ingredients: true } } } } } }, refunds: { select: { amount: true } } },
    });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
    if (!["COMPLETED", "PARTIALLY_REFUNDED"].includes(order.status)) throw new HttpError(409, "ORDER_NOT_REFUNDABLE", "Only completed, not fully refunded orders can be refunded.");
    if (!order.paidAmount) throw new HttpError(409, "ORDER_NOT_PAID", "This order has no completed payment to refund.");

    const requestedIds = input.items.map(({ orderItemId }) => orderItemId);
    const selected = order.items.filter(({ id: itemId }) => requestedIds.includes(itemId));
    if (selected.length !== requestedIds.length) throw new HttpError(404, "ORDER_ITEM_NOT_FOUND", "One or more order items could not be found.");
    const previousItems = await tx.refundItem.findMany({ where: { orderItemId: { in: requestedIds } }, select: { orderItemId: true, quantity: true } });
    const alreadyRefunded = new Map<string, number>();
    for (const line of previousItems) alreadyRefunded.set(line.orderItemId, (alreadyRefunded.get(line.orderItemId) ?? 0) + Number(line.quantity));
    const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const refundLines = input.items.map((requested) => {
      const item = selected.find(({ id: itemId }) => itemId === requested.orderItemId)!;
      if (Number(item.quantity) - (alreadyRefunded.get(item.id) ?? 0) < requested.quantity) throw new HttpError(409, "REFUND_QUANTITY_EXCEEDED", "Refund quantity exceeds the remaining quantity for an order item.");
      const lineAmount = roundMoney(Number(item.lineTotal) * requested.quantity / Number(item.quantity));
      const lineTax = Number(order.subtotalAmount) > 0 ? roundMoney(Number(order.taxAmount) * lineAmount / Number(order.subtotalAmount)) : 0;
      const lineService = Number(order.subtotalAmount) > 0 ? roundMoney(Number(order.serviceChargeAmount) * lineAmount / Number(order.subtotalAmount)) : 0;
      return { ...requested, item, amount: lineAmount, taxAmount: lineTax, serviceChargeAmount: lineService };
    });
    const amount = roundMoney(refundLines.reduce((sum, line) => sum + line.amount + line.serviceChargeAmount + (order.taxInclusive ? 0 : line.taxAmount), 0));
    const taxAmount = roundMoney(refundLines.reduce((sum, line) => sum + line.taxAmount, 0));
    const priorRefunds = order.refunds.reduce((sum, prior) => sum + Number(prior.amount), 0);
    if (priorRefunds + amount > Number(order.paidAmount) + 0.01) throw new HttpError(409, "REFUND_EXCEEDS_PAID", "Refund amount cannot exceed the amount paid.");

    const shift = input.method === "CASH" ? await tx.shift.findFirst({ where: { tenantId, branchId: order.branchId, userId: actorId, status: "OPEN" }, select: { id: true } }) : null;
    if (input.method === "CASH" && branch.requireShift && !shift) throw new HttpError(409, "SHIFT_REQUIRED", "Open a shift before issuing a cash refund.");
    const created = await tx.refund.create({ data: {
      tenantId, orderId: id, branchId: order.branchId, shiftId: shift?.id, amount, taxAmount,
      reason: input.reason, restock: input.restock, method: input.method, createdById: actorId, approvedById: actorId,
      items: { create: refundLines.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity, amount: line.amount, taxAmount: line.taxAmount })) },
    }, include: { items: true } });

    if (input.restock) {
      const restockByIngredient = new Map<string, number>();
      for (const line of refundLines) {
        const perUnit = new Map<string, number>();
        for (const recipeLine of line.item.product.recipe?.ingredients ?? []) perUnit.set(recipeLine.ingredientId, (perUnit.get(recipeLine.ingredientId) ?? 0) + Number(recipeLine.quantity));
        for (const modifier of line.item.modifiers) for (const effect of modifier.effects) perUnit.set(effect.ingredientId, (perUnit.get(effect.ingredientId) ?? 0) + Number(effect.quantityDelta));
        for (const [ingredientId, perItemQuantity] of perUnit) {
          if (perItemQuantity < -0.0005) throw new HttpError(409, "INVALID_RECIPE_EFFECT", "This order has an invalid modifier ingredient snapshot and cannot be restocked automatically.");
          const quantity = Math.round(Math.max(0, perItemQuantity) * line.quantity * 1000) / 1000;
          if (quantity <= 0) continue;
          restockByIngredient.set(ingredientId, (restockByIngredient.get(ingredientId) ?? 0) + quantity);
        }
      }
      for (const [ingredientId, quantity] of [...restockByIngredient].sort(([left], [right]) => left.localeCompare(right))) {
        await tx.stockLevel.upsert({ where: { branchId_ingredientId: { branchId: order.branchId, ingredientId } }, create: { tenantId, branchId: order.branchId, ingredientId, quantity }, update: { quantity: { increment: quantity } } });
        await tx.stockMovement.create({ data: { tenantId, branchId: order.branchId, ingredientId, salesOrderId: id, createdById: actorId, type: "REFUND_RESTOCK", quantity, note: `Refund ${created.id}: ${input.reason}` } });
      }
    }
    if (shift && input.method === "CASH") await tx.shift.update({ where: { id: shift.id }, data: { expectedCash: { decrement: amount } } });
    const cumulativeRefunds = priorRefunds + amount;
    const nextStatus = cumulativeRefunds + 0.01 >= Number(order.paidAmount) ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.salesOrder.update({ where: { id }, data: { status: nextStatus } });
    await tx.auditLog.create({ data: { userId: actorId, action: "order.refund", metadata: { orderId: id, refundId: created.id, amount: amount.toFixed(2), taxAmount: taxAmount.toFixed(2), reason: input.reason, restock: input.restock, approvedById: actorId } } });
    return created;
  });
  sendSuccess(response, { refund }, 201);
});

operationsRouter.get("/:tenantId/suppliers", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, inventoryRoles); sendSuccess(response, { suppliers: await prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } }) }); });
operationsRouter.post("/:tenantId/suppliers", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, inventoryRoles); sendSuccess(response, { supplier: await prisma.supplier.create({ data: { ...supplierSchema.parse(request.body), tenantId } }) }, 201); });
operationsRouter.patch("/:tenantId/suppliers/:id", async (request, response) => {
  const { tenantId, userId } = params(request);
  await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const input = supplierSchema.partial().parse(request.body);
  const update = await prisma.supplier.updateMany({ where: { id, tenantId }, data: input });
  if (!update.count) throw new HttpError(404, "SUPPLIER_NOT_FOUND", "Supplier not found.");
  sendSuccess(response, { supplier: await prisma.supplier.findUniqueOrThrow({ where: { id } }) });
});
operationsRouter.get("/:tenantId/inventory", async (request, response) => { const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles); const branchId = uuid.parse(request.query.branchId ?? scope.branchIds[0]); await branchAccess(tenantId, branchId, scope); const [stock, movements] = await Promise.all([prisma.stockLevel.findMany({ where: { tenantId, branchId }, include: { ingredient: { select: { id: true, name: true, unit: true } } }, orderBy: { ingredient: { name: "asc" } } }), prisma.stockMovement.findMany({ where: { tenantId, branchId }, include: { ingredient: { select: { name: true, unit: true } } }, orderBy: { createdAt: "desc" }, take: 20 })]); sendSuccess(response, { branchId, stock, movements }); });
operationsRouter.get("/:tenantId/inventory/valuation", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ["OWNER", "MANAGER", "INVENTORY_MANAGER"]);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const stock = await prisma.stockLevel.findMany({ where: { tenantId, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { branch: { select: { id: true, name: true } }, ingredient: { select: { id: true, name: true, unit: true } } }, orderBy: [{ branch: { name: "asc" } }, { ingredient: { name: "asc" } }] });
  const byBranch = new Map<string, { branchId: string; branchName: string; value: Prisma.Decimal }>();
  for (const line of stock) {
    const value = new Prisma.Decimal(line.quantity).mul(line.averageCost);
    const current = byBranch.get(line.branchId) ?? { branchId: line.branchId, branchName: line.branch.name, value: new Prisma.Decimal(0) };
    current.value = current.value.plus(value);
    byBranch.set(line.branchId, current);
  }
  const total = [...byBranch.values()].reduce((sum, branch) => sum.plus(branch.value), new Prisma.Decimal(0));
  sendSuccess(response, { total: total.toFixed(2), byBranch: [...byBranch.values()].map((branch) => ({ branchId: branch.branchId, branchName: branch.branchName, value: branch.value.toFixed(2) })), stock });
});
operationsRouter.post("/:tenantId/inventory/adjustments", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const input = z.object({
    branchId: uuid,
    ingredientId: uuid,
    quantity: z.number().finite().refine((value) => value !== 0),
    reorderLevel: z.number().min(0).optional(),
    type: z.enum(STOCK_ADJUSTMENT_TYPE_VALUES),
    note: z.string().trim().max(500).optional(),
  }).parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  const ingredient = await prisma.ingredient.findFirst({ where: { id: input.ingredientId, tenantId }, select: { id: true, unitCost: true } });
  if (!ingredient) {
    throw new HttpError(400, "INVALID_INGREDIENT", "Ingredient not found in this business.");
  }
  const movementQuantity = input.type === "WASTE" ? -Math.abs(input.quantity) : input.quantity;
  const stock = await prisma.$transaction(async (tx) => {
    let updated;
    if (movementQuantity < 0) {
      const result = await tx.stockLevel.updateMany({
        where: {
          tenantId,
          branchId: input.branchId,
          ingredientId: input.ingredientId,
          quantity: { gte: Math.abs(movementQuantity) },
        },
        data: {
          quantity: { decrement: Math.abs(movementQuantity) },
          ...(input.reorderLevel === undefined ? {} : { reorderLevel: input.reorderLevel }),
        },
      });
      if (result.count !== 1) throw new HttpError(409, "INSUFFICIENT_STOCK", "This movement would make stock negative.");
      updated = await tx.stockLevel.findUniqueOrThrow({ where: { branchId_ingredientId: { branchId: input.branchId, ingredientId: input.ingredientId } } });
    } else {
      updated = await tx.stockLevel.upsert({
        where: { branchId_ingredientId: { branchId: input.branchId, ingredientId: input.ingredientId } },
        create: { tenantId, branchId: input.branchId, ingredientId: input.ingredientId, quantity: movementQuantity, reorderLevel: input.reorderLevel ?? 0, averageCost: ingredient.unitCost ?? 0 },
        update: { quantity: { increment: movementQuantity }, ...(input.reorderLevel === undefined ? {} : { reorderLevel: input.reorderLevel }) },
      });
    }
    await tx.stockMovement.create({
      data: { tenantId, branchId: input.branchId, ingredientId: input.ingredientId, createdById: actorId, quantity: movementQuantity, type: input.type, note: input.note },
    });
    return updated;
  });
  sendSuccess(response, { stock });
});

operationsRouter.get("/:tenantId/stocktakes", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const stocktakes = await prisma.stocktake.findMany({
    where: { tenantId, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) },
    include: { branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, _count: { select: { lines: true } } },
    orderBy: { startedAt: "desc" }, take: 100,
  });
  sendSuccess(response, { stocktakes });
});

operationsRouter.post("/:tenantId/stocktakes", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const input = z.object({ branchId: uuid, note: z.string().trim().max(500).optional() }).parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  const stocktake = await prisma.$transaction(async (tx) => {
    const created = await tx.stocktake.create({ data: { tenantId, branchId: input.branchId, createdById: actorId, note: input.note }, include: { branch: { select: { id: true, name: true } }, lines: true } });
    await tx.auditLog.create({ data: { userId: actorId, action: "stocktake.create", metadata: { tenantId, branchId: input.branchId, stocktakeId: created.id } } });
    return created;
  });
  sendSuccess(response, { stocktake }, 201);
});

operationsRouter.get("/:tenantId/stocktakes/:id", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const stocktake = await prisma.stocktake.findFirst({ where: { id, tenantId }, include: { branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, lines: { include: { ingredient: { select: { id: true, name: true, unit: true } } }, orderBy: { ingredient: { name: "asc" } } } } });
  if (!stocktake) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Stocktake not found.");
  await branchAccess(tenantId, stocktake.branchId, scope);
  sendSuccess(response, { stocktake });
});

operationsRouter.put("/:tenantId/stocktakes/:id/lines", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const input = z.object({ lines: z.array(z.object({ ingredientId: uuid, countedQuantity: z.number().finite().min(0).max(999_999_999.999) })).min(1).max(500) }).superRefine(({ lines }, context) => {
    if (new Set(lines.map(({ ingredientId }) => ingredientId)).size !== lines.length) context.addIssue({ code: "custom", path: ["lines"], message: "Each ingredient can appear only once in a count." });
  }).parse(request.body);
  const stocktake = await prisma.stocktake.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true, status: true } });
  if (!stocktake) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Stocktake not found.");
  await branchAccess(tenantId, stocktake.branchId, scope);
  if (stocktake.status !== "DRAFT") throw new HttpError(409, "STOCKTAKE_LOCKED", "Only draft stocktakes can be counted.");
  const ingredientIds = input.lines.map(({ ingredientId }) => ingredientId);
  const ingredients = await prisma.ingredient.findMany({ where: { tenantId, isActive: true, id: { in: ingredientIds } }, select: { id: true } });
  if (ingredients.length !== ingredientIds.length) throw new HttpError(400, "INVALID_INGREDIENT", "All counted ingredients must be active in this business.");
  const countedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Stocktake" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const current = await tx.stocktake.findFirst({ where: { id, tenantId }, select: { status: true } });
    if (current?.status !== "DRAFT") throw new HttpError(409, "STOCKTAKE_LOCKED", "Only draft stocktakes can be counted.");
    for (const line of [...input.lines].sort((left, right) => left.ingredientId.localeCompare(right.ingredientId))) await tx.stocktakeLine.upsert({
      where: { stocktakeId_ingredientId: { stocktakeId: id, ingredientId: line.ingredientId } },
      create: { stocktakeId: id, ingredientId: line.ingredientId, countedQuantity: line.countedQuantity, countedAt },
      update: { countedQuantity: line.countedQuantity, countedAt, expectedAtCount: null, variance: null },
    });
    await tx.auditLog.create({ data: { userId: actorId, action: "stocktake.count.update", metadata: { tenantId, stocktakeId: id, lineCount: input.lines.length } } });
    return tx.stocktake.findUniqueOrThrow({ where: { id }, include: { lines: { include: { ingredient: { select: { id: true, name: true, unit: true } } }, orderBy: { ingredient: { name: "asc" } } } } });
  });
  sendSuccess(response, { stocktake: result });
});

operationsRouter.post("/:tenantId/stocktakes/:id/submit", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const stocktake = await prisma.stocktake.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!stocktake) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Stocktake not found.");
  await branchAccess(tenantId, stocktake.branchId, scope);
  const submitted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Stocktake" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const count = await tx.stocktakeLine.count({ where: { stocktakeId: id } });
    if (!count) throw new HttpError(409, "STOCKTAKE_EMPTY", "Record at least one ingredient count before submitting.");
    const changed = await tx.stocktake.updateMany({ where: { id, tenantId, status: "DRAFT" }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    if (changed.count !== 1) throw new HttpError(409, "STOCKTAKE_NOT_DRAFT", "Only draft stocktakes can be submitted.");
    await tx.auditLog.create({ data: { userId: actorId, action: "stocktake.submit", metadata: { tenantId, stocktakeId: id, lineCount: count } } });
    return tx.stocktake.findUniqueOrThrow({ where: { id }, include: { lines: { include: { ingredient: { select: { id: true, name: true, unit: true } } } }, branch: { select: { id: true, name: true } } } });
  });
  sendSuccess(response, { stocktake: submitted });
});

operationsRouter.post("/:tenantId/stocktakes/:id/approve", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER"]);
  const id = uuid.parse(request.params.id);
  const stocktakeScope = await prisma.stocktake.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!stocktakeScope) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Stocktake not found.");
  await branchAccess(tenantId, stocktakeScope.branchId, scope);
  const approved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Stocktake" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const stocktake = await tx.stocktake.findFirst({ where: { id, tenantId }, include: { lines: { orderBy: { ingredientId: "asc" } } } });
    if (!stocktake) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Stocktake not found.");
    if (stocktake.status !== "SUBMITTED") throw new HttpError(409, "STOCKTAKE_NOT_SUBMITTED", "Only submitted stocktakes can be approved.");
    if (!stocktake.lines.length) throw new HttpError(409, "STOCKTAKE_EMPTY", "This stocktake has no counted lines.");
    let totalVarianceValue = new Prisma.Decimal(0);
    for (const line of stocktake.lines) {
      await tx.stockLevel.upsert({ where: { branchId_ingredientId: { branchId: stocktake.branchId, ingredientId: line.ingredientId } }, create: { tenantId, branchId: stocktake.branchId, ingredientId: line.ingredientId, quantity: 0 }, update: {} });
      await tx.$queryRaw`SELECT "id" FROM "novara_database"."StockLevel" WHERE "branchId" = ${stocktake.branchId}::uuid AND "ingredientId" = ${line.ingredientId}::uuid FOR UPDATE`;
      const current = await tx.stockLevel.findUniqueOrThrow({ where: { branchId_ingredientId: { branchId: stocktake.branchId, ingredientId: line.ingredientId } } });
      const laterMovements = await tx.stockMovement.aggregate({ where: { tenantId, branchId: stocktake.branchId, ingredientId: line.ingredientId, createdAt: { gt: line.countedAt } }, _sum: { quantity: true } });
      const expectedAtCount = new Prisma.Decimal(current.quantity).minus(laterMovements._sum.quantity ?? 0);
      const variance = new Prisma.Decimal(line.countedQuantity).minus(expectedAtCount);
      if (!variance.isZero()) {
        await tx.stockLevel.update({ where: { id: current.id }, data: { quantity: { increment: variance } } });
        await tx.stockMovement.create({ data: { tenantId, branchId: stocktake.branchId, ingredientId: line.ingredientId, stocktakeId: id, createdById: actorId, type: "STOCKTAKE", quantity: variance, note: `Stocktake ${id}` } });
      }
      const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: line.ingredientId }, select: { unitCost: true } });
      const unitCost = current.averageCost.gt(0) ? current.averageCost : ingredient.unitCost;
      await tx.stocktakeLine.update({ where: { id: line.id }, data: { expectedAtCount, variance, unitCost } });
      if (unitCost) totalVarianceValue = totalVarianceValue.plus(variance.mul(unitCost));
    }
    const changed = await tx.stocktake.updateMany({ where: { id, tenantId, status: "SUBMITTED" }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: actorId } });
    if (changed.count !== 1) throw new HttpError(409, "STOCKTAKE_NOT_SUBMITTED", "This stocktake was processed by another user.");
    await tx.auditLog.create({ data: { userId: actorId, action: "stocktake.approve", metadata: { tenantId, stocktakeId: id, totalVarianceValue: totalVarianceValue.toFixed(2) } } });
    return tx.stocktake.findUniqueOrThrow({ where: { id }, include: { lines: { include: { ingredient: { select: { id: true, name: true, unit: true } } }, orderBy: { ingredient: { name: "asc" } } }, branch: { select: { id: true, name: true } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  sendSuccess(response, { stocktake: approved });
});

operationsRouter.post("/:tenantId/stocktakes/:id/cancel", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const stocktake = await prisma.stocktake.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!stocktake) throw new HttpError(404, "STOCKTAKE_NOT_FOUND", "Stocktake not found.");
  await branchAccess(tenantId, stocktake.branchId, scope);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Stocktake" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const changed = await tx.stocktake.updateMany({ where: { id, tenantId, status: { in: ["DRAFT", "SUBMITTED"] } }, data: { status: "CANCELLED" } });
    if (changed.count !== 1) throw new HttpError(409, "STOCKTAKE_NOT_CANCELLABLE", "Only draft or submitted stocktakes can be cancelled.");
    await tx.auditLog.create({ data: { userId: actorId, action: "stocktake.cancel", metadata: { tenantId, stocktakeId: id } } });
  });
  sendSuccess(response, { stocktakeId: id, cancelled: true });
});

operationsRouter.get("/:tenantId/purchases", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const purchases = await prisma.purchase.findMany({
    where: { tenantId, ...(scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) },
    include: {
      supplier: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  sendSuccess(response, { purchases });
});

operationsRouter.post("/:tenantId/purchases", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const input = purchaseSchema.parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, tenantId, isActive: true } });
  if (!supplier) throw new HttpError(400, "INVALID_SUPPLIER", "Choose an active supplier from this business.");
  const count = await prisma.ingredient.count({ where: { tenantId, id: { in: input.items.map(({ ingredientId }) => ingredientId) } } });
  if (count !== input.items.length) throw new HttpError(400, "INVALID_INGREDIENT", "One or more purchase items are not part of this business.");
  const totalAmount = input.items.reduce((total, item) => total + item.quantity * item.unitCost, 0);
  const purchase = await prisma.purchase.create({
    data: {
      tenantId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      reference: input.reference,
      notes: input.notes,
      totalAmount,
      items: { create: input.items },
    },
    include: { items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } }, supplier: true, branch: true },
  });
  sendSuccess(response, { purchase }, 201);
});

operationsRouter.post("/:tenantId/purchases/:id/order", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const purchase = await prisma.purchase.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!purchase) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Purchase order not found.");
  await branchAccess(tenantId, purchase.branchId, scope);
  const transition = await prisma.purchase.updateMany({ where: { id, tenantId, status: "DRAFT" }, data: { status: "ORDERED", orderedAt: new Date() } });
  if (transition.count !== 1) throw new HttpError(409, "PURCHASE_NOT_DRAFT", "Only draft purchase orders can be placed.");
  sendSuccess(response, { purchase: await prisma.purchase.findUniqueOrThrow({ where: { id }, include: { items: true, supplier: true, branch: true } }) });
});

operationsRouter.post("/:tenantId/purchases/:id/cancel", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const purchase = await prisma.purchase.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!purchase) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Purchase order not found.");
  await branchAccess(tenantId, purchase.branchId, scope);
  const transition = await prisma.purchase.updateMany({ where: { id, tenantId, status: { in: ["DRAFT", "ORDERED"] } }, data: { status: "CANCELLED" } });
  if (transition.count !== 1) throw new HttpError(409, "PURCHASE_NOT_CANCELLABLE", "Only draft or ordered purchase orders can be cancelled.");
  sendSuccess(response, { purchaseId: id, cancelled: true });
});

operationsRouter.post("/:tenantId/purchases/:id/receive", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const id = uuid.parse(request.params.id);
  const input = z.object({ lines: z.array(z.object({ purchaseItemId: uuid, quantity: z.number().positive().max(999_999_999.999) })).min(1).max(100) }).superRefine(({ lines }, context) => {
    if (new Set(lines.map(({ purchaseItemId }) => purchaseItemId)).size !== lines.length) context.addIssue({ code: "custom", path: ["lines"], message: "Each purchase line can only be received once per submission." });
  }).parse(request.body);
  const purchaseScope = await prisma.purchase.findFirst({ where: { id, tenantId }, select: { branchId: true } });
  if (!purchaseScope) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Purchase order not found.");
  await branchAccess(tenantId, purchaseScope.branchId, scope);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Purchase" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const purchase = await tx.purchase.findFirst({ where: { id, tenantId }, include: { items: { include: { ingredient: { select: { unitCost: true } } } } } });
    if (!purchase) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Purchase order not found.");
    if (purchase.status !== "ORDERED" && purchase.status !== "PARTIALLY_RECEIVED") throw new HttpError(409, "PURCHASE_NOT_RECEIVABLE", "Only ordered purchases with outstanding quantities can be received.");
    const received = new Map(purchase.items.map((item) => [item.id, item]));
    const receiptLines = input.lines.map((line) => {
      const item = received.get(line.purchaseItemId);
      if (!item) throw new HttpError(404, "PURCHASE_ITEM_NOT_FOUND", "A purchase line was not found on this order.");
      const remaining = item.quantity.minus(item.receivedQuantity);
      const requested = new Prisma.Decimal(line.quantity);
      if (requested.gt(remaining)) throw new HttpError(422, "PURCHASE_OVER_RECEIPT", `Received quantity exceeds the remaining amount for ${item.id}.`);
      return { item, requested, baseQuantity: requested.mul(item.unitFactor), baseUnitCost: item.unitCost.div(item.unitFactor) };
    });
    for (const line of [...receiptLines].sort((a, b) => a.item.ingredientId.localeCompare(b.item.ingredientId))) {
      await tx.stockLevel.upsert({
        where: { branchId_ingredientId: { branchId: purchase.branchId, ingredientId: line.item.ingredientId } },
        create: { tenantId, branchId: purchase.branchId, ingredientId: line.item.ingredientId, quantity: 0, averageCost: line.baseUnitCost },
        update: {},
      });
      await tx.$queryRaw`SELECT "id" FROM "novara_database"."StockLevel" WHERE "branchId" = ${purchase.branchId}::uuid AND "ingredientId" = ${line.item.ingredientId}::uuid FOR UPDATE`;
      const stock = await tx.stockLevel.findUniqueOrThrow({ where: { branchId_ingredientId: { branchId: purchase.branchId, ingredientId: line.item.ingredientId } } });
      const oldQuantity = new Prisma.Decimal(stock.quantity);
      const newQuantity = oldQuantity.plus(line.baseQuantity);
      const oldAverageCost = stock.averageCost.gt(0) ? stock.averageCost : new Prisma.Decimal(line.item.ingredient.unitCost ?? 0);
      const nextAverageCost = oldQuantity.gt(0)
        ? oldQuantity.mul(oldAverageCost).plus(line.baseQuantity.mul(line.baseUnitCost)).div(newQuantity).toDecimalPlaces(4)
        : line.baseUnitCost.toDecimalPlaces(4);
      const newStock = await tx.stockLevel.update({ where: { id: stock.id }, data: { quantity: { increment: line.baseQuantity }, averageCost: nextAverageCost } });
      await tx.purchaseItem.update({ where: { id: line.item.id }, data: { receivedQuantity: { increment: line.requested } } });
      await tx.stockMovement.create({
        data: { tenantId, branchId: purchase.branchId, ingredientId: line.item.ingredientId, purchaseId: id, createdById: actorId, type: "PURCHASE_RECEIVED", quantity: line.baseQuantity, note: `Receipt ${id}; balance ${newStock.quantity}` },
      });
    }
    const itemsAfterReceipt = await tx.purchaseItem.findMany({ where: { purchaseId: id }, select: { quantity: true, receivedQuantity: true } });
    const isComplete = itemsAfterReceipt.every((item) => item.receivedQuantity.gte(item.quantity));
    const status = isComplete ? "RECEIVED" : "PARTIALLY_RECEIVED";
    await tx.purchase.update({ where: { id }, data: { status, receivedAt: isComplete ? new Date() : null } });
    await tx.auditLog.create({ data: { userId: actorId, action: "purchase.receive", metadata: { tenantId, purchaseId: id, lineCount: receiptLines.length, status } } });
    return tx.purchase.findUniqueOrThrow({ where: { id }, include: { items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } }, supplier: true, branch: true } });
  });
  sendSuccess(response, { purchase: updated });
});

const cashAmount = z.number().finite().min(0).max(100_000_000);
const reportQuery = z.object({ branchId: uuid.optional(), from: z.iso.date().optional(), to: z.iso.date().optional() });

operationsRouter.get("/:tenantId/shifts/current", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "CASHIER"]);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const shift = await prisma.shift.findFirst({ where: { tenantId, userId: actorId, status: "OPEN", ...(branchId ? { branchId } : {}) }, include: { branch: { select: { id: true, name: true } }, cashMovements: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 } }, orderBy: { openedAt: "desc" } });
  sendSuccess(response, { shift });
});

operationsRouter.post("/:tenantId/shifts/open", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "CASHIER"]);
  const input = z.object({ branchId: uuid, openingCash: cashAmount }).parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  const existing = await prisma.shift.findFirst({ where: { tenantId, branchId: input.branchId, userId: actorId, status: "OPEN" } });
  if (existing) throw new HttpError(409, "SHIFT_ALREADY_OPEN", "You already have an open shift at this branch.");
  const shift = await prisma.$transaction(async (tx) => {
    const created = await tx.shift.create({ data: { tenantId, branchId: input.branchId, userId: actorId, openingCash: input.openingCash }, include: { branch: { select: { id: true, name: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "shift.open", metadata: { tenantId, shiftId: created.id, branchId: input.branchId, openingCash: input.openingCash } } });
    return created;
  });
  sendSuccess(response, { shift }, 201);
});

operationsRouter.post("/:tenantId/shifts/:id/close", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "CASHIER"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({ closingCash: cashAmount, note: z.string().trim().max(500).optional() }).parse(request.body);
  const closed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Shift" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const current = await tx.shift.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true, userId: true, openingCash: true, expectedCash: true, status: true } });
    if (!current) throw new HttpError(404, "SHIFT_NOT_FOUND", "Shift not found.");
    await branchAccess(tenantId, current.branchId, scope);
    if (scope.role === "CASHIER" && current.userId !== actorId) throw new HttpError(403, "SHIFT_ACCESS_DENIED", "You can only close your own shift.");
    if (current.status !== "OPEN") throw new HttpError(409, "SHIFT_ALREADY_CLOSED", "This shift has already been closed.");
    const openOrders = await tx.salesOrder.count({ where: { tenantId, branchId: current.branchId, shiftId: id, status: "OPEN" } });
    if (openOrders) throw new HttpError(409, "SHIFT_HAS_OPEN_ORDERS", "Complete or cancel all open orders from this shift before closing it.");
    const expectedTotal = Number(current.openingCash) + Number(current.expectedCash);
    const result = await tx.shift.update({ where: { id }, data: { status: "CLOSED", closingCash: input.closingCash, cashVariance: input.closingCash - expectedTotal, closedAt: new Date(), note: input.note }, include: { branch: { select: { id: true, name: true } } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "shift.close", metadata: { tenantId, shiftId: id, expectedCash: expectedTotal, closingCash: input.closingCash, variance: input.closingCash - expectedTotal, note: input.note } } });
    return result;
  });
  sendSuccess(response, { shift: closed });
});

operationsRouter.post("/:tenantId/shifts/:id/cash-movements", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "CASHIER"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({ type: z.enum(["PAY_IN", "PAY_OUT"]), amount: z.number().finite().positive().max(100_000_000), reason: z.string().trim().min(3).max(500) }).parse(request.body);
  const movement = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."Shift" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const shift = await tx.shift.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true, userId: true, status: true, openingCash: true, expectedCash: true } });
    if (!shift) throw new HttpError(404, "SHIFT_NOT_FOUND", "Shift not found.");
    await branchAccess(tenantId, shift.branchId, scope);
    if (scope.role === "CASHIER" && shift.userId !== actorId) throw new HttpError(403, "SHIFT_ACCESS_DENIED", "You can only adjust your own shift.");
    if (shift.status !== "OPEN") throw new HttpError(409, "SHIFT_ALREADY_CLOSED", "Cash movements can only be added to an open shift.");
    if (input.type === "PAY_OUT" && Number(shift.openingCash) + Number(shift.expectedCash) < input.amount) throw new HttpError(409, "INSUFFICIENT_EXPECTED_CASH", "The pay-out is greater than the expected drawer balance.");
    const created = await tx.cashMovement.create({ data: { tenantId, branchId: shift.branchId, shiftId: id, type: input.type, amount: input.amount, note: input.reason, createdById: actorId } });
    await tx.shift.update({ where: { id }, data: { expectedCash: input.type === "PAY_IN" ? { increment: input.amount } : { decrement: input.amount } } });
    await tx.auditLog.create({ data: { userId: actorId, action: "shift.cash_movement", metadata: { tenantId, shiftId: id, movementId: created.id, type: input.type, amount: input.amount, reason: input.reason } } });
    return created;
  });
  sendSuccess(response, { movement }, 201);
});

operationsRouter.get("/:tenantId/reports/sales", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const query = reportQuery.parse(request.query);
  if (query.branchId) await branchAccess(tenantId, query.branchId, scope);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const toKey = query.to ?? todayKey;
  const fromKey = query.from ?? new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  if (fromKey > toKey) throw new HttpError(400, "INVALID_DATE_RANGE", "The report start must be before its end.");
  const branchFilter = query.branchId ? { branchId: query.branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } };
  const reportBranches = await prisma.branch.findMany({ where: { tenantId, ...branchFilter }, select: { id: true, timezone: true, businessDayStart: true } });
  const dateRanges = reportBranches.map((branch) => ({ branchId: branch.id, ...localBusinessDateRange(fromKey, branch), end: localBusinessDateRange(toKey, branch).to }));
  const from = dateRanges.reduce((earliest, range) => range.from < earliest ? range.from : earliest, dateRanges[0]?.from ?? new Date(`${fromKey}T00:00:00.000Z`));
  const to = dateRanges.reduce((latest, range) => range.end > latest ? range.end : latest, dateRanges[0]?.end ?? new Date(`${toKey}T23:59:59.999Z`));
  const dateWhere = { OR: dateRanges.map((range) => ({ branchId: range.branchId, completedAt: { gte: range.from, lte: range.end } })) };
  const orders = await prisma.salesOrder.findMany({
    where: { tenantId, status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] }, ...dateWhere },
    include: {
      items: {
        include: {
          modifiers: true,
          product: {
            select: {
              id: true,
              name: true,
              recipe: { include: { ingredients: { include: { ingredient: { select: { unitCost: true } } } } } },
            },
          },
        },
      },
      branch: { select: { id: true, name: true, timezone: true, businessDayStart: true } },
    },
    orderBy: { completedAt: "asc" }, take: 10_000,
  });
  const byDay = new Map<string, { date: string; orders: number; sales: number }>();
  const products = new Map<string, { id: string; name: string; quantity: number; sales: number }>();
  let grossSales = 0;
  let costOfGoods = 0;
  const completeCostData = orders.length > 0 && orders.every((order) => order.items.every((item) => item.unitCost !== null || (item.modifiers.length === 0 && item.product.recipe && item.product.recipe.ingredients.every((line) => line.ingredient.unitCost !== null))));
  for (const order of orders) {
    const sales = Number(order.totalAmount);
    grossSales += sales;
    const date = businessDateKey(order.completedAt ?? order.createdAt, order.branch.timezone, order.branch.businessDayStart);
    const daily = byDay.get(date) ?? { date, orders: 0, sales: 0 };
    daily.orders += 1; daily.sales += sales; byDay.set(date, daily);
    for (const item of order.items) {
      if (item.unitCost !== null) costOfGoods += Number(item.unitCost) * Number(item.quantity);
      else for (const ingredient of item.product.recipe?.ingredients ?? []) costOfGoods += Number(ingredient.quantity) * Number(item.quantity) * Number(ingredient.ingredient.unitCost ?? 0);
      const product = products.get(item.productId) ?? { id: item.productId, name: item.product.name, quantity: 0, sales: 0 };
      product.quantity += Number(item.quantity); product.sales += Number(item.lineTotal); products.set(item.productId, product);
    }
  }
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true } });
  const refunds = await prisma.refund.findMany({ where: { tenantId, OR: dateRanges.map((range) => ({ branchId: range.branchId, createdAt: { gte: range.from, lte: range.end } })) }, select: { amount: true, createdAt: true, branch: { select: { timezone: true, businessDayStart: true } } } });
  const paymentBreakdown = await prisma.payment.groupBy({
    by: ["method"],
    where: { tenantId, OR: dateRanges.map((range) => ({ branchId: range.branchId, createdAt: { gte: range.from, lte: range.end } })) },
    _sum: { amount: true },
  });
  const refundTotal = refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  for (const refund of refunds) {
    const date = businessDateKey(refund.createdAt, refund.branch.timezone, refund.branch.businessDayStart);
    const daily = byDay.get(date) ?? { date, orders: 0, sales: 0 };
    daily.sales -= Number(refund.amount);
    byDay.set(date, daily);
  }
  const netSales = grossSales - refundTotal;
  const expenseRows = scope.role === "OWNER" ? await prisma.expense.findMany({ where: { tenantId, voidedAt: null, OR: dateRanges.map((range) => ({ branchId: range.branchId, expenseDate: { gte: range.from, lte: range.end } })) }, select: { amount: true } }) : [];
  const expenseTotal = expenseRows.reduce((sum, row) => sum + Number(row.amount), 0);
  sendSuccess(response, { range: { from, to }, currency: tenant.currency, summary: { orderCount: orders.length, grossSales, netSales, refunds: refundTotal, refundCount: refunds.length, ...(scope.role === "OWNER" ? { expenses: expenseTotal, ...(completeCostData ? { profit: netSales - costOfGoods, operatingProfitBeforeIncomeTax: netSales - costOfGoods - expenseTotal, foodCostPercent: netSales > 0 ? (costOfGoods / netSales) * 100 : 0 } : {}) } : {}) }, daily: [...byDay.values()], bestSellers: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10), paymentBreakdown: paymentBreakdown.map((item) => ({ method: item.method, amount: Number(item._sum.amount ?? 0) })) });
});

operationsRouter.get("/:tenantId/reports/inventory", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true } });
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const stock = await prisma.stockLevel.findMany({ where: { tenantId, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { ingredient: { select: { id: true, name: true, unit: true } }, branch: { select: { id: true, name: true } } }, orderBy: { ingredient: { name: "asc" } } });
  const lowStock = stock.filter((row) => Number(row.quantity) <= Number(row.reorderLevel));
  const movements = await prisma.stockMovement.findMany({ where: { tenantId, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { ingredient: { select: { name: true, unit: true } }, branch: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const stockValue = stock.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.quantity).mul(item.averageCost)), new Prisma.Decimal(0));
  sendSuccess(response, { lowStock, movements, valuation: { total: stockValue.toFixed(2), currency: tenant.currency } });
});

operationsRouter.post("/:tenantId/orders/:id/send-to-kitchen", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const id = uuid.parse(request.params.id);
  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, order.branchId, scope);
  const sent = await prisma.$transaction(async (tx) => {
    const current = await tx.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!current || current.status !== "OPEN") throw new HttpError(409, "ORDER_NOT_OPEN", "Only open orders can be sent to the kitchen.");
    const now = new Date();
    await tx.salesOrderItem.updateMany({ where: { orderId: id, sentToKitchenAt: null }, data: { sentToKitchenAt: now, kitchenStatus: "NEW" } });
    return tx.salesOrderItem.findMany({ where: { orderId: id, sentToKitchenAt: now }, include: { modifiers: true, product: { select: { id: true, name: true } } } });
  });
  sendSuccess(response, { items: sent });
});

operationsRouter.post("/:tenantId/orders/:id/request-bill", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const id = uuid.parse(request.params.id);
  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true, status: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, order.branchId, scope);
  if (order.status !== "OPEN") throw new HttpError(409, "ORDER_NOT_OPEN", "Only open orders can request a bill.");
  sendSuccess(response, { order: await prisma.salesOrder.update({ where: { id }, data: { billRequestedAt: new Date() }, include: { table: true } }) });
});

operationsRouter.get("/:tenantId/kitchen/queue", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, ["OWNER", "KITCHEN_STAFF"]);
  const query = z.object({ branchId: uuid.optional(), station: z.string().trim().min(1).max(100).optional() }).parse(request.query);
  if (query.branchId) await branchAccess(tenantId, query.branchId, scope);
  const rows = await prisma.salesOrderItem.findMany({
    where: { sentToKitchenAt: { not: null }, kitchenStatus: { in: ["NEW", "PREPARING"] }, order: { tenantId, status: "OPEN", ...(query.branchId ? { branchId: query.branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, ...(query.station ? { station: query.station } : {}) },
    include: { modifiers: true, product: { select: { id: true, name: true } }, order: { select: { id: true, createdAt: true, table: { select: { id: true, name: true, section: true } }, branch: { select: { id: true, name: true } } } } },
    orderBy: [{ sentToKitchenAt: "asc" }, { orderId: "asc" }], take: 500,
  });
  const grouped = new Map<string, { orderId: string; createdAt: Date; table: typeof rows[number]["order"]["table"]; branch: typeof rows[number]["order"]["branch"]; items: typeof rows }>();
  for (const item of rows) { const group = grouped.get(item.orderId) ?? { orderId: item.orderId, createdAt: item.order.createdAt, table: item.order.table, branch: item.order.branch, items: [] }; group.items.push(item); grouped.set(item.orderId, group); }
  sendSuccess(response, { tickets: [...grouped.values()] });
});

operationsRouter.patch("/:tenantId/kitchen/items/:id", async (request, response) => {
  const { tenantId, userId } = params(request); const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "KITCHEN_STAFF"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({ status: z.enum(["PREPARING", "READY", "NEW"] as const), reason: z.string().trim().min(3).max(300).optional() }).parse(request.body);
  if (input.status !== "NEW" && scope.role !== "OWNER" && scope.role !== "KITCHEN_STAFF") throw new HttpError(403, "KITCHEN_UPDATE_FORBIDDEN", "Only Kitchen Staff can advance kitchen items.");
  if (input.status === "NEW" && (!(["OWNER", "MANAGER"] as BusinessRole[]).includes(scope.role) || !input.reason)) throw new HttpError(403, "KITCHEN_RESET_FORBIDDEN", "Only a manager can reset an item, and a reason is required.");
  const item = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "novara_database"."SalesOrderItem" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const current = await tx.salesOrderItem.findFirst({ where: { id, order: { tenantId, status: "OPEN" } }, include: { order: { select: { id: true, branchId: true } } } });
    if (!current || !current.sentToKitchenAt) throw new HttpError(404, "KITCHEN_ITEM_NOT_FOUND", "Active kitchen item not found.");
    await branchAccess(tenantId, current.order.branchId, scope);
    const valid = input.status === "NEW" ? current.kitchenStatus !== "SERVED" && current.kitchenStatus !== "NEW" : (current.kitchenStatus === "NEW" && input.status === "PREPARING") || (current.kitchenStatus === "PREPARING" && input.status === "READY");
    if (!valid) throw new HttpError(409, "INVALID_KITCHEN_TRANSITION", "Kitchen items move one step at a time from New to Preparing to Ready.");
    const now = new Date();
    const updated = await tx.salesOrderItem.update({ where: { id }, data: { kitchenStatus: input.status, ...(input.status === "NEW" ? { preparingAt: null, readyAt: null } : input.status === "PREPARING" ? { preparingAt: now } : { readyAt: now }) }, include: { modifiers: true, product: { select: { id: true, name: true } } } });
    if (input.status === "NEW") await tx.auditLog.create({ data: { userId: actorId, action: "kitchen.item.reset", metadata: { tenantId, orderId: current.order.id, itemId: id, reason: input.reason } } });
    return updated;
  });
  sendSuccess(response, { item });
});

operationsRouter.patch("/:tenantId/orders/:id/items/:itemId/served", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const orderId = uuid.parse(request.params.id); const itemId = uuid.parse(request.params.itemId);
  const current = await prisma.salesOrderItem.findFirst({ where: { id: itemId, orderId, order: { tenantId } }, include: { order: { select: { branchId: true, status: true } } } });
  if (!current) throw new HttpError(404, "ORDER_ITEM_NOT_FOUND", "Order item not found.");
  await branchAccess(tenantId, current.order.branchId, scope);
  if (current.order.status !== "OPEN" || current.kitchenStatus !== "READY") throw new HttpError(409, "ITEM_NOT_READY", "Only ready items on an open order can be marked served.");
  const updated = await prisma.salesOrderItem.updateMany({ where: { id: itemId, orderId, kitchenStatus: "READY" }, data: { kitchenStatus: "SERVED", servedAt: new Date() } });
  if (updated.count !== 1) throw new HttpError(409, "ITEM_NOT_READY", "This item has already changed state.");
  sendSuccess(response, { item: await prisma.salesOrderItem.findUniqueOrThrow({ where: { id: itemId }, include: { product: { select: { id: true, name: true } } } }) });
});

operationsRouter.get("/:tenantId/orders/ready", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, orderRoles);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const items = await prisma.salesOrderItem.findMany({ where: { sentToKitchenAt: { not: null }, kitchenStatus: "READY", order: { tenantId, status: "OPEN", ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }), ...(scope.role === "WAITER" ? { createdById: getUserId(userId) } : {}) } }, include: { modifiers: true, product: { select: { id: true, name: true } }, order: { select: { id: true, table: { select: { name: true } }, createdBy: { select: { id: true, name: true } } } } }, orderBy: { readyAt: "asc" }, take: 200 });
  sendSuccess(response, { items });
});

operationsRouter.get("/:tenantId/kitchen/orders", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ["OWNER", "KITCHEN_STAFF"]);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const orders = await prisma.salesOrder.findMany({ where: { tenantId, status: "OPEN", ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { branch: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "asc" }, take: 200 });
  sendSuccess(response, { orders });
});

operationsRouter.patch("/:tenantId/kitchen/orders/:id", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ["OWNER", "KITCHEN_STAFF"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({ kitchenStatus: z.enum(["PREPARING", "READY"]) }).parse(request.body);
  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, order.branchId, scope);
  const updated = await prisma.salesOrder.updateMany({ where: { id, tenantId, status: "OPEN", kitchenStatus: { not: "READY" } }, data: { kitchenStatus: input.kitchenStatus } });
  if (updated.count !== 1) throw new HttpError(409, "KITCHEN_ORDER_COMPLETE", "This kitchen ticket is no longer active.");
  sendSuccess(response, { order: await prisma.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: { include: { product: { select: { id: true, name: true } } } }, branch: { select: { id: true, name: true } } } }) });
});
