# 12 Reports and dashboards

## Real-world example

On Saturday Thamel closes with 120 completed orders.

| Measure | Value |
|---|---|
| Gross sales (before discounts, excluding tax) | 54,000.00 |
| Discounts | 1,800.00 |
| Refunds (excluding tax) | 560.00 |
| Net sales | 51,640.00 |
| Tax collected on net sales | 6,713.20 |
| Cost of goods sold | 17,000.00 |
| Gross profit | 34,640.00 |
| Food cost percent | 32.9 |
| Average order value | 430.33 |

Sita sees all of this on her Owner dashboard. Ramesh sees the same sales numbers but no profit or cost cards. Anil sees only his own shift.

## Definitions

| Term | Definition |
|---|---|
| Gross sales | Sum of order subtotals for completed orders in the period |
| Discounts | Sum of order discount totals |
| Refunds | Sum of refund amounts excluding tax, by the refund's business date |
| Net sales | Gross sales - discounts - refunds |
| Tax collected | Sum of tax on completed orders minus tax on refunds |
| COGS | Sum of `OrderItem.unitCost x quantity` for completed lines minus the cost of restocked refunds |
| Gross profit | Net sales - COGS |
| Food cost percent | COGS / net sales x 100 |
| Average order value | Net sales / completed order count |
| Operating profit | Gross profit - expenses, always shown as before income tax |

Orders with status COMPLETED, PARTIALLY_REFUNDED and REFUNDED count as sales. OPEN and CANCELLED never count. Day boundaries use `businessDate`.

## Report endpoints

All accept `from`, `to` (business dates, max 366 days), `branchId` (or `all` for owners) and are scoped by `branchScopeWhere`.

| Endpoint | Permission | Content |
|---|---|---|
| GET /reports/sales | reports.sales.read | Daily series with orders, gross, discounts, refunds, net, tax |
| GET /reports/sales/hourly | reports.sales.read | Orders and net by local hour |
| GET /reports/payments | reports.sales.read | Totals by method |
| GET /reports/products | reports.sales.read | Quantity and net by product, top N |
| GET /reports/categories | reports.sales.read | Net by category |
| GET /reports/discounts | reports.sales.read | Discounts by cashier and order |
| GET /reports/refunds | reports.sales.read | Refunds with reasons and approvers |
| GET /reports/cashiers | reports.sales.read | Orders, net, voids by cashier |
| GET /reports/inventory | reports.inventory.read | Stock, valuation, low stock, waste value |
| GET /reports/profit | reports.profit.read | COGS, gross profit, food cost, per product margin |
| GET /reports/expenses | expenses.read | See 11 |
| GET /reports/export?type= | same as the source report | CSV stream |

## Backend logic

### Daily sales query

```sql
SELECT o."businessDate" AS day,
       COUNT(*) AS orders,
       SUM(o.subtotal) AS gross_sales,
       SUM(o."discountTotal") AS discounts,
       SUM(o."taxTotal") AS tax
FROM "Order" o
WHERE o."tenantId" = $1
  AND o."branchId" = ANY($2)
  AND o.status IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
  AND o."businessDate" BETWEEN $3 AND $4
GROUP BY o."businessDate"
ORDER BY o."businessDate"
```

Refunds come from a second query grouped by `Refund.businessDate`. The service merges both series by day and computes net sales.

### Hourly query

```sql
SELECT EXTRACT(HOUR FROM o."completedAt" AT TIME ZONE b.timezone) AS hour,
       COUNT(*) AS orders,
       SUM(o.subtotal - o."discountTotal") AS net
FROM "Order" o
JOIN "Branch" b ON b.id = o."branchId"
WHERE o."tenantId" = $1 AND o."branchId" = ANY($2)
  AND o.status IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
  AND o."businessDate" BETWEEN $3 AND $4
GROUP BY 1
ORDER BY 1
```

### Top products query

```sql
SELECT oi."productId", oi."productName",
       SUM(oi.quantity) AS qty,
       SUM(oi."lineTotal") AS revenue,
       SUM(oi."unitCost" * oi.quantity) AS cost
FROM "OrderItem" oi
JOIN "Order" o ON o.id = oi."orderId"
WHERE o."tenantId" = $1 AND o."branchId" = ANY($2)
  AND o.status IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
  AND o."businessDate" BETWEEN $3 AND $4
GROUP BY oi."productId", oi."productName"
ORDER BY revenue DESC
LIMIT $5
```

### Rules

1. Aggregation always happens in SQL, never by loading rows into Node.
2. Money fields are returned as strings with two decimals.
3. Profit fields are omitted from responses when the caller lacks `reports.profit.read`.
4. The date range is validated for order and span. The branch must be in the caller's scope.
5. Result sizes are capped. Top lists use `limit` up to 100.
6. For large tenants a nightly rollup table `DailySalesSummary` (tenantId, branchId, businessDate, measures) can serve ranges older than today. Today's numbers always come from live data.
7. CSV export streams rows with `Content-Disposition: attachment` and applies the same permissions and scope.

## Role dashboards

Each dashboard has its own endpoint, so a response contains only fields that role may see.

| Endpoint | Permission | Widgets |
|---|---|---|
| GET /dashboard/owner | reports.sales.read, profit fields need reports.profit.read | Sales today and last 7 days, net sales, refunds, best sellers, payment mix, low stock, profit and food cost, branch comparison, open shift variances |
| GET /dashboard/manager | reports.sales.read, inventory.read | Today's sales, open orders, pending refunds, low stock, shift status, hourly chart |
| GET /dashboard/cashier | orders.read | Own shift expected cash, own orders and sales today, sync status |
| GET /dashboard/waiter | orders.read | Own open tables, items ready to serve |
| GET /dashboard/kitchen | kitchen.orders.read | Queue by age |
| GET /dashboard/inventory | inventory.read | Low stock, recent movements, open purchases, waste this week |
| GET /admin/overview | platform SUPER_ADMIN | See 13 |

Landing routes come from `/auth/me.homeRoute`.

## Frontend logic

### Report pages (`/reports/*`)

Shared filter bar: date presets (Today, Yesterday, Last 7 days, Last 30 days, This month, Custom), branch select, Compare to previous period toggle. Filters live in the URL search params so links are shareable and the back button works. Query keys include tenant, report name and filters.

Components: `StatCard`, `SalesChart` (Recharts, dynamically imported), `DataTable` (TanStack Table with sorting and column visibility), `ExportButton` (calls the export endpoint and downloads the file).

### Dashboard components

| Component | Source |
|---|---|
| StatCard | Totals with change versus the previous period |
| SalesChart | Daily or hourly series |
| BestSellersTable | Top products |
| PaymentBreakdown | Donut chart by method |
| LowStockList | Items under reorder level with link to stock page |
| ProfitCard | Rendered only with `<Can permission="reports.profit.read">` |
| BranchComparison | Owners with several branches |
| ShiftStatusCard | Cashier and manager |

### Refresh behaviour

Owner and manager dashboards use `staleTime` 30 seconds with refetch on window focus. Kitchen and waiter dashboards poll every 5 to 10 seconds only while the tab is visible.

### States

Skeletons for cards and charts, empty states with guidance ("No sales for this period"), error state with retry. Numbers are formatted with `Intl.NumberFormat`, dates in the branch timezone.

## Tests

Net sales for the worked example equals 51,640.00. Cancelled and open orders are excluded. Hourly buckets respect the branch timezone. Manager response omits profit fields. Manager of Thamel cannot request Patan. A refund on the next day lowers that day's net, not the sale day. Export respects the same filters as the screen.
