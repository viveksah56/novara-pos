"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/formatDateTime";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Package, TrendingUp } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { getInventoryReport, getSalesReport, type InventoryReport, type SalesReport } from "@/features/reports/api/reportApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatMoney";

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
    { id: "quantity", header: "On hand", accessorFn: (row) => Number(row.quantity), cell: (row) => `${row.quantity} ${row.ingredient.unit.toLowerCase()}` },
    { id: "reorderLevel", header: "Reorder at", accessorFn: (row) => Number(row.reorderLevel), cell: (row) => `${row.reorderLevel} ${row.ingredient.unit.toLowerCase()}` },
  ];
  const movementColumns: DataColumn<NonNullable<typeof stock>["movements"][number]>[] = [
    { id: "createdAt", header: "When", accessorFn: (row) => new Date(row.createdAt).getTime(), cell: (row) => formatDateTime(new Date(row.createdAt), "en", { dateStyle: "medium", timeStyle: "short" }) },
    { id: "ingredient", header: "Ingredient", accessorFn: (row) => row.ingredient.name, cell: (row) => row.ingredient.name },
    { id: "branch", header: "Branch", accessorFn: (row) => row.branch.name, cell: (row) => row.branch.name },
    { id: "type", header: "Movement", accessorFn: (row) => row.type, cell: (row) => row.type.replaceAll("_", " ").toLowerCase() },
    { id: "quantity", header: "Quantity", accessorFn: (row) => Number(row.quantity), cell: (row) => `${row.quantity} ${row.ingredient.unit.toLowerCase()}` },
  ];
  const selectedBranch = activeBranchId === "all" ? "All branches" : branches.find((branch) => branch.id === activeBranchId)?.name ?? "Assigned branch";
  const title = kind === "sales" ? "Sales reports" : "Stock reports";
  const navGroups = [{ label: "Workspace", items: [{ label: "Overview", href: "/dashboard", icon: Activity, allowed: ["OWNER", "MANAGER"].includes(role) }, { label: "Inventory", href: "/inventory", icon: Package, allowed: ["OWNER", "MANAGER", "INVENTORY_MANAGER"].includes(role) }, { label: "Sales reports", href: "/reports", icon: BarChart3, allowed: ["OWNER", "MANAGER"].includes(role) }, { label: "Stock reports", href: "/stock-reports", icon: Package, allowed: ["OWNER", "MANAGER", "INVENTORY_MANAGER"].includes(role) }] }];
  const loading = kind === "sales" ? sales.isPending : inventory.isPending;
  const error = kind === "sales" ? sales.error : inventory.error;
  return<> <SidebarInset><header className="flex h-[72px] items-center gap-3 border-b px-4 sm:px-7"><SidebarTrigger /><div><p className="text-xs text-muted-foreground">Business intelligence · {selectedBranch}</p><h1 className="text-lg font-semibold">{title}</h1></div></header><main className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-7 xl:px-10">
    {!canRead ? <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">This role does not have access to {title.toLowerCase()}.</div> : <>
      <section className="flex flex-col gap-4 rounded-2xl border border-border/75 bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-5"><div className="min-w-56 flex-1"><label htmlFor="report-branch" className="mb-2 block text-xs font-medium text-muted-foreground">Branch</label><SelectField id="report-branch" value={activeBranchId} onValueChange={setBranchId} options={[...(role === "OWNER" ? [{ value: "all", label: "All branches" }] : []), ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></div>{kind === "sales" ? <><div><label htmlFor="report-from" className="mb-2 block text-xs font-medium text-muted-foreground">From</label><Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div><div><label htmlFor="report-to" className="mb-2 block text-xs font-medium text-muted-foreground">To</label><Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></> : null}<Button type="button" variant="outline" onClick={() => void (kind === "sales" ? sales.refetch() : inventory.refetch())}>Refresh</Button></section>
      {error ? <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{getErrorMessage(error)}</div> : null}
      {loading ? <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-secondary/60"/><div className="h-28 animate-pulse rounded-2xl bg-secondary/60"/><div className="h-28 animate-pulse rounded-2xl bg-secondary/60"/></div> : kind === "sales" && report ? <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric title="Net sales" value={formatMoney(report.summary.netSales, report.currency)} icon={TrendingUp}/><Metric title="Completed orders" value={String(report.summary.orderCount)} icon={Activity}/><Metric title="Refunds" value={formatMoney(report.summary.refunds, report.currency)} icon={BarChart3}/>{role === "OWNER" ? <><Metric title="Gross profit" value={report.summary.profit === undefined ? "Cost data needed" : formatMoney(report.summary.profit, report.currency)} icon={TrendingUp}/><Metric title="Expenses" value={formatMoney(report.summary.expenses ?? 0, report.currency)} icon={BarChart3}/><Metric title="Operating profit before income tax" value={report.summary.operatingProfitBeforeIncomeTax === undefined ? "Cost data needed" : formatMoney(report.summary.operatingProfitBeforeIncomeTax, report.currency)} icon={TrendingUp}/></> : null}</section>
        <ReportTable title="Daily sales" rows={report.daily} columns={dailyColumns} empty="No completed sales in this period."/><ReportTable title="Best sellers" rows={report.bestSellers} columns={bestsellerColumns} empty="No product sales in this period."/>
        <p className="text-xs leading-5 text-muted-foreground">Gross and operating profit appear for Owners when each sold product has recipe ingredient costs configured. Operating profit is before income tax.</p>
      </> : kind === "inventory" && stock ? <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric title="Stock valuation" value={formatMoney(Number(stock.valuation.total), stock.valuation.currency)} icon={TrendingUp}/><Metric title="Low stock items" value={String(stock.lowStock.length)} icon={Package}/><Metric title="Recent movements" value={String(stock.movements.length)} icon={Activity}/></section>
        <ReportTable title="Reorder attention" rows={stock.lowStock} columns={lowStockColumns} empty="All stock levels are above their reorder points."/><ReportTable title="Recent stock movements" rows={stock.movements} columns={movementColumns} empty="No stock movements have been recorded."/>
      </> : null}
    </>}
  </main></SidebarInset></>;
}
function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Activity }) { return <article className="rounded-2xl border border-border/75 bg-card p-5"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-5"/></span><p className="mt-4 text-xs text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></article>; }
function ReportTable<Row>({ title, rows, columns, empty }: { title: string; rows: Row[]; columns: DataColumn<Row>[]; empty: string }) { return <section className="rounded-2xl border border-border/75 bg-card p-4 sm:p-5"><h2 className="mb-4 font-semibold">{title}</h2><DataTable rows={rows} columns={columns} getRowId={(row, index) => String((row as Record<string, unknown>).id ?? index)} enableSearch searchPlaceholder={`Search ${title.toLowerCase()}…`} enableRowSelection={false} empty={<p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>}/></section>; }
