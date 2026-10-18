"use client";

import { useMemo, useState } from "react";
import { ConfirmReasonModal } from "@/components/ui/confirm-reason-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
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

  return <ConfirmReasonModal
    target={order}
    open={open}
    onOpenChange={(nextOpen) => { if (!nextOpen && !pending) onClose(); }}
    onConfirm={(_target, reason) => onSubmit({ reason, restock, method, items: selectedItems })}
    title="Refund order"
    description="Select the quantities to refund and record why. Refunds are limited to the remaining paid quantities."
    reasonLabel="Refund reason"
    placeholder="Describe why this refund is being issued"
    confirmLabel="Issue refund"
    pendingLabel="Issuing refund…"
    confirmVariant="destructive"
    minReasonLength={3}
    pending={pending}
    error={error}
    confirmDisabled={!selectedItems.length}
  >
    {(currentOrder) => <div className="space-y-5">
      <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-medium">Order #{currentOrder.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-muted-foreground">Paid total {formatMoney(Number(currentOrder.totalAmount), currency)}</p></div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Items to refund</p>
        {currentOrder.items.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 rounded-xl border p-3">
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
    </div>}
  </ConfirmReasonModal>;
}
