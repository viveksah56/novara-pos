"use client";

import { useMemo, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import type { PosOrderRecord, PosPaymentInput, PosPaymentLineInput } from "@/features/pos/api/posApi";
import { formatMoney } from "@/lib/formatMoney";

type PaymentLineDraft = { id: string; method: PosPaymentLineInput["method"]; amount: string; tendered: string; reference: string };
type CompletePaymentDialogProps = {
  order: PosOrderRecord | null;
  currency: string;
  open: boolean;
  pending: boolean;
  error?: string;
  requireReference: boolean;
  onClose: () => void;
  onSubmit: (payment: PosPaymentInput) => void;
};

function emptyLine(amount = "", id = "tender-1"): PaymentLineDraft {
  return { id, method: "CASH", amount, tendered: amount, reference: "" };
}

export function CompletePaymentDialog({ order, currency, open, pending, error, requireReference, onClose, onSubmit }: CompletePaymentDialogProps) {
  const total = Number(order?.totalAmount ?? 0);
  const [lines, setLines] = useState<PaymentLineDraft[]>(() => [emptyLine(order ? Number(order.totalAmount).toFixed(2) : "")]);
  const applied = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [lines]);
  const outstanding = Math.round((total - applied) * 100) / 100;
  const cashChange = lines.filter((line) => line.method === "CASH").reduce((sum, line) => sum + Math.max(0, (Number(line.tendered) || 0) - (Number(line.amount) || 0)), 0);
  const invalidLine = lines.some((line) => {
    const amount = Number(line.amount);
    const tendered = Number(line.tendered);
    return !Number.isFinite(amount) || amount <= 0 || (line.method === "CASH" && (!Number.isFinite(tendered) || tendered < amount)) || (line.method !== "CASH" && requireReference && !line.reference.trim());
  });
  const canSubmit = Boolean(order) && lines.length > 0 && lines.length <= 10 && !invalidLine && Math.abs(outstanding) < 0.01;

  function updateLine(id: string, patch: Partial<PaymentLineDraft>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function addLine() {
    if (lines.length >= 10) return;
    const amount = Math.max(0, outstanding).toFixed(2);
    setLines((current) => [...current, emptyLine(amount, crypto.randomUUID())]);
  }

  function submit() {
    if (!canSubmit) return;
    const payments: PosPaymentLineInput[] = lines.map((line) => ({
      method: line.method,
      amount: Number(line.amount),
      ...(line.method === "CASH" ? { tendered: Number(line.tendered) } : {}),
      ...(line.reference.trim() ? { reference: line.reference.trim() } : {}),
    }));
    onSubmit({ method: payments[0].method, payments });
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !pending) onClose(); }}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>Take payment</DialogTitle><DialogDescription>Split the amount across up to ten cash, card, transfer, or wallet tenders.</DialogDescription></DialogHeader>
      {order ? <div className="space-y-4">
        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-3"><Summary amount={formatMoney(total, currency)} label="Amount due"/><Summary amount={formatMoney(applied, currency)} label="Applied"/><Summary amount={formatMoney(Math.max(0, outstanding), currency)} label={outstanding < -0.01 ? "Over by" : "Remaining"} /></div>
        <div className="space-y-3">
          {lines.map((line, index) => <section key={line.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(150px,1fr)_minmax(110px,.7fr)_minmax(120px,.8fr)_minmax(140px,1fr)_40px] sm:items-end">
            <label className="space-y-1.5 text-xs font-medium">Tender {index + 1}<SelectField value={line.method} onValueChange={(value) => updateLine(line.id, { method: value as PaymentLineDraft["method"] })} options={[{ value: "CASH", label: "Cash" }, { value: "CARD", label: "Card" }, { value: "DIGITAL_WALLET", label: "Digital wallet" }, { value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "OTHER", label: "Other" }]} /></label>
            <label className="space-y-1.5 text-xs font-medium">Applied amount<Input type="number" inputMode="decimal" min="0.01" step="0.01" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value, ...(line.method === "CASH" && line.tendered === line.amount ? { tendered: event.target.value } : {}) })}/></label>
            {line.method === "CASH" ? <label className="space-y-1.5 text-xs font-medium">Cash tendered<Input type="number" inputMode="decimal" min={Number(line.amount) || 0} step="0.01" value={line.tendered} onChange={(event) => updateLine(line.id, { tendered: event.target.value })}/></label> : <label className="space-y-1.5 text-xs font-medium">Reference{!requireReference ? <span className="ml-1 font-normal text-muted-foreground">optional</span> : null}<Input value={line.reference} onChange={(event) => updateLine(line.id, { reference: event.target.value })} maxLength={120} placeholder="Transaction ID"/></label>}
            {line.method === "CASH" ? <label className="space-y-1.5 text-xs font-medium">Change<Input readOnly value={formatMoney(Math.max(0, (Number(line.tendered) || 0) - (Number(line.amount) || 0)), currency)}/></label> : <div className="hidden sm:block"/>}
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove tender ${index + 1}`} disabled={pending || lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 className="size-4"/></Button>
          </section>)}
        </div>
        <Button type="button" variant="outline" disabled={pending || lines.length >= 10 || outstanding <= 0.01} onClick={addLine}><Plus className="size-4"/>Add tender</Button>
        {cashChange > 0 ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">Total change due <strong className="ml-2">{formatMoney(cashChange, currency)}</strong></p> : null}
        {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button type="button" disabled={pending || !canSubmit} onClick={submit}><CreditCard className="size-4"/>{pending ? "Processing…" : "Complete payment"}</Button></DialogFooter>
      </div> : null}
    </DialogContent>
  </Dialog>;
}

function Summary({ label, amount }: { label: string; amount: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{amount}</p></div>; }
