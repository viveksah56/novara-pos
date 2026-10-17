import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "@lib/prisma.js";
import { HttpError } from "@lib/http-error.js";
import { sendSuccess } from "@lib/response.js";
import { requireAuth } from "@middleware/auth.js";
import type { BusinessRole } from "../../../prisma/generated/client/client.js";

const uuid = z.string().uuid();
const nonEmptyName = z.string().trim().min(2).max(160);
const categorySchema = z.object({ name: nonEmptyName, sortOrder: z.number().int().min(0).default(0), isActive: z.boolean().optional() });
const productSchema = z.object({ name: nonEmptyName, categoryId: uuid.nullable().optional(), description: z.string().trim().max(1000).nullable().optional(), sku: z.string().trim().max(80).nullable().optional(), price: z.number().min(0).max(100_000_000), isAvailable: z.boolean().default(true) });
const ingredientSchema = z.object({ name: nonEmptyName, unit: z.enum(["EACH", "GRAM", "KILOGRAM", "MILLILITER", "LITER", "OUNCE", "POUND"]), unitCost: z.number().min(0).max(100_000_000).nullable().optional(), isActive: z.boolean().optional() });
const supplierSchema = z.object({ name: nonEmptyName, email: z.email().nullable().optional(), phone: z.string().trim().max(40).nullable().optional(), address: z.string().trim().max(500).nullable().optional(), isActive: z.boolean().optional() });
const purchaseSchema = z.object({ branchId: uuid, supplierId: uuid, reference: z.string().trim().max(80).nullable().optional(), notes: z.string().trim().max(1000).nullable().optional(), items: z.array(z.object({ ingredientId: uuid, quantity: z.number().positive(), unitCost: z.number().min(0) })).min(1).max(100) }).superRefine(({ items }, context) => {
  if (new Set(items.map((item) => item.ingredientId)).size !== items.length) context.addIssue({ code: "custom", path: ["items"], message: "Combine duplicate ingredients into one purchase line." });
});
const recipeSchema = z.object({ productId: uuid, notes: z.string().trim().max(1000).nullable().optional(), ingredients: z.array(z.object({ ingredientId: uuid, quantity: z.number().positive() })).min(1).max(100) });
const salesOrderSchema = z.object({ branchId: uuid, clientOrderId: z.string().trim().min(8).max(80).optional(), items: z.array(z.object({ productId: uuid, quantity: z.number().positive() })).min(1).max(100) });

type TenantScope = { role: BusinessRole; branchIds: string[] };
async function tenantScope(userId: string, tenantId: string, roles?: BusinessRole[]): Promise<TenantScope> {
  const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { role: true, tenant: { select: { status: true, branches: { select: { id: true } } } }, branchAssignments: { select: { branchId: true } } } });
  if (!membership) throw new HttpError(403, "TENANT_ACCESS_DENIED", "You do not have access to this business.");
  if (membership.tenant.status !== "ACTIVE") throw new HttpError(403, "BUSINESS_SUSPENDED", "This business workspace is suspended.");
  if (roles && !roles.includes(membership.role)) throw new HttpError(403, "ROLE_FORBIDDEN", "Your role cannot perform this action.");
  return { role: membership.role, branchIds: membership.role === "OWNER" ? membership.tenant.branches.map(({ id }) => id) : membership.branchAssignments.map(({ branchId }) => branchId) };
}
async function branchAccess(tenantId: string, branchId: string, scope: TenantScope) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true } });
  if (!branch) throw new HttpError(404, "BRANCH_NOT_FOUND", "The branch could not be found.");
  if (scope.role !== "OWNER" && !scope.branchIds.includes(branchId)) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You are not assigned to this branch.");
}
function params(request: Request) { return { tenantId: uuid.parse(request.params.tenantId), userId: request.auth?.userId }; }
function getUserId(userId: string | undefined) { if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue."); return userId; }
const ownerManager: BusinessRole[] = ["OWNER", "MANAGER"];
const inventoryRoles: BusinessRole[] = ["OWNER", "MANAGER", "INVENTORY_MANAGER"];
const orderRoles: BusinessRole[] = ["OWNER", "MANAGER", "CASHIER", "WAITER"];

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

operationsRouter.get("/:tenantId/branches", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId);
  const branches = await prisma.branch.findMany({ where: { tenantId, ...(scope.role === "OWNER" ? {} : { id: { in: scope.branchIds } }) }, orderBy: { createdAt: "asc" } });
  sendSuccess(response, { branches });
});
operationsRouter.post("/:tenantId/branches", async (request, response) => {
  const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ["OWNER"]);
  const input = z.object({ name: nonEmptyName, timezone: z.string().trim().min(1).max(64).default("Asia/Kathmandu") }).parse(request.body);
  sendSuccess(response, { branch: await prisma.branch.create({ data: { ...input, tenantId } }) }, 201);
});

