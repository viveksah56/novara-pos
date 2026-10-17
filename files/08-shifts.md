# 08 Shifts and cash control

## Real-world example

Anil starts at 8:00 and opens a shift with NPR 5,000 in the drawer. By closing time cash sales total 18,400. One cash refund of 474.60 was paid. At noon a supplier delivered milk and Anil paid NPR 800 from the drawer as a pay-out.

Expected cash = 5,000 + 18,400 - 474.60 - 800 = 22,125.40. Anil counts 21,925.40. Variance is -200.00. The shift closes and Ramesh reviews the variance the next morning.

## Models

| Model | Fields |
|---|---|
| Shift | id, tenantId, branchId, businessDate, openedById, closedById, reviewedById, status (OPEN, CLOSED, REVIEWED), openedAt, closedAt, reviewedAt, openingCash, expectedCash, countedCash, variance, closingNote, reviewNote |
| CashMovement | id, shiftId, branchId, type (PAY_IN, PAY_OUT), amount, reason, expenseId, createdById, createdAt |

Constraint: at most one OPEN shift per user per branch (partial unique index on (branchId, openedById) where status is OPEN).

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| POST /shifts/open | orders.pay | Open with opening cash |
| GET /shifts/current | orders.pay | Current shift with live totals (X report) |
| POST /shifts/:id/cash-movements | orders.pay | Pay-in or pay-out |
| POST /shifts/:id/close | orders.pay | Close with counted cash |
| GET /shifts | orders.read | History, cashiers see their own |
| GET /shifts/:id | orders.read | Z report |
| POST /shifts/:id/review | shifts.review | Mark reviewed with note |

## Backend logic

### Open

1. Branch must be active and in scope.
2. Reject if the user already has an OPEN shift in that branch.
3. Validate opening cash as a non-negative decimal.
4. Set `businessDate` from the branch settings.
5. Audit `shift.open`.

### Live totals

```ts
export function expectedCash(s: {
  openingCash: Prisma.Decimal;
  cashSales: Prisma.Decimal;
  cashRefunds: Prisma.Decimal;
  payIns: Prisma.Decimal;
  payOuts: Prisma.Decimal;
}) {
  return s.openingCash.plus(s.cashSales).minus(s.cashRefunds).plus(s.payIns).minus(s.payOuts);
}
```

`cashSales` is the sum of `Payment.amount` where method is CASH and shiftId matches. `cashRefunds` is the sum of cash `Refund.amount` for the shift. Change given is already excluded because `amount` is the applied amount, not tendered.

### Cash movement

Pay-out requires a reason. If the reason is a purchase, the UI can create a linked Expense (see 11). Amounts must be positive. Audit `shift.cash_movement`.

### Close

1. Only the opener or a manager can close.
2. Reject if the shift's branch still has OPEN orders created in this shift. They must be completed or cancelled.
3. Take `countedCash` from the request.
4. Compute `expectedCash` inside a transaction and `variance = countedCash - expectedCash`.
5. Set status CLOSED and `closedAt`.
6. Return the Z report.

### Review

A manager marks the shift REVIEWED with a note. Variances beyond the branch tolerance (setting `shiftVarianceTolerance`, default 50) are flagged on the dashboard until reviewed.

### Z report content

Opening cash, sales by payment method, cash refunds, pay-ins, pay-outs, expected cash, counted cash, variance, order count, discount total, voids, item count.

### Business day rule

A shift that opens at 20:00 and closes at 01:00 keeps the businessDate of the opening time, so the late-night sales belong to the same business day.

## Frontend logic

### Open shift

When the POS loads and `requireShift` is on without an OPEN shift, a blocking dialog asks for opening cash with a numpad. Other POS actions are disabled until it succeeds.

### Shift panel (`/shifts` and POS menu)

Live X report: sales, expected cash, movements. Buttons: Pay in, Pay out, Close shift.

### Close dialog

Denomination counter (1000, 500, 100, 50, 20, 10, 5, 2, 1) sums into the counted amount, with an option to type the total directly. A summary shows expected, counted and variance before confirming. Large variance asks for a note. Closing prints the Z report.

### Manager view

Table of shifts with variance badges (green within tolerance, amber, red). Review drawer with the Z report and a note field.

### States

Closing with open orders lists them with a link to each order.

## Tests

Expected cash formula matches the worked example. Change given does not inflate expected cash. Second open shift for the same user is refused. Close with open orders is refused. Cashier cannot read another cashier's shift. Shift opened before midnight keeps its business date.
