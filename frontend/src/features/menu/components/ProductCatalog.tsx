"use client";

import { useState } from "react";
import { LayoutGrid, List, Pencil, PackageX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MenuProduct } from "@/features/menu/api/menuApi";
import type { StockItem } from "@/features/inventory/api/inventoryApi";

function portionEstimate(product: MenuProduct, stockByIngredient: Map<string, number>): number | null {
  const lines = product.recipe?.ingredients ?? [];
  if (!lines.length) return null;
  return Math.max(0, Math.floor(Math.min(...lines.map((line) => {
    const needed = Number(line.quantity);
    return needed > 0 ? (stockByIngredient.get(line.ingredientId) ?? 0) / needed : Number.POSITIVE_INFINITY;
  }))));
}

function StockBadge({ product, stockByIngredient, stockReady }: { product: MenuProduct; stockByIngredient: Map<string, number>; stockReady: boolean }) {
  const portions = portionEstimate(product, stockByIngredient);
  if (portions === null) return <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">No recipe</span>;
  if (!stockReady) return <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">Stock unavailable</span>;
  const className = portions === 0
    ? "bg-destructive/10 text-destructive"
    : portions <= 5
      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
      : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${className}`}>{portions === 0 ? "Out of stock" : `${portions} portions`}</span>;
}

export function ProductCatalog({ products, stock, stockReady, search, onEdit, onDelete }: {
  products: MenuProduct[];
  stock: StockItem[];
  stockReady: boolean;
  search: string;
  onEdit: (product: MenuProduct) => void;
  onDelete: (product: MenuProduct) => void;
}) {
  const [view, setView] = useState<"table" | "grid">("table");
  const stockByIngredient = new Map(stock.map((line) => [line.ingredient.id, Number(line.quantity)]));
  return <>
    <div className="flex items-center gap-1 rounded-lg border p-1" aria-label="Product display mode">
      <Button type="button" size="icon-sm" variant={view === "table" ? "secondary" : "ghost"} aria-label="Table view" aria-pressed={view === "table"} onClick={() => setView("table")}><List aria-hidden /></Button>
      <Button type="button" size="icon-sm" variant={view === "grid" ? "secondary" : "ghost"} aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid aria-hidden /></Button>
    </div>
    {!products.length ? <div className="px-6 py-14 text-center"><PackageX className="mx-auto size-7 text-muted-foreground" aria-hidden /><h4 className="mt-3 font-semibold">{search ? "No products match" : "No products yet"}</h4><p className="mt-1 text-sm text-muted-foreground">{search ? "Try another search." : "Add a product or import a catalog to get started."}</p></div> : view === "table" ? <div className="mt-3 overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>SKU</TableHead><TableHead>Price</TableHead><TableHead>Stock estimate</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{products.map((product) => <TableRow key={product.id}><TableCell className="min-w-40"><p className="font-medium">{product.name}</p>{product.description ? <p className="max-w-64 truncate text-xs text-muted-foreground">{product.description}</p> : null}</TableCell><TableCell>{product.category?.name ?? "Uncategorized"}</TableCell><TableCell className="font-mono text-xs">{product.sku ?? "—"}</TableCell><TableCell className="tabular-nums">NPR {Number(product.price).toLocaleString()}</TableCell><TableCell><StockBadge product={product} stockByIngredient={stockByIngredient} stockReady={stockReady} /></TableCell><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${product.isAvailable ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>{product.isAvailable ? "Available" : "Unavailable"}</span></TableCell><TableCell><div className="flex justify-end gap-1"><Button type="button" size="sm" variant="outline" onClick={() => onEdit(product)}><Pencil aria-hidden />Edit</Button><Button type="button" size="icon-sm" variant="outline" aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><Trash2 aria-hidden /></Button></div></TableCell></TableRow>)}</TableBody></Table></div> : <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map((product) => <article key={product.id} className="flex min-h-48 flex-col rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-semibold">{product.name}</h4><p className="mt-1 truncate text-xs text-muted-foreground">{product.category?.name ?? "Uncategorized"} · SKU {product.sku ?? "—"}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">NPR {Number(product.price).toLocaleString()}</span></div><p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">{product.description || "No description provided."}</p><div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3"><StockBadge product={product} stockByIngredient={stockByIngredient} stockReady={stockReady} /><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => onEdit(product)}><Pencil aria-hidden />Edit</Button><Button type="button" size="icon-sm" variant="outline" aria-label={`Delete ${product.name}`} onClick={() => onDelete(product)}><Trash2 aria-hidden /></Button></div></div></article>)}</div>}
    <p className="mt-3 text-xs text-muted-foreground">Stock estimate uses the recipe and selected branch ingredient quantities. Products without recipes are not stock-tracked.</p>
  </>;
}
