# Novara Project Guide

Novara is a multi-tenant cafe and restaurant operations platform. This document describes the code currently in this repository; unfinished workflows are called out explicitly.

## Architecture

```text
Browser
  └─ Next.js 16 App Router (frontend/src/app)
       ├─ React 19, TypeScript, Tailwind CSS, shadcn-style UI
       ├─ TanStack Query for API state; TanStack Table for tabular views
       └─ same-origin /api/* rewrite → Express API
            └─ /api/v1 (backend/src/modules)
                 └─ Prisma 7 → PostgreSQL
```

- **Frontend:** `frontend/`, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, TanStack Query/Table, Axios, React Hook Form and Zod.
- **Backend:** `backend/`, Express 5, TypeScript, Zod validation, Pino structured JSON logging, Prisma 7 and PostgreSQL.
- **API envelope:** successful responses use `{ "data": ..., "status": "success" }`; failures use `{ "data": null, "status": "error", "error": { "code", "message", "requestId" } }`.
- **Tenant isolation:** tenant IDs in URLs and selected branch context are treated as untrusted input. Backend membership and branch assignment checks scope operational reads and writes.
- **Frontend data flow:** feature APIs under `frontend/src/features/<feature>/api`, query hooks under `hooks`, reusable UI under `frontend/src/components`.
- **Auth:** access and rotating refresh tokens are stored in HTTP-only cookies. Next Proxy performs an optimistic route check; backend middleware and route services remain authoritative.

## Local development

Prerequisites: Node.js compatible with the workspace engines, npm, and a PostgreSQL database configured in `backend/.env.local`.

```sh
# Terminal 1: backend, default port 8000
cd backend && npm run dev

# Terminal 2: frontend, default port 3000
cd frontend && npm run dev
```

The frontend proxies `/api/*` to `API_PROXY_TARGET` (default `http://localhost:8000`). Backend readiness is available at `GET http://localhost:8000/ready`; liveness is `GET http://localhost:8000/health`. Apply schema migrations using `cd backend && npm run db:deploy`; seed demo accounts with `npm run db:seed:demo` when required.

Verification commands:

```sh
cd frontend && npm run typecheck && npm run lint && npm run build
cd backend && npm run typecheck && npm run build
```

## Frontend routes and views

App source lives under `frontend/src/app`. The `(auth)` and `(dashboard)` route groups are organizational and do not appear in browser URLs.

| Browser route | View / purpose | Main access |
| --- | --- | --- |
| `/` | Public Novara landing page and subscription plans | Public |
| `/login`, `/register` | Sign in and account registration | Public |
| `/dashboard` | Role-aware business overview / default business workspace | Owner, Manager |
| `/pos` | Register POS, menu, cart, table-mode order creation and payment | Owner, Manager, Cashier, Waiter |
| `/tables` | Branch-scoped dining floor with derived free/occupied/bill-requested status and table setup | Owner, Manager, Waiter |
| `/orders` | Order history and eligible order completion, including waiter ready-item alerts and serve actions | Owner, Manager, Cashier, Waiter |
| `/kitchen` | Live preparation queue | Owner, Manager, Kitchen Staff |
| `/menu`, `/menu/categories`, `/menu/products`, `/menu/modifiers` | Menu, category/product administration, modifier pricing and recipe effects | Business membership; writes restricted to owners/managers in API |
| `/inventory`, `/inventory/ingredients`, `/inventory/recipes`, `/inventory/stocktakes` | Stock, ingredients, recipes and count/reconciliation workflow | Inventory roles; recipe writes and stocktake approval are Owner/Manager |
| `/inventory/suppliers`, `/inventory/purchases` | Supplier and purchase order workflows with partial receiving and weighted cost updates | Inventory roles |
| `/shift` | Current cashier shift, open/close and cash variance | Owner, Manager, Cashier |
| `/reports`, `/stock-reports` | Sales and inventory reporting | Permission-gated business roles |
| `/expenses` | Branch-scoped expense register, categories, cash reconciliation and void history | Owner, Manager |
| `/branches`, `/team` | Business branches and staff membership administration | Owner/Manager; writes restricted by API |
| `/subscription` | Current subscription and public plan selection | Business members |
| `/feedback` | Submit support request, complaint or product feedback | Signed-in users |
| `/admin` | Platform overview | Super Admin |
| `/admin/businesses`, `/admin/businesses/[businessId]` | Business directory and details | Super Admin, Support Agent (mutations vary) |
| `/admin/plans`, `/admin/system` | Platform plans and system health | Super Admin |
| `/admin/support`, `/admin/tickets` | Support queue and ticket handling | Super Admin, Support Agent |
| `/unauthorized` | Access denied page | Public fallback |

