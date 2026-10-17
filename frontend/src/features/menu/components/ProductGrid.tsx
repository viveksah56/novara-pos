"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MenuProduct } from "@/features/menu/api/menuApi";
import type { PosCartLine } from "@/features/pos/api/posApi";
import { formatMoney } from "@/lib/formatMoney";

export function ProductGrid({
  products,
  cart,
  currency,
  disabled,
  onQuantityChange,
}: {
  products: MenuProduct[];
  cart: PosCartLine[];
  currency: string;
  disabled: boolean;
  onQuantityChange: (product: MenuProduct, delta: number) => void;
}) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const quantity = cart.find((line) => line.productId === product.id)?.quantity ?? 0;
        return (
          <article key={product.id} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="truncate font-semibold">{product.name}</h3><p className="mt-1 text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"}</p></div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(product.price, currency, 2)}</span>
            </div>
            {product.sku ? <p className="mt-3 text-[11px] text-muted-foreground">SKU · {product.sku}</p> : null}
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button type="button" size="icon" variant="outline" aria-label={`Remove one ${product.name}`} disabled={quantity === 0 || disabled} onClick={() => onQuantityChange(product, -1)}><Minus aria-hidden /></Button>
              <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
              <Button type="button" size="icon" aria-label={`Add one ${product.name}`} disabled={disabled} onClick={() => onQuantityChange(product, 1)}><Plus aria-hidden /></Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
