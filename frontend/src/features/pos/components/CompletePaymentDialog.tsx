"use client";

import { useMemo, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, FormSelectField } from "@/components/FormFields";
import type { PosOrderRecord, PosPaymentInput, PosPaymentLineInput } from "@/features/pos/api/posApi";
import { formatMoney } from "@/lib/formatMoney";

type PaymentLineDraft = { id: string; method: PosPaymentLineInput["method"]; amount: string; tendered: string; reference: string };
type PaymentMethod = PaymentLineDraft["method"];
type PaymentAmountStatus = "due" | "neutral" | "applied" | "pending" | "settled" | "overpaid";
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

const MAX_PAYMENT_LINES = 10;
const PAYMENT_AMOUNT_FORMATTER = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "DIGITAL_WALLET", label: "Digital wallet" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
] as const satisfies ReadonlyArray<{ value: PaymentMethod; label: string }>;
const PAYMENT_AMOUNT_STATUS_STYLES: Record<PaymentAmountStatus, string> = {
  due: "border-sky-500/25 bg-sky-500/5 text-sky-900 dark:text-sky-100",
  neutral: "border-border bg-muted/30 text-foreground",
  applied: "border-emerald-600/25 bg-emerald-600/10 text-emerald-900 dark:text-emerald-100",
  pending: "border-amber-600/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  settled: "border-emerald-600/25 bg-emerald-600/10 text-emerald-900 dark:text-emerald-100",
  overpaid: "border-destructive/30 bg-destructive/10 text-destructive",
};

function emptyLine(amount = "", id = "tender-1"): PaymentLineDraft {
  return { id, method: "CASH", amount, tendered: amount, reference: "" };
}

function formatExactMoney(amount: number, currency: string) {
  return `${currency} ${PAYMENT_AMOUNT_FORMATTER.format(amount)}`;
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_OPTIONS.some((option) => option.value === value);
}

export function CompletePaymentDialog({ order, currency, open, pending, error, requireReference, onClose, onSubmit }: CompletePaymentDialogProps) {
  const total = Number(order?.totalAmount ?? 0);
  const [lines, setLines] = useState<PaymentLineDraft[]>(() => [emptyLine(order ? Number(order.totalAmount).toFixed(2) : "")]);
  const applied = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [lines]);
  const remainingAmount = Math.round((total - applied) * 100) / 100;
  const totalCashChange = lines.filter((line) => line.method === "CASH").reduce((sum, line) => sum + Math.max(0, (Number(line.tendered) || 0) - (Number(line.amount) || 0)), 0);
  const hasInvalidLine = lines.some((line) => {
    const amount = Number(line.amount);
    const tendered = Number(line.tendered);
    return !Number.isFinite(amount) || amount <= 0 || (line.method === "CASH" && (!Number.isFinite(tendered) || tendered < amount)) || (line.method !== "CASH" && requireReference && !line.reference.trim());
  });
  const canSubmit = Boolean(order) && lines.length > 0 && lines.length <= MAX_PAYMENT_LINES && !hasInvalidLine && Math.abs(remainingAmount) < 0.01;

  function handleUpdateLine(id: string, patch: Partial<PaymentLineDraft>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  function handleAddLine() {
    if (lines.length >= MAX_PAYMENT_LINES) return;
    const amount = Math.max(0, remainingAmount).toFixed(2);
    setLines((current) => [...current, emptyLine(amount, crypto.randomUUID())]);
  }

  function handleSubmit() {
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
    <DialogContent className="max-h-[min(90dvh,48rem)] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Take payment</DialogTitle><DialogDescription>Split the amount across up to ten cash, card, transfer, or wallet tenders.</DialogDescription></DialogHeader>
      {order ? <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Payment status">
          <Summary amount={formatExactMoney(total, currency)} label="Amount due" status="due" detail="Order total"/>
          <Summary amount={formatExactMoney(applied, currency)} label="Applied" status={applied > 0 ? "applied" : "neutral"} detail={applied > 0 ? "Tender allocated" : "No tender yet"}/>
          <Summary amount={formatExactMoney(Math.abs(remainingAmount), currency)} label={remainingAmount < -0.01 ? "Over by" : "Remaining"} status={remainingAmount < -0.01 ? "overpaid" : remainingAmount <= 0.01 ? "settled" : "pending"} detail={remainingAmount < -0.01 ? "Reduce applied amount" : remainingAmount <= 0.01 ? "Ready to complete" : "Payment incomplete"}/>
        </div>
        <div className="space-y-3">
          {lines.map((line, index) => <section key={line.id} className="space-y-3 rounded-xl border bg-card/50 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Tender {index + 1}</p><Button type="button" variant="ghost" size="icon" aria-label={`Remove tender ${index + 1}`} disabled={pending || lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 aria-hidden className="size-4"/></Button></div>
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <FormSelectField id={`${line.id}-method`} label="Payment method" value={line.method} onValueChange={(value) => { if (isPaymentMethod(value)) handleUpdateLine(line.id, { method: value }); }} options={PAYMENT_METHOD_OPTIONS} />
              <FormField id={`${line.id}-amount`} label="Applied amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={line.amount} onChange={(event) => handleUpdateLine(line.id, { amount: event.target.value, ...(line.method === "CASH" && line.tendered === line.amount ? { tendered: event.target.value } : {}) })}/>
              {line.method === "CASH" ? <FormField id={`${line.id}-tendered`} label="Cash tendered" type="number" inputMode="decimal" min={Number(line.amount) || 0} step="0.01" value={line.tendered} onChange={(event) => handleUpdateLine(line.id, { tendered: event.target.value })}/> : <FormField id={`${line.id}-reference`} label={requireReference ? "Reference" : "Reference (optional)"} value={line.reference} onChange={(event) => handleUpdateLine(line.id, { reference: event.target.value })} maxLength={120} placeholder="Transaction ID"/>}
            </div>
            {line.method === "CASH" ? <div className="grid gap-3 sm:grid-cols-2"><FormField id={`${line.id}-change`} label="Change due" readOnly value={formatExactMoney(Math.max(0, (Number(line.tendered) || 0) - (Number(line.amount) || 0)), currency)} /><p className="self-end pb-2 text-xs leading-relaxed text-muted-foreground">Change is calculated from the tendered cash and is not included in the amount applied to the order.</p></div> : null}
          </section>)}
        </div>
        <Button type="button" variant="outline" disabled={pending || lines.length >= MAX_PAYMENT_LINES || remainingAmount <= 0.01} onClick={handleAddLine}><Plus className="size-4" aria-hidden="true"/>Add tender</Button>
        {totalCashChange > 0 ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">Total change due <strong className="ml-2">{formatMoney(totalCashChange, currency)}</strong></p> : null}
        {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button type="button" disabled={pending || !canSubmit} onClick={handleSubmit}><CreditCard className="size-4" aria-hidden="true"/>{pending ? "Processing…" : "Complete payment"}</Button></DialogFooter>
      </div> : null}
    </DialogContent>
  </Dialog>;
}

function Summary({ label, amount, status, detail }: { label: string; amount: string; status: PaymentAmountStatus; detail: string }) {
  return <div role="status" className={`min-w-0 rounded-xl border p-4 ${PAYMENT_AMOUNT_STATUS_STYLES[status]}`}>
    <p className="text-xs font-medium opacity-80">{label}</p>
    <p className="mt-1 break-words text-lg font-semibold tabular-nums">{amount}</p>
    <p className="mt-1 text-xs font-medium opacity-80">{detail}</p>
  </div>;
}