The dashboard and operational pages use a shared role-aware workspace shell. App-level `loading.tsx` and `(dashboard)/loading.tsx` show skeletons; `error.tsx`, `(dashboard)/error.tsx`, `global-error.tsx`, and `not-found.tsx` provide recovery UI. React Query screens also render local loading, empty, error and retry states.

## Roles and current capabilities

Roles are assigned per tenant membership except platform roles, which live in `PlatformStaff`.

| Role | Default workspace | Intended permissions / navigation |
| --- | --- | --- |
| `OWNER` | `/dashboard` | Business-wide view, branches, menu, products, inventory, purchasing, staff, sales/inventory reports, profit when costs are complete, subscriptions and shifts |
| `MANAGER` | `/dashboard` | Branch-scoped operations, orders, menu, inventory, purchasing, staff views, shifts and sales reports; profit is hidden |
| `CASHIER` | `/pos` | Create/view orders, cash checkout and own shift operations |
| `WAITER` | `/pos` | Create orders and view order workspace; no cash shift management |
| `KITCHEN_STAFF` | `/kitchen` | Read active kitchen tickets and advance them through preparation/ready |
| `INVENTORY_MANAGER` | `/inventory` | Ingredient, stock, supplier, purchase and inventory-report operations |
| `SUPER_ADMIN` | `/admin` | Platform businesses, plans, system health, support staff and global search |
| `SUPPORT_AGENT` | `/admin/support` | View business context and manage assigned platform support tickets; no platform plan or health administration |

Frontend capability mappings are defined in `frontend/src/lib/rbac.ts`; proxy checks live in `frontend/src/proxy.ts`. These checks improve navigation but do not replace API authorization. Backend role allowlists and tenant/branch scope are enforced in the route handlers.

## Backend API routes

All application endpoints below are mounted under `/api/v1`. Unless marked public, they require the session cookie and the route-specific role/tenant scope.

### Authentication and dashboard

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Register a business account |
| `POST` | `/auth/login` | Sign in and set session cookies |
| `POST` | `/auth/refresh` | Rotate refresh token and renew cookies |
| `POST` | `/auth/logout` | Revoke refresh token and clear cookies |
| `GET` | `/auth/me` | Current user profile and memberships |
| `GET` | `/dashboard/:view` | Role- and branch-scoped dashboard payload (`overview`, `pos`, `kitchen`, `inventory`, `admin`) |

### Tenant operations

