"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, ClipboardList, LayoutDashboard, RefreshCw, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { getKitchenQueue, updateKitchenItem, type KitchenTicket } from "@/features/pos/api/posApi";
import { tenancyApi } from "@/features/tenancy/api/tenancyApi";
import { getErrorMessage } from "@/lib/api-client";

export function KitchenQueueWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const memberships = profile.data?.memberships ?? [];
  const tenantId = searchParams.get("tenantId") ?? memberships[0]?.tenant.id ?? "";
  const membership = memberships.find((item) => item.tenant.id === tenantId);
  const role = profile.data?.platformRole ?? membership?.role ?? "KITCHEN_STAFF";
  const branches = useQuery({ queryKey: ["tenancy", tenantId, "branches"], queryFn: () => tenancyApi.getBranches(tenantId), enabled: Boolean(tenantId), retry: false });
  const branchList = branches.data ?? [];
  const branchId = searchParams.get("branchId") ?? branchList[0]?.id ?? "";
  const query = useQuery({
    queryKey: ["kitchen-queue", tenantId, branchId], queryFn: () => getKitchenQueue(tenantId, branchId), enabled: Boolean(tenantId && branchId),
    refetchInterval: () => typeof document !== "undefined" && document.visibilityState === "visible" ? 5_000 : false,
    refetchIntervalInBackground: false, retry: 1,
  });
  const [now, setNow] = useState(0);
  useEffect(() => { const initial = window.setTimeout(() => setNow(Date.now()), 0); const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);
  const update = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: "PREPARING" | "READY" }) => updateKitchenItem(tenantId, itemId, status),
    onMutate: async ({ itemId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["kitchen-queue", tenantId, branchId] });
      const previous = queryClient.getQueryData<KitchenTicket[]>(["kitchen-queue", tenantId, branchId]);
      queryClient.setQueryData<KitchenTicket[]>(["kitchen-queue", tenantId, branchId], (tickets = []) => tickets.map((ticket) => ({ ...ticket, items: ticket.items.map((item) => item.id === itemId ? { ...item, kitchenStatus: status } : item) })).filter((ticket) => ticket.items.some((item) => item.kitchenStatus !== "READY")));
      return { previous };
    },
    onError: (_error, _variables, context) => { if (context?.previous) queryClient.setQueryData(["kitchen-queue", tenantId, branchId], context.previous); },
    onSettled: async () => { await queryClient.invalidateQueries({ queryKey: ["kitchen-queue", tenantId, branchId] }); },
  });
  const groups = useMemo(() => query.data ?? [], [query.data]);
  const tenantName = membership?.tenant.name ?? "Kitchen workspace";

  return <SidebarProvider><WorkspaceSidebar role={role} tenantName={tenantName} activePath="/kitchen" groups={[{ label: "Workspace", items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, { label: "Point of sale", href: "/pos", icon: Store, capability: "orders.create" }, { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" }, { label: "Kitchen queue", href: "/kitchen", icon: ChefHat, capability: "kitchen.orders.read" },
  ]}]} /><SidebarInset><header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-7"><SidebarTrigger/><div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground">{tenantName}</p><h1 className="text-lg font-semibold">Kitchen queue</h1></div>{branchList.length > 1 ? <SelectField aria-label="Branch" value={branchId} onValueChange={(value) => router.push(`/kitchen?tenantId=${tenantId}&branchId=${value}`)} options={branchList.map((branch) => ({ value: branch.id, label: branch.name }))} triggerClassName="w-48"/> : null}<Button variant="outline" size="icon" aria-label="Refresh queue" onClick={() => void query.refetch()}><RefreshCw className="size-4"/></Button></header>
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-7 xl:px-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Live service</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Incoming tickets</h2><p className="mt-2 text-sm text-muted-foreground">Oldest tickets first · refreshes every five seconds while this screen is visible</p></div><span className="rounded-full border bg-card px-3 py-2 text-xs font-medium">{groups.length} active {groups.length === 1 ? "ticket" : "tickets"}</span></div>
      {query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm"><div><p className="font-medium">Connection issue</p><p className="mt-1 text-muted-foreground">{getErrorMessage(query.error)} The queue will retry automatically.</p></div><Button variant="outline" onClick={() => void query.refetch()}>Retry now</Button></div> : null}
      {query.isPending ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-secondary/60"/>)}</div> : groups.length ? <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{groups.map((ticket) => <TicketCard key={ticket.orderId} ticket={ticket} now={now} pending={update.isPending} onTransition={(itemId, status) => update.mutate({ itemId, status })}/>)}</div> : <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center"><ChefHat className="mx-auto size-9 text-muted-foreground"/><h3 className="mt-4 text-lg font-semibold">No active orders</h3><p className="mt-1 text-sm text-muted-foreground">New tickets will appear here when the service team sends items to the kitchen.</p></div>}
    </main></SidebarInset></SidebarProvider>;
}

function TicketCard({ ticket, now, pending, onTransition }: { ticket: KitchenTicket; now: number; pending: boolean; onTransition: (id: string, status: "PREPARING" | "READY") => void }) {
  const oldest = Math.min(...ticket.items.map((item) => new Date(item.sentToKitchenAt).getTime()));
  const minutes = Math.max(0, Math.floor((now - oldest) / 60_000));
  const timerStyle = minutes < 5 ? "text-emerald-700 bg-emerald-500/10" : minutes <= 10 ? "text-amber-800 bg-amber-500/10" : "text-destructive bg-destructive/10";
  return <article className="overflow-hidden rounded-2xl border bg-card shadow-sm"><header className="flex items-start justify-between gap-3 border-b bg-secondary/35 p-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground">{ticket.table ? `Table ${ticket.table.name}` : "Counter order"}</p><h3 className="mt-1 text-lg font-semibold">#{ticket.orderId.slice(0, 8).toUpperCase()}</h3><p className="mt-1 text-xs text-muted-foreground">{ticket.branch.name}{ticket.table?.section ? ` · ${ticket.table.section}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${timerStyle}`}>{minutes} min</span></header><ul className="divide-y">{ticket.items.map((item) => <li key={item.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><p className="font-medium">{item.quantity} × {item.product.name}</p><span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-semibold uppercase">{item.kitchenStatus.toLowerCase()}</span></div>{item.modifiers.length ? <p className="text-xs text-muted-foreground">{item.modifiers.map((modifier) => modifier.optionName).join(" · ")}</p> : null}{item.note ? <p className="rounded-md bg-amber-500/10 px-2.5 py-2 text-xs">Note: {item.note}</p> : null}<Button className="w-full" size="sm" disabled={pending} onClick={() => onTransition(item.id, item.kitchenStatus === "NEW" ? "PREPARING" : "READY")}>{item.kitchenStatus === "NEW" ? "Start preparing" : "Mark ready"}</Button></li>)}</ul></article>;
}
