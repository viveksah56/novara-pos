import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";
import type { Prisma } from "../../../prisma/generated/client/client.js";
import { businessDayStartAt, businessWeekStartAt, businessWeekdayIndex, type BusinessCalendar } from "@lib/business-time.js";

export type DashboardView = "overview" | "pos" | "kitchen" | "inventory" | "admin";

export async function getDashboard(userId: string, view: DashboardView, tenantId?: string, branchId?: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { email: true } });
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");

  if (env.SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    if (view !== "admin") throw new HttpError(403, "FORBIDDEN", "This dashboard is not available for your account.");
    const [businesses, activeBusinesses, suspendedBusinesses, users] = await Promise.all([
      prisma.tenant.count(), prisma.tenant.count({ where: { status: "ACTIVE" } }), prisma.tenant.count({ where: { status: "SUSPENDED" } }), prisma.user.count(),
    ]);
    return { view, role: "PLATFORM_ADMIN" as const, metrics: { businesses, activeBusinesses, suspendedBusinesses, users }, businessesList: await prisma.tenant.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, createdAt: true } }) };
  }

  const memberships = await prisma.membership.findMany({
    where: { userId, isActive: true, ...(tenantId ? { tenantId } : {}) }, orderBy: { createdAt: "asc" },
    select: { id: true, tenantId: true, role: true, tenant: { select: { id: true, name: true, currency: true, status: true, branches: { where: { isActive: true }, select: { id: true, name: true, timezone: true, businessDayStart: true } } } }, branchAssignments: { where: { branch: { isActive: true } }, select: { branchId: true, branch: { select: { id: true, name: true, timezone: true, businessDayStart: true } } } } },
  });
  const membership = memberships[0];
  if (!membership) throw new HttpError(403, "NO_WORKSPACE_ACCESS", "You do not have access to this business workspace.");
  if (membership.tenant.status !== "ACTIVE") throw new HttpError(403, "BUSINESS_SUSPENDED", "This business workspace is currently suspended.");

  const role = membership.role;
  const allowedViews: DashboardView[] = role === "OWNER" ? ["overview", "pos", "inventory"]
    : role === "MANAGER" ? ["overview", "pos", "inventory"]
    : role === "CASHIER" || role === "WAITER" ? ["pos"]
    : role === "KITCHEN_STAFF" ? ["kitchen"] : ["inventory"];
  if (!allowedViews.includes(view)) throw new HttpError(403, "FORBIDDEN", "You do not have permission to open this dashboard.");

  const accessibleBranches = role === "OWNER" ? membership.tenant.branches : membership.branchAssignments.map(({ branch }) => branch);
  if (!accessibleBranches.length) throw new HttpError(403, "NO_BRANCH_ACCESS", "No branch has been assigned to your account.");
  if (branchId && branchId !== "all" && !accessibleBranches.some((branch) => branch.id === branchId)) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You do not have access to the selected branch.");
  const scopedBranches = branchId === "all" ? accessibleBranches : [accessibleBranches.find((branch) => branch.id === branchId) ?? accessibleBranches[0]];
  const branches = accessibleBranches.map(({ id, name }) => ({ id, name }));
  const activeBranch = branchId === "all" ? undefined : scopedBranches[0];
  const scopedBranchIds = scopedBranches.map(({ id }) => id);
  const branchWhere = { branchId: { in: scopedBranchIds } };
  const now = new Date();
  const calendars: Array<BusinessCalendar & { branchId: string }> = scopedBranches.map(({ id, timezone, businessDayStart }) => ({ branchId: id, timezone, businessDayStart }));
  const todayScopes = calendars.map((calendar) => ({ branchId: calendar.branchId, completedAt: { gte: businessDayStartAt(now, calendar), lte: now } }));
  const weekScopes = calendars.map((calendar) => ({ branchId: calendar.branchId, completedAt: { gte: businessWeekStartAt(now, calendar), lte: now } }));
  const completedStatuses: Prisma.SalesOrderWhereInput["status"] = { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] };
  const completedTodayWhere: Prisma.SalesOrderWhereInput = { tenantId: membership.tenantId, status: completedStatuses, OR: todayScopes };

  const [todayOrders, weekOrders, todayRefunds, weekRefunds, openOrderCount, openOrderQueue, reviewOrders, ownTodayOrders, lowStockRows, recentMovements, pendingPurchases, currentShift, kitchenItemsByStatus, incomingKitchenTickets, shiftAlerts, wasteMovements, setupCounts, subscription] = await Promise.all([
    prisma.salesOrder.findMany({ where: completedTodayWhere, select: { branchId: true, totalAmount: true, completedAt: true } }),
    prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: completedStatuses, OR: weekScopes }, select: { branchId: true, totalAmount: true, completedAt: true } }),
    prisma.refund.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessDayStartAt(now, calendar), lte: now } })) }, select: { amount: true } }),
    prisma.refund.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessWeekStartAt(now, calendar), lte: now } })) }, select: { amount: true } }),
    prisma.salesOrder.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN" } }),
    view === "overview" && role === "MANAGER" ? prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN" }, orderBy: [{ billRequestedAt: "desc" }, { createdAt: "asc" }], take: 8, select: { id: true, createdAt: true, totalAmount: true, billRequestedAt: true, table: { select: { name: true } }, createdBy: { select: { name: true } } } }) : Promise.resolve([]),
    view === "overview" && role === "MANAGER" ? prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: { in: ["PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"] } }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, createdAt: true, status: true, table: { select: { name: true } } } }) : Promise.resolve([]),
    prisma.salesOrder.findMany({ where: { ...completedTodayWhere, createdById: userId }, select: { totalAmount: true } }),
    prisma.stockLevel.findMany({ where: { tenantId: membership.tenantId, ...branchWhere }, select: { quantity: true, reorderLevel: true } }),
    prisma.stockMovement.count({ where: { tenantId: membership.tenantId, OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessWeekStartAt(now, calendar), lte: now } })) } }),
    prisma.purchase.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: { in: ["DRAFT", "ORDERED"] } } }),
    prisma.shift.findFirst({ where: { tenantId: membership.tenantId, branchId: { in: scopedBranchIds }, userId, status: "OPEN" }, select: { status: true } }),
    prisma.salesOrderItem.groupBy({ by: ["kitchenStatus"], where: { order: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN" } }, _count: { _all: true }, _sum: { quantity: true } }),
    prisma.salesOrder.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN", items: { some: { kitchenStatus: { in: ["NEW", "PREPARING"] } } } } }),
    role === "OWNER" || role === "MANAGER"
      ? prisma.shift.findMany({ where: { tenantId: membership.tenantId, branchId: { in: scopedBranchIds }, status: "CLOSED", cashVariance: { not: 0 } }, orderBy: { closedAt: "desc" }, take: 10, select: { id: true, closedAt: true, cashVariance: true, branch: { select: { name: true } }, user: { select: { name: true } } } })
      : Promise.resolve([]),
    view === "inventory" ? prisma.stockMovement.findMany({ where: { tenantId: membership.tenantId, type: "WASTE", OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessWeekStartAt(now, calendar), lte: now } })) }, select: { quantity: true, ingredient: { select: { id: true, name: true, unit: true, unitCost: true } } } }) : Promise.resolve([]),
    view === "overview" && role === "OWNER" ? Promise.all([
      prisma.product.count({ where: { tenantId: membership.tenantId, isAvailable: true, recipe: { is: null } } }),
      prisma.branch.count({ where: { tenantId: membership.tenantId, isActive: true } }),
      prisma.membership.count({ where: { tenantId: membership.tenantId, isActive: true } }),
    ]) : Promise.resolve([0, 0, 0] as [number, number, number]),
    view === "overview" && role === "OWNER" ? prisma.subscription.findUnique({ where: { tenantId: membership.tenantId }, select: { status: true, trialEndsAt: true, plan: { select: { name: true, maxBranches: true, maxStaff: true } } } }) : Promise.resolve(null),
  ]);
  const costedOrders = role === "OWNER" && view === "overview"
    ? await prisma.salesOrder.findMany({
        where: completedTodayWhere,
        include: {
          items: {
            include: {
              product: {
                select: {
                  recipe: { include: { ingredients: { include: { ingredient: { select: { unitCost: true } } } } } },
                },
              },
            },
          },
        },
      })
    : [];
  const salesToday = todayOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const salesThisWeek = weekOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const refundsToday = todayRefunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const refundsThisWeek = weekRefunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const ownSalesToday = ownTodayOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const lowStock = lowStockRows.filter((stock) => Number(stock.quantity) <= Number(stock.reorderLevel)).length;
  const costsConfigured = costedOrders.length > 0 && costedOrders.every((order) => order.items.every((item) => item.product.recipe && item.product.recipe.ingredients.every((line) => line.ingredient.unitCost !== null)));
  const costOfGoods = costedOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (item.product.recipe?.ingredients.reduce((recipeSum, line) => recipeSum + Number(line.quantity) * Number(item.quantity) * Number(line.ingredient.unitCost ?? 0), 0) ?? 0), 0), 0);
  const itemsToPrepare = kitchenItemsByStatus.filter(({ kitchenStatus }) => kitchenStatus === "NEW" || kitchenStatus === "PREPARING").reduce((sum, item) => sum + Number(item._sum.quantity ?? 0), 0);
  const trendMap = new Map<number, number>();
  const calendarByBranch = new Map(calendars.map((calendar) => [calendar.branchId, calendar]));
  for (const order of weekOrders) {
    const calendar = calendarByBranch.get(order.branchId);
    if (!calendar || !order.completedAt) continue;
    const weekday = businessWeekdayIndex(order.completedAt, calendar);
    trendMap.set(weekday, (trendMap.get(weekday) ?? 0) + Number(order.totalAmount));
  }
  const trend = Array.from({ length: 7 }, (_, day) => ({ day, sales: trendMap.get(day) ?? 0 }));
  const hourlySales = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, orders: 0 }));
  for (const order of todayOrders) {
    if (!order.completedAt) continue;
    const timezone = calendarByBranch.get(order.branchId)?.timezone;
    const hour = Number(new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(order.completedAt));
    const slot = hourlySales[hour];
    if (slot) { slot.orders += 1; slot.sales += Number(order.totalAmount); }
  }
  const wasteByIngredient = wasteMovements.reduce<Array<{ id: string; name: string; unit: string; quantity: number; value: number }>>((rows, movement) => {
    const current = rows.find((row) => row.id === movement.ingredient.id);
    const quantity = Math.abs(Number(movement.quantity));
    const value = quantity * Number(movement.ingredient.unitCost ?? 0);
    if (current) { current.quantity += quantity; current.value += value; }
    else rows.push({ id: movement.ingredient.id, name: movement.ingredient.name, unit: movement.ingredient.unit, quantity, value });
    return rows;
  }, []).sort((left, right) => right.value - left.value);
  const [unrecipeProducts, activeBranches, activeStaff] = setupCounts;
  const trialDaysRemaining = subscription?.status === "TRIALING" && subscription.trialEndsAt
    ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  return {
    view, role, tenant: { id: membership.tenant.id, name: membership.tenant.name, currency: membership.tenant.currency }, branches, activeBranch,
    permissions: { reportsSalesRead: role === "OWNER" || role === "MANAGER", reportsProfitRead: role === "OWNER", staffRead: role === "OWNER" || role === "MANAGER", inventoryRead: role === "OWNER" || role === "MANAGER" || role === "INVENTORY_MANAGER" },
    metrics: view === "overview"
      ? { salesToday, salesThisWeek: salesThisWeek - refundsThisWeek, netSales: salesToday - refundsToday, refunds: refundsToday, openOrders: openOrderCount, lowStock, foodCostPercent: costsConfigured && salesToday > 0 ? (costOfGoods / salesToday) * 100 : null, profit: costsConfigured ? salesToday - refundsToday - costOfGoods : null }
      : view === "pos" ? { ownSalesToday, ownOrdersToday: ownTodayOrders.length, shiftStatus: currentShift ? "OPEN" : "NOT_STARTED" }
      : view === "kitchen" ? { incomingOrders: incomingKitchenTickets, incomingItems: kitchenItemsByStatus.find(({ kitchenStatus }) => kitchenStatus === "NEW")?._count._all ?? 0, itemsToPrepare, readyToServe: kitchenItemsByStatus.find(({ kitchenStatus }) => kitchenStatus === "READY")?._sum.quantity ?? 0 }
      : { lowStock, recentMovements, pendingPurchases, wasteEntries: wasteMovements.length, wasteQuantity: wasteByIngredient.reduce((sum, row) => sum + row.quantity, 0), wasteValue: wasteByIngredient.reduce((sum, row) => sum + row.value, 0) },
    ...(view === "overview" && role === "OWNER" ? { setup: { unrecipeProducts, trialDaysRemaining, trialStatus: subscription?.status ?? null, branchUsage: activeBranches, branchLimit: subscription?.plan.maxBranches ?? null, staffUsage: activeStaff, staffLimit: subscription?.plan.maxStaff ?? null, planName: subscription?.plan.name ?? null } } : {}),
    ...(view === "inventory" ? { wasteByIngredient } : {}),
    trend: view === "overview" ? trend : undefined,
    hourlySales: view === "overview" && role === "MANAGER" ? hourlySales : undefined,
    openOrderQueue: view === "overview" && role === "MANAGER" ? openOrderQueue : undefined,
    reviewOrders: view === "overview" && role === "MANAGER" ? reviewOrders : undefined,
    shiftAlerts: view === "overview" ? shiftAlerts : undefined,
    activity: [],
  };
}
