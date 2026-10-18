"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/formatDateTime";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, CalendarDays, Download, Package, TrendingUp } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { getInventoryReport, getSalesReport, type InventoryReport, type SalesReport } from "@/features/reports/api/reportApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatMoney";
import { PAYMENT_METHOD_LABELS, UNIT_PRESENTATION, type MeasureUnit } from "@/constants/system-constants";

type Props = { kind: "sales" | "inventory" };

export function ReportConsole({ kind }: Props) {
  const params = useSearchParams();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const memberships = profile.data?.memberships ?? [];
  const selectedTenant = params.get("tenantId");
  const membership = memberships.find((item) => item.tenant.id === selectedTenant) ?? memberships[0];
  const role = membership?.role ?? "";
  const tenantId = membership?.tenant.id ?? "";
  const branches = useMemo(() => role === "OWNER" ? membership?.tenant.branches ?? [] : (membership?.tenant.branches ?? []).filter((branch) => membership?.branchAssignments.some((assignment) => assignment.branchId === branch.id)), [membership, role]);
  const [branchId, setBranchId] = useState(params.get("branchId") ?? (role === "OWNER" ? "all" : ""));
  const activeBranchId = branchId || (role === "OWNER" ? "all" : branches[0]?.id ?? "");
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [datePreset, setDatePreset] = useState("30d");
  const requestedView = params.get("view") ?? "overview";
  const validViews = kind === "sales" ? ["overview", "daily", "products"] : ["overview", "reorder", "movements"];
  const activeSection = validViews.includes(requestedView) ? requestedView : "overview";
  const canRead = kind === "sales" ? ["OWNER", "MANAGER"].includes(role) : ["OWNER", "MANAGER", "INVENTORY_MANAGER"].includes(role);
  const sales = useQuery({ queryKey: ["reports", tenantId, "sales", activeBranchId, from, to], queryFn: () => getSalesReport(tenantId, { ...(activeBranchId && activeBranchId !== "all" ? { branchId: activeBranchId } : {}), from, to }), enabled: Boolean(canRead && tenantId && from && to), retry: false });
  const inventory = useQuery({ queryKey: ["reports", tenantId, "inventory", activeBranchId], queryFn: () => getInventoryReport(tenantId, activeBranchId && activeBranchId !== "all" ? activeBranchId : undefined), enabled: Boolean(canRead && tenantId), retry: false });
  const report = sales.data as SalesReport | undefined;
  const stock = inventory.data as InventoryReport | undefined;
  const dailyColumns: DataColumn<SalesReport["daily"][number]>[] = [
    { id: "date", header: "Date", accessorFn: (row) => row.date, cell: (row) => formatDateTime(new Date(`${row.date}T00:00:00Z`), "en", { dateStyle: "medium", timeZone: "UTC" }) },
    { id: "orders", header: "Orders", accessorFn: (row) => row.orders, cell: (row) => row.orders },
    { id: "sales", header: "Net sales", accessorFn: (row) => row.sales, cell: (row) => formatMoney(row.sales, report?.currency ?? "NPR") },
  ];
  const bestsellerColumns: DataColumn<SalesReport["bestSellers"][number]>[] = [
    { id: "name", header: "Product", accessorFn: (row) => row.name, cell: (row) => row.name },
    { id: "quantity", header: "Units sold", accessorFn: (row) => row.quantity, cell: (row) => row.quantity },
    { id: "sales", header: "Sales", accessorFn: (row) => row.sales, cell: (row) => formatMoney(row.sales, report?.currency ?? "NPR") },
  ];
  const lowStockColumns: DataColumn<NonNullable<typeof stock>["lowStock"][number]>[] = [
    { id: "ingredient", header: "Ingredient", accessorFn: (row) => row.ingredient.name, cell: (row) => row.ingredient.name },
    { id: "branch", header: "Branch", accessorFn: (row) => row.branch.name, cell: (row) => row.branch.name },
    { id: "quantity", header: "On hand", accessorFn: (row) => Number(row.quantity), cell: (row) => `${row.quantity} ${UNIT_PRESENTATION[row.ingredient.unit as MeasureUnit].abbreviation}` },
    { id: "reorderLevel", header: "Reorder at", accessorFn: (row) => Number(row.reorderLevel), cell: (row) => `${row.reorderLevel} ${UNIT_PRESENTATION[row.ingredient.unit as MeasureUnit].abbreviation}` },
    { id: "attention", header: "Attention", accessorFn: (row) => Number(row.quantity) <= 0 ? "Out of stock" : "Reorder", cell: (row) => <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${Number(row.quantity) <= 0 ? "bg-destructive/10 text-destructive" : "bg-amber-500/15 text-amber-800 dark:text-amber-300"}`}>{Number(row.quantity) <= 0 ? "Out of stock" : "Reorder"}</span> },
  ];
  const movementColumns: DataColumn<NonNullable<typeof stock>["movements"][number]>[] = [
    { id: "createdAt", header: "When", accessorFn: (row) => new Date(row.createdAt).getTime(), cell: (row) => formatDateTime(new Date(row.createdAt), "en", { dateStyle: "medium", timeStyle: "short" }) },
    { id: "ingredient", header: "Ingredient", accessorFn: (row) => row.ingredient.name, cell: (row) => row.ingredient.name },
    { id: "branch", header: "Branch", accessorFn: (row) => row.branch.name, cell: (row) => row.branch.name },
    { id: "type", header: "Movement", accessorFn: (row) => row.type, cell: (row) => row.type.replaceAll("_", " ").toLowerCase() },
    { id: "quantity", header: "Quantity", accessorFn: (row) => Number(row.quantity), cell: (row) => `${row.quantity} ${UNIT_PRESENTATION[row.ingredient.unit as MeasureUnit].abbreviation}` },
  ];
  const selectedBranch = activeBranchId === "all" ? "All branches" : branches.find((branch) => branch.id === activeBranchId)?.name ?? "Assigned branch";
  const title = kind === "sales" ? "Sales reports" : "Stock reports";
  const reportTabs = [
    { id: "overview", label: "Sales overview", href: "/reports" },
    { id: "daily", label: "Daily sales", href: "/reports" },
    { id: "products", label: "Products", href: "/reports" },
    { id: "inventory-overview", label: "Stock overview", href: "/stock-reports", view: "overview" },
    { id: "reorder", label: "Reorder attention", href: "/stock-reports" },
    { id: "movements", label: "Movements", href: "/stock-reports" },
  ];
  function applyDatePreset(value: string) {
    setDatePreset(value);
    if (value === "custom") return;
    const days = Number(value.slice(0, -1));
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    setDraftFrom(start.toISOString().slice(0, 10));
    setDraftTo(end.toISOString().slice(0, 10));
  }
  function generateReport() {
    if (draftFrom > draftTo) return;
    const rangeChanged = from !== draftFrom || to !== draftTo;
    setFrom(draftFrom);
    setTo(draftTo);
    if (!rangeChanged) void sales.refetch();
  }
  function exportSalesReport() {
    if (!report) return;
    const rows: unknown[][] = [
      ["Novara detailed sales report", `${report.range.from} – ${report.range.to}`],
      ["Branch", selectedBranch],
      ["Currency", report.currency],
      [],
      ["Summary", "Value"],
      ["Net sales", report.summary.netSales], ["Completed orders", report.summary.orderCount],
      ["Average order value", report.summary.orderCount ? report.summary.netSales / report.summary.orderCount : 0],
      ["Refunds", report.summary.refunds], ["Refund count", report.summary.refundCount ?? 0],
      ["Gross profit", report.summary.profit ?? "Not available"],
      ["Expenses", report.summary.expenses ?? "Not available"],
      [], ["Daily sales"], ["Date", "Orders", "Net sales"],
      ...report.daily.map((row) => [row.date, row.orders, row.sales]),
      [], ["Best sellers"], ["Product", "Units sold", "Sales"],
      ...report.bestSellers.map((row) => [row.name, row.quantity, row.sales]),
      [], ["Payment mix"], ["Method", "Amount"],
      ...report.paymentBreakdown.map((row) => [row.method, row.amount]),
    ];
    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `novara-sales-report-${report.range.from}-${report.range.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const loading = kind === "sales" ? sales.isPending : inventory.isPending;
  const error = kind === "sales" ? sales.error : inventory.error;
  return<> <SidebarInset><header className="flex h-[72px] items-center gap-3 border-b px-4 sm:px-7"><SidebarTrigger /><div><p className="text-xs text-muted-foreground">Business intelligence · {selectedBranch}</p><h1 className="text-lg font-semibold">{title}</h1></div></header><main className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-7 xl:px-10">
    {!canRead ? <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">This role does not have access to {title.toLowerCase()}.</div> : <>
      {kind === "sales" ? <section className="grid gap-3 rounded-2xl border border-border/75 bg-card p-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(150px,auto)_minmax(150px,auto)_minmax(150px,auto)_auto_auto] sm:p-5"><div className="sm:col-span-2 xl:col-span-1"><label htmlFor="report-branch" className="mb-2 block text-xs font-medium text-muted-foreground">Branch</label><SelectField id="report-branch" value={activeBranchId} onValueChange={setBranchId} options={[...(role === "OWNER" ? [{ value: "all", label: "All branches" }] : []), ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></div><div><label htmlFor="report-preset" className="mb-2 block text-xs font-medium text-muted-foreground">Date range</label><SelectField id="report-preset" value={datePreset} onValueChange={applyDatePreset} options={[{ value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" }, { value: "custom", label: "Custom range" }]} /></div><div><label htmlFor="report-from" className="mb-2 block text-xs font-medium text-muted-foreground">Start date</label><Input id="report-from" type="date" value={draftFrom} max={draftTo} onChange={(event) => { setDatePreset("custom"); setDraftFrom(event.target.value); }} /></div><div><label htmlFor="report-to" className="mb-2 block text-xs font-medium text-muted-foreground">End date</label><Input id="report-to" type="date" value={draftTo} min={draftFrom} onChange={(event) => { setDatePreset("custom"); setDraftTo(event.target.value); }} /></div><div className="flex items-end"><Button type="button" className="w-full" disabled={!draftFrom || !draftTo || draftFrom > draftTo || sales.isFetching} onClick={generateReport}><CalendarDays aria-hidden className="size-4"/>{sales.isFetching ? "Generating…" : "Generate report"}</Button></div><div className="flex items-end"><Button type="button" variant="outline" className="w-full" disabled={!report || sales.isFetching} onClick={exportSalesReport}><Download aria-hidden className="size-4"/>Export report</Button></div></section> : <section className="flex flex-col gap-3 rounded-2xl border border-border/75 bg-card p-4 sm:flex-row sm:items-end sm:p-5"><div className="min-w-56 flex-1"><label htmlFor="report-branch" className="mb-2 block text-xs font-medium text-muted-foreground">Branch</label><SelectField id="report-branch" value={activeBranchId} onValueChange={setBranchId} options={[...(role === "OWNER" ? [{ value: "all", label: "All branches" }] : []), ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></div><Button type="button" variant="outline" onClick={() => void inventory.refetch()}>Refresh</Button></section>}
      <nav aria-label="Report views" className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/75 bg-card p-1">{reportTabs.map((item) => {
        const view = item.view ?? item.id;
        const isSalesView = item.href === "/reports";
        const selected = (kind === "sales") === isSalesView && activeSection === view;
        const query = new URLSearchParams(params.toString());
        query.set("view", view);
        const href = `${item.href}?${query.toString()}`;
        return <Link key={item.id} href={href} aria-current={selected ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors ${selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.label}</Link>;
      })}</nav>
      {error ? <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{getErrorMessage(error)}</div> : null}
      {loading ? <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-secondary/60"/><div className="h-28 animate-pulse rounded-2xl bg-secondary/60"/><div className="h-28 animate-pulse rounded-2xl bg-secondary/60"/></div> : kind === "sales" && report ? <>
        {activeSection === "overview" ? <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric title="Net sales" value={formatMoney(report.summary.netSales, report.currency)} icon={TrendingUp}/><Metric title="Completed orders" value={String(report.summary.orderCount)} icon={Activity}/><Metric title="Average order value" value={formatMoney(report.summary.orderCount ? report.summary.netSales / report.summary.orderCount : 0, report.currency)} icon={BarChart3}/><Metric title="Refunds" value={formatMoney(report.summary.refunds, report.currency)} icon={BarChart3}/>{role === "OWNER" ? <><Metric title="Gross profit" value={report.summary.profit === undefined ? "Cost data needed" : formatMoney(report.summary.profit, report.currency)} icon={TrendingUp}/><Metric title="Expenses" value={formatMoney(report.summary.expenses ?? 0, report.currency)} icon={BarChart3}/><Metric title="Operating profit before income tax" value={report.summary.operatingProfitBeforeIncomeTax === undefined ? "Cost data needed" : formatMoney(report.summary.operatingProfitBeforeIncomeTax, report.currency)} icon={TrendingUp}/></> : null}</section><section className="rounded-2xl border border-border/75 bg-card p-4 sm:p-5"><div className="mb-3"><h2 className="font-semibold">Payment mix</h2><p className="mt-1 text-xs text-muted-foreground">Payment totals returned by the sales report.</p></div>{report.paymentBreakdown.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{report.paymentBreakdown.map((payment) => <div key={payment.method} className="rounded-xl border border-border/70 bg-background/40 p-3"><p className="text-xs capitalize text-muted-foreground">{PAYMENT_METHOD_LABELS[payment.method]}</p><p className="mt-1 font-semibold tabular-nums">{formatMoney(payment.amount, report.currency)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No payment breakdown is available for this period.</p>}</section><p className="text-xs leading-5 text-muted-foreground">Gross and operating profit appear for Owners when each sold product has recipe ingredient costs configured. Operating profit is before income tax.</p></> : activeSection === "daily" ? <ReportTable title="Daily sales" rows={report.daily} columns={dailyColumns} empty="No completed sales in this period." selectable/> : <ReportTable title="Best sellers" rows={report.bestSellers} columns={bestsellerColumns} empty="No product sales in this period." selectable/>}
      </> : kind === "inventory" && stock ? <>
        {activeSection === "overview" ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric title="Stock valuation" value={formatMoney(Number(stock.valuation.total), stock.valuation.currency)} icon={TrendingUp}/><Metric title="Low stock items" value={String(stock.lowStock.length)} icon={Package}/><Metric title="Recent movements" value={String(stock.movements.length)} icon={Activity}/></section> : activeSection === "reorder" ? <ReportTable title="Reorder attention" rows={stock.lowStock} columns={lowStockColumns} empty="All stock levels are above their reorder points." selectable/> : <ReportTable title="Recent stock movements" rows={stock.movements} columns={movementColumns} empty="No stock movements have been recorded." selectable/>}
      </> : null}
    </>}
  </main></SidebarInset></>;
}
function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Activity }) { return <article className="rounded-2xl border border-border/75 bg-card p-5"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-5"/></span><p className="mt-4 text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></article>; }
function ReportTable<Row>({ title, rows, columns, empty, selectable = false }: { title: string; rows: Row[]; columns: DataColumn<Row>[]; empty: string; selectable?: boolean }) { return <section className="rounded-2xl border border-border/75 bg-card p-4 sm:p-5"><h2 className="mb-4 font-semibold">{title}</h2><DataTable rows={rows} columns={columns} getRowId={(row, index) => String((row as Record<string, unknown>).id ?? index)} enableSearch searchPlaceholder={`Search ${title.toLowerCase()}…`} enableRowSelection={selectable} empty={<p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>}/></section>; }
