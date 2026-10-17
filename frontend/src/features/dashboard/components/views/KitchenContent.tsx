import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChefHat, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardPayload } from "@/features/dashboard/api";
import { EmptyPanel } from "@/features/dashboard/components/shared/EmptyPanel";
import { MetricCard } from "@/features/dashboard/components/shared/MetricCard";
import { WorkspaceError } from "@/features/dashboard/components/shared/WorkspaceError";
import { playTone } from "@/features/dashboard/lib/playTone";
import { getKitchenOrders, updateKitchenOrder } from "@/features/kitchen/api/kitchenApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/formatDateTime";
import { cn } from "@/lib/utils";

export function KitchenContent({ dashboard }: { dashboard: DashboardPayload }) {
  const tenantId = dashboard.tenant?.id ?? "";
  const branchId = dashboard.activeBranch?.id;
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ["kitchen-orders", tenantId, branchId], queryFn: () => getKitchenOrders(tenantId, branchId), enabled: Boolean(tenantId), refetchInterval: 5_000, retry: false });
  const knownKitchenTickets = useRef<Set<string> | null>(null);
  useEffect(() => {
    const tickets = orders.data;
    if (!tickets) return;
    const ids = new Set(tickets.map((ticket) => ticket.id));
    if (knownKitchenTickets.current) {
      const incoming = tickets.filter((ticket) => !knownKitchenTickets.current?.has(ticket.id));
      if (incoming.length) {
        toast.info(`${incoming.length} new kitchen ${incoming.length === 1 ? "ticket" : "tickets"}`, { description: "New orders are waiting in the kitchen queue." });
        playTone({ frequency: 660, volume: 0.07, duration: 0.2 });
      }
    }
    knownKitchenTickets.current = ids;
  }, [orders.data]);
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
        {orders.isPending ? <div className="h-48 animate-pulse rounded-2xl bg-secondary/60" aria-busy="true" /> : orders.isError ? <WorkspaceError message={getErrorMessage(orders.error)} error={orders.error} retry={() => void orders.refetch()} /> : tickets.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tickets.map((order) => <article key={order.id} className="rounded-2xl border border-border/75 bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">#{order.id.slice(-6).toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{order.branch.name}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase", order.kitchenStatus === "PENDING" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : order.kitchenStatus === "READY" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-blue-500/10 text-blue-800 dark:text-blue-300")}>{order.kitchenStatus.toLowerCase()}</span></div><p className="mt-1 text-xs text-muted-foreground">Received {formatDateTime(new Date(order.createdAt), "en", { timeStyle: "short" })}</p><ul className="my-4 space-y-2 border-y border-border py-4">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.product.name}</span><span className="font-semibold tabular-nums">× {item.quantity}</span></li>)}</ul>{order.kitchenStatus === "READY" ? <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-center text-sm font-medium text-emerald-800 dark:text-emerald-300">Ready to serve</p> : <Button className="w-full" disabled={update.isPending} onClick={() => update.mutate({ id: order.id, kitchenStatus: order.kitchenStatus === "PENDING" ? "PREPARING" : "READY" })}>{order.kitchenStatus === "PENDING" ? "Start preparing" : "Mark ready"}</Button>}</article>)}</div> : <EmptyPanel icon={ChefHat} title="Kitchen is all caught up" description="Incoming tickets refresh automatically and stay scoped to your assigned branch." tag="LIVE KITCHEN QUEUE" />}
        {update.error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(update.error)}</p> : null}
      </div>
    </div>
  );
}