operationsRouter.get("/:tenantId/team", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const memberships = await prisma.membership.findMany({ where: { tenantId, ...(scope.role === "MANAGER" ? { branchAssignments: { some: { branchId: { in: scope.branchIds } } } } : {}) }, include: { user: { select: { id: true, name: true, email: true, isActive: true } }, branchAssignments: { select: { branchId: true, branch: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } });
  sendSuccess(response, { memberships });
});
operationsRouter.post("/:tenantId/team", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const input = z.object({ email: z.email().transform((value) => value.toLowerCase()), role: z.enum(["MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF", "INVENTORY_MANAGER"]), branchIds: z.array(uuid).min(1).max(100) }).parse(request.body);
  if (scope.role === "MANAGER" && input.role === "MANAGER") throw new HttpError(403, "ROLE_FORBIDDEN", "Managers cannot invite other Managers.");
  const user = await prisma.user.findFirst({ where: { email: input.email, isActive: true }, select: { id: true } });
  if (!user) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "This email must have an active Novara account first.");
  const branches = await prisma.branch.findMany({ where: { tenantId, id: { in: input.branchIds } }, select: { id: true } });
  if (branches.length !== new Set(input.branchIds).size) throw new HttpError(400, "INVALID_BRANCH", "One or more selected branches are not part of this business.");
  if (scope.role === "MANAGER" && input.branchIds.some((id) => !scope.branchIds.includes(id))) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You can only assign staff to your branches.");
  const membership = await prisma.membership.upsert({ where: { tenantId_userId: { tenantId, userId: user.id } }, create: { tenantId, userId: user.id, role: input.role }, update: { role: input.role }, select: { id: true } });
  await prisma.$transaction([prisma.branchAssignment.deleteMany({ where: { membershipId: membership.id } }), prisma.branchAssignment.createMany({ data: input.branchIds.map((branchId) => ({ tenantId, membershipId: membership.id, branchId })), skipDuplicates: true })]);
  sendSuccess(response, { membership: await prisma.membership.findUniqueOrThrow({ where: { id: membership.id }, include: { user: { select: { id: true, name: true, email: true, isActive: true } }, branchAssignments: true } }) }, 201);
});
operationsRouter.delete("/:tenantId/team/:membershipId", async (request, response) => {
  const { tenantId, userId } = params(request); const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const membershipId = uuid.parse(request.params.membershipId);
  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId }, select: { id: true, role: true, branchAssignments: { select: { branchId: true } } } });
  if (!target) throw new HttpError(404, "MEMBERSHIP_NOT_FOUND", "Team member not found.");
  if (target.role === "OWNER") throw new HttpError(409, "OWNER_MEMBERSHIP_PROTECTED", "Transfer business ownership before removing the Owner.");
  if (scope.role === "MANAGER" && (target.role === "MANAGER" || target.branchAssignments.some(({ branchId }) => !scope.branchIds.includes(branchId)))) throw new HttpError(403, "ROLE_FORBIDDEN", "You cannot remove this team member.");
  await prisma.membership.delete({ where: { id: membershipId } }); sendSuccess(response, { membershipId, removed: true });
});

