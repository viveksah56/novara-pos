"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/formatDateTime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Activity, Boxes, ChefHat, ClipboardList, Coffee, CreditCard, LayoutDashboard, Package, Save, ClipboardCheck, Truck, ShoppingBag } from "lucide-react";
import type { WorkspaceNavGroup } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceSearch } from "@/components/layout/WorkspaceSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { getIngredients, getStock } from "@/features/inventory/api/inventoryApi";
import { createStocktake, getStocktake, getStocktakes, saveStocktakeLines, transitionStocktake } from "@/features/inventory/api/stocktakeApi";
import { apiClient, apiRequest, getErrorMessage } from "@/lib/api-client";

type Branch = { id: string; name: string };

export function StocktakeConsole() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState(searchParams.get("tenantId") ?? "");
  const [branchId, setBranchId] = useState("");
  const [stocktakeId, setStocktakeId] = useState("");
  const [stocktakeSearch, setStocktakeSearch] = useState("");
  const [stocktakeStatus, setStocktakeStatus] = useState("ALL");
  const [countOverrides, setCountOverrides] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const memberships = profile.data?.memberships ?? [];
  const membership = memberships.find(({ tenant }) => tenant.id === selectedTenantId) ?? memberships[0];
  const tenantId = membership?.tenant.id ?? "";
  const role = membership?.role ?? "";
  const canCount = ["OWNER", "MANAGER", "INVENTORY_MANAGER"].includes(role);
  const canApprove = ["OWNER", "MANAGER"].includes(role);
  const branches = useQuery({
    queryKey: ["stocktakes", tenantId, "branches"],
    queryFn: async () => (await apiRequest<{ branches: Branch[] }>(apiClient.get(`/tenants/${tenantId}/branches`))).branches,
    enabled: Boolean(tenantId), retry: false,
  });
  const activeBranchId = branchId || branches.data?.[0]?.id || "";
  const stocktakes = useQuery({ queryKey: ["stocktakes", tenantId, activeBranchId], queryFn: () => getStocktakes(tenantId, activeBranchId), enabled: Boolean(tenantId && activeBranchId), retry: false });
  const selectedStocktake = useQuery({ queryKey: ["stocktakes", tenantId, stocktakeId], queryFn: () => getStocktake(tenantId, stocktakeId), enabled: Boolean(tenantId && stocktakeId), retry: false });
  const ingredients = useQuery({ queryKey: ["inventory", tenantId, "ingredients"], queryFn: () => getIngredients(tenantId), enabled: Boolean(tenantId && stocktakeId), retry: false });
  const stock = useQuery({ queryKey: ["inventory", tenantId, "stock", activeBranchId], queryFn: () => getStock(tenantId, activeBranchId), enabled: Boolean(tenantId && activeBranchId && stocktakeId), retry: false });
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["stocktakes", tenantId] }),
    queryClient.invalidateQueries({ queryKey: ["inventory", tenantId] }),
  ]);
  const create = useMutation({ mutationFn: () => createStocktake(tenantId, activeBranchId), onSuccess: async (record) => { setStocktakeId(record.id); setNotice("Stocktake started. Enter physical counts for each ingredient."); setError(""); await refresh(); }, onError: (reason) => setError(getErrorMessage(reason)) });
  const currentCountOverrides = Object.fromEntries(Object.entries(countOverrides).filter(([key]) => key.startsWith(`${stocktakeId}:`)).map(([key, value]) => [key.slice(stocktakeId.length + 1), value]));
  const counts: Record<string, string> = { ...Object.fromEntries((selectedStocktake.data?.lines ?? []).map((line) => [line.ingredientId, String(line.countedQuantity)])), ...currentCountOverrides };
  const save = useMutation({ mutationFn: () => saveStocktakeLines(tenantId, stocktakeId, Object.entries(counts).filter(([, value]) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0).map(([ingredientId, value]) => ({ ingredientId, countedQuantity: Number(value) }))), onSuccess: async () => { setNotice("Counts saved with timestamps for movement reconciliation."); setError(""); await refresh(); await selectedStocktake.refetch(); }, onError: (reason) => setError(getErrorMessage(reason)) });
  const transition = useMutation({ mutationFn: (action: "submit" | "approve" | "cancel") => transitionStocktake(tenantId, stocktakeId, action), onSuccess: async (result, action) => { setNotice(action === "submit" ? "Stocktake submitted for manager approval." : action === "approve" ? "Stocktake approved. Variances were applied to stock and recorded in the ledger." : "Stocktake cancelled."); setError(""); if (action === "cancel") setStocktakeId(""); await refresh(); await selectedStocktake.refetch(); }, onError: (reason) => setError(getErrorMessage(reason)) });

  async function submitStocktake() {
    setError("");
    try {
      if (Object.values(counts).some((value) => value.trim() !== "")) await save.mutateAsync();
      await transition.mutateAsync("submit");
    } catch {
      // Mutation handlers already expose an actionable error message.
    }
  }

  const navGroups: WorkspaceNavGroup[] = [
    { label: "Workspace", items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, allowed: ["OWNER", "MANAGER"].includes(role) },
      { label: "Point of sale", href: "/pos", icon: CreditCard, capability: "orders.create" },
      { label: "Kitchen queue", href: "/kitchen", icon: ChefHat, capability: "kitchen.orders.read" },
      { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    ] },
    { label: "Menu", items: [
      { label: "Categories", href: "/menu/categories", icon: Coffee, allowed: ["OWNER", "MANAGER"].includes(role) },
      { label: "Products", href: "/menu/products", icon: Package, allowed: ["OWNER", "MANAGER"].includes(role) },
      { label: "Recipes", href: "/inventory/recipes", icon: ChefHat, allowed: ["OWNER", "MANAGER"].includes(role) },
    ] },
    { label: "Inventory", items: [
      { label: "Inventory", href: "/inventory", icon: Boxes, capability: "inventory.read" },
      { label: "Ingredients", href: "/inventory/ingredients", icon: Package, capability: "inventory.read" },
      { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read" },
      { label: "Suppliers", href: "/inventory/suppliers", icon: Truck, capability: "inventory.read" },
      { label: "Purchases", href: "/inventory/purchases", icon: ShoppingBag, capability: "inventory.read" },
      { label: "Reports", href: "/stock-reports", icon: Activity, capability: "reports.inventory.read" },
    ] },
  ];
  const record = selectedStocktake.data;
  const visibleStocktakes = useMemo(() => {
    const search = stocktakeSearch.trim().toLocaleLowerCase();
    return (stocktakes.data ?? []).filter((item) => {
      const matchesStatus = stocktakeStatus === "ALL" || item.status === stocktakeStatus;
      const matchesSearch = !search || [
        item.branch?.name,
        item.createdBy?.name,
        item.status.replaceAll("_", " "),
      ].some((value) => value?.toLocaleLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [stocktakes.data, stocktakeSearch, stocktakeStatus]);
  const stockByIngredient = new Map((stock.data?.stock ?? []).map((row) => [row.ingredient.id, Number(row.quantity)]));

  return<>
    <SidebarInset className="min-w-0">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><SidebarTrigger /><span className="text-sm font-medium">Inventory stocktakes</span></div><div className="flex items-center gap-2"><WorkspaceSearch groups={navGroups} /><ThemeToggle /></div></header>
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Inventory control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Stocktakes</h1><p className="mt-2 text-sm text-muted-foreground">Count stock, submit for approval, and reconcile count-time changes without overwriting later sales.</p></div><div className="flex flex-wrap items-center gap-2">{memberships.length > 1 ? <SelectField aria-label="Business" value={tenantId} onValueChange={(value) => { setSelectedTenantId(value); setBranchId(""); setStocktakeId(""); }} options={memberships.map(({ tenant }) => ({ value: tenant.id, label: tenant.name }))} /> : null}<SelectField aria-label="Branch" value={activeBranchId} onValueChange={(value) => { setBranchId(value); setStocktakeId(""); }} options={(branches.data ?? []).map((branch) => ({ value: branch.id, label: branch.name }))} />{canCount ? <Button disabled={!activeBranchId || create.isPending} onClick={() => create.mutate()}><ClipboardCheck aria-hidden />{create.isPending ? "Starting…" : "Start stocktake"}</Button> : null}</div></div>
        {notice ? <p role="status" className="rounded-lg border bg-secondary/50 p-3 text-sm">{notice}</p> : null}{error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        {branches.isError ? <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{getErrorMessage(branches.error)}</p> : null}
        <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="font-semibold">Recent counts</h2><p className="mt-1 text-xs text-muted-foreground">Search and open a count to continue or review its actions.</p></div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{visibleStocktakes.length}</span>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
              <Input value={stocktakeSearch} onChange={(event) => setStocktakeSearch(event.target.value)} placeholder="Search branch, staff or status…" aria-label="Search stocktakes" />
              <SelectField aria-label="Filter stocktakes by status" value={stocktakeStatus} onValueChange={setStocktakeStatus} options={[{ value: "ALL", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "SUBMITTED", label: "Submitted" }, { value: "APPROVED", label: "Approved" }, { value: "CANCELLED", label: "Cancelled" }]} />
            </div>
            {stocktakes.isPending ? <div className="h-32 animate-pulse rounded-xl bg-secondary" aria-busy="true" /> : stocktakes.isError ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>{getErrorMessage(stocktakes.error)}</p><Button size="sm" variant="outline" onClick={() => void stocktakes.refetch()}>Retry</Button></div> : visibleStocktakes.length ? <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">{visibleStocktakes.map((item) => <article key={item.id} className={`rounded-xl border p-3 transition ${stocktakeId === item.id ? "border-primary bg-primary/5" : "hover:bg-secondary/40"}`}><button type="button" onClick={() => setStocktakeId(item.id)} aria-pressed={stocktakeId === item.id} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center justify-between gap-2"><strong className="text-sm">{item.status.replaceAll("_", " ")}</strong><span className="text-[10px] text-muted-foreground">{item._count?.lines ?? 0} lines</span></span><span className="mt-1 block text-xs text-muted-foreground">{item.branch?.name ?? "Branch"} · {formatDateTime(new Date(item.startedAt), "en", { dateStyle: "medium", timeStyle: "short" })}</span><span className="mt-1 block truncate text-xs text-muted-foreground">Started by {item.createdBy?.name ?? "Staff"}</span></button><div className="mt-3 flex justify-end border-t pt-2"><Button type="button" size="sm" variant={stocktakeId === item.id ? "secondary" : "outline"} onClick={() => setStocktakeId(item.id)}>{item.status === "DRAFT" ? "Continue count" : "Review count"}</Button></div></article>)}</div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{stocktakes.data?.length ? "No stocktakes match those filters." : "No stocktakes for this branch yet."}</p>}
          </section>
          <section className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">{!stocktakeId ? <div className="py-14 text-center"><ClipboardCheck className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Choose or start a stocktake</h2><p className="mt-1 text-sm text-muted-foreground">A stocktake records physical counts and applies only the verified variance.</p></div> : selectedStocktake.isPending ? <div className="h-48 animate-pulse rounded-xl bg-secondary" /> : selectedStocktake.isError || !record ? <div role="alert" className="py-8 text-sm text-destructive">{getErrorMessage(selectedStocktake.error)}</div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{record.branch?.name ?? "Branch stocktake"}</h2><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{record.status}</span></div><p className="mt-1 text-xs text-muted-foreground">Started {formatDateTime(new Date(record.startedAt), "en", { dateStyle: "medium", timeStyle: "short" })} by {record.createdBy?.name ?? "staff"}</p></div><div className="flex flex-wrap gap-2">{record.status === "DRAFT" && canCount ? <><Button variant="outline" disabled={save.isPending || !Object.values(counts).some((value) => value.trim() !== "")} onClick={() => save.mutate()}><Save aria-hidden />{save.isPending ? "Saving…" : "Save counts"}</Button><Button disabled={transition.isPending || save.isPending || (!record.lines?.length && !Object.values(counts).some((value) => value.trim() !== ""))} onClick={() => void submitStocktake()}>{save.isPending || transition.isPending ? "Submitting…" : "Submit for approval"}</Button></> : null}{record.status === "SUBMITTED" && canApprove ? <Button disabled={transition.isPending} onClick={() => transition.mutate("approve")}>{transition.isPending ? "Applying…" : "Approve & apply variance"}</Button> : null}{["DRAFT", "SUBMITTED"].includes(record.status) && canCount ? <Button variant="ghost" disabled={transition.isPending} onClick={() => transition.mutate("cancel")}>Cancel</Button> : null}</div></div>
            {record.status === "DRAFT" ? <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-300">Counts save with the current timestamp. Submit when counting is complete; after submission, only an owner or manager can approve and apply variances.</p> : null}
            {record.status === "SUBMITTED" && !canApprove ? <p className="mt-4 rounded-lg bg-secondary p-3 text-xs">Submitted for owner or manager approval.</p> : null}
            {ingredients.isPending || stock.isPending ? <div className="mt-4 h-40 animate-pulse rounded-xl bg-secondary" /> : ingredients.isError || stock.isError ? <p role="alert" className="mt-4 text-sm text-destructive">{getErrorMessage(ingredients.error ?? stock.error)}</p> : <div className="mt-5 overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-secondary/70 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-3">Ingredient</th><th className="px-3 py-3 text-right">System qty</th><th className="px-3 py-3 text-right">Counted</th><th className="px-3 py-3 text-right">Variance</th></tr></thead><tbody className="divide-y">{(ingredients.data ?? []).filter((ingredient) => ingredient.isActive).map((ingredient) => { const system = stockByIngredient.get(ingredient.id) ?? 0; const saved = record.lines?.find((line) => line.ingredientId === ingredient.id); const value = record.status === "DRAFT" ? counts[ingredient.id] ?? "" : saved ? String(saved.countedQuantity) : ""; const variance = saved?.variance !== null && saved?.variance !== undefined ? Number(saved.variance) : value === "" ? null : Number(value) - system; return <tr key={ingredient.id}><td className="px-3 py-3"><p className="font-medium">{ingredient.name}</p><p className="text-[11px] text-muted-foreground">{ingredient.unit.toLowerCase()}</p></td><td className="px-3 py-3 text-right tabular-nums">{system.toLocaleString()}</td><td className="px-3 py-3 text-right">{record.status === "DRAFT" ? <Input className="ml-auto h-9 w-32 text-right tabular-nums" type="number" min="0" step="any" aria-label={`Count ${ingredient.name}`} value={value} onChange={(event) => setCountOverrides((current) => ({ ...current, [`${stocktakeId}:${ingredient.id}`]: event.target.value }))} /> : <span className="tabular-nums">{value || "—"}</span>}</td><td className={`px-3 py-3 text-right tabular-nums ${variance !== null && variance < 0 ? "text-destructive" : ""}`}>{variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance.toLocaleString()}`}</td></tr>; })}</tbody></table></div>}
            {record.lines?.length ? <p className="mt-3 text-xs text-muted-foreground">{record.lines.length} ingredient count{record.lines.length === 1 ? "" : "s"} saved{record.status === "APPROVED" ? ` · Approved by ${record.approvedBy?.name ?? "manager"}` : ""}.</p> : null}
          </>}</section>
        </div>
      </main>
    </SidebarInset>
  </>;
}
