import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Armchair,
  ClipboardList,
  Clock3,
  CreditCard,
  LayoutGrid,
  List,
  ReceiptText,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardPayload } from "@/features/dashboard/api";
import { EmptyPanel } from "@/features/dashboard/components/shared/EmptyPanel";
import { HealthRow } from "@/features/dashboard/components/shared/HealthRow";
import { MetricCard } from "@/features/dashboard/components/shared/MetricCard";
import { WorkspaceError } from "@/features/dashboard/components/shared/WorkspaceError";
import { playTone } from "@/features/dashboard/lib/playTone";
import { pollWhenVisible } from "@/features/dashboard/lib/polling";
import { getMenuProducts, type MenuProduct } from "@/features/menu/api/menuApi";
import { ProductGrid } from "@/features/menu/components/ProductGrid";
import {
  appendPosOrderItems,
  completePosOrder,
  createPosOrder,
  listDiningTables,
  listPosOrders,
  listReadyOrderItems,
  sendOrderToKitchen,
  type PosCartLine,
  type PosOrderRecord,
  type PosPaymentInput,
} from "@/features/pos/api/posApi";
import { CompletePaymentDialog } from "@/features/pos/components/CompletePaymentDialog";
import { replaceOfflineOrderQueue, useOfflineOrderQueue } from "@/features/pos/hooks/useOfflineOrderQueue";
import { getCurrentShift } from "@/features/shifts/api/shiftApi";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/formatDateTime";
import { formatMoney } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";

