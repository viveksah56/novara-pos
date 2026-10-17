# 06 Orders and POS

## Real-world example

At 9:40 on Saturday Anil sells to two tourists: 2 Large Oat Lattes (420 each) and 1 Chicken Momo (220), takeaway, no discount.

Line totals: 2 x 420 = 840 and 1 x 220 = 220. Subtotal 1,060.00. Tax 13 percent exclusive is 137.80. Total 1,197.80. They pay NPR 1,200 in cash. The system completes the order, deducts stock, prints the receipt, and shows change NPR 2.20.

## Models

| Model | Fields |
|---|---|
| Order | id, tenantId, branchId, orderNumber, businessDate, type (DINE_IN, TAKEAWAY), status, tableId, shiftId, customerName, customerPhone, note, subtotal, discountType, discountValue, discountTotal, serviceChargeTotal, taxTotal, total, createdById, completedById, clientOrderId, createdAt, completedAt, cancelledAt, cancelReason |
| OrderItem | id, orderId, productId, productName, unitPrice, quantity, modifierTotal, lineTotal, unitCost, kitchenStatus, note |
| OrderItemModifier | id, orderItemId, optionId, groupName, optionName, priceDelta |
| OrderCounter | branchId, businessDate, lastNumber. Primary key (branchId, businessDate) |
| IdempotencyKey | id, tenantId, key, requestHash, responseStatus, responseBody, createdAt. Unique (tenantId, key) |

Order statuses: OPEN, COMPLETED, CANCELLED, PARTIALLY_REFUNDED, REFUNDED.

```
OPEN -> COMPLETED -> PARTIALLY_REFUNDED -> REFUNDED
OPEN -> CANCELLED
COMPLETED -> REFUNDED
```

Indexes: (tenantId, businessDate), (branchId, status, createdAt), unique (branchId, orderNumber), unique (tenantId, clientOrderId).

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| POST /orders | orders.create | Create an order, optionally with payments to complete it in one request |
| GET /orders | orders.read | Search and list, cursor paginated |
| GET /orders/:id | orders.read | Details |
| PATCH /orders/:id | orders.update | Add, change or remove items on an OPEN order, set table or note |
| POST /orders/:id/discount | discounts.apply | Apply or change discount |
| POST /orders/:id/cancel | orders.cancel | Cancel an OPEN order |
| POST /orders/:id/payments | orders.pay | See 07 |
| GET /orders/:id/receipt | receipts.print | Receipt data |

## Backend logic

### Create order

Request body:

```ts
export const createOrderSchema = z.object({
  branchId: z.string().min(1),
  type: z.enum(["DINE_IN", "TAKEAWAY"]),
  tableId: z.string().optional(),
  note: z.string().max(300).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().max(100),
    optionIds: z.array(z.string()).max(20).default([]),
    note: z.string().max(200).optional(),
  })).min(1).max(100),
  discount: z.object({ type: z.enum(["PERCENT", "FIXED"]), value: z.string() }).optional(),
  payments: z.array(paymentInput).optional(),
});
```

Steps:

1. Idempotency: with `Idempotency-Key` present, look up the key. A matching body hash replays the stored response, a different hash returns 422.
2. Branch access via `requireBranch`. Reject inactive branches.
3. If `requireShift` is on, find the caller's open shift in the branch. Otherwise 409 NO_OPEN_SHIFT.
4. Load products with tenantId, their modifier groups and options, recipes and option effects in as few queries as possible.
5. For each line, validate group min and max, option membership and active flags. Reject unavailable products.
6. Calculate line price: `(unitPrice + sum(option deltas)) x quantity`.
7. Calculate totals (below).
8. Compute `unitCost` per line from consumption and branch average costs.
9. Compute `businessDate` from the branch settings.
10. Take the next order number in the transaction.
11. Insert Order, OrderItems and OrderItemModifiers.
12. If payments are supplied, run the completion routine from 07 in the same transaction.
13. Store the idempotency record and return the order with server totals.

### Totals

```ts
export function calculateTotals(
  lines: Prisma.Decimal[],
  discount: { type: "PERCENT" | "FIXED"; value: Prisma.Decimal } | null,
  branch: { taxRate: Prisma.Decimal; taxInclusive: boolean; serviceChargeRate: Prisma.Decimal },
) {
  const subtotal = lines.reduce((s, l) => s.plus(l), new Prisma.Decimal(0));
  let discountTotal = new Prisma.Decimal(0);
  if (discount) {
    discountTotal = discount.type === "PERCENT"
      ? subtotal.times(discount.value).div(100)
      : discount.value;
    if (discountTotal.gt(subtotal)) discountTotal = subtotal;
  }
  const base = subtotal.minus(discountTotal);
  const service = base.times(branch.serviceChargeRate).div(100);
  const taxable = base.plus(service);
  let tax: Prisma.Decimal;
  let total: Prisma.Decimal;
  if (branch.taxInclusive) {
    total = taxable;
    tax = taxable.minus(taxable.div(new Prisma.Decimal(1).plus(branch.taxRate.div(100))));
  } else {
    tax = taxable.times(branch.taxRate).div(100);
    total = taxable.plus(tax);
  }
  return {
    subtotal: money(subtotal),
    discountTotal: money(discountTotal),
    serviceChargeTotal: money(service),
    taxTotal: money(tax),
    total: money(total),
  };
}
```