operationsRouter.get("/:tenantId/categories", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId); sendSuccess(response, { categories: await prisma.category.findMany({ where: { tenantId }, include: { _count: { select: { products: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }) }); });
operationsRouter.post("/:tenantId/categories", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const input = categorySchema.parse(request.body); sendSuccess(response, { category: await prisma.category.create({ data: { ...input, tenantId } }) }, 201); });
operationsRouter.patch("/:tenantId/categories/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const id = uuid.parse(request.params.id); const input = categorySchema.partial().extend({ isActive: z.boolean().optional() }).parse(request.body); const result = await prisma.category.updateMany({ where: { id, tenantId }, data: input }); if (!result.count) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found."); sendSuccess(response, { category: await prisma.category.findUniqueOrThrow({ where: { id } }) }); });
operationsRouter.delete("/:tenantId/categories/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ["OWNER"]); const id = uuid.parse(request.params.id); const result = await prisma.category.deleteMany({ where: { id, tenantId } }); if (!result.count) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found."); sendSuccess(response, { id, deleted: true }); });

operationsRouter.get("/:tenantId/products", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId); sendSuccess(response, { products: await prisma.product.findMany({ where: { tenantId }, include: { category: { select: { id: true, name: true } } }, orderBy: { name: "asc" } }) }); });
operationsRouter.post("/:tenantId/products", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const input = productSchema.parse(request.body); if (input.categoryId && !await prisma.category.findFirst({ where: { id: input.categoryId, tenantId } })) throw new HttpError(400, "INVALID_CATEGORY", "Choose a category in this business."); sendSuccess(response, { product: await prisma.product.create({ data: { ...input, tenantId } }) }, 201); });
operationsRouter.patch("/:tenantId/products/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const id = uuid.parse(request.params.id); const input = productSchema.partial().parse(request.body); if (input.categoryId && !await prisma.category.findFirst({ where: { id: input.categoryId, tenantId } })) throw new HttpError(400, "INVALID_CATEGORY", "Choose a category in this business."); const result = await prisma.product.updateMany({ where: { id, tenantId }, data: input }); if (!result.count) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found."); sendSuccess(response, { product: await prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true } }) }); });
operationsRouter.delete("/:tenantId/products/:id", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); const id = uuid.parse(request.params.id); const result = await prisma.product.deleteMany({ where: { id, tenantId } }); if (!result.count) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found."); sendSuccess(response, { id, deleted: true }); });

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
operationsRouter.get("/:tenantId/recipes", async (request, response) => { const { tenantId, userId } = params(request); await tenantScope(getUserId(userId), tenantId, ownerManager); sendSuccess(response, { recipes: await prisma.recipe.findMany({ where: { tenantId }, include: { product: { select: { id: true, name: true } }, ingredients: { include: { ingredient: { select: { id: true, name: true, unit: true } } } } }, orderBy: { updatedAt: "desc" } }) }); });
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
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  sendSuccess(response, { orders });
});

operationsRouter.post("/:tenantId/orders", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, orderRoles);
  const input = salesOrderSchema.parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  if (input.clientOrderId) {
    const existing = await prisma.salesOrder.findUnique({ where: { tenantId_clientOrderId: { tenantId, clientOrderId: input.clientOrderId } }, include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } }, branch: { select: { id: true, name: true } }, createdBy: { select: { id: true } } } });
    if (existing) {
      await branchAccess(tenantId, existing.branchId, scope);
      if (existing.branchId !== input.branchId || existing.createdBy.id !== actorId) throw new HttpError(409, "ORDER_IDEMPOTENCY_CONFLICT", "This offline order identifier has already been used.");
      return sendSuccess(response, { order: existing });
    }
  }

  const quantities = new Map<string, number>();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  const products = await prisma.product.findMany({ where: { tenantId, id: { in: [...quantities.keys()] }, isAvailable: true } });
  if (products.length !== quantities.size) throw new HttpError(400, "INVALID_PRODUCT", "One or more products are unavailable in this business.");

  const productById = new Map(products.map((product) => [product.id, product]));
  const items = [...quantities].map(([productId, quantity]) => {
    const product = productById.get(productId)!;
    const unitPrice = Number(product.price);
    return { productId, quantity, unitPrice, lineTotal: Math.round(unitPrice * quantity * 100) / 100 };
  });
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const order = await prisma.salesOrder.create({
    data: { tenantId, branchId: input.branchId, createdById: actorId, totalAmount, clientOrderId: input.clientOrderId, items: { create: items } },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } }, branch: { select: { id: true, name: true } } },
  });
  sendSuccess(response, { order }, 201);
});

