import { env } from "@config/env.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";

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
    where: { userId, ...(tenantId ? { tenantId } : {}) }, orderBy: { createdAt: "asc" },
    select: { id: true, tenantId: true, role: true, tenant: { select: { id: true, name: true, currency: true, status: true, branches: { select: { id: true, name: true } } } }, branchAssignments: { select: { branchId: true, branch: { select: { id: true, name: true } } } } },
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

  const branches = role === "OWNER" ? membership.tenant.branches : membership.branchAssignments.map(({ branch }) => branch);
  if (!branches.length) throw new HttpError(403, "NO_BRANCH_ACCESS", "No branch has been assigned to your account.");
  if (branchId && branchId !== "all" && !branches.some((branch) => branch.id === branchId)) throw new HttpError(403, "BRANCH_ACCESS_DENIED", "You do not have access to the selected branch.");
  const activeBranch = branchId === "all" ? undefined : branches.find((branch) => branch.id === branchId) ?? branches[0];
  const scopedBranchIds = branchId === "all" ? branches.map(({ id }) => id) : activeBranch ? [activeBranch.id] : [];
  const branchWhere = { branchId: { in: scopedBranchIds } };
  const now = new Date();
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  const week = new Date(today); week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const completedTodayWhere = { tenantId: membership.tenantId, ...branchWhere, status: "COMPLETED" as const, completedAt: { gte: today, lte: now } };

  const [todayOrders, weekOrders, openOrders, ownTodayOrders, lowStockRows, recentMovements, pendingPurchases, currentShift, kitchenOrders] = await Promise.all([
    prisma.salesOrder.findMany({ where: completedTodayWhere, select: { totalAmount: true, completedAt: true } }),
    prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: "COMPLETED", completedAt: { gte: week, lte: now } }, select: { totalAmount: true, completedAt: true } }),
    prisma.salesOrder.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN" } }),
    prisma.salesOrder.findMany({ where: { ...completedTodayWhere, createdById: userId }, select: { totalAmount: true } }),
    prisma.stockLevel.findMany({ where: { tenantId: membership.tenantId, ...branchWhere }, select: { quantity: true, reorderLevel: true } }),
    prisma.stockMovement.count({ where: { tenantId: membership.tenantId, ...branchWhere, createdAt: { gte: week } } }),
    prisma.purchase.count({ where: { tenantId: membership.tenantId, ...branchWhere, status: { in: ["DRAFT", "ORDERED"] } } }),
    prisma.shift.findFirst({ where: { tenantId: membership.tenantId, branchId: { in: scopedBranchIds }, userId, status: "OPEN" }, select: { status: true } }),
    prisma.salesOrder.findMany({ where: { tenantId: membership.tenantId, ...branchWhere, status: "OPEN", kitchenStatus: { not: "READY" } }, include: { items: { select: { quantity: true } } } }),
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
  const ownSalesToday = ownTodayOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const lowStock = lowStockRows.filter((stock) => Number(stock.quantity) <= Number(stock.reorderLevel)).length;
  const costsConfigured = costedOrders.length > 0 && costedOrders.every((order) => order.items.every((item) => item.product.recipe && item.product.recipe.ingredients.every((line) => line.ingredient.unitCost !== null)));
  const costOfGoods = costedOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + (item.product.recipe?.ingredients.reduce((recipeSum, line) => recipeSum + Number(line.quantity) * Number(item.quantity) * Number(line.ingredient.unitCost ?? 0), 0) ?? 0), 0), 0);
  const itemsToPrepare = kitchenOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0);
  const trendMap = new Map<string, number>();
  for (const order of weekOrders) { const key = (order.completedAt ?? now).toISOString().slice(0, 10); trendMap.set(key, (trendMap.get(key) ?? 0) + Number(order.totalAmount)); }
  const trend = Array.from({ length: 7 }, (_, index) => { const date = new Date(week); date.setUTCDate(week.getUTCDate() + index); const key = date.toISOString().slice(0, 10); return { day: index, sales: trendMap.get(key) ?? 0 }; });

  return {
    view, role, tenant: { id: membership.tenant.id, name: membership.tenant.name, currency: membership.tenant.currency }, branches, activeBranch,
    permissions: { reportsSalesRead: role === "OWNER" || role === "MANAGER", reportsProfitRead: role === "OWNER", staffRead: role === "OWNER" || role === "MANAGER", inventoryRead: role === "OWNER" || role === "MANAGER" || role === "INVENTORY_MANAGER" },
    metrics: view === "overview"
      ? { salesToday, salesThisWeek, netSales: salesToday, refunds: 0, openOrders, lowStock, foodCostPercent: costsConfigured && salesToday > 0 ? (costOfGoods / salesToday) * 100 : null, profit: costsConfigured ? salesToday - costOfGoods : null }
      : view === "pos" ? { ownSalesToday, ownOrdersToday: ownTodayOrders.length, shiftStatus: currentShift ? "OPEN" : "NOT_STARTED", syncStatus: "ONLINE" }
      : view === "kitchen" ? { incomingOrders: kitchenOrders.filter((order) => order.kitchenStatus === "PENDING").length, itemsToPrepare, readyToServe: 0 }
      : { lowStock, recentMovements, pendingPurchases, wasteEntries: 0 },
    trend: view === "overview" ? trend : undefined,
    activity: [],
  };
}
