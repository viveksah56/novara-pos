"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Package,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wallet,
  Coffee,
  Building2,
  Check,
  ChevronDown,
  Boxes,
  ReceiptText,
  Store,
  Truck,
  CircleAlert,
} from "lucide-react";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceSearch } from "@/components/layout/WorkspaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { ActionDialog, type ActionModel } from "@/components/ui/alert-dialog";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import {
  dashboardKeys,
  getDashboard,
  type DashboardPayload,
  type DashboardView,
} from "@/features/dashboard/api";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { roleHasCapability, type Capability } from "@/lib/rbac";
import { formatMoney } from "@/lib/formatMoney";
import { getMenuProducts, type MenuProduct } from "@/features/menu/api/menuApi";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { completePosOrder, createPosOrder, listPosOrders, type PosCartLine, type PosOrderRecord } from "@/features/pos/api/posApi";
import { ProductGrid } from "@/features/menu/components/ProductGrid";
import { getKitchenOrders, updateKitchenOrder } from "@/features/kitchen/api/kitchenApi";
import { getCurrentShift } from "@/features/shifts/api/shiftApi";
import { replaceOfflineOrderQueue, useOfflineOrderQueue } from "@/features/pos/hooks/useOfflineOrderQueue";
import { cn } from "@/lib/utils";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  MANAGER: "/dashboard",
  CASHIER: "/pos",
  WAITER: "/pos",
  KITCHEN_STAFF: "/kitchen",
  INVENTORY_MANAGER: "/inventory",
  PLATFORM_ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
  SUPPORT_AGENT: "/admin/support",
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  capability?: Capability;
  permission?: keyof NonNullable<DashboardPayload["permissions"]>;
  ready?: boolean;
};
const navigation: Record<string, NavItem[]> = {
  OWNER: [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      ready: true,
    },
    {
      label: "Point of sale",
      href: "/pos",
      icon: CreditCard,
      capability: "orders.create",
      ready: true,
    },
    { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    {
      label: "Menu & products",
      href: "/menu/products",
      icon: Coffee,
      ready: true,
    },
    {
      label: "Inventory",
      href: "/inventory",
      icon: Package,
      capability: "inventory.read",
      permission: "inventoryRead",
    },
    { label: "Stock reports", href: "/stock-reports", icon: Boxes, capability: "reports.inventory.read" },
    {
      label: "Reports",
      href: "/reports",
      icon: Activity,
      capability: "reports.sales.read",
      permission: "reportsSalesRead",
    },
    {
      label: "Team",
      href: "/team",
      icon: Users,
      permission: "staffRead",
      ready: true,
    },
    { label: "Branches", href: "/branches", icon: Building2, ready: true },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings2,
      capability: "settings.read",
    },
    { label: "Subscription", href: "/subscription", icon: Wallet, ready: true },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
    { label: "Audit log", href: "/audit-log", icon: ShieldCheck },
  ],
  MANAGER: [
    {
      label: "Branch overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      ready: true,
    },
    {
      label: "Point of sale",
      href: "/pos",
      icon: CreditCard,
      capability: "orders.create",
      ready: true,
    },
    { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    {
      label: "Menu & products",
      href: "/menu/products",
      icon: Coffee,
      ready: true,
    },
    {
      label: "Inventory",
      href: "/inventory",
      icon: Package,
      capability: "inventory.read",
      permission: "inventoryRead",
    },
    {
      label: "Sales reports",
      href: "/reports",
      icon: Activity,
      capability: "reports.sales.read",
      permission: "reportsSalesRead",
    },
    {
      label: "Team",
      href: "/team",
      icon: Users,
      permission: "staffRead",
      ready: true,
    },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  CASHIER: [
    {
      label: "Point of sale",
      href: "/pos",
      icon: CreditCard,
      capability: "orders.create",
      ready: true,
    },
    { label: "My orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    { label: "Shift", href: "/shift", icon: Clock3 },
    { label: "Receipts", href: "/orders", icon: ReceiptText, capability: "orders.read" },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  WAITER: [
    {
      label: "Tables",
      href: "/pos",
      icon: Store,
      capability: "orders.create",
      ready: true,
    },
    { label: "My orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  KITCHEN_STAFF: [
    {
      label: "Kitchen queue",
      href: "/kitchen",
      icon: ChefHat,
      capability: "kitchen.orders.read",
      ready: true,
    },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  INVENTORY_MANAGER: [
    { label: "Stock", href: "/inventory", icon: Boxes, ready: true },
    {
      label: "Ingredients",
      href: "/inventory/ingredients",
      icon: Package,
      ready: true,
    },
    {
      label: "Suppliers",
      href: "/inventory/suppliers",
      icon: Truck,
      ready: true,
    },
    {
      label: "Purchases",
      href: "/inventory/purchases",
      icon: ShoppingBag,
      ready: true,
    },
    { label: "Stock reports", href: "/stock-reports", icon: Activity },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  PLATFORM_ADMIN: [
    { label: "Admin overview", href: "/admin", icon: ShieldCheck, ready: true },
    { label: "Businesses", href: "/admin", icon: Building2, ready: true },
    { label: "Plans & trials", href: "/plans", icon: Wallet },
    { label: "System health", href: "/health", icon: Activity },
  ],
};

const viewByRole: Record<string, DashboardView> = {
  OWNER: "overview",
  MANAGER: "overview",
  CASHIER: "pos",
  WAITER: "pos",
  KITCHEN_STAFF: "kitchen",
  INVENTORY_MANAGER: "inventory",
  PLATFORM_ADMIN: "admin",
  SUPER_ADMIN: "admin",
  SUPPORT_AGENT: "admin",
};
const viewsByRole: Record<string, DashboardView[]> = {
  OWNER: ["overview", "pos", "inventory"],
  MANAGER: ["overview", "pos", "inventory"],
  CASHIER: ["pos"],
  WAITER: ["pos"],
  KITCHEN_STAFF: ["kitchen"],
  INVENTORY_MANAGER: ["inventory"],
  PLATFORM_ADMIN: ["admin"],
  SUPER_ADMIN: ["admin"],
  SUPPORT_AGENT: ["admin"],
};
const roleTitles: Record<string, string> = {
  OWNER: "Business overview",
  MANAGER: "Branch overview",
  CASHIER: "Point of sale",
  WAITER: "Service floor",
  KITCHEN_STAFF: "Kitchen queue",
  INVENTORY_MANAGER: "Stock overview",
  PLATFORM_ADMIN: "Platform overview",
  SUPER_ADMIN: "Platform overview",
  SUPPORT_AGENT: "Support workspace",
};
const roleDescriptions: Record<string, string> = {
  OWNER: "A clear view of how your business is performing.",
  MANAGER: "Your branch, at a glance.",
  CASHIER: "Your register and today’s service.",
  WAITER: "Keep tables and orders moving.",
  KITCHEN_STAFF: "Prepare every order with the team.",
  INVENTORY_MANAGER: "Stock health across your operation.",
  PLATFORM_ADMIN: "The Novara platform, at a glance.",
  SUPER_ADMIN: "The Novara platform, at a glance.",
  SUPPORT_AGENT: "Help Novara customers with their workspace.",
};

function roleName(role: string) {
  return role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  accent = false,
}: {
  title: string;
  value: string;
  note: string;
  icon: typeof CircleDollarSign;
  accent?: boolean;
}) {
  return (
    <article
      className={cn(
        "group rounded-2xl border border-border/75 bg-card p-5 shadow-[0_8px_32px_-24px_rgba(14,42,31,.28)] transition-transform hover:-translate-y-0.5",
        accent && "bg-primary text-primary-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            "text-sm font-medium",
            accent ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            accent ? "bg-white/10" : "bg-secondary text-primary",
          )}
        >
          <Icon aria-hidden className="size-[18px]" />
        </span>
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-[-.04em]">
        {value}
      </div>
      <p
        className={cn(
          "mt-1.5 text-xs",
          accent ? "text-primary-foreground/65" : "text-muted-foreground",
        )}
      >
        {note}
      </p>
    </article>
  );
}

function WorkspaceError({
  message,
  retry,
  error,
}: {
  message: string;
  retry: () => void;
  error?: unknown;
}) {
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive"><CircleAlert aria-hidden className="size-5" /></span>
      <div>
        <p className="text-lg font-semibold tracking-tight">We couldn’t load this workspace</p>
        <p className="mt-1.5 max-w-prose text-sm leading-6 text-muted-foreground">{message}</p>
        {apiError?.requestId ? <p className="mt-3 text-xs text-muted-foreground">Reference: <span className="font-mono">{apiError.requestId}</span></p> : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-3">
        <Button onClick={retry}>Try again</Button>
        <Button variant="outline" render={<Link href="/login" />}>Sign in again</Button>
      </div>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  tag = "COMING NEXT",
}: {
  icon: typeof ClipboardList;
  title: string;
  description: string;
  tag?: string;
}) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/65 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="mt-4 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold tracking-[.16em] text-muted-foreground">
        {tag}
      </span>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

function OverviewContent({
  dashboard,
  role,
}: {
  dashboard: DashboardPayload;
  role: string;
}) {
  const metrics = dashboard.metrics;
  const currency = dashboard.tenant?.currency ?? "NPR";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Sales today"
          value={formatMoney(metrics.salesToday, currency)}
          note="No completed sales yet today"
          icon={CircleDollarSign}
          accent
        />
        <MetricCard
          title="This week"
          value={formatMoney(metrics.salesThisWeek, currency)}
          note="Week to date · all selected branches"
          icon={ArrowUpRight}
        />
        <MetricCard
          title="Open orders"
          value={String(metrics.openOrders ?? 0)}
          note="Orders currently in progress"
          icon={ClipboardList}
        />
        <MetricCard
          title="Low stock items"
          value={String(metrics.lowStock ?? 0)}
          note="Items that need attention"
          icon={Package}
        />
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.85fr)]">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Performance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Sales overview
              </h2>
            </div>
            <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium">
              This week
            </span>
          </div>
          <div
            className="mt-7 flex h-48 items-end justify-between gap-2 border-b border-border px-1 sm:gap-4"
            role="img"
            aria-label="Weekly sales chart. No sales have been recorded yet."
          >
            {days.map((day) => (
              <div
                key={day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="h-1.5 w-full max-w-12 rounded-t-md bg-primary/20" />
                <span className="pb-2 text-[11px] text-muted-foreground">
                  {day}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Net sales this week</span>
            <span className="font-semibold">
              {formatMoney(metrics.netSales, currency)}
            </span>
          </div>
        </article>
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">At a glance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Business health
              </h2>
            </div>
            <Activity className="size-5 text-brand-muted" aria-hidden />
          </div>
          <div className="mt-5 space-y-4">
            <HealthRow
              label="Refunds today"
              value={formatMoney(metrics.refunds, currency)}
            />
            <HealthRow
              label="Food cost"
              value={
                metrics.foodCostPercent === null
                  ? "—"
                  : `${metrics.foodCostPercent}%`
              }
            />
            {role === "OWNER" ? (
              <HealthRow
                label="Gross profit"
                value={metrics.profit === null ? "Enter ingredient costs" : formatMoney(metrics.profit, currency)}
              />
            ) : null}
          </div>
          <p className="mt-5 rounded-xl bg-secondary/75 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
            {role === "MANAGER"
              ? "Profit reporting is restricted to business owners."
              : "Branch comparison and best sellers appear as sales data becomes available."}
          </p>
        </article>
      </section>
      <section className="mt-5">
        <EmptyPanel
          icon={ClipboardList}
          title="Your activity will show up here"
          description="Orders, best sellers, payments and branch comparisons will appear once the point of sale and order workflows are connected."
          tag="READY FOR POS DATA"
        />
      </section>
    </>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 pb-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PosContent({
  dashboard,
  role,
  actorId,
}: {
  dashboard: DashboardPayload;
  role: string;
  actorId: string;
}) {
  const metrics = dashboard.metrics;
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id ?? dashboard.branches?.[0]?.id ?? "";
  const currency = dashboard.tenant?.currency ?? "NPR";
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; items: Array<{ name: string; quantity: number; unitPrice: number }>; total: number } | null>(null);
  const queueKey = `novara:offline-orders:${tenantId}:${actorId}`;
  const offlineQueue = useOfflineOrderQueue(queueKey);
  const [online, setOnline] = useState(true);
  const syncingRef = useRef(false);
  const cashierShift = useQuery({ queryKey: ["shift", tenantId, branchId], queryFn: () => getCurrentShift(tenantId, branchId), enabled: Boolean(tenantId && branchId && role === "CASHIER"), retry: false });
  useEffect(() => {
    const updateOnlineStatus = () => setOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => { window.removeEventListener("online", updateOnlineStatus); window.removeEventListener("offline", updateOnlineStatus); };
  }, []);
  useEffect(() => {
    if (!online || !offlineQueue.length || syncingRef.current) return;
    syncingRef.current = true;
    void (async () => {
      const remaining = [...offlineQueue];
      while (remaining.length && navigator.onLine) {
        const current = remaining[0];
        if (current.tenantId !== tenantId) break;
        try {
          await createPosOrder(current.tenantId, current.branchId, current.items, current.clientOrderId);
          remaining.shift();
        } catch { break; }
      }
      if (remaining.length < offlineQueue.length) {
        replaceOfflineOrderQueue(queueKey, () => [...remaining]);
        setMessage(`${offlineQueue.length - remaining.length} offline order${offlineQueue.length - remaining.length === 1 ? "" : "s"} synced.`);
        await queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] });
      }
      syncingRef.current = false;
    })();
  }, [offlineQueue, online, queryClient, queueKey, tenantId]);
  const menuQuery = useQuery({
    queryKey: ["menu", tenantId, "products"],
    queryFn: () => getMenuProducts(tenantId),
    enabled: Boolean(tenantId),
    retry: false,
  });
  const ordersQuery = useQuery({
    queryKey: ["pos-orders", tenantId, branchId],
    queryFn: () => listPosOrders(tenantId, branchId),
    enabled: Boolean(tenantId && branchId),
    retry: false,
  });
  const createOrderMutation = useMutation({
    mutationFn: (clientOrderId: string) => createPosOrder(tenantId, branchId, cart, clientOrderId),
    onSuccess: async (order) => {
      setOpenOrderId(order.id);
      setError("");
      setMessage("Order saved. Complete it when payment and preparation are confirmed.");
      await queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] });
    },
    onError: (reason, clientOrderId) => {
      if (reason instanceof ApiError && reason.code === "NETWORK_ERROR") {
        replaceOfflineOrderQueue(queueKey, (current) => [...current, { clientOrderId, tenantId, branchId, items: cart }]);
        setCart([]);
        setError("");
        setMessage("Connection lost. This order is saved on this device and will sync when you reconnect.");
      } else setError(getErrorMessage(reason));
    },
  });
  const completeOrderMutation = useMutation({
    mutationFn: () => completePosOrder(tenantId, openOrderId ?? "", { method: "CASH", cashReceived: Number(cashReceived || cartTotal) }),
    onSuccess: async (order) => {
      setReceipt({ id: order.id, items: cart.map((line) => ({ name: cartProduct(line.productId)?.name ?? "Item", quantity: line.quantity, unitPrice: Number(cartProduct(line.productId)?.price ?? 0) })), total: cartTotal });
      setOpenOrderId(null);
      setCart([]);
      setCashReceived("");
      setError("");
      setMessage("Order completed and recipe stock movements were recorded.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (reason) => setError(getErrorMessage(reason)),
  });
  const products = (menuQuery.data ?? []).filter((product) => product.isAvailable);
  const cartProduct = (productId: string) => products.find((product) => product.id === productId);
  const cartTotal = cart.reduce((sum, line) => sum + Number(cartProduct(line.productId)?.price ?? 0) * line.quantity, 0);
  function updateQuantity(product: MenuProduct, delta: number) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (!existing && delta > 0) return [...current, { productId: product.id, quantity: 1 }];
      return current
        .map((line) => line.productId === product.id ? { ...line, quantity: line.quantity + delta } : line)
        .filter((line) => line.quantity > 0);
    });
  }
  const pending = createOrderMutation.isPending || completeOrderMutation.isPending;
  const orderColumns: DataColumn<PosOrderRecord>[] = [
    { id: "id", header: "Order", cell: (order) => <span className="font-mono text-xs font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>, accessorFn: (order) => order.id },
    { id: "items", header: "Items", cell: (order) => <span className="block max-w-64 truncate">{order.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ")}</span>, accessorFn: (order) => order.items.map((item) => item.product.name).join(" ") },
    { id: "createdBy", header: "Staff", cell: (order) => order.createdBy.name, accessorFn: (order) => order.createdBy.name },
    { id: "createdAt", header: "Created", cell: (order) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt)), accessorFn: (order) => new Date(order.createdAt).getTime() },
    { id: "status", header: "Status", cell: (order) => <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", order.status === "OPEN" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : order.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{order.status}</span>, accessorFn: (order) => order.status },
    { id: "totalAmount", header: "Total", cell: (order) => <span className="tabular-nums">{formatMoney(Number(order.totalAmount), currency)}</span>, accessorFn: (order) => Number(order.totalAmount) },
  ];
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard title={role === "WAITER" ? "My open tables" : "My sales today"} value={role === "WAITER" ? "0" : formatMoney(metrics.ownSalesToday, currency)} note={role === "WAITER" ? "No tables are assigned right now" : "Your completed sales this shift"} icon={Store} accent />
        <MetricCard title="Orders today" value={String(metrics.ownOrdersToday ?? 0)} note="Orders you have handled" icon={ReceiptText} />
        <MetricCard title="Shift status" value={String(metrics.shiftStatus ?? "NOT_STARTED").replaceAll("_", " ")} note="Current register session" icon={Clock3} />
      </section>
      <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm text-muted-foreground">Service workspace</p><h2 className="mt-1 text-xl font-semibold">{role === "WAITER" ? "Table service menu" : "Register menu"}</h2></div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{dashboard.activeBranch?.name ?? "Choose a branch"}</span>
          </div>
          {menuQuery.isPending ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary/70" />)}</div> : menuQuery.isError ? <WorkspaceError message={getErrorMessage(menuQuery.error)} error={menuQuery.error} retry={() => void menuQuery.refetch()} /> : products.length ? (
            <ProductGrid products={products} cart={cart} currency={currency} disabled={Boolean(openOrderId) || pending} onQuantityChange={updateQuantity} />
          ) : <EmptyPanel icon={ShoppingBag} title="No available products" description="Add and activate products in Menu to start taking orders." tag="MENU EMPTY" />}
        </article>
        <aside className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">Current ticket</p><h2 className="mt-1 text-xl font-semibold">Order summary</h2>
          {error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="mt-4 rounded-lg border border-border bg-secondary/60 p-3 text-xs leading-5">{message}</p> : null}
          <div className="mt-5 space-y-3">{cart.length ? cart.map((line) => {
            const product = cartProduct(line.productId);
            return product ? <div key={product.id} className="flex items-center justify-between gap-4 text-sm"><span className="min-w-0 truncate">{line.quantity} × {product.name}</span><span className="shrink-0 font-medium tabular-nums">{formatMoney(Number(product.price) * line.quantity, currency)}</span></div> : null;
          }) : <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Choose menu items to begin an order.</p>}</div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Total</span><strong className="text-lg tabular-nums">{formatMoney(cartTotal, currency)}</strong></div>
          {role === "CASHIER" && !cashierShift.data ? <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">Open your cash drawer shift before completing cash sales. <a className="font-semibold underline" href={`/shift?tenantId=${tenantId}&branchId=${branchId}`}>Open shift</a></p> : null}
          {openOrderId ? <div className="mt-4 space-y-2"><label htmlFor="cash-received" className="text-xs font-medium text-muted-foreground">Cash received</label><Input id="cash-received" inputMode="decimal" type="number" min={cartTotal} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder={cartTotal.toFixed(2)} /><p className="text-xs text-muted-foreground">Change due: {formatMoney(Math.max(0, Number(cashReceived || cartTotal) - cartTotal), currency)}</p></div> : null}
          <Button className="mt-5 w-full" disabled={!branchId || !cart.length || pending || Boolean(openOrderId)} onClick={() => { setError(""); if (!navigator.onLine) { createOrderMutation.mutate(crypto.randomUUID()); return; } createOrderMutation.mutate(crypto.randomUUID()); }}>{createOrderMutation.isPending ? "Saving order…" : online ? "Save order" : "Queue order offline"}</Button>
          {openOrderId ? <Button className="mt-2 w-full" variant="secondary" disabled={pending || (role === "CASHIER" && !cashierShift.data)} onClick={() => { setError(""); completeOrderMutation.mutate(); }}>{completeOrderMutation.isPending ? "Completing…" : "Take cash & complete order"}</Button> : null}
          {receipt ? <Button type="button" className="mt-2 w-full" variant="outline" onClick={() => window.print()}>Print receipt</Button> : null}
          {!branchId ? <p className="mt-3 text-xs text-destructive">Your account needs an assigned branch before it can create an order.</p> : null}
          <div className="mt-6 space-y-3 border-t border-border pt-5"><HealthRow label="Network sync" value={!online ? "Offline · queued" : offlineQueue.length ? `${offlineQueue.length} order(s) syncing` : "Online"} /><HealthRow label="Branch" value={dashboard.activeBranch?.name ?? "—"} /></div>
        </aside>
      </section>
      {receipt ? <article id="novara-pos-receipt" className="sr-only"><h1>Novara · {dashboard.tenant?.name}</h1><p>{dashboard.activeBranch?.name}</p><p>Receipt #{receipt.id.slice(0, 8).toUpperCase()}</p><p>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}</p><hr/>{receipt.items.map((item, index) => <p key={`${item.name}-${index}`}>{item.quantity} × {item.name} — {formatMoney(item.unitPrice * item.quantity, currency)}</p>)}<hr/><strong>Total · {formatMoney(receipt.total, currency)}</strong><p>Thank you for visiting.</p></article> : null}
      <section className="mt-5 overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Service activity</p><h2 className="mt-1 text-lg font-semibold">Recent orders</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{ordersQuery.data?.length ?? 0} in this branch</span></div>
        {ordersQuery.isPending ? <div className="h-40 animate-pulse rounded-xl bg-secondary/60" aria-busy="true" /> : ordersQuery.isError ? <WorkspaceError message={getErrorMessage(ordersQuery.error)} error={ordersQuery.error} retry={() => void ordersQuery.refetch()} /> : <DataTable rows={ordersQuery.data ?? []} columns={orderColumns} getRowId={(order) => order.id} enableSearch searchPlaceholder="Search order, product or staff…" empty={<div className="px-4 py-12 text-center"><p className="font-medium">No orders for this branch yet</p><p className="mt-1 text-sm text-muted-foreground">Orders created at this register will appear here.</p></div>} />}
      </section>
    </>
  );
}

function KitchenContent({ dashboard }: { dashboard: DashboardPayload }) {
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id;
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ["kitchen-orders", tenantId, branchId], queryFn: () => getKitchenOrders(tenantId, branchId), enabled: Boolean(tenantId), refetchInterval: 5_000, retry: false });
  const update = useMutation({ mutationFn: ({ id, kitchenStatus }: { id: string; kitchenStatus: "PREPARING" | "READY" }) => updateKitchenOrder(tenantId, id, kitchenStatus), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["kitchen-orders", tenantId] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]); } });
  const tickets = orders.data ?? [];
  const waiting = tickets.filter((order) => order.kitchenStatus === "PENDING").length;
  const preparing = tickets.filter((order) => order.kitchenStatus === "PREPARING").length;
  const ready = tickets.filter((order) => order.kitchenStatus === "READY").length;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        title="Incoming orders"
        value={String(waiting)}
        note="Orders waiting in the queue"
        icon={ClipboardList}
        accent
      />
      <MetricCard
        title="Items to prepare"
        value={String(tickets.reduce((count, order) => count + order.items.reduce((sum, item) => sum + Number(item.quantity), 0), 0))}
        note={`${preparing} currently preparing`}
        icon={ChefHat}
      />
      <MetricCard
        title="Ready to serve"
        value={String(ready)}
        note="Awaiting pickup or service"
        icon={Check}
      />
      <div className="sm:col-span-3">
        {orders.isPending ? <div className="h-48 animate-pulse rounded-2xl bg-secondary/60" aria-busy="true" /> : orders.isError ? <WorkspaceError message={getErrorMessage(orders.error)} error={orders.error} retry={() => void orders.refetch()} /> : tickets.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tickets.map((order) => <article key={order.id} className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{order.branch.name}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase", order.kitchenStatus === "PENDING" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : order.kitchenStatus === "READY" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-blue-500/10 text-blue-800 dark:text-blue-300")}>{order.kitchenStatus.toLowerCase()}</span></div><p className="mt-1 text-xs text-muted-foreground">Received {new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(order.createdAt))}</p><ul className="my-4 space-y-2 border-y border-border py-4">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.product.name}</span><span className="font-semibold tabular-nums">× {item.quantity}</span></li>)}</ul>{order.kitchenStatus === "READY" ? <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-center text-sm font-medium text-emerald-800 dark:text-emerald-300">Ready to serve</p> : <Button className="w-full" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, kitchenStatus: order.kitchenStatus === "PENDING" ? "PREPARING" : "READY" })}>{order.kitchenStatus === "PENDING" ? "Start preparing" : "Mark ready"}</Button>}</article>)}</div> : <EmptyPanel icon={ChefHat} title="Kitchen is all caught up" description="Incoming tickets refresh automatically and stay scoped to your assigned branch." tag="LIVE KITCHEN QUEUE" />}
        {update.error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(update.error)}</p> : null}
      </div>
    </div>
  );
}

