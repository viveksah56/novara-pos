"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PosOrderRecord } from "@/features/pos/api/posApi";
import { formatDateTime } from "@/lib/formatDateTime";
import { formatMoney } from "@/lib/formatMoney";

export function OrderDetailsDialog({
  order,
  currency,
  onOpenChange,
}: {
  order: PosOrderRecord | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      {order ? <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2"><DialogTitle>Order #{order.id.slice(-6).toUpperCase()}</DialogTitle><Badge variant={order.status === "OPEN" ? "secondary" : "outline"}>{order.status.replaceAll("_", " ")}</Badge></div>
          <DialogDescription>{order.table ? `Table ${order.table.name}${order.table.section ? ` · ${order.table.section}` : ""}` : "Counter order"} · {order.branch.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          <Detail label="Placed" value={formatDateTime(order.createdAt, "en", { dateStyle: "medium", timeStyle: "short" })} />
          <Detail label="Staff" value={`${order.createdBy.name}${order.createdBy.role ? ` · ${order.createdBy.role.replaceAll("_", " ")}` : ""}`} />
          {order.completedAt ? <Detail label="Completed" value={formatDateTime(order.completedAt, "en", { dateStyle: "medium", timeStyle: "short" })} /> : null}
          {order.billRequestedAt ? <Detail label="Bill requested" value={formatDateTime(order.billRequestedAt, "en", { dateStyle: "medium", timeStyle: "short" })} /> : null}
        </div>
        <section aria-labelledby="order-detail-items" className="space-y-3">
          <h3 id="order-detail-items" className="text-sm font-semibold">Items</h3>
          <div className="divide-y rounded-xl border">
            {order.items.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-3.5 text-sm">
              <div className="min-w-0"><p className="font-medium">{item.quantity} × {item.product.name}</p>{item.modifiers?.length ? <p className="mt-1 text-xs text-muted-foreground">{item.modifiers.map((modifier) => `${modifier.groupName}: ${modifier.optionName}`).join(" · ")}</p> : null}{item.note ? <p className="mt-1 text-xs text-muted-foreground">Note: {item.note}</p> : null}{item.kitchenStatus ? <p className="mt-1 text-xs text-muted-foreground">Kitchen · {item.kitchenStatus.toLowerCase()}</p> : null}</div>
              <span className="shrink-0 tabular-nums">{formatMoney(Number(item.lineTotal), currency)}</span>
            </div>)}
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-base"><span className="font-medium">Total</span><strong className="tabular-nums">{formatMoney(Number(order.totalAmount), currency)}</strong></div>
        </section>
        {order.payments?.length ? <section aria-labelledby="order-detail-payments" className="space-y-3">
          <h3 id="order-detail-payments" className="text-sm font-semibold">Payments</h3>
          <div className="divide-y rounded-xl border">{order.payments.map((payment, index) => <div key={`${payment.createdAt}-${payment.createdById}-${index}`} className="flex items-center justify-between gap-3 p-3 text-sm"><span>{payment.method.replaceAll("_", " ")} · {formatDateTime(payment.createdAt, "en", { dateStyle: "medium", timeStyle: "short" })}</span><span className="font-medium tabular-nums">{formatMoney(Number(payment.amount), currency)}</span></div>)}</div>
        </section> : null}
      </DialogContent> : null}
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}