export function PosContent({
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
  const [recentOrdersView, setRecentOrdersView] = useState<"table" | "grid">("table");
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
    refetchInterval: role === "CASHIER" || role === "WAITER" ? pollWhenVisible(5_000) : false,
    retry: false,
  });
  const tableQuery = useQuery({ queryKey: ["dining-tables", tenantId, branchId], queryFn: () => listDiningTables(tenantId, branchId), enabled: Boolean(tenantId && branchId && (role === "WAITER" || tableId)), refetchInterval: pollWhenVisible(5_000), retry: false });
  const readyItemsQuery = useQuery({ queryKey: ["ready-order-items", tenantId, branchId], queryFn: () => listReadyOrderItems(tenantId, branchId), enabled: Boolean(tenantId && branchId && role === "WAITER"), refetchInterval: pollWhenVisible(5_000), retry: false });
  const knownReadyItems = useRef<Set<string> | null>(null);
  useEffect(() => {
    const items = readyItemsQuery.data;
    if (!items || role !== "WAITER") return;
    const nextIds = new Set(items.map((item) => item.id));
    if (knownReadyItems.current) {
      const newlyReady = items.filter((item) => !knownReadyItems.current?.has(item.id));
      if (newlyReady.length) {
        const first = newlyReady[0];
        toast.success(`${newlyReady.length === 1 ? first.product.name : `${newlyReady.length} items`} ready to serve`, { description: first.order.table?.name ?? `Order #${first.order.id.slice(-6).toUpperCase()}` });
        playTone({ frequency: 880, volume: 0.08, duration: 0.18 });
      }
    }
    knownReadyItems.current = nextIds;
  }, [readyItemsQuery.data, role]);
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
    { id: "createdAt", header: "Created", cell: (order) => formatDateTime(new Date(order.createdAt), "en", { dateStyle: "medium", timeStyle: "short" }), accessorFn: (order) => new Date(order.createdAt).getTime() },
    { id: "status", header: "Status", cell: (order) => <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", order.status === "OPEN" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : order.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{order.status === "OPEN" && order.billRequestedAt ? "BILL REQUESTED" : order.status}</span>, accessorFn: (order) => order.billRequestedAt ? "BILL REQUESTED" : order.status },
    { id: "totalAmount", header: "Total", cell: (order) => <span className="tabular-nums">{formatMoney(Number(order.totalAmount), currency)}</span>, accessorFn: (order) => Number(order.totalAmount) },
  ];
  const recentOrders = (ordersQuery.data ?? []).filter((order) => role === "CASHIER"
    ? order.createdBy.id === actorId || order.payments?.some((payment) => payment.createdById === actorId)
    : true);
  const cashCollected = (dashboard.paymentMix ?? []).filter((payment) => payment.method === "CASH").reduce((sum, payment) => sum + payment.amount, 0);
  const nonCashCollected = (dashboard.paymentMix ?? []).filter((payment) => payment.method !== "CASH").reduce((sum, payment) => sum + payment.amount, 0);
  return (
    <>
      {role === "WAITER" ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active tables" value={tableQuery.isPending ? "—" : String(diningTables.length)} note="Tables in this branch" icon={Armchair} accent />
        <MetricCard title="Occupied" value={tableQuery.isPending ? "—" : String(occupiedTables)} note="Currently serving guests" icon={Store} />
        <MetricCard title="Available" value={tableQuery.isPending ? "—" : String(availableTables)} note="Ready to start an order" icon={ShoppingBag} />
        <MetricCard title="Bill requested" value={tableQuery.isPending ? "—" : String(billRequestedTables)} note="Ready for checkout" icon={ReceiptText} />
      </section> : <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="My sales today" value={formatMoney(metrics.ownSalesToday, currency)} note="Your completed sales today" icon={Store} accent />
        <MetricCard title="Orders today" value={String(metrics.ownOrdersToday ?? 0)} note="Orders you have handled" icon={ReceiptText} />
        {role === "CASHIER" ? <MetricCard title="Cash collected" value={formatMoney(cashCollected, currency)} note={`Other payments · ${formatMoney(nonCashCollected, currency)}`} icon={Wallet} /> : null}
        <MetricCard title="Shift status" value={cashierShift.isPending ? "Checking…" : cashierShift.data?.status ?? "NOT STARTED"} note={cashierShift.data ? `Opening ${formatMoney(cashierShift.data.openingCash, currency)} · expected ${formatMoney(Number(cashierShift.data.openingCash) + Number(cashierShift.data.expectedCash), currency)}` : "Open a register shift before cash sales"} icon={Clock3} />
      </section>}
      {role === "CASHIER" ? <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/75 bg-card p-4"><div><p className="text-sm font-semibold">Cash drawer</p><p className="mt-1 text-xs text-muted-foreground">{cashierShift.data ? `Opened ${formatDateTime(new Date(cashierShift.data.openedAt), "en", { timeStyle: "short" })} · expected cash includes cash sales and movements.` : cashierShift.isError ? `Shift status unavailable: ${getErrorMessage(cashierShift.error)}` : "Start your shift to take cash payments."}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant={online ? "secondary" : "destructive"}>{online ? "Online" : "Offline"}</Badge>{offlineQueue.length ? <Badge variant="outline">{offlineQueue.length} order{offlineQueue.length === 1 ? "" : "s"} pending sync</Badge> : null}</div></div><Button variant={cashierShift.data ? "outline" : "default"} render={<Link href={`/shift?tenantId=${tenantId}&branchId=${branchId}`}/>}><Clock3 className="size-4"/>{cashierShift.data ? "Review shift" : "Open shift"}</Button></section> : null}
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
      {receipt ? <article id="novara-pos-receipt" className="sr-only"><h1>Novara · {dashboard.tenant?.name}</h1>{receiptPrintCount > 1 ? <p className="receipt-duplicate">DUPLICATE</p> : null}<p>{dashboard.activeBranch?.name}</p><p>Receipt #{receipt.id.slice(-6).toUpperCase()}</p><p>{formatDateTime(new Date(), "en", { dateStyle: "medium", timeStyle: "short" })}</p><hr/>{receipt.items.map((item, index) => <p key={`${item.name}-${index}`}>{item.quantity} × {item.name} — {formatMoney(item.unitPrice * item.quantity, currency)}</p>)}<hr/><strong>Total · {formatMoney(receipt.total, currency)}</strong><p>Thank you for visiting.</p></article> : null}
      {paymentTarget ? <CompletePaymentDialog key={paymentTarget.id} order={paymentTarget} currency={currency} open pending={waiterPaymentMutation.isPending} error={waiterPaymentMutation.error ? getErrorMessage(waiterPaymentMutation.error) : undefined} requireReference onClose={() => { if (!waiterPaymentMutation.isPending) setPaymentTarget(null); }} onSubmit={(payment) => waiterPaymentMutation.mutate({ orderId: paymentTarget.id, payment })} /> : null}
      {role !== "WAITER" ? <section className="mt-5 overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">{role === "CASHIER" ? "Orders you created or checked out" : "Service activity"}</p><h2 className="mt-1 text-lg font-semibold">Recent orders</h2></div><div className="flex items-center gap-2"><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{recentOrders.length} orders</span>{role === "CASHIER" ? <div role="group" aria-label="Recent order layout" className="flex rounded-lg border p-1"><Button type="button" size="icon-sm" variant={recentOrdersView === "table" ? "secondary" : "ghost"} aria-label="Table view" aria-pressed={recentOrdersView === "table"} onClick={() => setRecentOrdersView("table")}><List aria-hidden /></Button><Button type="button" size="icon-sm" variant={recentOrdersView === "grid" ? "secondary" : "ghost"} aria-label="Grid view" aria-pressed={recentOrdersView === "grid"} onClick={() => setRecentOrdersView("grid")}><LayoutGrid aria-hidden /></Button></div> : null}</div></div>
        {ordersQuery.isPending ? <div className="h-40 animate-pulse rounded-xl bg-secondary/60" aria-busy="true" /> : ordersQuery.isError ? <WorkspaceError message={getErrorMessage(ordersQuery.error)} error={ordersQuery.error} retry={() => void ordersQuery.refetch()} /> : recentOrdersView === "grid" && role === "CASHIER" ? recentOrders.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{recentOrders.slice(0, 18).map((order) => <article key={order.id} className="rounded-xl border border-border/75 bg-background/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold">#{order.id.slice(-6).toUpperCase()}</p><p className="mt-1 text-xs text-muted-foreground">{order.table ? `Table ${order.table.name}` : "Counter order"}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", order.status === "OPEN" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>{order.status}</span></div><p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">{order.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ") || "No items"}</p><div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3"><span className="text-xs text-muted-foreground">{formatDateTime(new Date(order.createdAt), "en", { dateStyle: "medium", timeStyle: "short" })}</span><strong className="tabular-nums">{formatMoney(Number(order.totalAmount), currency)}</strong></div></article>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No orders handled by you yet.</div> : <DataTable rows={recentOrders} columns={orderColumns} getRowId={(order) => order.id} enableSearch searchPlaceholder="Search order, product or staff…" empty={<div className="px-4 py-12 text-center"><p className="font-medium">{role === "CASHIER" ? "No orders handled by you yet" : "No orders for this branch yet"}</p><p className="mt-1 text-sm text-muted-foreground">Recent service activity will appear here.</p></div>} />}
      </section> : null}
    </>
  );
}
