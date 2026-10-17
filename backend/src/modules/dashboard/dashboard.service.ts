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

  const [todayOrders, weekOrders, todayRefunds, weekRefunds, openOrders, ownTodayOrders, lowStockRows, recentMovements, pendingPurchases, currentShift, kitchenOrders, shiftAlerts] = await Promise.all([
    prisma.salesOrder.findMany({ where: completedTodayWhere, select: { branchId: true, totalAmount: true, completedAt: true } }),
    prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: completedStatuses, OR: weekScopes }, select: { branchId: true, totalAmount: true, completedAt: true } }),
    prisma.refund.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessDayStartAt(now, calendar), lte: now } })) }, select: { amount: true } }),
    prisma.refund.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessWeekStartAt(now, calendar), lte: now } })) }, select: { amount: true } }),
    prisma.salesOrder.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN" } }),
    prisma.salesOrder.findMany({ where: { ...completedTodayWhere, createdById: userId }, select: { totalAmount: true } }),
    prisma.stockLevel.findMany({ where: { tenantId: membership.tenantId, ...branchWhere }, select: { quantity: true, reorderLevel: true } }),
    prisma.stockMovement.count({ where: { tenantId: membership.tenantId, OR: calendars.map((calendar) => ({ branchId: calendar.branchId, createdAt: { gte: businessWeekStartAt(now, calendar), lte: now } })) } }),
    prisma.purchase.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: { in: ["DRAFT", "ORDERED"] } } }),
    prisma.shift.findFirst({ where: { tenantId: membership.tenantId, branchId: { in: scopedBranchIds }, userId, status: "OPEN" }, select: { status: true } }),
    prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN", kitchenStatus: { not: "READY" } }, include: { items: { select: { quantity: true } } } }),
    role === "OWNER" || role === "MANAGER"
      ? prisma.shift.findMany({ where: { tenantId: membership.tenantId, branchId: { in: scopedBranchIds }, status: "CLOSED", cashVariance: { not: 0 } }, orderBy: { closedAt: "desc" }, take: 10, select: { id: true, closedAt: true, cashVariance: true, branch: { select: { name: true } }, user: { select: { name: true } } } })
      : Promise.resolve([]),
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
  const itemsToPrepare = kitchenOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0);
  const trendMap = new Map<number, number>();
  const calendarByBranch = new Map(calendars.map((calendar) => [calendar.branchId, calendar]));
  for (const order of weekOrders) {
    const calendar = calendarByBranch.get(order.branchId);
    if (!calendar || !order.completedAt) continue;
    const weekday = businessWeekdayIndex(order.completedAt, calendar);
    trendMap.set(weekday, (trendMap.get(weekday) ?? 0) + Number(order.totalAmount));
  }
  const trend = Array.from({ length: 7 }, (_, day) => ({ day, sales: trendMap.get(day) ?? 0 }));

  return {
    view, role, tenant: { id: membership.tenant.id, name: membership.tenant.name, currency: membership.tenant.currency }, branches, activeBranch,
    permissions: { reportsSalesRead: role === "OWNER" || role === "MANAGER", reportsProfitRead: role === "OWNER", staffRead: role === "OWNER" || role === "MANAGER", inventoryRead: role === "OWNER" || role === "MANAGER" || role === "INVENTORY_MANAGER" },
    metrics: view === "overview"
      ? { salesToday, salesThisWeek: salesThisWeek - refundsThisWeek, netSales: salesToday - refundsToday, refunds: refundsToday, openOrders, lowStock, foodCostPercent: costsConfigured && salesToday > 0 ? (costOfGoods / salesToday) * 100 : null, profit: costsConfigured ? salesToday - refundsToday - costOfGoods : null }
      : view === "pos" ? { ownSalesToday, ownOrdersToday: ownTodayOrders.length, shiftStatus: currentShift ? "OPEN" : "NOT_STARTED", syncStatus: "ONLINE" }
      : view === "kitchen" ? { incomingOrders: kitchenOrders.filter((order) => order.kitchenStatus === "PENDING").length, itemsToPrepare, readyToServe: 0 }
      : { lowStock, recentMovements, pendingPurchases, wasteEntries: 0 },
    trend: view === "overview" ? trend : undefined,
    shiftAlerts: view === "overview" ? shiftAlerts : undefined,
    activity: [],
  };
}