operationsRouter.post("/:tenantId/orders/:id/complete", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, orderRoles);
  const id = uuid.parse(request.params.id);

  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, order.branchId, scope);

  const payment = z.object({ method: z.enum(["CASH", "CARD", "OTHER"]).default("CASH"), cashReceived: cashAmount.optional() }).parse(request.body ?? {});
  const completed = await prisma.$transaction(async (tx) => {
    const current = await tx.salesOrder.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: { include: { recipe: { include: { ingredients: true } } } } } } },
    });
    if (!current) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
    if (current.status !== "OPEN") throw new HttpError(409, "ORDER_NOT_OPEN", "Only open orders can be completed.");
    const currentShift = await tx.shift.findFirst({ where: { tenantId, branchId: current.branchId, userId: actorId, status: "OPEN" } });
    if (scope.role === "CASHIER" && !currentShift) throw new HttpError(409, "SHIFT_REQUIRED", "Open a cash drawer shift before completing a sale.");
    const total = Number(current.totalAmount);
    const cashReceived = payment.method === "CASH" ? payment.cashReceived ?? total : undefined;
    if (payment.method === "CASH" && cashReceived! < total) throw new HttpError(400, "INSUFFICIENT_PAYMENT", "Cash received must cover the order total.");

    const ingredientUsage = new Map<string, number>();
    for (const item of current.items) {
      for (const recipeLine of item.product.recipe?.ingredients ?? []) {
        const required = Number(recipeLine.quantity) * Number(item.quantity);
        ingredientUsage.set(recipeLine.ingredientId, (ingredientUsage.get(recipeLine.ingredientId) ?? 0) + required);
      }
    }

    // Claim the order before applying stock changes; any failure rolls this update back.
    const transition = await tx.salesOrder.updateMany({ where: { id, tenantId, status: "OPEN" }, data: { status: "COMPLETED", completedAt: new Date(), paymentMethod: payment.method, paidAmount: total, cashReceived, cashChange: payment.method === "CASH" ? cashReceived! - total : null, shiftId: currentShift?.id } });
    if (transition.count !== 1) throw new HttpError(409, "ORDER_NOT_OPEN", "This order has already been completed or cancelled.");

    if (payment.method === "CASH" && currentShift) {
      await tx.shift.update({ where: { id: currentShift.id }, data: { expectedCash: { increment: total } } });
    }

    for (const [ingredientId, rawQuantity] of ingredientUsage) {
      const quantity = Math.round(rawQuantity * 1000) / 1000;
      const updated = await tx.stockLevel.updateMany({
        where: { tenantId, branchId: current.branchId, ingredientId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (updated.count !== 1) throw new HttpError(409, "INSUFFICIENT_STOCK", "An ingredient does not have enough stock to complete this order.");
      await tx.stockMovement.create({
        data: { tenantId, branchId: current.branchId, ingredientId, salesOrderId: id, createdById: actorId, type: "RECIPE_USAGE", quantity: -quantity, note: `Order ${id}` },
      });
    }

    return tx.salesOrder.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { product: { select: { id: true, name: true } } } }, branch: { select: { id: true, name: true } } },
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
operationsRouter.post("/:tenantId/inventory/adjustments", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, inventoryRoles);
  const input = z.object({
    branchId: uuid,
    ingredientId: uuid,
    quantity: z.number().finite().refine((value) => value !== 0),
    reorderLevel: z.number().min(0).optional(),
    type: z.enum(["WASTE", "ADJUSTMENT"]),
    note: z.string().trim().max(500).optional(),
  }).parse(request.body);
  await branchAccess(tenantId, input.branchId, scope);
  if (!await prisma.ingredient.findFirst({ where: { id: input.ingredientId, tenantId } })) {
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
        create: { tenantId, branchId: input.branchId, ingredientId: input.ingredientId, quantity: movementQuantity, reorderLevel: input.reorderLevel ?? 0 },
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
  const purchase = await prisma.purchase.findFirst({ where: { id, tenantId }, include: { items: true } });
  if (!purchase) throw new HttpError(404, "PURCHASE_NOT_FOUND", "Purchase order not found.");
  if (purchase.status !== "DRAFT" && purchase.status !== "ORDERED") throw new HttpError(409, "PURCHASE_NOT_RECEIVABLE", "This purchase order cannot be received.");
  await branchAccess(tenantId, purchase.branchId, scope);

  const updated = await prisma.$transaction(async (tx) => {
    const transition = await tx.purchase.updateMany({ where: { id, tenantId, status: purchase.status }, data: { status: "RECEIVED", receivedAt: new Date() } });
    if (transition.count !== 1) throw new HttpError(409, "PURCHASE_NOT_RECEIVABLE", "This purchase order was already processed.");
    for (const item of purchase.items) {
      await tx.stockLevel.upsert({
        where: { branchId_ingredientId: { branchId: purchase.branchId, ingredientId: item.ingredientId } },
        create: { tenantId, branchId: purchase.branchId, ingredientId: item.ingredientId, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      });
      await tx.stockMovement.create({
        data: { tenantId, branchId: purchase.branchId, ingredientId: item.ingredientId, purchaseId: id, createdById: actorId, type: "PURCHASE_RECEIVED", quantity: item.quantity },
      });
    }
    return tx.purchase.findUniqueOrThrow({ where: { id }, include: { items: { include: { ingredient: { select: { id: true, name: true, unit: true } } } }, supplier: true, branch: true } });
  });
  sendSuccess(response, { purchase: updated });
});

const cashAmount = z.number().finite().min(0).max(100_000_000);
const reportQuery = z.object({ branchId: uuid.optional(), from: z.iso.datetime().optional(), to: z.iso.datetime().optional() });

operationsRouter.get("/:tenantId/shifts/current", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "CASHIER"]);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const shift = await prisma.shift.findFirst({ where: { tenantId, userId: actorId, status: "OPEN", ...(branchId ? { branchId } : {}) }, include: { branch: { select: { id: true, name: true } } }, orderBy: { openedAt: "desc" } });
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
  const shift = await prisma.shift.create({ data: { tenantId, branchId: input.branchId, userId: actorId, openingCash: input.openingCash }, include: { branch: { select: { id: true, name: true } } } });
  sendSuccess(response, { shift }, 201);
});