function InventoryContent({ dashboard }: { dashboard: DashboardPayload }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Low stock"
          value="0"
          note="Items below par level"
          icon={Package}
          accent
        />
        <MetricCard
          title="Recent movements"
          value="0"
          note="Stock changes this week"
          icon={Activity}
        />
        <MetricCard
          title="Pending purchases"
          value="0"
          note="Awaiting delivery"
          icon={Truck}
        />
        <MetricCard
          title="Waste log"
          value="0"
          note="Entries this month"
          icon={Boxes}
        />
      </section>
      <div className="mt-5">
        <EmptyPanel
          icon={Package}
          title="Inventory workspace is being prepared"
          description={`Stock controls for ${dashboard.activeBranch?.name ?? "your branch"} will appear here. The MVP dashboard starts with the sales, POS and kitchen workflows.`}
        />
      </div>
    </>
  );
}

function AdminContent({ dashboard }: { dashboard: DashboardPayload }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Businesses"
          value={String(dashboard.metrics.businesses ?? 0)}
          note="All registered workspaces"
          icon={Building2}
          accent
        />
        <MetricCard
          title="Active"
          value={String(dashboard.metrics.activeBusinesses ?? 0)}
          note="Currently operating"
          icon={Store}
        />
        <MetricCard
          title="Suspended"
          value={String(dashboard.metrics.suspendedBusinesses ?? 0)}
          note="Access paused"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Accounts"
          value={String(dashboard.metrics.users ?? 0)}
          note="Across all businesses"
          icon={Users}
        />
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-border/75 bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-sm text-muted-foreground">Platform</p>
            <h2 className="mt-1 text-xl font-semibold">Recent businesses</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">
            Latest 8
          </span>
        </div>
        {dashboard.businessesList?.length ? (
          <ul className="divide-y divide-border">
            {dashboard.businessesList.map((business) => (
              <li
                key={business.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{business.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {new Date(business.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                  {business.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No businesses registered yet.
          </div>
        )}
      </section>
    </>
  );
}

function RoleDashboardContent({
  requestedView,
}: {
  requestedView?: DashboardView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [logoutAction, setLogoutAction] = useState<ActionModel | null>(null);
  const loggedInUserQuery = useQuery({
    queryKey: authQueryKeys.loggedInUser,
    queryFn: authApi.getLoggedInUser,
    retry: false,
    staleTime: 30_000,
  });
  const loggedInUser = loggedInUserQuery.data;
  const memberships = loggedInUser?.memberships ?? [];
  const activeTenantId =
    searchParams.get("tenantId") ?? memberships[0]?.tenant.id;
  const activeMembership =
    memberships.find((membership) => membership.tenant.id === activeTenantId) ??
    (searchParams.has("tenantId") ? undefined : memberships[0]);
  const role =
    loggedInUser?.platformRole ??
    (loggedInUser?.isPlatformAdmin ? "PLATFORM_ADMIN" : activeMembership?.role);
  const correctView = role ? viewByRole[role] : undefined;
  const view = requestedView ?? correctView;
  const activeBranchId = searchParams.get("branchId") ?? undefined;
  const dashboardQuery = useQuery({
    queryKey: dashboardKeys.view(
      view ?? "overview",
      activeTenantId,
      activeBranchId,
    ),
    queryFn: () =>
      getDashboard(view ?? "overview", activeTenantId, activeBranchId),
    enabled:
      !!loggedInUser &&
      !!view &&
      !!role &&
      !loggedInUser.platformRole &&
      (role === "PLATFORM_ADMIN" || !!activeMembership),
    retry: false,
  });
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  useEffect(() => {
    if (
      loggedInUserQuery.error instanceof ApiError &&
      loggedInUserQuery.error.statusCode === 401
    )
      router.replace("/login");
  }, [loggedInUserQuery.error, router]);
  useEffect(() => {
    if (!loggedInUser || !role || !correctView) return;
    if (pathname === "/dashboard" && (role === "OWNER" || role === "MANAGER"))
      return;
    if (
      pathname === "/dashboard" &&
      (role === "PLATFORM_ADMIN" ||
        role === "SUPER_ADMIN" ||
        role === "SUPPORT_AGENT")
    ) {
      router.replace(ROLE_HOME[role]);
      return;
    }
    if (
      pathname === "/dashboard" &&
      requestedView === undefined &&
      correctView !== "overview"
    )
      router.replace(ROLE_HOME[role]);
    if (requestedView && !viewsByRole[role]?.includes(requestedView))
      router.replace(ROLE_HOME[role]);
  }, [loggedInUser, role, correctView, pathname, requestedView, router]);

  const visibleNav = useMemo(() => {
    const items = navigation[role ?? ""] ?? [];
    return items.filter((item) => {
      if (item.capability && !roleHasCapability(role, item.capability))
        return false;
      return (
        !item.permission ||
        (dashboardQuery.data?.permissions?.[item.permission] ??
          (role === "OWNER" || role === "MANAGER"))
      );
    });
  }, [role, dashboardQuery.data?.permissions]);

  function switchTenant(tenantId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tenantId", tenantId);
    params.delete("branchId");
    router.push(`${pathname}?${params.toString()}`);
  }
  function switchBranch(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (branchId) params.set("branchId", branchId);
    else params.set("branchId", "all");
    router.push(`${pathname}?${params.toString()}`);
  }

  if (loggedInUserQuery.isPending) return <LoadingWorkspace />;
  if (loggedInUserQuery.isError)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <WorkspaceError
          message={getErrorMessage(loggedInUserQuery.error)}
          error={loggedInUserQuery.error}
          retry={() => void loggedInUserQuery.refetch()}
        />
      </main>
    );
  if (!loggedInUser || !role)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="max-w-md rounded-2xl border border-border bg-card p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Building2 className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">No workspace access</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your account is not assigned to a business workspace. Ask an owner
            to invite you, then sign in again.
          </p>
          <Button className="mt-5" onClick={() => logoutMutation.mutate()}>
            Sign out
          </Button>
        </section>
      </main>
    );
  if (dashboardQuery.isPending) return <LoadingWorkspace />;

  const isForbidden =
    dashboardQuery.error instanceof ApiError &&
    dashboardQuery.error.statusCode === 403;
  if (dashboardQuery.isError)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <WorkspaceError
          message={
            isForbidden
              ? "Your account does not have access to this dashboard."
              : getErrorMessage(dashboardQuery.error)
          }
          error={dashboardQuery.error}
          retry={() => void dashboardQuery.refetch()}
        />
      </main>
    );
  const dashboard = dashboardQuery.data;
  const heading = roleTitles[role] ?? "Workspace";
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const sidebarTopContent = (
    <div className="mt-4 space-y-3 px-4">
      <div className="relative rounded-xl border border-border/70 bg-background p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {dashboard.tenant?.name ?? "Novara Platform"}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {dashboard.activeBranch?.name ??
                (role === "PLATFORM_ADMIN"
                  ? "Platform administration"
                  : "Workspace")}
            </p>
          </div>
          {memberships.length > 1 ? (
            <SelectField aria-label="Switch business" value={activeTenantId} onValueChange={switchTenant} options={memberships.map(({ tenant }) => ({ value: tenant.id, label: tenant.name }))} triggerClassName="h-9 w-9 justify-center gap-0 border-0 bg-transparent px-0 shadow-none hover:bg-secondary/80" />
          ) : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </div>
      {dashboard.branches && dashboard.branches.length > 1 ? (
        <label className="mt-3 block px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Branch
          <SelectField value={dashboard.activeBranch?.id ?? "all"} onValueChange={switchBranch} options={[{ value: "all", label: "All assigned branches" }, ...dashboard.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} triggerClassName="mt-1.5 normal-case tracking-normal" />
        </label>
      ) : null}
    </div>
  );
  const sidebarFooter = (
      <div className="rounded-xl bg-secondary/80 p-3.5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium">All systems operational</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Your workspace is up to date.
        </p>
      </div>
  );

  return (
    <SidebarProvider className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(139,159,151,.12),transparent_35%),var(--background)] text-foreground">
      <WorkspaceSidebar
        role={role}
        tenantName={dashboard.tenant?.name ?? "Novara Platform"}
        groups={[{ label: "Workspace", items: visibleNav }]}
        activePath={pathname}
        brandHref={ROLE_HOME[role] ?? "/dashboard"}
        treatUnspecifiedAsReady={false}
        topContent={sidebarTopContent}
        footer={sidebarFooter}
        showLogout={false}
      />
      <SidebarInset>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger />
              <div className="min-w-0">
                <p className="hidden text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground sm:block">
                  {dashboard.tenant?.name ?? "Novara control room"}
                </p>
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  {heading}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WorkspaceSearch groups={[{ label: "Workspace", items: visibleNav }]} />
              <Button
                variant="ghost"
                size="icon-lg"
                className="relative"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
              </Button>
              <ThemeToggle />
              <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {loggedInUser.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="hidden xl:block">
                  <p className="text-xs font-semibold">{loggedInUser.name}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                    {roleName(role)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Sign out"
                title="Sign out"
                disabled={logoutMutation.isPending}
                onClick={() =>
                  setLogoutAction({
                    kind: "LOGOUT",
                    subject: loggedInUser.name,
                  })
                }
              >
                <LogOut className="size-[18px]" />
              </Button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] p-4 pb-10 sm:p-7 xl:px-10 xl:py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{date}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-.03em] sm:text-[28px]">{`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${loggedInUser.name.split(" ")[0]}`}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {roleDescriptions[role]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dashboard.dataStatus === "NO_OPERATIONAL_DATA" &&
                role !== "PLATFORM_ADMIN" ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Awaiting sales data
                  </span>
                ) : null}
                <button
                  onClick={() => void dashboardQuery.refetch()}
                  className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
                >
                  Refresh
                </button>
              </div>
            </div>
            {logoutMutation.error ? (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {getErrorMessage(logoutMutation.error)}
              </div>
            ) : null}
            {dashboard.view === "overview" ? (
              <OverviewContent dashboard={dashboard} role={role} />
            ) : dashboard.view === "pos" ? (
              <PosContent key={`${dashboard.tenant?.id ?? "platform"}:${dashboard.activeBranch?.id ?? "default"}`} dashboard={dashboard} role={role} actorId={loggedInUser?.id ?? "anonymous"} />
            ) : dashboard.view === "kitchen" ? (
              <KitchenContent dashboard={dashboard} />
            ) : dashboard.view === "inventory" ? (
              <InventoryContent dashboard={dashboard} />
            ) : (
              <AdminContent dashboard={dashboard} />
            )}
            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5 text-xs text-muted-foreground">
              <span>
                © {new Date().getFullYear()} Novara · Hospitality, in harmony
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5" />
                Workspace status normal
              </span>
            </footer>
          </main>
        </div>
      </SidebarInset>
      {logoutAction ? (
        <ActionDialog
          action={logoutAction}
          open
          pending={logoutMutation.isPending}
          onOpenChange={(open) => {
            if (!open) setLogoutAction(null);
          }}
          onConfirm={() => logoutMutation.mutate()}
          error={
            logoutMutation.error
              ? getErrorMessage(logoutMutation.error)
              : undefined
          }
        />
      ) : null}
    </SidebarProvider>
  );
}

function LoadingWorkspace() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[260px] border-r border-border/70 bg-card p-6 lg:block">
        <div className="h-9 w-36 animate-pulse rounded bg-secondary" />
        <div className="mt-10 h-16 animate-pulse rounded-xl bg-secondary" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-secondary/80"
            />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6 sm:p-10">
        <div className="mx-auto max-w-6xl" aria-busy="true">
          <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded bg-secondary" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl bg-secondary/70"
              />
            ))}
          </div>
          <p className="sr-only">Loading your Novara workspace…</p>
        </div>
      </main>
    </div>
  );
}

export function DashboardHome() {
  return <RoleDashboard />;
}

export function RoleDashboard({
  requestedView,
}: {
  requestedView?: DashboardView;
}) {
  return (
    <Suspense fallback={<LoadingWorkspace />}>
      <RoleDashboardContent requestedView={requestedView} />
    </Suspense>
  );
}
