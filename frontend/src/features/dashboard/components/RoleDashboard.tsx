"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Armchair,
  Bell,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  ClipboardCheck,
  Clock3,
  CreditCard,
  LayoutDashboard,
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
  TrendingUp,
  AlertTriangle,
  Utensils,
} from "lucide-react";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceSearch } from "@/components/layout/WorkspaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
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
import { appendPosOrderItems, completePosOrder, createPosOrder, listDiningTables, listPosOrders, sendOrderToKitchen, type PosCartLine, type PosOrderRecord } from "@/features/pos/api/posApi";
import { ProductGrid } from "@/features/menu/components/ProductGrid";
import { getKitchenOrders, updateKitchenOrder } from "@/features/kitchen/api/kitchenApi";
import { getCurrentShift } from "@/features/shifts/api/shiftApi";
import { replaceOfflineOrderQueue, useOfflineOrderQueue } from "@/features/pos/hooks/useOfflineOrderQueue";
import { cn } from "@/lib/utils";
import { getSalesReport, getInventoryReport } from "@/features/reports/api/reportApi";
import { getPurchaseOrders } from "@/features/purchasing/api/purchasingApi";
import { getStocktakes } from "@/features/inventory/api/stocktakeApi";
import { listReadyOrderItems } from "@/features/pos/api/posApi";
import { CompletePaymentDialog } from "@/features/pos/components/CompletePaymentDialog";
import type { PosPaymentInput } from "@/features/pos/api/posApi";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  MANAGER: "/dashboard",
  CASHIER: "/pos",
  WAITER: "/tables",
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
    { label: "Tables", href: "/tables", icon: Store, capability: "orders.read" },
    { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    {
      label: "Menu & products",
      href: "/menu/products",
      icon: Coffee,
      ready: true,
    },
    { label: "Modifiers", href: "/menu/modifiers", icon: Coffee, ready: true },
    {
      label: "Inventory",
      href: "/inventory",
      icon: Package,
      capability: "inventory.read",
      permission: "inventoryRead",
    },
    { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read", permission: "inventoryRead" },
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
    { label: "Branches", href: "/settings/branches", icon: Building2, capability: "settings.read", ready: true },
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
    { label: "Audit log", href: "/audit-log", icon: ShieldCheck, ready: false },
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
    { label: "Tables", href: "/tables", icon: Store, capability: "orders.read" },
    { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    {
      label: "Menu & products",
      href: "/menu/products",
      icon: Coffee,
      ready: true,
    },
    { label: "Modifiers", href: "/menu/modifiers", icon: Coffee, ready: true },
    {
      label: "Inventory",
      href: "/inventory",
      icon: Package,
      capability: "inventory.read",
      permission: "inventoryRead",
    },
    { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read", permission: "inventoryRead" },
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
      href: "/tables",
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
  ],
  INVENTORY_MANAGER: [
    { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read", ready: true },
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
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id;
  const branchTimezone = dashboard.activeBranch?.timezone;
  const [clockNow, setClockNow] = useState(0);
  useEffect(() => {
    const updateClock = () => setClockNow(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  const range = { from: dateKey(from, branchTimezone), to: dateKey(today, branchTimezone) };
  const report = useQuery({
    queryKey: ["reports", tenantId, "dashboard-week", branchId, range.from, range.to],
    queryFn: () => getSalesReport(tenantId, { ...range, ...(branchId ? { branchId } : {}) }),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false,
    retry: false,
  });
  const todayReport = useQuery({
    queryKey: ["reports", tenantId, "dashboard-today", branchId, range.to],
    queryFn: () => getSalesReport(tenantId, { from: range.to, to: range.to, ...(branchId ? { branchId } : {}) }),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false,
    retry: false,
  });
  const inventory = useQuery({
    queryKey: ["reports", tenantId, "dashboard-inventory", branchId],
    queryFn: () => getInventoryReport(tenantId, branchId),
    enabled: Boolean(tenantId && dashboard.permissions?.inventoryRead),
    staleTime: 30_000,
    refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false,
    retry: false,
  });
  const branchReports = useQueries({
    queries: (role === "OWNER" && (dashboard.branches?.length ?? 0) > 1 ? dashboard.branches ?? [] : []).map((branch) => ({
      queryKey: ["reports", tenantId, "dashboard-branch", branch.id, range.from, range.to],
      queryFn: () => getSalesReport(tenantId, { ...range, branchId: branch.id }),
      enabled: Boolean(tenantId),
      staleTime: 30_000,
      refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false,
      retry: false,
    })),
  });
  const reportDaily = report.data?.daily ?? [];
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(from);
    date.setDate(from.getDate() + index);
    const key = dateKey(date, branchTimezone);
    return reportDaily.find((item) => item.date.slice(0, 10) === key) ?? { date: key, orders: 0, sales: 0 };
  });
  const todayKey = dateKey(today, branchTimezone);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todaySales = daily.find((item) => item.date.slice(0, 10) === todayKey)?.sales ?? Number(metrics.netSales ?? 0);
  const yesterdaySales = daily.find((item) => item.date.slice(0, 10) === dateKey(yesterday, branchTimezone))?.sales;
  const orderCount = daily.find((item) => item.date.slice(0, 10) === todayKey)?.orders ?? 0;
  const averageOrderValue = orderCount > 0 ? todaySales / orderCount : 0;
  const changePercent = yesterdaySales && yesterdaySales !== 0 ? ((todaySales - yesterdaySales) / Math.abs(yesterdaySales)) * 100 : null;
  const lowStockRows = inventory.data?.lowStock ?? [];
  const chartMaximum = Math.max(1, ...daily.map((item) => item.sales));
  const openOrders = dashboard.openOrderQueue ?? [];
  const hourlySales = dashboard.hourlySales ?? Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, orders: 0 }));
  const hourlyMaximum = Math.max(1, ...hourlySales.map((item) => item.sales));
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Sales today"
          value={formatMoney(todaySales, currency)}
          note={`${orderCount} orders · ${formatMoney(averageOrderValue, currency)} average order`}
          icon={CircleDollarSign}
          accent
        />
        <MetricCard
          title="Compared with yesterday"
          value={changePercent === null ? "—" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`}
          note={yesterdaySales === undefined ? "Yesterday’s comparable sales are unavailable" : formatMoney(yesterdaySales, currency)}
          icon={TrendingUp}
        />
        <MetricCard
          title="Refunds today"
          value={formatMoney(metrics.refunds, currency)}
          note="Refund value recorded today"
          icon={ArrowUpRight}
        />
        <MetricCard
          title="Low stock items"
          value={String(lowStockRows.length || metrics.lowStock || 0)}
          note="Ingredients at or below reorder level"
          icon={Package}
        />
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.85fr)]">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Performance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Net sales · last 7 days
              </h2>
            </div>
            <span className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium">{report.isFetching ? "Updating" : "Live report"}</span>
          </div>
          {report.isPending ? <div className="mt-7 h-48 animate-pulse rounded-xl bg-secondary/60" aria-busy="true" /> : report.isError ? <div role="alert" className="mt-6 rounded-xl border border-destructive/20 p-4 text-sm text-destructive">Sales trend is unavailable. <Button variant="outline" size="sm" className="ml-2" onClick={() => void report.refetch()}>Retry</Button></div> : daily.length ? <div className="mt-7 grid h-48 grid-cols-7 items-end gap-2 border-b border-border px-1 sm:gap-4" role="img" aria-label="Net sales by day for the last seven days">{daily.map((item) => <div key={item.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2"><span title={formatMoney(item.sales, currency)} className="w-full max-w-12 rounded-t-md bg-primary/75 transition-all" style={{ height: `${Math.max(3, (item.sales / chartMaximum) * 100)}%` }} /><span className="pb-2 text-[10px] text-muted-foreground sm:text-[11px]">{new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${item.date.slice(0, 10)}T12:00:00`))}</span></div>)}</div> : <div className="mt-7 grid h-48 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">No completed sales in this period</div>}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Net sales · last 7 days</span>
            <span className="font-semibold">
              {formatMoney(daily.reduce((sum, item) => sum + item.sales, 0), currency)}
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
              label="Open orders"
              value={String(metrics.openOrders ?? 0)}
            />
            {role === "OWNER" && dashboard.permissions?.reportsProfitRead ? <>
              <HealthRow label="Food cost" value={report.data?.summary.foodCostPercent === undefined ? "Not enough recipe cost data" : `${report.data.summary.foodCostPercent.toFixed(1)}%`} />
              <HealthRow
                label="Gross profit"
                value={report.data?.summary.profit === undefined ? "Not enough recipe cost data" : formatMoney(report.data.summary.profit, currency)}
              />
            </> : null}
            <HealthRow label="Refunds today" value={`${formatMoney(metrics.refunds, currency)} · ${todayReport.data?.summary.refundCount ?? "—"} refunds`} />
            {dashboard.branches && dashboard.branches.length > 1 ? <HealthRow label="Branches" value={`${dashboard.branches.length} accessible`} /> : null}
          </div>
          <p className="mt-5 rounded-xl bg-secondary/75 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
            {role === "MANAGER"
              ? "Profit and food-cost reporting are withheld unless your account has the corresponding permission."
              : "Financial totals use completed orders and recorded refunds for your selected branch scope."}
          </p>
        </article>
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Product performance</p><h2 className="mt-1 text-xl font-semibold">Best sellers</h2></div><Utensils className="size-5 text-primary"/></div>{report.isPending ? <LoadingRowsDashboard/> : report.isError ? <p className="mt-4 text-sm text-muted-foreground">Best sellers are unavailable.</p> : report.data?.bestSellers.length ? <div className="mt-4 divide-y divide-border/70">{report.data.bestSellers.slice(0, 5).map((product, index) => <div key={product.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span><span className="text-right text-xs text-muted-foreground">{product.quantity} sold<br/><strong className="text-foreground">{formatMoney(product.sales, currency)}</strong></span></div>)}</div> : <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No product sales in the selected period.</p>}</article>
        {role === "OWNER" && (dashboard.branches?.length ?? 0) > 1 ? <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Branch performance</p><h2 className="mt-1 text-xl font-semibold">Branch comparison</h2></div><Building2 className="size-5 text-primary"/></div><div className="mt-4 divide-y divide-border/70">{dashboard.branches?.map((branch, index) => { const query = branchReports[index]; return <div key={branch.id} className="flex items-center justify-between gap-4 py-3"><span className="truncate text-sm font-medium">{branch.name}</span><span className="text-sm font-semibold tabular-nums">{query?.isPending ? "Loading…" : query?.isError ? "Unavailable" : formatMoney(query?.data?.summary.netSales ?? 0, currency)}</span></div>; })}</div></article> : null}
      </section>
      {role === "MANAGER" ? <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div><p className="text-sm text-muted-foreground">Staffing signal</p><h2 className="mt-1 text-xl font-semibold">Hourly sales today</h2></div><div className="mt-5 grid h-40 items-end gap-1" style={{ gridTemplateColumns: "repeat(24,minmax(0,1fr))" }} aria-label="Hourly sales today">{hourlySales.map((slot) => <div key={slot.hour} className="flex h-full min-w-0 flex-col items-center justify-end gap-1"><span title={`${slot.orders} orders · ${formatMoney(slot.sales, currency)}`} className="w-full rounded-t bg-primary/75" style={{ height: `${slot.sales > 0 ? Math.max(5, slot.sales / hourlyMaximum * 100) : 2}%` }}/><span className="text-[8px] text-muted-foreground">{slot.hour % 3 === 0 ? String(slot.hour).padStart(2, "0") : ""}</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">{branchTimezone ? `Times shown in ${branchTimezone}.` : "Times use each assigned branch’s local timezone."}</p></article><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Service queue</p><h2 className="mt-1 text-xl font-semibold">Open orders</h2></div><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold">{metrics.openOrders ?? 0}</span></div>{openOrders.length ? <div className="mt-4 divide-y divide-border/70">{openOrders.map((order) => { const ageMinutes = Math.max(0, Math.floor((clockNow - new Date(order.createdAt).getTime()) / 60_000)); return <div key={order.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{order.table ? `Table ${order.table.name}` : `Order #${order.id.slice(-6).toUpperCase()}`}</p><p className="mt-1 text-xs text-muted-foreground">{ageMinutes} min · {order.createdBy.name}</p></div><span className="text-sm font-semibold">{formatMoney(Number(order.totalAmount), currency)}</span></div>; })}</div> : <p className="mt-5 text-sm text-muted-foreground">No open orders.</p>}</article></section> : null}
      {role === "MANAGER" ? <section className="mt-5 rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Order review</p><h2 className="mt-1 text-xl font-semibold">Refund and void activity</h2></div><CircleAlert className="size-5 text-primary"/></div><p className="mt-2 text-xs text-muted-foreground">Recent refunds and cancellations in your assigned branches.</p>{(dashboard.reviewOrders ?? []).length ? <div className="mt-3 divide-y divide-border/70">{dashboard.reviewOrders?.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm font-medium">{order.table ? `Table ${order.table.name}` : `Order #${order.id.slice(-6).toUpperCase()}`} · {order.status.replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</span></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No recent refunds or voids.</p>}</section> : null}
      {lowStockRows.length ? <section className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/[.035] p-5"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-amber-600"/><div><h2 className="font-semibold">Low stock attention</h2><p className="text-sm text-muted-foreground">{lowStockRows.slice(0, 4).map((row) => `${row.ingredient.name} (${row.quantity} ${row.ingredient.unit})`).join(" · ")}</p></div></div></section> : null}
      {dashboard.shiftAlerts?.length ? <section className="mt-5 rounded-2xl border border-amber-500/25 bg-card p-5"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-amber-600"/><div><h2 className="font-semibold">Cash variances to review</h2><p className="text-sm text-muted-foreground">Recent closed shifts with a recorded drawer difference.</p></div></div><div className="mt-4 divide-y divide-border/70">{dashboard.shiftAlerts.slice(0, 5).map((shift) => <div key={shift.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{shift.user.name} · {shift.branch.name}{shift.closedAt ? ` · ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(shift.closedAt))}` : ""}</span><span className="text-sm font-semibold tabular-nums">{formatMoney(shift.cashVariance, currency)}</span></div>)}</div></section> : null}
      {role === "OWNER" ? <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Last 7 days</p><h2 className="mt-1 text-xl font-semibold">Payment mix</h2></div><CircleDollarSign className="size-5 text-primary"/></div>{report.isPending ? <LoadingRowsDashboard/> : report.isError ? <p className="mt-4 text-sm text-destructive">Payment summary unavailable.</p> : report.data?.paymentBreakdown.length ? <div className="mt-4 space-y-4">{report.data.paymentBreakdown.map((payment) => { const total = report.data!.paymentBreakdown.reduce((sum, item) => sum + item.amount, 0); const percent = total > 0 ? payment.amount / total * 100 : 0; return <div key={payment.method}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span>{payment.method.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</span><span className="font-medium tabular-nums">{formatMoney(payment.amount, currency)} · {percent.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }}/></div></div>; })}</div> : <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Payments will appear after completed sales.</p>}</article><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Business setup</p><h2 className="mt-1 text-xl font-semibold">Workspace readiness</h2></div><Settings2 className="size-5 text-primary"/></div><div className="mt-4 space-y-3"><HealthRow label="Products without recipes" value={String(dashboard.setup?.unrecipeProducts ?? 0)}/><HealthRow label="Subscription plan" value={dashboard.setup?.planName ?? "No plan selected"}/><HealthRow label="Branch usage" value={`${dashboard.setup?.branchUsage ?? 0}${dashboard.setup?.branchLimit ? ` / ${dashboard.setup.branchLimit}` : ""}`}/><HealthRow label="Team usage" value={`${dashboard.setup?.staffUsage ?? 0}${dashboard.setup?.staffLimit ? ` / ${dashboard.setup.staffLimit}` : ""}`}/>{dashboard.setup?.trialDaysRemaining !== null && dashboard.setup?.trialDaysRemaining !== undefined ? <HealthRow label="Trial days remaining" value={String(dashboard.setup.trialDaysRemaining)}/> : null}</div></article></section> : null}
    </>
  );
}

function dateKey(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function LoadingRowsDashboard() { return <div className="mt-4 space-y-3" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary/60"/>)}<span className="sr-only">Loading report data…</span></div>; }
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
  tableId,
}: {
  dashboard: DashboardPayload;
  role: string;
  actorId: string;
  tableId?: string;
}) {
  const metrics = dashboard.metrics;
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id ?? dashboard.branches?.[0]?.id ?? "";
  const currency = dashboard.tenant?.currency ?? "NPR";
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [waiterView, setWaiterView] = useState<"new-order" | "tables" | "recent-orders">("new-order");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; items: Array<{ name: string; quantity: number; unitPrice: number }>; total: number } | null>(null);
  const [receiptPrintCount, setReceiptPrintCount] = useState(0);
  const [paymentTarget, setPaymentTarget] = useState<PosOrderRecord | null>(null);
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
          await createPosOrder(current.tenantId, current.branchId, current.items, current.clientOrderId, undefined, true, current.createdAt);
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
    refetchInterval: () => (role === "CASHIER" || role === "WAITER") && typeof document !== "undefined" && document.visibilityState === "visible" ? 5_000 : false,
    retry: false,
  });
  const tableQuery = useQuery({ queryKey: ["dining-tables", tenantId, branchId], queryFn: () => listDiningTables(tenantId, branchId), enabled: Boolean(tenantId && branchId && (role === "WAITER" || tableId)), refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 5_000 : false, retry: false });
  const readyItemsQuery = useQuery({ queryKey: ["ready-order-items", tenantId, branchId], queryFn: () => listReadyOrderItems(tenantId, branchId), enabled: Boolean(tenantId && branchId && role === "WAITER"), refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 5_000 : false, retry: false });
  const selectedTable = tableId ? tableQuery.data?.find((table) => table.id === tableId) : undefined;
  const currentOpenOrderId = openOrderId ?? selectedTable?.openOrder?.id ?? null;
  const createOrderMutation = useMutation({
    mutationFn: (clientOrderId: string) => tableId && currentOpenOrderId ? appendPosOrderItems(tenantId, currentOpenOrderId, cart) : createPosOrder(tenantId, branchId, cart, clientOrderId, tableId),
    onSuccess: async (order) => {
      setError("");
      if (role === "WAITER" && !tableId) {
        setOpenOrderId(null);
        setCart([]);
        setCashReceived("");
        setMessage(`Order #${order.id.slice(-6).toUpperCase()} saved and sent to the kitchen. A cashier can take payment when it is ready.`);
      } else if (role === "WAITER" && tableId && currentOpenOrderId) {
        setCart([]);
        setMessage("Items added to the table order. Send any new items to the kitchen when ready.");
      } else if (role === "WAITER") {
        setOpenOrderId(order.id);
        setCart([]);
        setMessage(`Order saved for table service. Send the ticket to the kitchen when you are ready.`);
      } else {
        setOpenOrderId(order.id);
        setMessage("Order saved. Complete it when payment and preparation are confirmed.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["dining-tables", tenantId] }),
      ]);
    },
    onError: (reason, clientOrderId) => {
      if (reason instanceof ApiError && reason.code === "NETWORK_ERROR") {
        replaceOfflineOrderQueue(queueKey, (current) => [...current, { clientOrderId, tenantId, branchId, items: cart, createdAt: Date.now() }]);
        setCart([]);
        setError("");
        setMessage("Connection lost. This order is saved on this device and will sync when you reconnect.");
      } else setError(getErrorMessage(reason));
    },
  });
  const sendKitchenMutation = useMutation({
    mutationFn: () => sendOrderToKitchen(tenantId, currentOpenOrderId ?? ""),
    onSuccess: async ({ items }) => {
      setOpenOrderId(null);
      setMessage(items.length ? `${items.length} item${items.length === 1 ? "" : "s"} sent to the kitchen.` : "There are no unsent items on this order.");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] }), queryClient.invalidateQueries({ queryKey: ["dining-tables", tenantId] }), queryClient.invalidateQueries({ queryKey: ["kitchen-queue", tenantId] })]);
    },
    onError: (reason) => setError(getErrorMessage(reason)),
  });
  const completeOrderMutation = useMutation({
    mutationFn: () => completePosOrder(tenantId, currentOpenOrderId ?? "", { method: "CASH", cashReceived: Number(cashReceived || cartTotal) }),
    onSuccess: async (order) => {
      setReceipt({ id: order.id, items: cart.map((line) => ({ name: cartProduct(line.productId)?.name ?? "Item", quantity: line.quantity, unitPrice: lineUnitPrice(line) })), total: cartTotal });
      setReceiptPrintCount(0);
      setOpenOrderId(null);
      setCart([]);
      setCashReceived("");
      setError("");
      setMessage("Order completed and recipe stock movements were recorded.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["dining-tables", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (reason) => setError(getErrorMessage(reason)),
  });
  const waiterPaymentMutation = useMutation({
    mutationFn: ({ orderId, payment }: { orderId: string; payment: PosPaymentInput }) => completePosOrder(tenantId, orderId, payment),
    onSuccess: async (order) => {
      setPaymentTarget(null);
      setMessage(`Payment completed for order #${order.id.slice(-6).toUpperCase()}. The order and stock ledger are up to date.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos-orders", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["dining-tables", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["inventory", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
  const products = (menuQuery.data ?? []).filter((product) => product.isAvailable);
  const cartProduct = (productId: string) => products.find((product) => product.id === productId);
  const lineUnitPrice = (line: PosCartLine) => {
    const product = cartProduct(line.productId);
    const selectedOptionIds = line.optionIds ?? [];
    const modifierDelta = product?.modifierGroups?.flatMap(({ group }) => group.options)
      .filter((option) => selectedOptionIds.includes(option.id))
      .reduce((sum, option) => sum + Number(option.priceDelta), 0) ?? 0;
    return Number(product?.price ?? 0) + modifierDelta;
  };
  const cartTotal = cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0);
  function updateQuantity(product: MenuProduct, delta: number, optionIds?: string[]) {
    setCart((current) => {
      if (delta < 0 && optionIds === undefined) {
        const lastLineIndex = current.findLastIndex((line) => line.productId === product.id);
        if (lastLineIndex < 0) return current;
        return current.flatMap((line, index) => index !== lastLineIndex || line.quantity > 1
          ? index === lastLineIndex ? [{ ...line, quantity: line.quantity - 1 }] : [line]
          : []);
      }
      const normalizedOptions = [...(optionIds ?? [])].sort();
      const existingIndex = current.findIndex((line) => line.productId === product.id &&
        [...(line.optionIds ?? [])].sort().join("|") === normalizedOptions.join("|"));
      if (existingIndex < 0 && delta > 0) return [...current, { productId: product.id, quantity: 1, optionIds: normalizedOptions }];
      if (existingIndex < 0) return current;
      return current.flatMap((line, index) => index !== existingIndex || line.quantity + delta > 0
        ? index === existingIndex ? [{ ...line, quantity: line.quantity + delta }] : [line]
        : []);
    });
  }
  const pending = createOrderMutation.isPending || completeOrderMutation.isPending || sendKitchenMutation.isPending;
  const diningTables = tableQuery.data ?? [];
  const occupiedTables = diningTables.filter((table) => table.status === "OCCUPIED").length;
  const availableTables = diningTables.filter((table) => table.status === "FREE").length;
  const billRequestedTables = diningTables.filter((table) => table.status === "BILL_REQUESTED").length;
  const serviceOrders = (ordersQuery.data ?? [])
    .filter((order) => order.status === "OPEN")
    .sort((left, right) => Number(Boolean(right.billRequestedAt)) - Number(Boolean(left.billRequestedAt)) || Number(Boolean(right.table)) - Number(Boolean(left.table)) || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const orderColumns: DataColumn<PosOrderRecord>[] = [
    { id: "id", header: "Order", cell: (order) => <span className="font-mono text-xs font-semibold">#{order.id.slice(-6).toUpperCase()}</span>, accessorFn: (order) => order.id },
    { id: "table", header: "Table", cell: (order) => order.table ? <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Table {order.table.name}</span> : <span className="text-xs text-muted-foreground">Counter</span>, accessorFn: (order) => order.table?.name ?? "Counter" },
    { id: "items", header: "Items", cell: (order) => <span className="block max-w-64 truncate">{order.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ")}</span>, accessorFn: (order) => order.items.map((item) => item.product.name).join(" ") },
    { id: "createdBy", header: "Staff", cell: (order) => <span>{order.createdBy.name}<span className="ml-1 text-xs text-muted-foreground">{order.createdBy.role?.replaceAll("_", " ")}</span></span>, accessorFn: (order) => `${order.createdBy.name} ${order.createdBy.role ?? ""}` },
    { id: "createdAt", header: "Created", cell: (order) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt)), accessorFn: (order) => new Date(order.createdAt).getTime() },
    { id: "status", header: "Status", cell: (order) => <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", order.status === "OPEN" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : order.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{order.status === "OPEN" && order.billRequestedAt ? "BILL REQUESTED" : order.status}</span>, accessorFn: (order) => order.billRequestedAt ? "BILL REQUESTED" : order.status },
    { id: "totalAmount", header: "Total", cell: (order) => <span className="tabular-nums">{formatMoney(Number(order.totalAmount), currency)}</span>, accessorFn: (order) => Number(order.totalAmount) },
  ];
  return (
    <>
      {role === "WAITER" ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active tables" value={tableQuery.isPending ? "—" : String(diningTables.length)} note="Tables in this branch" icon={Armchair} accent />
        <MetricCard title="Occupied" value={tableQuery.isPending ? "—" : String(occupiedTables)} note="Currently serving guests" icon={Store} />
        <MetricCard title="Available" value={tableQuery.isPending ? "—" : String(availableTables)} note="Ready to start an order" icon={ShoppingBag} />
        <MetricCard title="Bill requested" value={tableQuery.isPending ? "—" : String(billRequestedTables)} note="Ready for checkout" icon={ReceiptText} />
      </section> : <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="My sales today" value={formatMoney(metrics.ownSalesToday, currency)} note="Your completed sales today" icon={Store} accent />
        <MetricCard title="Orders today" value={String(metrics.ownOrdersToday ?? 0)} note="Orders you have handled" icon={ReceiptText} />
        <MetricCard title="Shift status" value={cashierShift.isPending ? "Checking…" : cashierShift.data?.status ?? "NOT STARTED"} note={cashierShift.data ? `Opening ${formatMoney(cashierShift.data.openingCash, currency)} · expected ${formatMoney(Number(cashierShift.data.openingCash) + Number(cashierShift.data.expectedCash), currency)}` : "Open a register shift before cash sales"} icon={Clock3} />
      </section>}
      {role === "CASHIER" ? <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/75 bg-card p-4"><div><p className="text-sm font-semibold">Cash drawer</p><p className="mt-1 text-xs text-muted-foreground">{cashierShift.data ? `Opened ${new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(cashierShift.data.openedAt))} · expected cash includes cash sales and movements.` : cashierShift.isError ? `Shift status unavailable: ${getErrorMessage(cashierShift.error)}` : "Start your shift to take cash payments."}</p></div><Button variant={cashierShift.data ? "outline" : "default"} render={<Link href={`/shift?tenantId=${tenantId}&branchId=${branchId}`}/>}><Clock3 className="size-4"/>{cashierShift.data ? "Review shift" : "Open shift"}</Button></section> : null}
      {role === "CASHIER" ? <section className="mt-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium text-primary">Service handoff</p><h2 className="mt-1 text-xl font-semibold">Open orders to settle</h2><p className="mt-1 text-sm text-muted-foreground">Branch orders from the service team, with table, staff, items and total. Bill requests appear first.</p></div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{serviceOrders.length} awaiting checkout</span>
        </div>
        {cashierShift.isError ? <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm"><span>Shift status could not be verified. Payment actions are disabled until it is available.</span><Button type="button" size="sm" variant="outline" onClick={() => void cashierShift.refetch()}>Retry shift check</Button></div> : null}
        {!cashierShift.isPending && !cashierShift.isError && !cashierShift.data ? <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm"><span>Open your register shift before taking payment for a waiter order.</span><Button size="sm" render={<Link href={`/shift?tenantId=${tenantId}&branchId=${branchId}`} />}>Open shift</Button></div> : null}
        {ordersQuery.isPending ? <div className="h-40 animate-pulse rounded-xl bg-secondary/60" aria-busy="true" /> : ordersQuery.isError ? <WorkspaceError message={getErrorMessage(ordersQuery.error)} error={ordersQuery.error} retry={() => void ordersQuery.refetch()} /> : serviceOrders.length ? <DataTable rows={serviceOrders} columns={orderColumns} getRowId={(order) => order.id} enableRowSelection={false} enableSearch searchPlaceholder="Search staff, table, order or item…" actions={(order) => <Button type="button" size="sm" disabled={!cashierShift.data || cashierShift.isError || waiterPaymentMutation.isPending} onClick={() => { waiterPaymentMutation.reset(); setPaymentTarget(order); }}><CreditCard aria-hidden className="size-4" />Take payment</Button>} empty={<p className="py-8 text-center text-sm text-muted-foreground">No open orders match your search.</p>} /> : <div className="rounded-xl border border-dashed border-border p-8 text-center"><ClipboardList aria-hidden className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-3 font-semibold">No open orders to settle</h3><p className="mt-1 text-sm text-muted-foreground">New branch orders will appear here automatically.</p></div>}
      </section> : null}
      {role === "WAITER" ? <section className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[.035] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Ready to serve</p><p className="mt-1 text-xs text-muted-foreground">Kitchen-ready items for your branch</p></div><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold">{readyItemsQuery.data?.length ?? 0}</span></div>{readyItemsQuery.isError ? <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-destructive">{getErrorMessage(readyItemsQuery.error)}</span><Button size="sm" variant="outline" onClick={() => void readyItemsQuery.refetch()}>Retry</Button></div> : readyItemsQuery.data?.length ? <ul className="mt-3 divide-y divide-border/70">{readyItemsQuery.data.slice(0, 5).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span className="font-medium">{item.quantity} × {item.product.name}<span className="ml-2 font-normal text-muted-foreground">{item.order.table?.name ?? `Order #${item.order.id.slice(-6).toUpperCase()}`}</span></span><span className="text-xs text-muted-foreground">Ready</span></li>)}</ul> : !readyItemsQuery.isPending ? <p className="mt-3 text-sm text-muted-foreground">No ready items right now.</p> : <div className="mt-3 h-10 animate-pulse rounded-lg bg-secondary/60" aria-busy="true"/>}</section> : null}
      {role === "WAITER" ? <div role="tablist" aria-label="Service workspace" className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-card p-2">
        <Button type="button" role="tab" aria-selected={waiterView === "new-order"} variant={waiterView === "new-order" ? "default" : "ghost"} onClick={() => setWaiterView("new-order")}><Store aria-hidden />New order</Button>
        <Button type="button" role="tab" aria-selected={waiterView === "tables"} variant={waiterView === "tables" ? "default" : "ghost"} onClick={() => setWaiterView("tables")}><Armchair aria-hidden />Tables</Button>
        <Button type="button" role="tab" aria-selected={waiterView === "recent-orders"} variant={waiterView === "recent-orders" ? "default" : "ghost"} onClick={() => setWaiterView("recent-orders")}><ClipboardList aria-hidden />Recent orders</Button>
      </div> : null}
      {role === "WAITER" && tableQuery.isError ? <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><span>Table status could not be loaded: {getErrorMessage(tableQuery.error)}</span><Button type="button" variant="outline" onClick={() => void tableQuery.refetch()}>Retry</Button></div> : null}
      {role === "WAITER" && waiterView === "tables" ? <section className="mt-5 rounded-2xl border border-border/75 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">{dashboard.activeBranch?.name ?? "Selected branch"}</p><h2 className="mt-1 text-xl font-semibold">Service floor</h2><p className="mt-1 text-sm text-muted-foreground">Choose a table to open its order. Occupied tables show the current ticket and total.</p></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{diningTables.length} active tables</span></div>
        {tableQuery.isPending ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-secondary/60" />)}</div> : diningTables.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{diningTables.map((table) => <article key={table.id} className={cn("rounded-xl border p-4", table.status === "FREE" ? "border-emerald-500/20 bg-emerald-500/[.035]" : table.status === "BILL_REQUESTED" ? "border-amber-500/25 bg-amber-500/[.04]" : "border-primary/25 bg-primary/[.035]")}>
          <div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-lg bg-primary/10 px-3 py-1.5 text-lg font-bold tracking-tight text-primary">{table.name}</span><p className="mt-2 text-sm font-medium">{table.section ?? "Dining area"}</p><p className="mt-0.5 text-xs text-muted-foreground">{table.seats} seats · {table.branch.name}</p></div><span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">{table.status.replaceAll("_", " ")}</span></div>
          {table.openOrder ? <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3"><div><p className="text-xs text-muted-foreground">Current order</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(Number(table.openOrder.totalAmount), currency)}</p></div><p className="text-right text-xs text-muted-foreground">Started by<br/><span className="font-medium text-foreground">{table.openOrder.createdBy.name}</span></p></div> : <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">Available for new guests</p>}
          <Button className="mt-4 w-full" variant={table.status === "FREE" ? "default" : "outline"} render={<Link href={`/pos?tenantId=${tenantId}&branchId=${branchId}&tableId=${table.id}`} />}>{table.status === "FREE" ? "Start table order" : table.status === "BILL_REQUESTED" ? "Review table bill" : "Open table order"}</Button>
        </article>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><Armchair className="mx-auto size-8 text-muted-foreground"/><h3 className="mt-3 font-semibold">No tables set up for this branch</h3><p className="mt-1 text-sm text-muted-foreground">Ask an Owner or Manager to add tables and service sections.</p></div>}
      </section> : null}
      {role === "WAITER" && waiterView === "recent-orders" ? <section className="mt-5 rounded-2xl border border-border/75 bg-card p-4 shadow-sm sm:p-6"><div className="mb-4"><p className="text-sm text-muted-foreground">{dashboard.activeBranch?.name ?? "Selected branch"}</p><h2 className="mt-1 text-xl font-semibold">Recent table orders</h2><p className="mt-1 text-sm text-muted-foreground">Table number, order status, and total stay visible while you serve.</p></div>{ordersQuery.isPending ? <div className="h-40 animate-pulse rounded-xl bg-secondary/60" aria-busy="true"/> : ordersQuery.isError ? <WorkspaceError message={getErrorMessage(ordersQuery.error)} error={ordersQuery.error} retry={() => void ordersQuery.refetch()}/> : <DataTable rows={ordersQuery.data ?? []} columns={orderColumns} getRowId={(order) => order.id} enableSearch searchPlaceholder="Search table, order or item…" empty={<p className="px-4 py-12 text-center text-sm text-muted-foreground">No orders have been opened for this branch yet.</p>}/>}</section> : null}
      {(role !== "WAITER" || waiterView === "new-order") ? <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{tableId ? selectedTable ? <><span className="inline-flex rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">Dine-in · Table {selectedTable.name}</span>{selectedTable.section ? <span>· {selectedTable.section}</span> : null}</> : tableQuery.isPending ? "Loading selected table…" : "Selected table unavailable" : role === "WAITER" ? "Select a table to begin service" : "Counter service · no table selected"}</p><h2 className="mt-1 text-xl font-semibold">{role === "WAITER" ? "Table service menu" : "Register menu"}</h2></div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{dashboard.activeBranch?.name ?? "Choose a branch"}</span>
          </div>
          {role === "WAITER" && !tableId ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4"><p className="text-sm text-muted-foreground">Start from the service floor so every order is attached to the correct table and section.</p><Button size="sm" render={<Link href={`/tables?tenantId=${tenantId}&branchId=${branchId}`} />} disabled={!branchId}>Open tables</Button></div> : null}
          {menuQuery.isPending ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary/70" />)}</div> : menuQuery.isError ? <WorkspaceError message={getErrorMessage(menuQuery.error)} error={menuQuery.error} retry={() => void menuQuery.refetch()} /> : products.length ? (
            <ProductGrid products={products} cart={cart} currency={currency} disabled={(role === "WAITER" && !tableId) || Boolean(currentOpenOrderId && !(role === "WAITER" && tableId)) || pending} onQuantityChange={updateQuantity} />
          ) : <EmptyPanel icon={ShoppingBag} title="No available products" description="Add and activate products in Menu to start taking orders." tag="MENU EMPTY" />}
        </article>
        <aside className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">Current ticket</p><h2 className="mt-1 text-xl font-semibold">Order summary</h2>
          {error ? <p role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="mt-4 rounded-lg border border-border bg-secondary/60 p-3 text-xs leading-5">{message}</p> : null}
          <div className="mt-5 space-y-3">{cart.length ? cart.map((line) => {
            const product = cartProduct(line.productId);
            const selectedOptionIds = line.optionIds ?? [];
            const optionLabels = product?.modifierGroups?.flatMap(({ group }) => group.options)
              .filter((option) => selectedOptionIds.includes(option.id)).map((option) => option.name) ?? [];
            return product ? <div key={`${product.id}:${[...selectedOptionIds].sort().join(",")}`} className="flex items-start justify-between gap-4 text-sm"><span className="min-w-0">{line.quantity} × {product.name}{optionLabels.length ? <span className="mt-0.5 block text-xs text-muted-foreground">{optionLabels.join(" · ")}</span> : null}</span><span className="shrink-0 font-medium tabular-nums">{formatMoney(lineUnitPrice(line) * line.quantity, currency)}</span></div> : null;
          }) : <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Choose menu items to begin an order.</p>}</div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Total</span><strong className="text-lg tabular-nums">{formatMoney(cartTotal, currency)}</strong></div>
          {role === "CASHIER" && !cashierShift.data ? <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">{cashierShift.isError ? "Your open shift could not be verified. Retry the shift check before taking payment." : "Open your cash drawer shift before completing cash sales."} <a className="font-semibold underline" href={`/shift?tenantId=${tenantId}&branchId=${branchId}`}>Open shift</a></p> : null}
          {currentOpenOrderId && role !== "WAITER" ? <div className="mt-4 space-y-2"><label htmlFor="cash-received" className="text-xs font-medium text-muted-foreground">Cash received</label><Input id="cash-received" inputMode="decimal" type="number" min={cartTotal} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder={cartTotal.toFixed(2)} /><p className="text-xs text-muted-foreground">Change due: {formatMoney(Math.max(0, Number(cashReceived || cartTotal) - cartTotal), currency)}</p></div> : null}
          {tableId && tableQuery.isError ? <p role="alert" className="mt-3 text-xs text-destructive">The selected table could not be loaded. Return to Tables and open it again.</p> : null}
          {tableId && !tableQuery.isPending && !tableQuery.isError && !selectedTable ? <p role="alert" className="mt-3 text-xs text-destructive">This table is not available at the selected branch. Return to Tables and choose a valid table.</p> : null}
          {role === "WAITER" && !tableId ? <Button className="mt-5 w-full" render={<Link href={`/tables?tenantId=${tenantId}&branchId=${branchId}`} />} disabled={!branchId}>Choose a table to start</Button> : <Button className="mt-5 w-full" disabled={!branchId || !cart.length || pending || Boolean(tableId && (tableQuery.isPending || tableQuery.isError || !selectedTable)) || Boolean(currentOpenOrderId && !(role === "WAITER" && tableId))} onClick={() => { setError(""); if (!navigator.onLine) { createOrderMutation.mutate(crypto.randomUUID()); return; } createOrderMutation.mutate(crypto.randomUUID()); }}>{createOrderMutation.isPending ? "Saving order…" : tableId && currentOpenOrderId ? "Add items to order" : tableId ? "Save table order" : online ? "Save order" : "Queue order offline"}</Button>}
          {currentOpenOrderId && role === "WAITER" ? <Button className="mt-2 w-full" variant="secondary" disabled={pending} onClick={() => { setError(""); sendKitchenMutation.mutate(); }}>{sendKitchenMutation.isPending ? "Sending ticket…" : "Send to kitchen"}</Button> : null}
          {currentOpenOrderId && role !== "WAITER" ? <Button className="mt-2 w-full" variant="secondary" disabled={pending || (role === "CASHIER" && (!cashierShift.data || cashierShift.isError))} onClick={() => { setError(""); completeOrderMutation.mutate(); }}>{completeOrderMutation.isPending ? "Completing…" : "Take cash & complete order"}</Button> : null}
          {receipt ? <Button type="button" className="mt-2 w-full" variant="outline" onClick={() => { setReceiptPrintCount((count) => count + 1); window.print(); }}>{receiptPrintCount ? "Reprint receipt" : "Print receipt"}</Button> : null}
          {!branchId ? <p className="mt-3 text-xs text-destructive">Your account needs an assigned branch before it can create an order.</p> : null}
          <div className="mt-6 space-y-3 border-t border-border pt-5"><HealthRow label="Network sync" value={!online ? "Offline · queued" : offlineQueue.length ? `${offlineQueue.length} order(s) syncing` : "Online"} /><HealthRow label="Branch" value={dashboard.activeBranch?.name ?? "—"} /></div>
        </aside>
      </section> : null}
      {receipt ? <article id="novara-pos-receipt" className="sr-only"><h1>Novara · {dashboard.tenant?.name}</h1>{receiptPrintCount > 1 ? <p className="receipt-duplicate">DUPLICATE</p> : null}<p>{dashboard.activeBranch?.name}</p><p>Receipt #{receipt.id.slice(-6).toUpperCase()}</p><p>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}</p><hr/>{receipt.items.map((item, index) => <p key={`${item.name}-${index}`}>{item.quantity} × {item.name} — {formatMoney(item.unitPrice * item.quantity, currency)}</p>)}<hr/><strong>Total · {formatMoney(receipt.total, currency)}</strong><p>Thank you for visiting.</p></article> : null}
      {paymentTarget ? <CompletePaymentDialog key={paymentTarget.id} order={paymentTarget} currency={currency} open pending={waiterPaymentMutation.isPending} error={waiterPaymentMutation.error ? getErrorMessage(waiterPaymentMutation.error) : undefined} requireReference onClose={() => { if (!waiterPaymentMutation.isPending) setPaymentTarget(null); }} onSubmit={(payment) => waiterPaymentMutation.mutate({ orderId: paymentTarget.id, payment })} /> : null}
      {role !== "WAITER" ? <section className="mt-5 overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Service activity</p><h2 className="mt-1 text-lg font-semibold">Recent orders</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{ordersQuery.data?.length ?? 0} in this branch</span></div>
        {ordersQuery.isPending ? <div className="h-40 animate-pulse rounded-xl bg-secondary/60" aria-busy="true" /> : ordersQuery.isError ? <WorkspaceError message={getErrorMessage(ordersQuery.error)} error={ordersQuery.error} retry={() => void ordersQuery.refetch()} /> : <DataTable rows={role === "CASHIER" ? (ordersQuery.data ?? []).filter((order) => order.createdBy.id === actorId) : (ordersQuery.data ?? [])} columns={orderColumns} getRowId={(order) => order.id} enableSearch searchPlaceholder="Search order, product or staff…" empty={<div className="px-4 py-12 text-center"><p className="font-medium">{role === "CASHIER" ? "No orders handled by you yet" : "No orders for this branch yet"}</p><p className="mt-1 text-sm text-muted-foreground">Recent service activity will appear here.</p></div>} />}
      </section> : null}
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
        {orders.isPending ? <div className="h-48 animate-pulse rounded-2xl bg-secondary/60" aria-busy="true" /> : orders.isError ? <WorkspaceError message={getErrorMessage(orders.error)} error={orders.error} retry={() => void orders.refetch()} /> : tickets.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tickets.map((order) => <article key={order.id} className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-6).toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{order.branch.name}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase", order.kitchenStatus === "PENDING" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : order.kitchenStatus === "READY" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-blue-500/10 text-blue-800 dark:text-blue-300")}>{order.kitchenStatus.toLowerCase()}</span></div><p className="mt-1 text-xs text-muted-foreground">Received {new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(order.createdAt))}</p><ul className="my-4 space-y-2 border-y border-border py-4">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.product.name}</span><span className="font-semibold tabular-nums">× {item.quantity}</span></li>)}</ul>{order.kitchenStatus === "READY" ? <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-center text-sm font-medium text-emerald-800 dark:text-emerald-300">Ready to serve</p> : <Button className="w-full" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, kitchenStatus: order.kitchenStatus === "PENDING" ? "PREPARING" : "READY" })}>{order.kitchenStatus === "PENDING" ? "Start preparing" : "Mark ready"}</Button>}</article>)}</div> : <EmptyPanel icon={ChefHat} title="Kitchen is all caught up" description="Incoming tickets refresh automatically and stay scoped to your assigned branch." tag="LIVE KITCHEN QUEUE" />}
        {update.error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(update.error)}</p> : null}
      </div>
    </div>
  );
}

