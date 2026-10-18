"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api-client";
import { recordStockAdjustment } from "@/features/inventory/api/inventoryApi";
import { parseInventoryImport, type InventoryImportRow } from "@/features/inventory/lib/inventoryImport";

export function InventoryImportDialog({ tenantId, branchId, ingredients, onComplete }: {
  tenantId: string;
  branchId: string;
  ingredients: { id: string; name: string; unit: string }[];
  onComplete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<InventoryImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ applied: number; failed: number } | null>(null);
  const valid = rows.filter((row) => row.payload);
  const invalid = rows.filter((row) => row.error);

  async function selectFile(file?: File) {
    if (!file) return;
    setRows([]);
    setResult(null);
    setError("");
    setFileName(file.name);
    try {
      setRows(await parseInventoryImport(file, ingredients));
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }

  async function importRows() {
    setWorking(true);
    setError("");
    let applied = 0;
    let failed = invalid.length;
    const failedRows = new Map<number, string>();
    for (const row of valid) {
      if (!row.payload) continue;
      try {
        await recordStockAdjustment(tenantId, {
          ...row.payload,
          branchId,
        });
        applied += 1;
      } catch (reason) {
        failed += 1;
        failedRows.set(row.row, getErrorMessage(reason));
      }
    }
    setRows((current) => current.map((row) => failedRows.has(row.row)
      ? { ...row, error: failedRows.get(row.row), payload: undefined }
      : row));
    try {
      await onComplete();
      setResult({ applied, failed });
    } catch (reason) {
      setError(`Stock movements were applied, but inventory could not refresh: ${getErrorMessage(reason)}`);
    } finally {
      setWorking(false);
    }
  }

  return <>
    <Button type="button" variant="outline" onClick={() => { setOpen(true); setError(""); }}>
      <Upload aria-hidden />Import stock
    </Button>
    <Dialog open={open} onOpenChange={(next) => { if (!working) setOpen(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import stock movements</DialogTitle>
          <DialogDescription>Upload JSON, CSV, or Excel (.xlsx). Each valid row is recorded as an auditable stock adjustment or waste movement for the selected branch.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-5 py-7 text-center transition hover:bg-muted/40">
            <FileSpreadsheet className="size-6 text-primary" aria-hidden />
            <span className="text-sm font-medium">Choose a file</span>
            <span className="text-xs text-muted-foreground">Up to 5 MB · max 1,000 rows</span>
            <Input className="sr-only" type="file" accept=".json,.csv,.xlsx,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void selectFile(event.currentTarget.files?.[0])} />
          </label>
          {fileName ? <p className="text-xs text-muted-foreground">Selected: {fileName}</p> : null}
          <div className="rounded-xl border p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Columns</p>
            <p className="mt-1">ingredient, quantity, type, reorderLevel, note</p>
            <p className="mt-1">Ingredient can be its exact name or ID. Quantity is the change: positive adds stock, negative removes stock. Waste is always deducted.</p>
          </div>
          {rows.length ? <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">{valid.length} ready</span><span className={`rounded-full px-2.5 py-1 ${invalid.length ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>{invalid.length} invalid</span></div> : null}
          {valid.length ? <div className="overflow-hidden rounded-lg border"><div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">Preview · first {Math.min(6, valid.length)} valid rows</div><div className="max-h-48 overflow-auto"><table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="px-3 py-2">Ingredient</th><th className="px-3 py-2">Movement</th><th className="px-3 py-2 text-right">Quantity change</th><th className="px-3 py-2 text-right">Reorder at</th></tr></thead><tbody>{valid.slice(0, 6).map(({ row, payload }) => { const ingredient = ingredients.find((item) => item.id === payload?.ingredientId); return <tr key={row} className="border-t"><td className="px-3 py-2">{ingredient?.name ?? "Unknown ingredient"}</td><td className="px-3 py-2">{payload?.type === "WASTE" ? "Waste" : "Adjustment"}</td><td className="px-3 py-2 text-right tabular-nums">{payload?.quantity} {ingredient?.unit.toLowerCase()}</td><td className="px-3 py-2 text-right tabular-nums">{payload?.reorderLevel ?? "—"}</td></tr>; })}</tbody></table></div></div> : null}
          {invalid.length ? <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive" role="alert">{invalid.slice(0, 8).map((row) => <p key={row.row}>Row {row.row}: {row.error}</p>)}{invalid.length > 8 ? <p>And {invalid.length - 8} more invalid rows.</p> : null}</div> : null}
          {result ? <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">Import finished: {result.applied} movements recorded, {result.failed} failed.</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={working} onClick={() => setOpen(false)}>{result ? "Done" : "Cancel"}</Button>
          <Button type="button" disabled={!valid.length || working || Boolean(result) || !branchId} onClick={() => void importRows()}>{working ? "Applying…" : `Apply ${valid.length} movement${valid.length === 1 ? "" : "s"}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
