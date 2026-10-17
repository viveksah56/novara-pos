# 10 Suppliers and purchases

## Real-world example

Dipak orders 20 kg of coffee beans from Himalayan Roasters for Thamel at NPR 2,100 per kg, total 42,000. The first delivery brings 15 kg and the rest arrives three days later. Before the first delivery Thamel holds 8,200 g at an average cost of 2.20. Receiving all 20 kg (20,000 g at 2.10 per g) gives:

(8,200 x 2.20 + 20,000 x 2.10) / 28,200 = 60,040 / 28,200 = 2.1291 per g.

## Models

| Model | Fields |
|---|---|
| Supplier | id, tenantId, name, contactName, phone, email, address, taxRegistrationNumber, notes, isActive. Unique (tenantId, name) |
| Purchase | id, tenantId, branchId, supplierId, number, status (DRAFT, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED), orderedAt, expectedAt, receivedAt, subtotal, discountTotal, taxTotal, total, amountPaid, paymentStatus (UNPAID, PARTIAL, PAID), note, createdById |
| PurchaseItem | id, purchaseId, ingredientId, orderedQuantity, receivedQuantity, unit, unitFactor, unitCost, lineTotal |

`orderedQuantity` and `unitCost` are in the purchase unit (kg). `unitFactor` converts to the base unit (1000 g per kg).

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /suppliers | suppliers.manage | List |
| POST /suppliers | suppliers.manage | Create |
| PATCH /suppliers/:id | suppliers.manage | Update or deactivate |
| GET /purchases | purchases.manage | List with filters |
| POST /purchases | purchases.manage | Create DRAFT |
| PATCH /purchases/:id | purchases.manage | Edit DRAFT or ORDERED |
| POST /purchases/:id/order | purchases.manage | Mark ORDERED |
| POST /purchases/:id/receive | purchases.manage | Receive lines |
| POST /purchases/:id/payments | purchases.manage | Record supplier payment |
| POST /purchases/:id/cancel | purchases.manage | Cancel if nothing received |

## Backend logic

### Create

1. Supplier and ingredients must belong to the tenant, the branch to the user's scope.
2. Lines default `unit` and `unitFactor` from the ingredient's purchase settings, editable per line.
3. Totals: `lineTotal = orderedQuantity x unitCost`, `subtotal` is the sum, `total = subtotal - discount + tax`.
4. Number format `PO-TH-0007` from a per-branch counter.

### Receive

```ts
export async function receivePurchase(ctx: Ctx, id: string, lines: ReceiveLine[]) {
  return prisma.$transaction(async (tx) => {
    const purchase = await loadPurchaseForUpdate(tx, ctx, id);
    if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(purchase.status)) {
      throw new HttpError(409, "CONFLICT", "Purchase cannot be received");
    }
    for (const line of lines) {
      const item = purchase.items.find((i) => i.id === line.purchaseItemId);
      if (!item) throw new HttpError(404, "NOT_FOUND", "Line not found");
      const remaining = item.orderedQuantity.minus(item.receivedQuantity);
      if (new Prisma.Decimal(line.quantity).gt(remaining)) {
        throw new HttpError(422, "OVER_RECEIPT", "Received more than ordered");
      }
      const baseQty = new Prisma.Decimal(line.quantity).times(item.unitFactor);
      const baseCost = item.unitCost.div(item.unitFactor);
      await applyReceipt(tx, ctx, purchase.branchId, item.ingredientId, baseQty, baseCost, purchase.id);
      await tx.purchaseItem.update({
        where: { id: item.id },
        data: { receivedQuantity: { increment: line.quantity } },
      });
    }
    await refreshPurchaseStatus(tx, purchase.id);
    await audit(tx, ctx, "purchase.receive", "Purchase", purchase.id, { lines: lines.length });
    return loadPurchase(tx, ctx, purchase.id);
  });
}
```

`applyReceipt` ensures the IngredientStock row, computes the new weighted average `(oldQty x oldAvg + qty x cost) / (oldQty + qty)` rounded to 4 decimals, increases quantity, and writes a PURCHASE movement with the new balance. When old quantity is zero or negative, the new average is the receipt cost. Status becomes RECEIVED when every line is fully received, otherwise PARTIALLY_RECEIVED.

### Payments

`POST /purchases/:id/payments` adds to `amountPaid` (never above total) and recalculates `paymentStatus`. Each payment is audited with method and reference. A cash payment can link to a shift pay-out (see 08).

### Cancel

Allowed for DRAFT and ORDERED with zero received quantity. Otherwise the remainder is closed by marking the purchase RECEIVED with the received lines only.

### Supplier deactivation

A supplier with open purchases cannot be deactivated.

## Frontend logic

### Suppliers (`/inventory/suppliers`)

Table with search, add and edit sheet, tax number field, active toggle.

### Purchase builder (`/inventory/purchases/new`)

Supplier combobox, branch, expected date. Line repeater: ingredient combobox, quantity, unit (prefilled), unit cost. Totals update from integer minor units for preview. Save as draft or mark ordered.

### Receive dialog

Lists ordered, already received and remaining quantities. The user types received quantities per line with a Receive all shortcut. The dialog shows the expected new stock and new average cost from a preview endpoint. Submit refreshes stock, purchases and low-stock queries.

### Purchase list

Filters by status, supplier, branch, date. Badges for status and payment status. Overdue expected dates are highlighted.

## Tests

Weighted average matches 2.1291 for the worked example. Partial receipts update status correctly. Over-receipt is refused. Unit conversion from kg to g is applied. Supplier from another tenant is rejected. Cancelling after a receipt is refused.