operationsRouter.post("/:tenantId/shifts/:id/close", async (request, response) => {
  const { tenantId, userId } = params(request);
  const actorId = getUserId(userId);
  const scope = await tenantScope(actorId, tenantId, ["OWNER", "MANAGER", "CASHIER"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({ closingCash: cashAmount, note: z.string().trim().max(500).optional() }).parse(request.body);
  const shift = await prisma.shift.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true, userId: true, openingCash: true, expectedCash: true } });
  if (!shift) throw new HttpError(404, "SHIFT_NOT_FOUND", "Shift not found.");
  await branchAccess(tenantId, shift.branchId, scope);
  if (scope.role === "CASHIER" && shift.userId !== actorId) throw new HttpError(403, "SHIFT_ACCESS_DENIED", "You can only close your own shift.");
  const expectedTotal = Number(shift.openingCash) + Number(shift.expectedCash);
  const result = await prisma.shift.updateMany({ where: { id, tenantId, status: "OPEN" }, data: { status: "CLOSED", closingCash: input.closingCash, cashVariance: input.closingCash - expectedTotal, closedAt: new Date(), note: input.note } });
  if (result.count !== 1) throw new HttpError(409, "SHIFT_ALREADY_CLOSED", "This shift has already been closed.");
  sendSuccess(response, { shift: await prisma.shift.findUniqueOrThrow({ where: { id }, include: { branch: { select: { id: true, name: true } } } }) });
});

