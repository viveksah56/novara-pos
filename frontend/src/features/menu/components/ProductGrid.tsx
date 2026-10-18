"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityControl } from "@/components/shared/QuantityControl";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MenuProduct } from "@/features/menu/api/menuApi";
import type { PosCartLine } from "@/features/pos/api/posApi";
import { formatMoney } from "@/lib/formatMoney";

export function ProductGrid({ products, cart, currency, disabled, onQuantityChange, layout = "grid", compact = false }: {
  products: MenuProduct[];
  cart: PosCartLine[];
  currency: string;
  disabled: boolean;
  onQuantityChange: (product: MenuProduct, delta: number, optionIds?: string[]) => void;
  layout?: "grid" | "list";
  compact?: boolean;
}) {
  const [pendingProduct, setPendingProduct] = useState<MenuProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const activeGroups = pendingProduct?.modifierGroups?.filter(({ group }) => group.isActive).map(({ group }) => ({ ...group, options: group.options.filter((option) => option.isActive) })) ?? [];
  const validSelection = activeGroups.every((group) => {
    const count = group.options.filter((option) => selectedOptions.includes(option.id)).length;
    return count >= group.minSelect && count <= group.maxSelect;
  });
  const selectedPrice = Number(pendingProduct?.price ?? 0) + activeGroups.flatMap((group) => group.options).filter((option) => selectedOptions.includes(option.id)).reduce((sum, option) => sum + Number(option.priceDelta), 0);

  function startProduct(product: MenuProduct) {
    const groups = product.modifierGroups?.filter(({ group }) => group.isActive).map(({ group }) => ({ ...group, options: group.options.filter((option) => option.isActive) })) ?? [];
    if (!groups.length) {
      onQuantityChange(product, 1, []);
      return;
    }
    const defaults = groups.flatMap((group) => group.options.filter((option) => option.isDefault).slice(0, group.maxSelect).map((option) => option.id));
    setSelectedOptions(defaults);
    setPendingProduct(product);
  }

  function toggleOption(groupId: string, optionId: string) {
    const group = activeGroups.find((item) => item.id === groupId);
    if (!group) return;
    setSelectedOptions((current) => {
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      const withinGroup = group.options.filter((option) => current.includes(option.id)).map((option) => option.id);
      const preserved = current.filter((id) => !withinGroup.includes(id));
      if (group.maxSelect === 1) return [...preserved, optionId];
      if (withinGroup.length >= group.maxSelect) return current;
      return [...current, optionId];
    });
  }

  function addSelected() {
    if (!pendingProduct || !validSelection) return;
    onQuantityChange(pendingProduct, 1, selectedOptions);
    setPendingProduct(null);
  }

  return <>
    <div className={layout === "list" ? "divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-background" : "mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
      {products.map((product) => {
        const quantity = cart.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
        const activeModifierGroups = product.modifierGroups?.filter(({ group }) => group.isActive) ?? [];
        const hasModifiers = activeModifierGroups.length > 0;
        return <article key={product.id} className={layout === "list" ? "flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:gap-4 sm:px-4" : compact ? "flex min-h-32 flex-col rounded-xl border border-border/75 bg-background/60 p-3" : "flex min-h-40 flex-col rounded-xl border border-border bg-background p-4"}>
          <div className={layout === "list" ? "flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:flex-1" : "flex items-start justify-between gap-3"}><div className="min-w-0"><h3 className="truncate font-semibold">{product.name}</h3><p className="mt-1 text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(product.price, currency, 2)}</span></div>
          {product.sku && layout === "grid" ? <p className="mt-2 text-[11px] text-muted-foreground">SKU · {product.sku}</p> : null}
          {hasModifiers ? <p className={layout === "list" ? "hidden text-[11px] text-muted-foreground md:block" : "mt-1 text-[11px] text-muted-foreground"}>Customizable · {activeModifierGroups.length} groups</p> : null}
          <div className={layout === "list" ? "ml-auto" : "mt-auto flex items-center justify-between gap-2 pt-3"}><QuantityControl label={product.name} quantity={quantity} disabled={disabled} onDecrease={() => onQuantityChange(product, -1)} onIncrease={() => startProduct(product)} /></div>
        </article>;
      })}
    </div>
    <Dialog open={Boolean(pendingProduct)} onOpenChange={(open) => { if (!open) setPendingProduct(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Customize {pendingProduct?.name}</DialogTitle><DialogDescription>Choose the available options for this item. Required groups must be completed.</DialogDescription></DialogHeader>
        <div className="space-y-5">{activeGroups.map((group) => <section key={group.id} className="space-y-2"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{group.name}{group.minSelect > 0 ? <span className="ml-1 text-destructive">*</span> : null}</h3><p className="text-xs text-muted-foreground">Choose {group.minSelect === group.maxSelect ? group.minSelect : `${group.minSelect}–${group.maxSelect}`}</p></div><span className="text-xs tabular-nums text-muted-foreground">{group.options.filter((option) => selectedOptions.includes(option.id)).length}/{group.maxSelect}</span></div><div className="grid gap-2">{group.options.map((option) => { const selected = selectedOptions.includes(option.id); const delta = Number(option.priceDelta); return <Button key={option.id} type="button" variant={selected ? "secondary" : "outline"} className="h-auto min-h-11 justify-between whitespace-normal py-2 text-left" aria-pressed={selected} onClick={() => toggleOption(group.id, option.id)}><span className="min-w-0"><span className="block font-medium">{option.name}{option.isDefault ? <span className="ml-2 text-[10px] text-muted-foreground">DEFAULT</span> : null}</span>{option.recipeEffects.length ? <span className="mt-0.5 block text-xs text-muted-foreground">Adjusts {option.recipeEffects.map((effect) => effect.ingredient.name).join(", ")}</span> : null}</span><span className="shrink-0 pl-3 text-xs tabular-nums">{delta > 0 ? "+" : ""}{formatMoney(delta, currency, 2)}</span></Button>; })}</div></section>)}</div>
        <DialogFooter className="items-center justify-between sm:justify-between"><p className="mr-auto text-sm text-muted-foreground">Unit price <strong className="ml-1 text-foreground">{formatMoney(selectedPrice, currency)}</strong></p><Button type="button" variant="outline" onClick={() => setPendingProduct(null)}>Cancel</Button><Button type="button" disabled={!validSelection || selectedPrice < 0} onClick={addSelected}>Add item</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
