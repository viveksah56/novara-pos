# 11 Expenses

## Real-world example

Sita records Thamel's costs for October: rent NPR 85,000, salaries 310,000, electricity 7,200 and other costs 40,000. Anil's NPR 800 milk pay-out from the drawer is also recorded as an expense in the Supplies category, linked to his shift.

Monthly view: net sales 1,420,000, cost of goods 468,600, gross profit 951,400, expenses 442,200, operating profit before income tax 509,200.

## Models

| Model | Fields |
|---|---|
| ExpenseCategory | id, tenantId, name, isActive. Unique (tenantId, name) |
| Expense | id, tenantId, branchId, categoryId, amount, expenseDate, description, paymentMethod, reference, attachmentUrl, shiftId, cashMovementId, createdById, voidedAt, voidedById, voidReason, createdAt |

New permissions: `expenses.read` and `expenses.manage`, granted to OWNER and MANAGER (see 03).

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /expense-categories | expenses.read | List |
| POST /expense-categories | expenses.manage | Create |
| GET /expenses | expenses.read | List with filters |
| POST /expenses | expenses.manage | Record |
| POST /expenses/:id/void | expenses.manage | Void with reason |
| GET /reports/expenses | expenses.read | Totals by category and month |

## Backend logic

### Create

1. Validate amount greater than zero, date not in the future beyond one day, category in the tenant, branch in scope.
2. For payment method CASH with an open shift, optionally create a PAY_OUT CashMovement and link it in `cashMovementId`.
3. Attachment URL comes from a signed upload endpoint, only HTTPS URLs on the storage host are accepted.
4. Audit `expense.create`.

### Void

Expenses are never deleted. Voiding sets `voidedAt`, `voidedById` and a required reason, excluded from reports. If linked to a cash movement, the movement is reversed by a PAY_IN with the same amount and a reference to the void.

### Report

```sql
SELECT c.name, date_trunc('month', e."expenseDate") AS month, SUM(e.amount) AS total
FROM "Expense" e
JOIN "ExpenseCategory" c ON c.id = e."categoryId"
WHERE e."tenantId" = $1 AND e."voidedAt" IS NULL
  AND e."expenseDate" BETWEEN $2 AND $3
  AND e."branchId" = ANY($4)
GROUP BY c.name, month
ORDER BY month, total DESC
```

Operating profit equals gross profit minus expenses. The label always says "before income tax" and never "net profit".

## Frontend logic

### Expenses page (`/expenses`)

Month picker, branch filter, table with category, date, amount, method, creator, void badge. Add dialog: branch, category combobox with create-on-the-fly, date, amount, description, method, optional attachment upload. A summary strip shows total and top categories, and a bar chart (dynamic import) shows the monthly trend.

### Void

Row action opens a dialog with a required reason.

## Tests

Voided expenses are excluded from totals. Cash expense links to the shift pay-out. Cashier cannot create expenses. Operating profit equals gross profit minus expenses for the worked month.
