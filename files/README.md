# Novara

Novara is a multi-tenant SaaS platform for cafes and restaurants. It combines point of sale, inventory, purchasing, reporting, staff access control and subscription billing. This folder documents the backend and frontend logic of every module, each with a worked real-world example.

## Files

| File | Module | Models |
|---|---|---|
| 00-architecture.md | Shared rules for backend and frontend | none |
| 01-auth.md | Authentication and sessions | User, RefreshToken, PasswordResetToken |
| 02-tenants-branches.md | Business and locations | Tenant, Branch |
| 03-team-roles-rbac.md | Staff, roles, permissions | Membership, MembershipBranch, Invitation |
| 04-menu.md | Menu and modifiers | Category, Product, ModifierGroup, ModifierOption, ProductModifierGroup |
| 05-ingredients-recipes.md | Ingredients and recipes | Ingredient, RecipeItem, ModifierOptionRecipeItem |
| 06-orders-pos.md | POS and orders | Order, OrderItem, OrderItemModifier, OrderCounter, IdempotencyKey |
| 07-payments-refunds.md | Payments, receipts, refunds | Payment, Refund, RefundItem |
| 08-shifts.md | Cash shifts | Shift, CashMovement |
| 09-inventory-stock.md | Stock ledger and stocktake | IngredientStock, StockMovement, Stocktake, StocktakeLine |
| 10-suppliers-purchases.md | Purchasing | Supplier, Purchase, PurchaseItem |
| 11-expenses.md | Expenses | ExpenseCategory, Expense |
| 12-reports-dashboards.md | Reports and role dashboards | read models |
| 13-subscriptions-admin.md | Plans, billing, platform admin | Plan, Subscription, SubscriptionInvoice |
| 14-audit.md | Audit log | AuditLog |
| 15-offline-sync.md | Offline POS | Dexie tables |
| 16-tables-kitchen.md | Tables and kitchen queue | DiningTable, kitchen fields on OrderItem |
| 17-testing-deployment.md | Testing, release, operations | none |

## Worked example used in every file

Himalayan Brew is a cafe group in Kathmandu using Novara. Currency is NPR and timezone is Asia/Kathmandu.

| Person | Role | Branch |
|---|---|---|
| Sita Sharma | OWNER | All |
| Ramesh Thapa | MANAGER | Thamel |
| Anil Gurung | CASHIER | Thamel |
| Maya Rai | WAITER | Thamel |
| Bikash Tamang | KITCHEN_STAFF | Thamel |
| Dipak Shrestha | INVENTORY_MANAGER | Thamel and Patan |

Branches: Thamel (code TH) and Patan (code PT). Tax rate 13 percent, exclusive.

## Conventions

1. Every business-owned row carries tenantId. Branch-owned rows also carry branchId.
2. Money is Decimal in the database and a string with two decimals in the API.
3. All timestamps are UTC in storage. Reports use the branch timezone and business date.
4. Completed sales are never deleted. Corrections are refunds and reversals.
5. Every stock change is a StockMovement row written in the same transaction as the stock balance.
6. Permissions are checked on the backend. The frontend only hides controls.
7. A record outside the caller's tenant or branch scope returns 404.
