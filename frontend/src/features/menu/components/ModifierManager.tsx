"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Boxes, ChefHat, ClipboardList, Coffee, CreditCard, LayoutDashboard, Package, Plus, Save, Trash2, UtensilsCrossed } from "lucide-react";
import { WorkspaceSidebar, type WorkspaceNavGroup } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceSearch } from "@/components/layout/WorkspaceSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { getIngredients } from "@/features/inventory/api/inventoryApi";
import { assignModifierGroups, getMenuProducts, getModifierGroups, saveModifierGroup, type ModifierGroupInput, type ModifierGroupRecord, type ModifierOptionInput } from "@/features/menu/api/menuApi";
import { getErrorMessage } from "@/lib/api-client";

const emptyOption = (): ModifierOptionInput => ({ name: "", priceDelta: 0, isDefault: false, isActive: true, sortOrder: 0, effects: [] });
const emptyGroup = (): ModifierGroupInput => ({ name: "", minSelect: 0, maxSelect: 1, sortOrder: 0, isActive: true, options: [emptyOption()] });

export function ModifierManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [groupInput, setGroupInput] = useState<ModifierGroupInput>(emptyGroup());
  const [editingId, setEditingId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const memberships = profile.data?.memberships ?? [];
  const requestedTenantId = searchParams.get("tenantId");
  const membership = memberships.find(({ tenant }) => tenant.id === requestedTenantId) ?? memberships[0];
  const tenantId = membership?.tenant.id ?? "";
  const tenantName = membership?.tenant.name ?? "Your workspace";
  const role = membership?.role ?? "";
  const canManage = role === "OWNER" || role === "MANAGER";
  const groups = useQuery({ queryKey: ["menu", tenantId, "modifier-groups"], queryFn: () => getModifierGroups(tenantId), enabled: Boolean(tenantId), retry: false });
  const products = useQuery({ queryKey: ["menu", tenantId, "products"], queryFn: () => getMenuProducts(tenantId), enabled: Boolean(tenantId), retry: false });
  const ingredients = useQuery({ queryKey: ["inventory", tenantId, "ingredients"], queryFn: () => getIngredients(tenantId), enabled: Boolean(tenantId), retry: false });
  const navGroups: WorkspaceNavGroup[] = [
    { label: "Workspace", items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, allowed: canManage },
      { label: "Point of sale", href: "/pos", icon: CreditCard, capability: "orders.create" },
      { label: "Kitchen queue", href: "/kitchen", icon: ChefHat, capability: "kitchen.orders.read" },
      { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    ] },
    { label: "Menu", items: [
      { label: "Categories", href: "/menu/categories", icon: Coffee, allowed: canManage },
      { label: "Products", href: "/menu/products", icon: UtensilsCrossed, allowed: canManage },
      { label: "Modifiers", href: "/menu/modifiers", icon: Plus, allowed: canManage },
      { label: "Recipes", href: "/inventory/recipes", icon: ChefHat, allowed: canManage },
    ] },
    { label: "Inventory", items: [
      { label: "Inventory", href: "/inventory", icon: Boxes, capability: "inventory.read" },
      { label: "Ingredients", href: "/inventory/ingredients", icon: Package, capability: "inventory.read" },
      { label: "Reports", href: "/reports", icon: Activity, capability: "reports.sales.read" },
    ] },
  ];
  const saveMutation = useMutation({
    mutationFn: () => saveModifierGroup(tenantId, groupInput, editingId),
    onSuccess: async () => {
      setGroupInput(emptyGroup()); setEditingId(undefined); setError(""); setMessage("Modifier group saved. Product assignments and POS will use the updated choices.");
      await queryClient.invalidateQueries({ queryKey: ["menu", tenantId] });
    },
    onError: (reason) => { setError(getErrorMessage(reason)); setMessage(""); },
  });
  const assignmentMutation = useMutation({
    mutationFn: ({ productId, groupIds }: { productId: string; groupIds: string[] }) => assignModifierGroups(tenantId, productId, groupIds),
    onSuccess: async () => { setError(""); setMessage("Product modifier groups updated."); await queryClient.invalidateQueries({ queryKey: ["menu", tenantId] }); },
    onError: (reason) => setError(getErrorMessage(reason)),
  });

  function editGroup(group: ModifierGroupRecord) {
    setEditingId(group.id);
    setGroupInput({ name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, sortOrder: group.sortOrder, isActive: group.isActive, options: group.options.map((option) => ({ name: option.name, priceDelta: Number(option.priceDelta), isDefault: option.isDefault, isActive: option.isActive, sortOrder: option.sortOrder, effects: (option.recipeEffects ?? option.effects ?? []).map(({ ingredientId, quantityDelta }) => ({ ingredientId, quantityDelta: Number(quantityDelta) })) })) });
    setMessage(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function updateOption(index: number, patch: Partial<ModifierOptionInput>) {
    setGroupInput((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) }));
  }
  function toggleProductGroup(productId: string, groupId: string, checked: boolean) {
    const product = products.data?.find((item) => item.id === productId);
    if (!product) return;
    const currentIds = product.modifierGroups?.map(({ group }) => group.id) ?? [];
    const groupIds = checked ? [...new Set([...currentIds, groupId])] : currentIds.filter((id) => id !== groupId);
    assignmentMutation.mutate({ productId, groupIds });
  }

  return <SidebarProvider>
    <WorkspaceSidebar role={role} tenantName={tenantName} groups={navGroups} activePath={pathname} />
    <SidebarInset className="min-w-0">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><SidebarTrigger /><span className="text-sm font-medium">Menu modifiers</span></div><div className="flex items-center gap-2"><WorkspaceSearch groups={navGroups} /><ThemeToggle /></div></header>
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Menu configuration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Modifiers & recipe effects</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure sizes, milk choices, extras, and the ingredient changes applied when a sale is completed.</p></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{tenantName}</span></div>
        {message ? <p role="status" className="rounded-lg border bg-secondary/50 p-3 text-sm">{message}</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        {!canManage ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">Only business owners and managers can change modifier configuration.</div> : <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{editingId ? "Edit modifier group" : "Create modifier group"}</h2><p className="mt-1 text-xs text-muted-foreground">Define how many options customers may choose.</p></div>{editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(undefined); setGroupInput(emptyGroup()); }}>Cancel edit</Button> : null}</div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium sm:col-span-2">Group name<Input value={groupInput.name} maxLength={120} onChange={(event) => setGroupInput((current) => ({ ...current, name: event.target.value }))} placeholder="Milk choice" /></label>
              <label className="space-y-1.5 text-sm font-medium">Minimum selections<Input type="number" min="0" max="20" value={groupInput.minSelect} onChange={(event) => setGroupInput((current) => ({ ...current, minSelect: Number(event.target.value) }))} /></label>
              <label className="space-y-1.5 text-sm font-medium">Maximum selections<Input type="number" min="1" max="20" value={groupInput.maxSelect} onChange={(event) => setGroupInput((current) => ({ ...current, maxSelect: Number(event.target.value) }))} /></label></div>
            <div className="mt-6 space-y-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Options</h3><Button type="button" variant="outline" size="sm" onClick={() => setGroupInput((current) => ({ ...current, options: [...current.options, { ...emptyOption(), sortOrder: current.options.length }] }))}><Plus aria-hidden />Add option</Button></div>
              {groupInput.options.map((option, index) => <article key={index} className="space-y-3 rounded-xl border bg-background p-3 sm:p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]"><label className="space-y-1 text-xs font-medium">Option name<Input value={option.name} maxLength={120} onChange={(event) => updateOption(index, { name: event.target.value })} placeholder="Oat milk" /></label><label className="space-y-1 text-xs font-medium">Price change<Input type="number" step="0.01" value={option.priceDelta} onChange={(event) => updateOption(index, { priceDelta: Number(event.target.value) })} /></label><Button type="button" variant="ghost" size="icon" aria-label={`Remove option ${index + 1}`} disabled={groupInput.options.length <= 1} onClick={() => setGroupInput((current) => ({ ...current, options: current.options.filter((_, optionIndex) => optionIndex !== index) }))}><Trash2 aria-hidden /></Button></div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs"><label className="flex items-center gap-2"><Checkbox checked={option.isDefault} onCheckedChange={(checked) => updateOption(index, { isDefault: checked === true })} />Default selection</label><label className="flex items-center gap-2"><Checkbox checked={option.isActive} onCheckedChange={(checked) => updateOption(index, { isActive: checked === true })} />Available</label></div>
                <div className="space-y-2 border-t pt-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Recipe effects</p><Button type="button" size="sm" variant="ghost" onClick={() => updateOption(index, { effects: [...option.effects, { ingredientId: "", quantityDelta: 0 }] })}>Add effect</Button></div>
                  {option.effects.map((effect, effectIndex) => <div key={effectIndex} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]"><SelectField aria-label="Ingredient affected by option" value={effect.ingredientId} onValueChange={(ingredientId) => updateOption(index, { effects: option.effects.map((item, itemIndex) => itemIndex === effectIndex ? { ...item, ingredientId } : item) })} options={[{ value: "", label: "Select ingredient" }, ...(ingredients.data ?? []).map((ingredient) => ({ value: ingredient.id, label: `${ingredient.name} (${ingredient.unit.toLowerCase()})` }))]} /><Input aria-label="Signed recipe quantity change" type="number" step="any" value={effect.quantityDelta} onChange={(event) => updateOption(index, { effects: option.effects.map((item, itemIndex) => itemIndex === effectIndex ? { ...item, quantityDelta: Number(event.target.value) } : item) })} /><Button type="button" variant="ghost" size="icon" aria-label="Remove recipe effect" onClick={() => updateOption(index, { effects: option.effects.filter((_, itemIndex) => itemIndex !== effectIndex) })}><Trash2 aria-hidden /></Button></div>)}
                  <p className="text-[11px] leading-5 text-muted-foreground">Use positive amounts to add ingredient usage and negative amounts to replace or remove base recipe usage. The backend rejects a resulting negative quantity.</p>
                </div>
              </article>)}
            </div>
            <div className="mt-5 flex justify-end"><Button type="button" disabled={!canManage || saveMutation.isPending || !groupInput.name.trim() || groupInput.options.some((option) => !option.name.trim() || option.effects.some((effect) => !effect.ingredientId)) || groupInput.maxSelect < groupInput.minSelect} onClick={() => { setError(""); saveMutation.mutate(); }}><Save aria-hidden />{saveMutation.isPending ? "Saving…" : "Save modifier group"}</Button></div>
          </section>
          <section className="space-y-5">
            <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">Existing groups</h2><div className="mt-4 space-y-2">{groups.isPending ? <div className="h-24 animate-pulse rounded-xl bg-secondary" /> : groups.isError ? <p role="alert" className="text-sm text-destructive">{getErrorMessage(groups.error)}</p> : groups.data?.length ? groups.data.map((group) => <div key={group.id} className="flex items-start justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="font-medium">{group.name} {!group.isActive ? <span className="ml-1 text-xs text-muted-foreground">Inactive</span> : null}</p><p className="mt-1 text-xs text-muted-foreground">{group.minSelect}–{group.maxSelect} selections · {group.options.length} options</p><p className="mt-1 truncate text-xs text-muted-foreground">{group.options.map((option) => option.name).join(" · ")}</p></div><Button type="button" size="sm" variant="outline" onClick={() => editGroup(group)}>Edit</Button></div>) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No modifier groups yet.</p>}</div></article>
            <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">Assign groups to products</h2><p className="mt-1 text-xs text-muted-foreground">POS will request selections only for groups assigned to each product.</p><div className="mt-4 space-y-3">{products.isPending ? <div className="h-24 animate-pulse rounded-xl bg-secondary" /> : products.isError ? <p role="alert" className="text-sm text-destructive">{getErrorMessage(products.error)}</p> : products.data?.length ? products.data.map((product) => <div key={product.id} className="rounded-xl border p-3"><p className="font-medium">{product.name}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{(groups.data ?? []).filter((group) => group.isActive).map((group) => { const checked = product.modifierGroups?.some(({ group: attached }) => attached.id === group.id) ?? false; return <label key={group.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-secondary/50 px-2 py-2 text-xs"><Checkbox checked={checked} disabled={assignmentMutation.isPending} onCheckedChange={(value) => toggleProductGroup(product.id, group.id, value === true)} /><span className="truncate">{group.name}</span></label>; })}</div></div>) : <p className="text-sm text-muted-foreground">Create products before assigning modifier groups.</p>}</div></article>
          </section>
        </div>}
      </main>
    </SidebarInset>
  </SidebarProvider>;
}