function InventoryContent({ dashboard }: { dashboard: DashboardPayload }) {
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id;
  const inventory = useQuery({ queryKey: ["reports", tenantId, "dashboard-inventory", branchId], queryFn: () => getInventoryReport(tenantId, branchId), enabled: Boolean(tenantId), staleTime: 30_000, refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false, retry: false });
  const purchases = useQuery({ queryKey: ["purchases", tenantId, "dashboard"], queryFn: () => getPurchaseOrders(tenantId), enabled: Boolean(tenantId), staleTime: 30_000, refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false, retry: false });
  const stocktakes = useQuery({ queryKey: ["stocktakes", tenantId, branchId, "dashboard"], queryFn: () => getStocktakes(tenantId, branchId), enabled: Boolean(tenantId), staleTime: 30_000, refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false, retry: false });
  const movements = inventory.data?.movements ?? [];
  const pendingPurchases = (purchases.data ?? []).filter((purchase) => purchase.status === "ORDERED" || purchase.status === "PARTIALLY_RECEIVED");
  const wasteByIngredient = dashboard.wasteByIngredient ?? [];
  const activeStocktake = (stocktakes.data ?? []).find((stocktake) => stocktake.status === "DRAFT");
  const movementTypeLabel = (type: string) => type.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Low stock"
          value={inventory.isPending ? "…" : String(inventory.data?.lowStock.length ?? 0)}
          note="Ingredients at or below reorder level"
          icon={Package}
          accent
        />
        <MetricCard
          title="Recent movements"
          value={inventory.isPending ? "…" : String(movements.length)}
          note="Latest ledger entries"
          icon={Activity}
        />
        <MetricCard
          title="Pending purchases"
          value={purchases.isPending ? "…" : String(pendingPurchases.length)}
          note="Ordered or partly received"
          icon={Truck}
        />
        <MetricCard
          title="Waste this week"
          value={inventory.isPending ? "…" : String(dashboard.metrics.wasteEntries ?? 0)}
          note={`${formatMoney(Number(dashboard.metrics.wasteValue ?? 0), dashboard.tenant?.currency ?? "NPR")} recorded this week`}
          icon={Boxes}
        />
      </section>
      {inventory.isError || purchases.isError || stocktakes.isError ? <section role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><span>{getErrorMessage(inventory.error ?? purchases.error ?? stocktakes.error)}</span><Button variant="outline" onClick={() => { void inventory.refetch(); void purchases.refetch(); void stocktakes.refetch(); }}>Retry</Button></section> : null}
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Reorder attention</p><h2 className="mt-1 text-xl font-semibold">Low-stock ingredients</h2></div><Package className="size-5 text-primary"/></div>{inventory.isPending ? <LoadingRowsDashboard/> : inventory.data?.lowStock.length ? <div className="mt-4 divide-y divide-border/70">{inventory.data.lowStock.slice(0, 8).map((row) => <div key={row.id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 truncate text-sm font-medium">{row.ingredient.name}<span className="ml-2 text-xs text-muted-foreground">{row.branch.name}</span></span><span className="shrink-0 text-right text-sm font-semibold tabular-nums">{row.quantity} <span className="text-xs font-normal text-muted-foreground">/ {row.reorderLevel} {row.ingredient.unit}</span></span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">All tracked ingredients are above their reorder levels.</div>}</article>
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Stock ledger</p><h2 className="mt-1 text-xl font-semibold">Recent movements</h2></div><Activity className="size-5 text-primary"/></div>{inventory.isPending ? <LoadingRowsDashboard/> : movements.length ? <div className="mt-4 divide-y divide-border/70">{movements.slice(0, 6).map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{movement.ingredient.name}</p><p className="mt-1 text-xs text-muted-foreground">{movement.branch.name} · {movementTypeLabel(movement.type)} · {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(movement.createdAt))}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{movement.quantity} {movement.ingredient.unit}</span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Stock receipts, waste, adjustments and sales deductions will appear here.</div>}</article>
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Receiving</p><h2 className="mt-1 text-xl font-semibold">Open purchases</h2></div><Truck className="size-5 text-primary"/></div>{purchases.isPending ? <LoadingRowsDashboard/> : pendingPurchases.length ? <div className="mt-4 divide-y divide-border/70">{pendingPurchases.slice(0, 6).map((purchase) => <div key={purchase.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{purchase.supplier.name}</p><p className="mt-1 text-xs text-muted-foreground">{purchase.branch.name} · {purchase.status.replaceAll("_", " ")}</p></div><span className="text-sm font-semibold tabular-nums">{formatMoney(purchase.totalAmount, dashboard.tenant?.currency ?? "NPR")}</span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No purchases are waiting to be received.</div>}</article><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Counting</p><h2 className="mt-1 text-xl font-semibold">Stocktake</h2></div><ClipboardCheck className="size-5 text-primary"/></div>{stocktakes.isPending ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-secondary/60" aria-busy="true"/> : activeStocktake ? <div className="mt-4 rounded-xl bg-secondary/60 p-4"><p className="font-medium">Count in progress</p><p className="mt-1 text-sm text-muted-foreground">Started {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(activeStocktake.startedAt))} · {activeStocktake._count?.lines ?? activeStocktake.lines?.length ?? 0} items counted</p><Button className="mt-4" variant="outline" render={<Link href="/inventory/stocktakes"/>}>Continue stocktake</Button></div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No count is in progress.</div>}</article></section>
      <section className="mt-5 rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">This week</p><h2 className="mt-1 text-xl font-semibold">Waste by ingredient</h2></div><Boxes className="size-5 text-primary"/></div>{inventory.isPending ? <LoadingRowsDashboard/> : wasteByIngredient.length ? <div className="mt-4 divide-y divide-border/70">{wasteByIngredient.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.quantity.toLocaleString()} {item.unit} discarded</p></div><span className="text-sm font-semibold tabular-nums">{formatMoney(item.value, dashboard.tenant?.currency ?? "NPR")}</span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No waste has been recorded this business week.</div>}</section>
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
    refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 30_000 : false,
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
          <Button className="mt-5" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
            Sign out
          </Button>
          {logoutMutation.error ? <p role="alert" className="mt-3 text-sm text-destructive">{getErrorMessage(logoutMutation.error)}</p> : null}
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
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[.06] px-3 py-2.5">
        <span className="relative grid size-2 shrink-0 place-items-center"><span className="absolute size-2 animate-ping rounded-full bg-emerald-500/40"/><span className="relative size-1.5 rounded-full bg-emerald-500"/></span>
        <div className="min-w-0"><p className="truncate text-xs font-medium">Workspace operational</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">Services are running normally</p></div>
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
      />
      <SidebarInset>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SidebarTrigger />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
                  {roleName(role)} workspace
                </p>
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  {heading}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
            {dashboard.view === "overview" ? (
              <OverviewContent dashboard={dashboard} role={role} />
            ) : dashboard.view === "pos" ? (
              <PosContent key={`${dashboard.tenant?.id ?? "platform"}:${dashboard.activeBranch?.id ?? "default"}:${searchParams.get("tableId") ?? "walk-in"}`} dashboard={dashboard} role={role} actorId={loggedInUser?.id ?? "anonymous"} tableId={searchParams.get("tableId") ?? undefined} />
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
