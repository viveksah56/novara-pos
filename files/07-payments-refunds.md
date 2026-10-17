# 07 Payments, receipts and refunds

## Real-world example

The tourists in 06 owe 1,197.80 and hand over NPR 1,200 in cash. Anil taps Cash, Exact is replaced by 1,200, the screen shows change 2.20, and Complete is pressed.

Ten minutes later one of the tourists returns and says the latte is cold. Ramesh refunds one Large Oat Latte: 420.00 plus 13 percent tax 54.60 equals 474.60. The order becomes PARTIALLY_REFUNDED, the ingredients are not restocked because the drink was already made, and the cash refund reduces Anil's expected drawer cash by 474.60.

## Models

| Model | Fields |
|---|---|
| Payment | id, tenantId, orderId, branchId, shiftId, method (CASH, CARD, BANK_TRANSFER, DIGITAL_WALLET), status (COMPLETED, REFUNDED), amount, tendered, changeGiven, reference, createdById, createdAt |
| Refund | id, tenantId, orderId, branchId, shiftId, businessDate, amount, taxAmount, reason, restock, method, createdById, approvedById, createdAt |
| RefundItem | id, refundId, orderItemId, quantity, amount |

Order total equals the sum of completed payment amounts when the order is completed. `amount` is what applies to the bill. For cash, `tendered` is what the customer handed over and `changeGiven` is `tendered - amount`.

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| POST /orders/:id/payments | orders.pay | Record one or more payments, completes the order when paid in full |
| POST /orders/:id/refunds | orders.refund | Full or partial refund |
| GET /orders/:id/receipt | receipts.print | Receipt payload |
| POST /orders/:id/receipt/reprint | receipts.print | Logs a reprint |

## Backend logic

### Pay and complete

```ts
export async function payOrder(ctx: Ctx, orderId: string, input: PayInput) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; status: string; total: Prisma.Decimal; branchId: string }[]>`
      SELECT id, status, total, "branchId" FROM "Order"
      WHERE id = ${orderId} AND "tenantId" = ${ctx.tenantId}
      FOR UPDATE
    `;
    const order = rows[0];
    if (!order || !canSeeBranch(ctx, order.branchId)) throw new HttpError(404, "NOT_FOUND", "Order not found");
    if (order.status !== "OPEN") throw new HttpError(409, "CONFLICT", "Order is not open");

    const paid = input.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
    if (paid.lt(order.total)) throw new HttpError(409, "UNDERPAID", "Payment is less than the total");

    const shift = await currentShift(tx, ctx, order.branchId);
    for (const p of input.payments) {
      await tx.payment.create({ data: paymentRow(ctx, order, shift, p) });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt: new Date(), completedById: ctx.userId, shiftId: shift?.id ?? null },
    });

    await deductStockForOrder(tx, ctx, order.id, order.branchId);
    await audit(tx, ctx, "order.complete", "Order", order.id, { total: order.total.toFixed(2) });
    return loadOrder(tx, ctx, order.id);
  });
}
```

Rules:

1. The order row is locked with `FOR UPDATE` so two requests cannot complete it twice.
2. Cash overpayment is allowed. Non-cash payments cannot exceed the remaining due.
3. Split payments are summed. Example: 700 cash and 497.80 wallet reference `ESEWA-123`.
4. `tendered` and `changeGiven` apply to cash only.
5. Non-cash methods require a `reference` when the branch setting `requirePaymentReference` is on.
6. The client never sends status. The server sets COMPLETED.
7. Stock deduction is covered in 09 and runs inside this transaction. If deduction fails with INSUFFICIENT_STOCK the whole transaction rolls back and the order stays OPEN.
8. A zero-total order (fully discounted) completes with no payments.

### Refund

1. Load the order with lock, status must be COMPLETED or PARTIALLY_REFUNDED.
2. Input: item lines with quantities (or full), reason (required), `restock` boolean, `method`.
3. Refundable quantity per line is `quantity - refundedSoFar`.
4. Amount per line is `lineUnitNet x refundQty` where lineUnitNet is the line's price after its share of the order discount. Tax is computed proportionally. Sum equals `Refund.amount`.
5. `amount` cannot exceed `paidTotal - refundedTotal`.
6. Cashiers have no permission. Managers and owners approve; `approvedById` equals the caller.
7. Create Refund and RefundItems. If all quantities are refunded, order status becomes REFUNDED, otherwise PARTIALLY_REFUNDED.
8. If `restock` is true, create REVERSAL movements for the refunded quantity (see 09). If false, create WASTE movements with the reason so reports show the loss.
9. Cash refunds reduce the current shift's expected cash. Non-cash refunds do not.
10. Audit `order.refund` with amount, reason and approver.

Example refund payload:

```ts
{
  reason: "Customer said coffee was cold",
  restock: false,
  method: "CASH",
  items: [{ orderItemId: "oi_1", quantity: 1 }]
}
```

### Receipt

The receipt payload is built from stored snapshots, not live menu data: business name, branch address, tax registration number, order number, date in branch timezone, cashier name, lines with modifiers, subtotal, discount, service charge, tax, total, payments, change, footer text. Reprints add the word DUPLICATE and write an audit entry.

## Frontend logic

### Payment dialog

Shows total due. Method tabs: Cash, Card, Wallet, Bank transfer. Cash tab has a numpad, quick buttons (Exact, 500, 1000, 2000) and live change. Split mode adds rows until remaining is zero. The Complete button enables only when the preview remaining is zero or negative for cash. Reference input appears for non-cash methods.

### After payment

A success view shows order number and change, then the receipt dialog. Print uses `window.print()` with an 80 mm stylesheet (`@page { size: 80mm auto; margin: 0 }`). ESC/POS direct printing is a later enhancement. Buttons: Print, New order.

### Refund dialog

Opened from the order drawer by users with `orders.refund`. Lists lines with a quantity stepper capped at refundable quantity, a reason select (Cold or wrong item, Customer changed mind, Staff error, Other with text), a restock toggle explaining its effect, and a summary of refund amount and tax from the API's preview endpoint. Confirm requires a reason.

### States

Pending shows a spinner and disables the buttons. Failure keeps the cart and shows the error. 409 UNDERPAID highlights the remaining amount.

## Edge cases

| Case | Handling |
|---|---|
| Network drops mid-payment | Same idempotency key on retry returns the stored result |
| Refund greater than paid | 422 with the maximum refundable amount |
| Order refunded twice for the same line | Refundable quantity check blocks it |
| Cash payment but no open shift | 409 NO_OPEN_SHIFT when the branch requires shifts |

## Tests

Underpayment is rejected. Two parallel payments complete the order once. Split payments sum correctly. Change is computed for cash only. Refund of one latte equals 474.60 in the worked example. Partial then full refund moves status correctly. Restock false creates WASTE movements. Rollback leaves the order OPEN when stock is insufficient.
