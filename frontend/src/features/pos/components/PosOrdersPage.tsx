"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, CreditCard } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { completePosOrder, listPosOrders, type PosOrderRecord } from "@/features/pos/api/posApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";

export function PosOrdersPage() {
  const params = useSearchParams();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const queryClient = useQueryClient();
  const memberships = profile.data?.memberships ?? [];
  const tenantId = params.get("tenantId");
  const membership = memberships.find((item) => item.tenant.id === tenantId) ?? memberships[0];
  const role = membership?.role ?? "";
  const branches = useMemo(() => role === "OWNER" ? membership?.tenant.branches ?? [] : (membership?.tenant.branches ?? []).filter((branch) => membership?.branchAssignments.some((assignment) => assignment.branchId === branch.id)), [membership, role]);
  const [branchId, setBranchId] = useState(params.get("branchId") ?? branches[0]?.id ?? "");
  const canRead = ["OWNER", "MANAGER", "CASHIER", "WAITER"].includes(role);
  const orders = useQuery({ queryKey: ["pos-orders", membership?.tenant.id, branchId], queryFn: () => listPosOrders(membership!.tenant.id, branchId || undefined), enabled: Boolean(canRead && membership), retry: false });
  const complete = useMutation({ mutationFn: (orderId: string) => completePosOrder(membership!.tenant.id, orderId, { method: "CASH" }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["pos-orders", membership?.tenant.id] }), queryClient.invalidateQueries({ queryKey: ["inventory", membership?.tenant.id] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]); } });
  const currency = membership?.tenant.currency ?? "NPR";
  const columns: DataColumn<PosOrderRecord>[] = [
    { id: "id", header: "Order", accessorFn: (order) => order.id, cell: (order) => <span className="font-mono text-xs">#{order.id.slice(0, 8).toUpperCase()}</span> },
    { id: "createdAt", header: "Placed", accessorFn: (order) => new Date(order.createdAt).getTime(), cell: (order) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt)) },
    { id: "createdBy", header: "Staff", accessorFn: (order) => order.createdBy.name, cell: (order) => order.createdBy.name },
    { id: "items", header: "Items", accessorFn: (order) => order.items.map((item) => item.product.name).join(" "), cell: (order) => <span className="block max-w-72 truncate">{order.items.map((item) => `${item.quantity} × ${item.product.name}`).join(", ")}</span> },
    { id: "status", header: "Status", accessorFn: (order) => order.status, cell: (order) => <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", order.status === "OPEN" ? "bg-amber-500/10 text-amber-800" : order.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-800" : "bg-muted text-muted-foreground")}>{order.status.toLowerCase()}</span> },
    { id: "totalAmount", header: "Total", accessorFn: (order) => Number(order.totalAmount), cell: (order) => formatMoney(Number(order.totalAmount), currency) },
  ];
  return <SidebarProvider><WorkspaceSidebar role={role} tenantName={membership?.tenant.name ?? "Workspace"} activePath="/orders" groups={[{ label: "Service", items: [{ label: "Point of sale", href: "/pos", icon: CreditCard, allowed: canRead }, { label: "Orders", href: "/orders", icon: ClipboardList, allowed: canRead }] }]} /><SidebarInset><header className="flex h-[72px] items-center gap-3 border-b px-4 sm:px-7"><SidebarTrigger /><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{membership?.tenant.name ?? "Business"}</p><h1 className="text-lg font-semibold">Orders</h1></div><Button render={<Link href="/pos"/>}><CreditCard className="size-4"/>New order</Button></header><main className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-7 xl:px-10"><p className="text-sm text-muted-foreground">Browse branch-scoped order history. Select rows to export or use search and sorting.</p>{branches.length > 1 ? <label className="block max-w-sm space-y-2 text-sm font-medium">Branch<SelectField value={branchId} onValueChange={setBranchId} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}/></label> : null}{complete.error ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(complete.error)}</p> : null}{!canRead ? <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Your role cannot access orders.</div> : orders.isPending ? <div className="h-52 animate-pulse rounded-2xl bg-secondary/60"/> : orders.isError ? <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{getErrorMessage(orders.error)} <Button type="button" variant="outline" className="ml-2" onClick={() => void orders.refetch()}>Retry</Button></div> : <section className="rounded-2xl border border-border/75 bg-card p-4 sm:p-5"><DataTable rows={orders.data ?? []} columns={columns} getRowId={(order) => order.id} enableSearch searchPlaceholder="Search order, product or staff…" actions={["OWNER", "MANAGER", "CASHIER"].includes(role) ? (order) => order.status === "OPEN" ? <Button type="button" variant="outline" size="sm" disabled={complete.isPending} onClick={() => complete.mutate(order.id)}><Check className="size-4"/>Take cash</Button> : null : undefined} empty={<p className="py-12 text-center text-sm text-muted-foreground">No orders found for this branch.</p>}/></section>}</main></SidebarInset></SidebarProvider>;
}
