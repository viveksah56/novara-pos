import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, Boxes, CircleDollarSign, ClipboardCheck, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardPayload } from "@/features/dashboard/api";
import { LoadingRows } from "@/features/dashboard/components/shared/LoadingRows";
import { MetricCard } from "@/features/dashboard/components/shared/MetricCard";
import { pollWhenVisible } from "@/features/dashboard/lib/polling";
import { getStocktakes } from "@/features/inventory/api/stocktakeApi";
import { getPurchaseOrders } from "@/features/purchasing/api/purchasingApi";
import { getInventoryReport } from "@/features/reports/api/reportApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/formatDateTime";
import { formatMoney } from "@/lib/formatMoney";

export function InventoryContent({ dashboard }: { dashboard: DashboardPayload }) {
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id;
  const inventory = useQuery({ queryKey: ["reports", tenantId, "dashboard-inventory", branchId], queryFn: () => getInventoryReport(tenantId, branchId), enabled: Boolean(tenantId), staleTime: 30_000, refetchInterval: pollWhenVisible(30_000), retry: false });
  const purchases = useQuery({ queryKey: ["purchases", tenantId, "dashboard"], queryFn: () => getPurchaseOrders(tenantId), enabled: Boolean(tenantId), staleTime: 30_000, refetchInterval: pollWhenVisible(30_000), retry: false });
  const stocktakes = useQuery({ queryKey: ["stocktakes", tenantId, branchId, "dashboard"], queryFn: () => getStocktakes(tenantId, branchId), enabled: Boolean(tenantId), staleTime: 30_000, refetchInterval: pollWhenVisible(30_000), retry: false });
  const movements = inventory.data?.movements ?? [];
  const pendingPurchases = (purchases.data ?? []).filter((purchase) => purchase.status === "ORDERED" || purchase.status === "PARTIALLY_RECEIVED");
  const wasteByIngredient = dashboard.wasteByIngredient ?? [];
  const activeStocktake = (stocktakes.data ?? []).find((stocktake) => stocktake.status === "DRAFT");
  const movementTypeLabel = (type: string) => type.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <MetricCard
          title="Stock valuation"
          value={inventory.isPending ? "…" : formatMoney(Number(inventory.data?.valuation.total ?? 0), inventory.data?.valuation.currency ?? dashboard.tenant?.currency ?? "NPR")}
          note="Current value at weighted average cost"
          icon={CircleDollarSign}
        />
      </section>
      {inventory.isError || purchases.isError || stocktakes.isError ? <section role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><span>{getErrorMessage(inventory.error ?? purchases.error ?? stocktakes.error)}</span><Button variant="outline" onClick={() => { void inventory.refetch(); void purchases.refetch(); void stocktakes.refetch(); }}>Retry</Button></section> : null}
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Reorder attention</p><h2 className="mt-1 text-xl font-semibold">Low-stock ingredients</h2></div><Package className="size-5 text-primary"/></div>{inventory.isPending ? <LoadingRows/> : inventory.data?.lowStock.length ? <div className="mt-4 divide-y divide-border/70">{inventory.data.lowStock.slice(0, 8).map((row) => <div key={row.id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 truncate text-sm font-medium">{row.ingredient.name}<span className="ml-2 text-xs text-muted-foreground">{row.branch.name}</span></span><span className="shrink-0 text-right text-sm font-semibold tabular-nums">{row.quantity} <span className="text-xs font-normal text-muted-foreground">/ {row.reorderLevel} {row.ingredient.unit}</span></span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">All tracked ingredients are above their reorder levels.</div>}</article>
        <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Stock ledger</p><h2 className="mt-1 text-xl font-semibold">Recent movements</h2></div><Activity className="size-5 text-primary"/></div>{inventory.isPending ? <LoadingRows/> : movements.length ? <div className="mt-4 divide-y divide-border/70">{movements.slice(0, 6).map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{movement.ingredient.name}</p><p className="mt-1 text-xs text-muted-foreground">{movement.branch.name} · {movementTypeLabel(movement.type)} · {formatDateTime(new Date(movement.createdAt), "en", { dateStyle: "medium" })}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{movement.quantity} {movement.ingredient.unit}</span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Stock receipts, waste, adjustments and sales deductions will appear here.</div>}</article>
      </section>
      <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Receiving</p><h2 className="mt-1 text-xl font-semibold">Open purchases</h2></div><Truck className="size-5 text-primary"/></div>{purchases.isPending ? <LoadingRows/> : pendingPurchases.length ? <div className="mt-4 divide-y divide-border/70">{pendingPurchases.slice(0, 6).map((purchase) => <div key={purchase.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{purchase.supplier.name}</p><p className="mt-1 text-xs text-muted-foreground">{purchase.branch.name} · {purchase.status.replaceAll("_", " ")}</p></div><span className="text-sm font-semibold tabular-nums">{formatMoney(purchase.totalAmount, dashboard.tenant?.currency ?? "NPR")}</span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No purchases are waiting to be received.</div>}</article><article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Counting</p><h2 className="mt-1 text-xl font-semibold">Stocktake</h2></div><ClipboardCheck className="size-5 text-primary"/></div>{stocktakes.isPending ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-secondary/60" aria-busy="true"/> : activeStocktake ? <div className="mt-4 rounded-xl bg-secondary/60 p-4"><p className="font-medium">Count in progress</p><p className="mt-1 text-sm text-muted-foreground">Started {formatDateTime(new Date(activeStocktake.startedAt), "en", { dateStyle: "medium" })} · {activeStocktake._count?.lines ?? activeStocktake.lines?.length ?? 0} items counted</p><Button className="mt-4" variant="outline" render={<Link href="/inventory/stocktakes"/>}>Continue stocktake</Button></div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No count is in progress.</div>}</article></section>
      <section className="mt-5 rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">This week</p><h2 className="mt-1 text-xl font-semibold">Waste by ingredient</h2></div><Boxes className="size-5 text-primary"/></div>{inventory.isPending ? <LoadingRows/> : wasteByIngredient.length ? <div className="mt-4 divide-y divide-border/70">{wasteByIngredient.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.quantity.toLocaleString()} {item.unit} discarded</p></div><span className="text-sm font-semibold tabular-nums">{formatMoney(item.value, dashboard.tenant?.currency ?? "NPR")}</span></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No waste has been recorded this business week.</div>}</section>
    </>
  );
}
