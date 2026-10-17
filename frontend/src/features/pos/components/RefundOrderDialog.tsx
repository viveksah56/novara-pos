"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PosOrderRecord, PosRefundInput } from "@/features/pos/api/posApi";
import { formatMoney } from "@/lib/formatMoney";

type RefundOrderDialogProps = {
  order: PosOrderRecord | null;
  currency: string;
  open: boolean;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: PosRefundInput) => void;
};

export function RefundOrderDialog({ order, currency, open, pending, error, onClose, onSubmit }: RefundOrderDialogProps) {
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [method, setMethod] = useState<PosRefundInput["method"]>("CASH");
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries((order?.items ?? []).map((item) => [item.id, "0"])));

  const selectedItems = useMemo(() => order?.items.flatMap((item) => {
    const quantity = Number(quantities[item.id] ?? 0);
    return Number.isFinite(quantity) && quantity > 0 ? [{ orderItemId: item.id, quantity }] : [];
  }) ?? [], [order, quantities]);
  const estimatedTotal = useMemo(() => order?.items.reduce((sum, item) => {
    const quantity = Number(quantities[item.id] ?? 0);
    return sum + (Number.isFinite(quantity) ? (Number(item.lineTotal) / Number(item.quantity)) * quantity : 0);
  }, 0) ?? 0, [order, quantities]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItems.length || reason.trim().length < 3) return;
    onSubmit({ reason: reason.trim(), restock, method, items: selectedItems });
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !pending) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Refund order</DialogTitle>
        <DialogDescription>Select the quantities to refund and record why. Refunds are limited to the remaining paid quantities.</DialogDescription>
      </DialogHeader>
      {order ? <form className="space-y-5" onSubmit={submit}>
        <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-medium">Order #{order.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-muted-foreground">Paid total {formatMoney(Number(order.totalAmount), currency)}</p></div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Items to refund</p>
          {order.items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 rounded-xl border p-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{item.product.name}</p><p className="text-xs text-muted-foreground">{formatMoney(Number(item.unitPrice), currency)} each · maximum {item.quantity}</p></div>
            <label className="space-y-1 text-xs text-muted-foreground">Quantity<Input aria-label={`Refund quantity for ${item.product.name}`} type="number" min="0" max={item.quantity} step="any" value={quantities[item.id] ?? "0"} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
          </div>)}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>Estimated item subtotal</span><span className="font-semibold">{formatMoney(estimatedTotal, currency)}</span></div>
          <p className="text-xs text-muted-foreground">Tax and service charge are prorated by the server based on the selected item amounts.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">Refund method<SelectField value={method} onValueChange={(value) => setMethod(value as PosRefundInput["method"])} options={[{ value: "CASH", label: "Cash" }, { value: "CARD", label: "Card" }, { value: "OTHER", label: "Other" }]} /></label>
          <label className="flex items-center gap-2 self-end rounded-lg border p-3 text-sm"><Checkbox checked={restock} onCheckedChange={(checked) => setRestock(checked === true)} />Restock returned ingredients</label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">Reason<Textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} required placeholder="Describe why this refund is being issued" /></label>
        {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending || !selectedItems.length || reason.trim().length < 3}><RotateCcw className="size-4" />{pending ? "Issuing refund…" : "Issue refund"}</Button></DialogFooter>
      </form> : null}
    </DialogContent>
  </Dialog>;
}