Replace `:tenantId` with the active tenant UUID.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/tenants/:tenantId/subscription` | `GET`, `POST` | Read/change subscription selection |
| `/tenants/:tenantId/branches` | `GET`, `POST` | List/create branches |
| `/tenants/:tenantId/team` | `GET` | List memberships and branch access |
| `/tenants/:tenantId/team/invitations` | `GET`, `POST` | List pending invites and send hashed, branch-scoped, seven-day invitations (enforces the plan staff limit) |
| `/tenants/:tenantId/team/invitations/:invitationId` | `DELETE` | Revoke a pending invitation |
| `/tenants/:tenantId/team/:membershipId` | `PATCH`, `DELETE` | Change role/branch scope or deactivate access without deleting history |
| `/tenants/:tenantId/team/:membershipId/reactivate` | `POST` | Restore a deactivated membership |
| `/auth/team-invitations/:token` | `GET` | Preview invitation without revealing whether an account exists |
| `/auth/team-invitations/accept` | `POST` | Accept invite; require matching sign-in for existing users or create account and cookie session |
| `/tenants/:tenantId/categories` | `GET`, `POST` | List/create categories |
| `/tenants/:tenantId/categories/:id` | `PATCH`, `DELETE` | Update/delete category |
| `/tenants/:tenantId/products` | `GET`, `POST` | List/create products |
| `/tenants/:tenantId/products/:id` | `PATCH`, `DELETE` | Update/delete product |
| `/tenants/:tenantId/modifier-groups` | `GET`, `POST` | List/create modifier groups, options, prices and ingredient effects |
| `/tenants/:tenantId/modifier-groups/:id` | `PATCH` | Update a modifier group and its option/effect snapshot |
| `/tenants/:tenantId/products/:id/modifier-groups` | `PUT` | Assign active modifier groups to a product |
| `/tenants/:tenantId/modifier-options/:id/recipe` | `PUT` | Replace one option's ingredient effects |
| `/tenants/:tenantId/ingredients` | `GET`, `POST` | List/create ingredients |
| `/tenants/:tenantId/ingredients/:id` | `PATCH` | Update ingredient and cost data |
| `/tenants/:tenantId/recipes` | `GET`, `PUT` | List/upsert product recipes |
| `/tenants/:tenantId/orders` | `GET`, `POST` | List/create POS or table orders; creation supports client idempotency UUID and prevents multiple open orders per table |
| `/tenants/:tenantId/orders/:id/items` | `POST` | Append menu items/modifiers to an open table order and recalculate totals atomically |
| `/tenants/:tenantId/tables` | `GET`, `POST` | List tables with derived occupancy or create a table |
| `/tenants/:tenantId/tables/:id` | `PATCH` | Rename/reorder/relocate in settings, or deactivate an unused table |
| `/tenants/:tenantId/orders/:id/send-to-kitchen` | `POST` | Send only unsent order items to the kitchen |
| `/tenants/:tenantId/orders/:id/request-bill` | `POST` | Mark the open table order as bill requested |
| `/tenants/:tenantId/kitchen/queue` | `GET` | Read active unsent-complete items grouped by ticket, oldest first, with modifiers/notes |
| `/tenants/:tenantId/kitchen/items/:id` | `PATCH` | Advance `NEW → PREPARING → READY`; Owner/Manager reset with a reason |
| `/tenants/:tenantId/orders/ready` | `GET` | Poll ready items for waiter service |
| `/tenants/:tenantId/orders/:id/items/:itemId/served` | `PATCH` | Mark a ready item served (not available to Kitchen Staff) |
| `/tenants/:tenantId/orders/:id/complete` | `POST` | Take payment, complete order and deduct recipe stock atomically |
| `/tenants/:tenantId/orders/:id/refunds` | `POST` | Owner/Manager approval of a full or line-level partial refund; optional restock is applied atomically |
| `/tenants/:tenantId/orders/:id/cancel` | `POST` | Cancel an open order |
| `/tenants/:tenantId/inventory` | `GET` | Read branch stock levels and recent ledger movements |
| `/tenants/:tenantId/inventory/adjustments` | `POST` | Record stock adjustment and ledger movement |
| `/tenants/:tenantId/inventory/valuation` | `GET` | Read weighted-cost stock valuation by branch |
| `/tenants/:tenantId/stocktakes` | `GET`, `POST` | List scoped counts or start a draft stocktake |
| `/tenants/:tenantId/stocktakes/:id` | `GET` | Read stocktake and ingredient count lines |
| `/tenants/:tenantId/stocktakes/:id/lines` | `PUT` | Save physical counts and count timestamps while draft |
| `/tenants/:tenantId/stocktakes/:id/submit` | `POST` | Submit saved counts for approval |
| `/tenants/:tenantId/stocktakes/:id/approve` | `POST` | Reconcile movement changes, apply variances, and write stocktake ledger movements atomically |
| `/tenants/:tenantId/stocktakes/:id/cancel` | `POST` | Cancel a draft or submitted stocktake |
| `/tenants/:tenantId/suppliers` | `GET`, `POST` | List/create suppliers |
| `/tenants/:tenantId/suppliers/:id` | `PATCH` | Update supplier |
| `/tenants/:tenantId/purchases` | `GET`, `POST` | List/create purchase orders |
| `/tenants/:tenantId/purchases/:id/order` | `POST` | Submit a purchase order |
| `/tenants/:tenantId/purchases/:id/cancel` | `POST` | Cancel a purchase order |
| `/tenants/:tenantId/purchases/:id/receive` | `POST` | Receive selected quantities, convert to base units, update weighted average cost and stock ledger atomically |
| `/tenants/:tenantId/shifts/current` | `GET` | Read current cashier shift |
| `/tenants/:tenantId/shifts/open` | `POST` | Open a cash shift |
| `/tenants/:tenantId/shifts/:id/close` | `POST` | Close shift and record cash variance |
| `/tenants/:tenantId/shifts/:id/cash-movements` | `POST` | Record a pay-in or pay-out with an audit event and expected-cash adjustment |
| `/tenants/:tenantId/reports/sales` | `GET` | Sales summaries, daily totals, best sellers and conditional owner profit |
| `/tenants/:tenantId/reports/inventory` | `GET` | Low stock, weighted-cost valuation, and inventory movement report |
| `/tenants/:tenantId/expense-categories` | `GET`, `POST` | List/create tenant expense categories (Owner, Manager) |
| `/tenants/:tenantId/expenses` | `GET`, `POST` | List scoped expenses or record an expense (Owner, Manager) |
| `/tenants/:tenantId/expenses/:id/void` | `POST` | Soft-void an expense and reverse linked drawer cash (Owner, Manager) |
| `/tenants/:tenantId/reports/expenses` | `GET` | Expense totals grouped by category and month |
| `/tenants/:tenantId/kitchen/orders` | `GET` | Legacy order-level kitchen queue retained for compatibility; new UI uses item-level `/kitchen/queue` |
| `/tenants/:tenantId/kitchen/orders/:id` | `PATCH` | Legacy order-level preparation endpoint retained for compatibility |

### Platform and support

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/platform/public-plans` | Public subscription plan catalog |
| `POST` | `/platform/feedback` | Submit support request, complaint or product feedback |
| `GET` | `/platform/my-feedback` | Current user’s feedback/tickets |
| `GET`, `PATCH` | `/platform/businesses/:tenantId/complaints`, `/platform/businesses/:tenantId/complaints/:ticketId` | Business-side complaint queue and status updates |
| `GET`, `PATCH` | `/platform/tickets`, `/platform/tickets/:ticketId` | Platform support queue and ticket actions |
| `GET` | `/platform/overview` | Platform summary (`SUPER_ADMIN`) |
| `GET` | `/platform/businesses`, `/platform/businesses/:businessId` | Search/list business directory and view details |
| `PATCH`, `DELETE` | `/platform/businesses/:businessId` | Update/suspend or remove a business (`SUPER_ADMIN`) |
| `GET`, `POST`, `PATCH`, `DELETE` | `/platform/plans`, `/platform/plans/:planId` | Manage plans (`SUPER_ADMIN`) |
| `GET`, `POST`, `DELETE` | `/platform/support-agents`, `/platform/support-agents/:userId` | Manage support agents (`SUPER_ADMIN`) |
| `GET` | `/platform/search` | Search businesses/users/tickets |
| `GET` | `/platform/system-health` | Platform health (`SUPER_ADMIN`) |
| `GET` | `/openapi.json` | Generated API schema |

