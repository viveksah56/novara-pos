# 09 Inventory and stock ledger

## Real-world example

Thamel holds 12,000 ml of oat milk. Two Large Oat Lattes use 500 ml, so stock becomes 11,500 ml and a SALE movement of -500 is recorded. Maya spills 1,000 ml of dairy milk and logs it as WASTE. At month end Dipak counts coffee beans: the system expected 8,450 g but he counts 8,200 g. The stocktake records a -250 g variance worth 250 x 2.20 = NPR 550.

## Models

| Model | Fields |
|---|---|
| IngredientStock | id, branchId, ingredientId, quantity, averageCost, updatedAt. Unique (branchId, ingredientId) |
| StockMovement | id, tenantId, branchId, ingredientId, type, quantityDelta, unitCost, balanceAfter, reason, referenceType, referenceId, createdById, createdAt |
| Stocktake | id, tenantId, branchId, status (DRAFT, SUBMITTED, APPROVED, CANCELLED), startedAt, submittedAt, approvedAt, createdById, approvedById, note |
| StocktakeLine | id, stocktakeId, ingredientId, countedQuantity, countedAt, expectedAtCount, variance, unitCost |

Movement types: OPENING, PURCHASE, SALE, REVERSAL, WASTE, ADJUSTMENT, STOCKTAKE, TRANSFER_IN, TRANSFER_OUT. Index (branchId, ingredientId, createdAt).

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /inventory/stock | inventory.read | Balances per ingredient for a branch |
| GET /inventory/low-stock | inventory.read | Items at or below reorder level |
| GET /inventory/movements | inventory.read | Ledger, cursor paginated |
| POST /inventory/adjustments | inventory.adjust | Opening, waste or adjustment |
| GET /inventory/valuation | reports.inventory.read | Stock value |
| POST /stocktakes | inventory.adjust | Start |
| PUT /stocktakes/:id/lines | inventory.adjust | Save counts |
| POST /stocktakes/:id/submit | inventory.adjust | Submit for approval |
| POST /stocktakes/:id/approve | inventory.adjust, OWNER or MANAGER only | Apply variances |
| POST /stocktakes/:id/cancel | inventory.adjust | Cancel |

## Backend logic

### Deduct on sale

Runs inside the completion transaction from 07.

```ts
export async function deductStockForOrder(tx: Tx, ctx: Ctx, orderId: string, branchId: string) {
  const needs = await consumptionForOrder(tx, ctx, orderId);
  const branch = await tx.branch.findFirstOrThrow({ where: { id: branchId, tenantId: ctx.tenantId } });
  const ids = [...needs.keys()].sort();

  for (const ingredientId of ids) {
    const quantity = needs.get(ingredientId)!;
    await tx.ingredientStock.upsert({
      where: { branchId_ingredientId: { branchId, ingredientId } },
      create: { branchId, ingredientId, quantity: 0, averageCost: 0 },
      update: {},
    });
    const updated = await tx.$executeRaw`
      UPDATE "IngredientStock"
      SET quantity = quantity - ${quantity}, "updatedAt" = now()
      WHERE "branchId" = ${branchId} AND "ingredientId" = ${ingredientId}
        AND (quantity >= ${quantity} OR ${branch.allowNegativeStock})
    `;
    if (updated === 0) throw new HttpError(409, "INSUFFICIENT_STOCK", "Not enough stock to complete this order");
    const row = await tx.ingredientStock.findUniqueOrThrow({
      where: { branchId_ingredientId: { branchId, ingredientId } },
    });
    await tx.stockMovement.create({
      data: {
        tenantId: ctx.tenantId, branchId, ingredientId, type: "SALE",
        quantityDelta: quantity.negated(), unitCost: row.averageCost, balanceAfter: row.quantity,
        referenceType: "Order", referenceId: orderId, createdById: ctx.userId,
      },
    });
  }
}
```

Notes: ingredient IDs are processed in sorted order so concurrent orders cannot deadlock. The conditional UPDATE is atomic, so two cashiers cannot both take the last stock. `allowNegativeStock` lets a cafe keep selling when counts are not trustworthy yet, which matches small cafes that are still setting up.

### Reverse on refund

With `restock` true, insert REVERSAL movements with positive deltas at the original unit cost. With `restock` false, insert WASTE movements with negative deltas and the refund reason, but only for ingredients not already deducted twice. The refund quantity ratio scales the consumption.

### Adjustments

Types OPENING, WASTE, ADJUSTMENT. Reason is required for WASTE and ADJUSTMENT. Quantity is signed for ADJUSTMENT and positive for OPENING and WASTE (stored negative for WASTE). A WASTE of 1,000 ml dairy milk writes delta -1000.

### Low stock

```sql
SELECT i.id, i.name, s.quantity, i."reorderLevel"
FROM "IngredientStock" s
JOIN "Ingredient" i ON i.id = s."ingredientId"
WHERE s."branchId" = $1 AND i."tenantId" = $2 AND i."isActive" AND s.quantity <= i."reorderLevel"
ORDER BY (s.quantity / NULLIF(i."reorderLevel", 0)) ASC
```

### Valuation

`sum(quantity x averageCost)` per branch and per ingredient. Average cost updates only on purchase receipts (see 10) using the weighted average.

### Stocktake

1. Start creates a DRAFT with a start time. Lines are added as counts are saved. Each saved line stores `countedAt`.
2. Submit locks the counts.
3. Approve, in one transaction: for each line compute `expectedAtCount = currentBalance - sum(movements after countedAt)`, `variance = counted - expectedAtCount`, then apply `variance` to the current balance, so sales made during the count are preserved. Write a STOCKTAKE movement for non-zero variances and set the status APPROVED.
4. Audit `stocktake.approve` with total variance value.

## Frontend logic

### Stock page (`/inventory/stock`)

Table: ingredient, unit, on hand, reorder level, average cost, value, status badge (OK, Low, Out). Filters: low only, search. Row action opens the adjustment dialog.

### Adjustment dialog

Type select (Waste, Adjustment, Opening), quantity with unit, reason select with free text, preview of new balance. Submit invalidates stock and movement queries.

### Movements (`/inventory/movements`)

Ledger table with type badges, signed quantity, balance after, user, reference link to the order or purchase. Infinite scroll through the cursor.

### Stocktake (`/inventory/stocktakes/[id]`)

Spreadsheet-style grid: ingredient, system quantity (hidden during blind count if enabled), counted input, live variance and value. Autosave on blur. Submit then manager approves from the same screen with a variance summary.

### Low-stock widget

Used on the Owner, Manager and Inventory dashboards, linking to the stock page filtered to low items.

## Edge cases

| Case | Handling |
|---|---|
| Last unit sold by two cashiers at once | Only one conditional UPDATE succeeds, the other gets INSUFFICIENT_STOCK |
| Product without recipe | No movements |
| Negative stock allowed | Balance can go below zero and is highlighted red |
| Sales during a stocktake | Handled by `expectedAtCount` |

## Tests

Sale writes movements and lowers balance. Insufficient stock rolls back the whole payment. Concurrent sales of the last unit allow only one. Waste lowers stock with reason. Stocktake variance adjusts balance and keeps later sales. Valuation equals the sum of quantity times cost.
