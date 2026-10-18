"use client";

import { useMemo } from "react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/shared/SearchBar";
import type { StockItem } from "@/features/inventory/api/inventoryApi";

function quantity(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function stockStatus(row: StockItem) {
  const current = Number(row.quantity);
  const reorderAt = Number(row.reorderLevel);
  if (current <= 0) return { label: "Out of stock", classes: "bg-destructive/10 text-destructive" };
  if (current <= reorderAt) return { label: "Reorder", classes: "bg-amber-500/15 text-amber-800 dark:text-amber-300" };
  return { label: "In stock", classes: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" };
}

export function InventoryStockTable({ rows, branchName, search, onSearchChange, onAdjust }: {
  rows: StockItem[];
  branchName: string;
  search: string;
  onSearchChange: (value: string) => void;
  onAdjust: (row: StockItem) => void;
}) {
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.ingredient.name,
      row.ingredient.unit,
      branchName,
      row.quantity,
      row.reorderLevel,
      row.averageCost,
      stockStatus(row).label,
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [branchName, rows, search]);

  const columns: DataColumn<StockItem>[] = [
    {
      id: "ingredient",
      header: "Ingredient",
      accessorFn: (row) => row.ingredient.name,
      cell: (row) => <div className="min-w-36"><p className="font-medium">{row.ingredient.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.ingredient.unit.toLowerCase()}</p></div>,
    },
    { id: "branch", header: "Branch", accessorFn: () => branchName, cell: () => <span className="whitespace-nowrap">{branchName}</span> },
    { id: "quantity", header: "On hand", accessorFn: (row) => Number(row.quantity), cell: (row) => <span className="tabular-nums">{quantity(row.quantity)} {row.ingredient.unit.toLowerCase()}</span> },
    { id: "averageCost", header: "Average cost", accessorFn: (row) => Number(row.averageCost ?? 0), cell: (row) => <span className="whitespace-nowrap tabular-nums">NPR {Number(row.averageCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { id: "reorderLevel", header: "Reorder level", accessorFn: (row) => Number(row.reorderLevel), cell: (row) => <span className="tabular-nums">{quantity(row.reorderLevel)} {row.ingredient.unit.toLowerCase()}</span> },
    { id: "status", header: "Status", accessorFn: (row) => stockStatus(row).label, cell: (row) => { const status = stockStatus(row); return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${status.classes}`}>{status.label}</span>; } },
  ];

  return <div className="space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchBar value={search} onValueChange={onSearchChange} placeholder="Search ingredients, stock or status…" ariaLabel="Search inventory" className="sm:max-w-sm" />
      <p className="text-xs text-muted-foreground">{filteredRows.length} of {rows.length} stock items</p>
    </div>
    <DataTable
      rows={filteredRows}
      columns={columns}
      getRowId={(row) => row.id}
      enableRowSelection
      initialPageSize={10}
      actions={(row) => <Button type="button" size="sm" variant="outline" onClick={() => onAdjust(row)}>Adjust</Button>}
      empty={<div className="px-4 py-12 text-center"><h4 className="font-semibold">{search ? "No stock matches" : "No stock recorded"}</h4><p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different ingredient or status." : "Add an inventory movement to set the branch stock level."}</p></div>}
    />
  </div>;
}