## Data model overview

Prisma schema is split into files under `backend/prisma/schema/`; generated client code is placed under `backend/prisma/generated/client/`.

- **Identity and tenancy:** `User`, `RefreshToken`, `Tenant`, `Branch`, active/deactivated `Membership`, `BranchAssignment`.
- **Platform:** `PlatformStaff`, `PlatformTicket`, `SubscriptionPlan`, `Subscription`.
- **Menu:** `Category`, `Product`.
- **Inventory and purchasing:** `Ingredient`, `Recipe`, `RecipeIngredient`, `StockLevel`, `StockMovement`, `Supplier`, `Purchase`, `PurchaseItem`.
- **Sales and operations:** `DiningTable`, `SalesOrder`, `SalesOrderItem` with item kitchen lifecycle timestamps, `Payment`, `Refund`, `RefundItem`, `Shift`, `CashMovement`.
- **Finance:** `ExpenseCategory`, `Expense`, with immutable audit history for voids and cash drawer reversals.
- Primary IDs are UUIDs. Tenant-owned data carries `tenantId`; branch stock and orders carry `branchId`.

## Error handling and operational guarantees

- Express installs request IDs before route handling and returns `X-Request-Id` plus a stable error envelope. `HttpError`, Zod validation, malformed JSON and Prisma uniqueness errors receive normalized responses; unexpected failures are logged with Pino JSON and return a generic 500 message. Common credential and cookie fields are redacted from structured logs.
- `/health` is a liveness check. `/ready` verifies the database connection.
- Protected App Router routes use the Next 16 `proxy.ts` convention for fast session and role navigation checks. Backend authorization is still mandatory.
- A rejected refresh token redirects the browser to `/login` while preserving the requested path. The shared logout action calls the API, clears the TanStack Query cache and navigates to sign in.
- POS completion uses a Prisma transaction to update the order, persist one or more tender records, deduct recipe stock and create `StockMovement` entries. A cash tender records applied amount separately from tendered cash and change. Order creation supports a client UUID for safe retry. An offline browser queue stores draft order payloads locally and syncs them after connectivity returns.
- Refund creation locks the order row, validates refundable quantities and paid balance, records refund line snapshots, optionally restores recipe stock, adjusts cash shift expectation, and writes an audit event in one transaction. Reports include partially and fully refunded sales and subtract refund amounts from net sales.
- Membership checks reject deactivated users on the next API request. Role and branch updates are audited; Manager scope is restricted to assigned branches; Owner deactivation/demotion preserves at least one active Owner, open shifts must be closed first, and team changes enforce configured plan staff limits.
- Cashier checkout requires an open shift; cash received/change and shift expected cash are recorded. Shift close computes the expected cash from opening cash plus recorded cash sales and stores the variance.
- Expense records are branch-scoped and limited to Owners and Managers. Cash expenses attach a PAY_OUT to an open creator shift; voiding preserves the original record and adds a PAY_IN reversal, without changing a shift already closed. Expense reporting excludes void records; Owner sales summaries label operating profit as before income tax.