Worked values: lines 840.00 and 220.00, no discount, no service charge. subtotal 1060.00, tax 137.80, total 1197.80.

### Discount rules

1. Requires `discounts.apply`.
2. A PERCENT discount above the branch's `cashierMaxDiscountPercent` is allowed only for MANAGER and OWNER. A cashier gets 403 DISCOUNT_LIMIT.
3. A FIXED discount is converted to a percent of subtotal for the same check.
4. Discount cannot exceed subtotal. Every change is audited.

### Edit an OPEN order

Allowed only while status is OPEN. Replacing the item list recalculates totals and re-snapshots prices from current products. Items already sent to the kitchen cannot be removed by a waiter. A manager removal writes audit `order.item.void` with a reason.

### Cancel

1. OPEN only. 2. Reason required (min 3 characters). 3. Sets status CANCELLED, `cancelledAt`, `cancelReason`. 4. No stock was deducted, so no reversal. 5. Audit `order.cancel`.

### Order number

```sql
INSERT INTO "OrderCounter" ("branchId", "businessDate", "lastNumber")
VALUES ($1, $2, 1)
ON CONFLICT ("branchId", "businessDate")
DO UPDATE SET "lastNumber" = "OrderCounter"."lastNumber" + 1
RETURNING "lastNumber"
```

The result is formatted as `TH-20261017-0042` (branch code, business date, zero-padded counter).

### Search

Filters: status, type, businessDate range, branchId, createdById, text on order number or customer. Cashiers see only their own orders. Cursor on (createdAt, id).

## Frontend logic

### POS layout (`/pos`)

Full-screen route without sidebar. Left: category tabs and product grid with large touch targets. Right: cart panel with lines, totals preview and Pay button. Top bar: branch name, shift status, sync status, user menu.

### Cart store

```ts
type CartLine = {
  key: string;
  productId: string;
  name: string;
  unitPrice: string;
  options: { id: string; name: string; priceDelta: string }[];
  quantity: number;
  note?: string;
};

type CartState = {
  lines: CartLine[];
  type: "DINE_IN" | "TAKEAWAY";
  tableId?: string;
  discount?: { type: "PERCENT" | "FIXED"; value: string };
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};
```

Lines with the same product and option set merge by incrementing quantity. Preview math uses integer minor units (paisa) and the branch tax settings. The server response replaces the preview after submit.

### Interaction

| Action | Behaviour |
|---|---|
| Tap product | Adds one, or opens the modifier dialog if the product has groups |
| Long press line | Opens note and quantity editor |
| Search box (focus with `/`) | Debounced 200 ms filter on name and SKU |
| F2 | Open payment dialog |
| F4 | Hold order (save as OPEN for table service) |
| Esc | Close dialog |
| Delete | Remove selected line |
| Ctrl+Enter | Pay exact cash and finish |

### Submit

1. Generate `clientOrderId` UUID and use it as `Idempotency-Key`.
2. Build the payload from the cart. Prices are never sent.
3. Online: POST /orders with the chosen payments. Success clears the cart, opens the receipt dialog and triggers print.
4. Offline: write to the Dexie queue and show a local receipt marked Pending (see 15).
5. 409 for an unavailable product removes the line and shows a toast.

### Order history (`/orders`)

Table with filters, status badges, cursor "Load more", detail drawer with items, payments, refunds, timeline from audit. Refund and cancel buttons appear only with permission and in valid states.

## Edge cases

| Case | Handling |
|---|---|
| Double tap on Pay | Button disabled, idempotency key makes the retry safe |
| Menu changed while cart open | Server reprices, response shows differences, POS highlights changed lines |
| Table already has an OPEN order | Reuse it instead of creating another |
| Shift closed during the sale | 409 NO_OPEN_SHIFT, prompt to open a shift |

## Tests

Totals for the worked example equal 1197.80. Inclusive tax gives the same total with tax extracted. Cashier discount above 10 percent is refused. Client-sent prices are ignored. Same idempotency key returns the same order. Two concurrent orders get different numbers. Cashier cannot read another cashier's orders.