operationsRouter.get("/:tenantId/reports/sales", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ownerManager);
  const query = reportQuery.parse(request.query);
  if (query.branchId) await branchAccess(tenantId, query.branchId, scope);
  const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86_400_000);
  const to = query.to ? new Date(query.to) : new Date();
  if (from >= to) throw new HttpError(400, "INVALID_DATE_RANGE", "The report start must be before its end.");
  const orders = await prisma.salesOrder.findMany({
    where: { tenantId, status: "COMPLETED", completedAt: { gte: from, lte: to }, ...(query.branchId ? { branchId: query.branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              recipe: { include: { ingredients: { include: { ingredient: { select: { unitCost: true } } } } } },
            },
          },
        },
      },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: "asc" }, take: 10_000,
  });
  const byDay = new Map<string, { date: string; orders: number; sales: number }>();
  const products = new Map<string, { id: string; name: string; quantity: number; sales: number }>();
  let grossSales = 0;
  let costOfGoods = 0;
  const completeCostData = orders.length > 0 && orders.every((order) => order.items.every((item) => item.product.recipe && item.product.recipe.ingredients.every((line) => line.ingredient.unitCost !== null)));
  for (const order of orders) {
    const sales = Number(order.totalAmount);
    grossSales += sales;
    const date = (order.completedAt ?? order.createdAt).toISOString().slice(0, 10);
    const daily = byDay.get(date) ?? { date, orders: 0, sales: 0 };
    daily.orders += 1; daily.sales += sales; byDay.set(date, daily);
    for (const item of order.items) {
      for (const ingredient of item.product.recipe?.ingredients ?? []) costOfGoods += Number(ingredient.quantity) * Number(item.quantity) * Number(ingredient.ingredient.unitCost ?? 0);
      const product = products.get(item.productId) ?? { id: item.productId, name: item.product.name, quantity: 0, sales: 0 };
      product.quantity += Number(item.quantity); product.sales += Number(item.lineTotal); products.set(item.productId, product);
    }
  }
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true } });
  sendSuccess(response, { range: { from, to }, currency: tenant.currency, summary: { orderCount: orders.length, grossSales, netSales: grossSales, refunds: 0, ...(scope.role === "OWNER" && completeCostData ? { profit: grossSales - costOfGoods, foodCostPercent: grossSales > 0 ? (costOfGoods / grossSales) * 100 : 0 } : {}) }, daily: [...byDay.values()], bestSellers: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10) });
});

operationsRouter.get("/:tenantId/reports/inventory", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, inventoryRoles);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const stock = await prisma.stockLevel.findMany({ where: { tenantId, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { ingredient: { select: { id: true, name: true, unit: true } }, branch: { select: { id: true, name: true } } }, orderBy: { ingredient: { name: "asc" } } });
  const lowStock = stock.filter((row) => Number(row.quantity) <= Number(row.reorderLevel));
  const movements = await prisma.stockMovement.findMany({ where: { tenantId, ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { ingredient: { select: { name: true, unit: true } }, branch: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  sendSuccess(response, { lowStock, movements });
});

operationsRouter.get("/:tenantId/kitchen/orders", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ["OWNER", "MANAGER", "KITCHEN_STAFF"]);
  const branchId = request.query.branchId ? uuid.parse(request.query.branchId) : undefined;
  if (branchId) await branchAccess(tenantId, branchId, scope);
  const orders = await prisma.salesOrder.findMany({ where: { tenantId, status: "OPEN", ...(branchId ? { branchId } : scope.role === "OWNER" ? {} : { branchId: { in: scope.branchIds } }) }, include: { branch: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "asc" }, take: 200 });
  sendSuccess(response, { orders });
});

operationsRouter.patch("/:tenantId/kitchen/orders/:id", async (request, response) => {
  const { tenantId, userId } = params(request);
  const scope = await tenantScope(getUserId(userId), tenantId, ["OWNER", "MANAGER", "KITCHEN_STAFF"]);
  const id = uuid.parse(request.params.id);
  const input = z.object({ kitchenStatus: z.enum(["PREPARING", "READY"]) }).parse(request.body);
  const order = await prisma.salesOrder.findFirst({ where: { id, tenantId }, select: { id: true, branchId: true } });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found.");
  await branchAccess(tenantId, order.branchId, scope);
  const updated = await prisma.salesOrder.updateMany({ where: { id, tenantId, status: "OPEN", kitchenStatus: { not: "READY" } }, data: { kitchenStatus: input.kitchenStatus } });
  if (updated.count !== 1) throw new HttpError(409, "KITCHEN_ORDER_COMPLETE", "This kitchen ticket is no longer active.");
  sendSuccess(response, { order: await prisma.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: { include: { product: { select: { id: true, name: true } } } }, branch: { select: { id: true, name: true } } } }) });
});