## Known scope limits

- Modifier groups/options are supported, including product assignment, option price deltas, recipe ingredient effects, and per-order snapshots. The POS validates selections and calculates totals; checkout atomically applies the combined base recipe and selected effects to stock and movements. Modifiers do not yet have a dedicated option-level recipe editing API in the UI; effects are edited with the group.
- Payments/refunds currently use the existing order completion endpoint plus a separate refund endpoint. Split tender checkout is supported in the order payment dialog with per-line applied amount, cash tendered/change and conditional references. Refund approval is restricted to Owners and Managers, but a separate approval workflow/permission assignment is not yet modeled.
- Team invites use the configured Resend email provider in production. In local development without email credentials, the API returns the invitation URL to the authorized inviter so the acceptance flow can be exercised manually.
- Dashboard sales, refunds, weekly trend buckets, and sales-report date windows now use each branch timezone and `businessDayStart`. Expense date range interpretation and some operational summaries still use UTC or date-only storage; a full timezone audit remains.
- The offline queue synchronizes order drafts, not offline payment completion, and uses local storage rather than Dexie, a service worker, or background sync. Failed orders are not yet shown in a dedicated needs-attention workflow.
- Inventory stores branch `StockLevel` quantities and weighted average costs. Stocktake count, submit, approval, and count-time movement reconciliation are implemented; stock valuation reporting and approval threshold policies remain outstanding.
- Purchase receipts support partial quantities, base-unit conversion, and weighted average cost updates. Supplier payments, overdue tracking, purchase-order numbering, and a full purchase edit workflow remain outstanding.
- Dining tables and item-level kitchen progression are implemented, including table occupancy derived from open orders, bill requests, adding items to active table orders, oldest-first kitchen polling, ready-item waiter service actions, and unique open-order protection. Remaining: live SSE (polling is used), drag-and-drop table layout, station configuration, cancellation acknowledgments for already-sent items, and a manager UI to reset a kitchen item with a reason.
- The shared TanStack Table supports row selection, sorting, search and pagination in the browser; server-side pagination/filter/sort is not yet consistent across all lists.
- Audit-event persistence is not yet wired into all mutations. Profit reporting is withheld unless every sold product has complete recipe ingredient cost data.
- Expense receipt attachment upload is not available until a storage provider and signed-upload configuration are selected; the API currently does not accept arbitrary attachment URLs.
- Migrations for the current workspace changes, including dining tables/item kitchen flow, expenses, weighted average purchasing and stocktakes, must be deployed to the target database before use. Do not infer migration state from a successful TypeScript build.
