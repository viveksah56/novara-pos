import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CircleAlert,
  CircleDollarSign,
  Package,
  Settings2,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardPayload } from "@/features/dashboard/api";
import { HealthRow } from "@/features/dashboard/components/shared/HealthRow";
import { LoadingRows } from "@/features/dashboard/components/shared/LoadingRows";
import { MetricCard } from "@/features/dashboard/components/shared/MetricCard";
import { dateKey } from "@/features/dashboard/lib/dateKey";
import { pollWhenVisible } from "@/lib/polling";
import { getInventoryReport, getSalesReport } from "@/features/reports/api/reportApi";
import { formatDateTime } from "@/lib/formatDateTime";
import { formatMoney } from "@/lib/formatMoney";

export function OverviewContent({
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
    refetchInterval: pollWhenVisible(30_000),
    retry: false,
  });
  const todayReport = useQuery({
    queryKey: ["reports", tenantId, "dashboard-today", branchId, range.to],
    queryFn: () => getSalesReport(tenantId, { from: range.to, to: range.to, ...(branchId ? { branchId } : {}) }),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    refetchInterval: pollWhenVisible(30_000),
    retry: false,
  });
  const inventory = useQuery({
    queryKey: ["reports", tenantId, "dashboard-inventory", branchId],
    queryFn: () => getInventoryReport(tenantId, branchId),
    enabled: Boolean(tenantId && dashboard.permissions?.inventoryRead),
    staleTime: 30_000,
    refetchInterval: pollWhenVisible(30_000),
    retry: false,
  });
  const branchReports = useQueries({
    queries: (role === "OWNER" && (dashboard.branches?.length ?? 0) > 1 ? dashboard.branches ?? [] : []).map((branch) => ({
      queryKey: ["reports", tenantId, "dashboard-branch", branch.id, range.from, range.to],
      queryFn: () => getSalesReport(tenantId, { ...range, branchId: branch.id }),
      enabled: Boolean(tenantId),
      staleTime: 30_000,
      refetchInterval: pollWhenVisible(30_000),
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
          {report.isPending ? <div className="mt-7 h-48 animate-pulse rounded-xl bg-secondary/60" aria-busy="true" /> : report.isError ? <div role="alert" className="mt-6 rounded-xl border border-destructive/20 p-4 text-sm text-destructive">Sales trend is unavailable. <Button variant="outline" size="sm" className="ml-2" onClick={() => void report.refetch()}>Retry</Button></div> : daily.length ? <div className="mt-7 grid h-48 grid-cols-7 items-end gap-2 border-b border-border px-1 sm:gap-4" role="img" aria-label="Net sales by day for the last seven days">{daily.map((item) => <div key={item.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2"><span title={formatMoney(item.sales, currency)} className="w-full max-w-12 rounded-t-md bg-primary/75 transition-all" style={{ height: `${Math.max(3, (item.sales / chartMaximum) * 100)}%` }} /><span className="pb-2 text-[10px] text-muted-foreground sm:text-[11px]">{formatDateTime(new Date(`${item.date.slice(0, 10)}T12:00:00`), "en", { weekday: "short" })}</span></div>)}</div> : <div className="mt-7 grid h-48 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">No completed sales in this period</div>}
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
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Product performance</p><h2 className="mt-1 text-xl font-semibold">Best sellers</h2></div><Utensils className="size-5 text-primary"/></div>{report.isPending ? <LoadingRows/> : report.isError ? <p className="mt-4 text-sm text-muted-foreground">Best sellers are unavailable.</p> : report.data?.bestSellers.length ? <div className="mt-4 divide-y divide-border/70">{report.data.bestSellers.slice(0, 5).map((product, index) => <div key={product.id} className="flex items-center gap-3 py-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span><span className="text-right text-xs text-muted-foreground">{product.quantity} sold<br/><strong className="text-foreground">{formatMoney(product.sales, currency)}</strong></span></div>)}</div> : <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No product sales in the selected period.</p>}</article>
        {role === "OWNER" && (dashboard.branches?.length ?? 0) > 1 ? <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Branch performance</p><h2 className="mt-1 text-xl font-semibold">Branch comparison</h2></div><Building2 className="size-5 text-primary"/></div><div className="mt-4 divide-y divide-border/70">{dashboard.branches?.map((branch, index) => { const query = branchReports[index]; return <div key={branch.id} className="flex items-center justify-between gap-4 py-3"><span className="truncate text-sm font-medium">{branch.name}</span><span className="text-sm font-semibold tabular-nums">{query?.isPending ? "Loading…" : query?.isError ? "Unavailable" : formatMoney(query?.data?.summary.netSales ?? 0, currency)}</span></div>; })}</div></article> : null}
      </section>
      {role === "MANAGER" ? <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div><p className="text-sm text-muted-foreground">Staffing signal</p><h2 className="mt-1 text-xl font-semibold">Hourly sales today</h2></div><div className="mt-5 grid h-40 items-end gap-1" style={{ gridTemplateColumns: "repeat(24,minmax(0,1fr))" }} aria-label="Hourly sales today">{hourlySales.map((slot) => <div key={slot.hour} className="flex h-full min-w-0 flex-col items-center justify-end gap-1"><span title={`${slot.orders} orders · ${formatMoney(slot.sales, currency)}`} className="w-full rounded-t bg-primary/75" style={{ height: `${slot.sales > 0 ? Math.max(5, slot.sales / hourlyMaximum * 100) : 2}%` }}/><span className="text-[8px] text-muted-foreground">{slot.hour % 3 === 0 ? String(slot.hour).padStart(2, "0") : ""}</span></div>)}</div><p className="mt-3 text-xs text-muted-foreground">{branchTimezone ? `Times shown in ${branchTimezone}.` : "Times use each assigned branch’s local timezone."}</p></article><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Service queue</p><h2 className="mt-1 text-xl font-semibold">Open orders</h2></div><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold">{metrics.openOrders ?? 0}</span></div>{openOrders.length ? <div className="mt-4 divide-y divide-border/70">{openOrders.map((order) => { const ageMinutes = Math.max(0, Math.floor((clockNow - new Date(order.createdAt).getTime()) / 60_000)); return <div key={order.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{order.table ? `Table ${order.table.name}` : `Order #${order.id.slice(-6).toUpperCase()}`}</p><p className="mt-1 text-xs text-muted-foreground">{ageMinutes} min · {order.createdBy.name}</p></div><span className="text-sm font-semibold">{formatMoney(Number(order.totalAmount), currency)}</span></div>; })}</div> : <p className="mt-5 text-sm text-muted-foreground">No open orders.</p>}</article></section> : null}
      {role === "MANAGER" ? <section className="mt-5 rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Order review</p><h2 className="mt-1 text-xl font-semibold">Refund and void activity</h2></div><CircleAlert className="size-5 text-primary"/></div><p className="mt-2 text-xs text-muted-foreground">Recent refunds and cancellations in your assigned branches.</p>{(dashboard.reviewOrders ?? []).length ? <div className="mt-3 divide-y divide-border/70">{dashboard.reviewOrders?.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm font-medium">{order.table ? `Table ${order.table.name}` : `Order #${order.id.slice(-6).toUpperCase()}`} · {order.status.replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{formatDateTime(new Date(order.createdAt), "en", { dateStyle: "medium", timeStyle: "short" })}</span></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No recent refunds or voids.</p>}</section> : null}
      {lowStockRows.length ? <section className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/[.035] p-5"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-amber-600"/><div><h2 className="font-semibold">Low stock attention</h2><p className="text-sm text-muted-foreground">{lowStockRows.slice(0, 4).map((row) => `${row.ingredient.name} (${row.quantity} ${row.ingredient.unit})`).join(" · ")}</p></div></div></section> : null}
      {dashboard.shiftAlerts?.length ? <section className="mt-5 rounded-2xl border border-amber-500/25 bg-card p-5"><div className="flex items-center gap-3"><AlertTriangle className="size-5 text-amber-600"/><div><h2 className="font-semibold">Cash variances to review</h2><p className="text-sm text-muted-foreground">Recent closed shifts with a recorded drawer difference.</p></div></div><div className="mt-4 divide-y divide-border/70">{dashboard.shiftAlerts.slice(0, 5).map((shift) => <div key={shift.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">{shift.user.name} · {shift.branch.name}{shift.closedAt ? ` · ${formatDateTime(new Date(shift.closedAt), "en", { dateStyle: "medium" })}` : ""}</span><span className="text-sm font-semibold tabular-nums">{formatMoney(shift.cashVariance, currency)}</span></div>)}</div></section> : null}
      {role === "OWNER" ? <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Last 7 days</p><h2 className="mt-1 text-xl font-semibold">Payment mix</h2></div><CircleDollarSign className="size-5 text-primary"/></div>{report.isPending ? <LoadingRows/> : report.isError ? <p className="mt-4 text-sm text-destructive">Payment summary unavailable.</p> : report.data?.paymentBreakdown.length ? <div className="mt-4 space-y-4">{report.data.paymentBreakdown.map((payment) => { const total = report.data!.paymentBreakdown.reduce((sum, item) => sum + item.amount, 0); const percent = total > 0 ? payment.amount / total * 100 : 0; return <div key={payment.method}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span>{payment.method.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</span><span className="font-medium tabular-nums">{formatMoney(payment.amount, currency)} · {percent.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }}/></div></div>; })}</div> : <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Payments will appear after completed sales.</p>}</article><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Business setup</p><h2 className="mt-1 text-xl font-semibold">Workspace readiness</h2></div><Settings2 className="size-5 text-primary"/></div><div className="mt-4 space-y-3"><HealthRow label="Products without recipes" value={String(dashboard.setup?.unrecipeProducts ?? 0)}/><HealthRow label="Subscription plan" value={dashboard.setup?.planName ?? "No plan selected"}/><HealthRow label="Branch usage" value={`${dashboard.setup?.branchUsage ?? 0}${dashboard.setup?.branchLimit ? ` / ${dashboard.setup.branchLimit}` : ""}`}/><HealthRow label="Team usage" value={`${dashboard.setup?.staffUsage ?? 0}${dashboard.setup?.staffLimit ? ` / ${dashboard.setup.staffLimit}` : ""}`}/>{dashboard.setup?.trialDaysRemaining !== null && dashboard.setup?.trialDaysRemaining !== undefined ? <HealthRow label="Trial days remaining" value={String(dashboard.setup.trialDaysRemaining)}/> : null}</div></article></section> : null}
    </>
  );
}
