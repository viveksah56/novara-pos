"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, DoorOpen, DoorClosed, Wallet } from "lucide-react";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { closeShift, getCurrentShift, openShift } from "@/features/shifts/api/shiftApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatMoney";

export function ShiftConsole() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const memberships = profile.data?.memberships ?? [];
  const selectedTenantId = params.get("tenantId");
  const membership = memberships.find((item) => item.tenant.id === selectedTenantId) ?? memberships[0];
  const tenantId = membership?.tenant.id ?? "";
  const role = membership?.role ?? "";
  const branches = useMemo(() => role === "OWNER" ? membership?.tenant.branches ?? [] : (membership?.tenant.branches ?? []).filter((branch) => membership?.branchAssignments.some((assignment) => assignment.branchId === branch.id)), [membership, role]);
  const [selectedBranchId, setSelectedBranchId] = useState(params.get("branchId") ?? "");
  const activeBranchId = selectedBranchId || branches[0]?.id || "";
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notice, setNotice] = useState("");
  const shift = useQuery({ queryKey: ["shift", tenantId, activeBranchId], queryFn: () => getCurrentShift(tenantId, activeBranchId), enabled: Boolean(tenantId && activeBranchId), refetchInterval: 30_000, retry: false });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ["shift", tenantId] }); await queryClient.invalidateQueries({ queryKey: ["dashboard"] }); };
  const open = useMutation({ mutationFn: () => openShift(tenantId, { branchId: activeBranchId, openingCash: Number(openingCash) }), onSuccess: async () => { setOpeningCash(""); setNotice("Cash drawer opened."); await refresh(); } });
  const close = useMutation({ mutationFn: () => closeShift(tenantId, shift.data!.id, { closingCash: Number(closingCash) }), onSuccess: async (closedShift) => { setClosingCash(""); const variance = Number(closedShift.cashVariance ?? 0); setNotice(`Shift closed. Cash variance: ${variance > 0 ? "+" : ""}${formatMoney(variance, currency)}.`); await refresh(); } });
  const currency = membership?.tenant.currency ?? "NPR";
  const active = shift.data;
  const canUse = ["OWNER", "MANAGER", "CASHIER"].includes(role);
  return <SidebarProvider><WorkspaceSidebar role={role} tenantName={membership?.tenant.name ?? "Workspace"} activePath="/shift" groups={[{ label: "Workspace", items: [{ label: "Point of sale", href: "/pos", icon: Wallet, allowed: ["OWNER", "MANAGER", "CASHIER", "WAITER"].includes(role) }, { label: "Shift", href: "/shift", icon: Clock3, allowed: canUse }] }]} /><SidebarInset><header className="flex h-[72px] items-center gap-3 border-b px-4 sm:px-7"><SidebarTrigger /><div><p className="text-xs text-muted-foreground">Cash management</p><h1 className="text-lg font-semibold">Register shift</h1></div></header><main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-7">
    {!canUse ? <section className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Cash drawer shifts are available to Owners, Managers, and Cashiers.</section> : <>
      {branches.length > 1 ? <label className="block max-w-sm space-y-2 text-sm font-medium">Branch<SelectField value={activeBranchId} onValueChange={setSelectedBranchId} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} /></label> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-3 text-sm">{notice}</p> : null}
      {shift.isError ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(shift.error)}</p> : null}
      {open.error || close.error ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(open.error ?? close.error)}</p> : null}
      {shift.isPending ? <div className="h-48 animate-pulse rounded-2xl bg-secondary/60" /> : active ? <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-7"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><DoorOpen className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Shift open</p><h2 className="mt-1 text-2xl font-semibold">{active.branch.name}</h2><p className="mt-1 text-sm text-muted-foreground">Started {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(active.openedAt))}</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-secondary/60 p-4"><p className="text-xs text-muted-foreground">Opening float</p><p className="mt-1 font-semibold">{formatMoney(Number(active.openingCash), currency)}</p></div><div className="rounded-xl bg-secondary/60 p-4"><p className="text-xs text-muted-foreground">Expected cash</p><p className="mt-1 font-semibold">{formatMoney(Number(active.openingCash) + Number(active.expectedCash), currency)}</p></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground" htmlFor="counted-cash">Counted cash</label><Input id="counted-cash" inputMode="decimal" type="number" min="0" step="0.01" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} placeholder="0.00" /></div></div><Button className="mt-5" variant="destructive" disabled={close.isPending || closingCash === ""} onClick={() => close.mutate()}><DoorClosed className="size-4" />{close.isPending ? "Closing…" : "Close shift"}</Button></section> : <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-7"><span className="grid size-12 place-items-center rounded-xl bg-secondary text-primary"><DoorOpen className="size-5" /></span><h2 className="mt-4 text-xl font-semibold">Open the cash drawer</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">Count the opening float before taking cash payments. Cashier sales will be included in the expected drawer balance.</p><div className="mt-5 max-w-sm space-y-2"><label htmlFor="opening-cash" className="text-sm font-medium">Opening cash</label><Input id="opening-cash" inputMode="decimal" type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="0.00" /></div><Button className="mt-4" disabled={open.isPending || !activeBranchId || openingCash === ""} onClick={() => open.mutate()}><DoorOpen className="size-4" />{open.isPending ? "Opening…" : "Open shift"}</Button></section>}
    </>}
  </main></SidebarInset></SidebarProvider>;
}
