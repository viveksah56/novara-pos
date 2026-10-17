# Novara implementation checklist

Reviewed against the project notes, `PROJECT.md`, and the current `main` checkout. This file tracks what is verified in this repository; items are not marked complete merely because an earlier review or patch description said they were done.

**Status:** `[x]` implemented and checked in source; `[ ]` outstanding; `🔎` requires a focused verification pass; `⚠️` needs a product/security decision. Build/test verification is called out separately where it has not been run.

## 1. Security and correctness

- [x] Configure Express `trust proxy` from `TRUST_PROXY` so rate limits can use the real client IP behind the known proxy. Set `TRUST_PROXY=1` only when exactly one trusted proxy is in front of Express; leave unset otherwise.
- [x] Reserve addresses in `SUPER_ADMIN_EMAILS` from public signup.
- [x] Add `npm run db:create-admin`; requires an allowlisted email and a 16+ character password from environment variables and refuses to replace an existing user's credentials.
- [x] Pin access-token verification to HS256 in the required and optional auth middleware.
- [ ] Implement email verification using a persisted, single-use, expiring token and configured email delivery. `User.emailVerifiedAt` exists; verification is not enforced or sent yet.
- [ ] Add `/audit`, restricted to Owner and `audit.read`. Current `AuditLog` schema is legacy (`userId`, `action`, `metadata`); it does not yet provide the full indexed tenant/entity/cursor contract in `files/14-audit.md`.
- [ ] Complete transactional audit coverage for every business and platform mutation. Several high-value operations already write audit rows, but coverage and metadata are inconsistent and need an endpoint-by-endpoint audit.
- [ ] Add database-backed integration tests for: worked order total 1,197.80; duplicate/concurrent completion; last-unit stock race; refunds/status/restock; idempotency replay and payload mismatch 422; cross-tenant record isolation; Manager response omitting profit fields.
- [x] Omit profit and food-cost keys entirely from Manager dashboard responses; implementation and backend build pass. Automated database assertion remains outstanding.
- [x] Run backend typecheck/build and frontend typecheck/build after the current changes. Next's native SWC binary is unavailable, so the successful build uses the WASM fallback.

## 2. Dashboards

### Owner

- [ ] Consolidate per-branch report requests into one backend response.
- [ ] Add previous-period comparison to report pages.
- [ ] Link shift variances to an Owner review workflow.

### Manager

- [ ] Add an explicit pending-refunds approval workflow and dashboard card.
- [ ] Add a branch-scoped shift status card with open staff, expected cash, and variances.

### Cashier

- [ ] Display expected cash using opening cash + cash sales − cash refunds + pay-ins − pay-outs; reconcile the displayed value against the shift API.
- [x] Add a prominent online/offline/pending sync status badge.
- [ ] Add a failed offline-order inbox with retry, edit, and discard actions; current browser queue has no failure-management view.

### Waiter

- [x] Scope ready items to orders created by the waiter (the schema has no explicit table-assignment relation).
- [x] Add accessible toast and brief sound notifications for newly ready items.
- [x] Align Waiter `orders.update` with send-to-kitchen, request-bill, and served-item operations in the frontend role mapping and backend operational guards.
- [ ] Add a dedicated “My tables” view/filter.

### Kitchen

- [x] Add accessible toast and brief sound on new kitchen tickets.
- [ ] Add station filtering.
- [ ] Configure timer thresholds per branch.
- [ ] Keep cancelled sent items visible until acknowledged.
- [ ] Remove the unused legacy `KitchenContent` and order-level kitchen endpoints after confirming compatibility and clients.

### Inventory manager

- [x] Show low stock, recent movements, open purchases, and waste on `/inventory` landing page.
- [x] Add a stocktake-in-progress card.
- [x] Add a stock valuation card using weighted average cost.

### Super admin

- [ ] Add extend-trial and confirm-invoice actions with auditable authorization.
- [x] Verify trials ending soon, past-due subscriptions, and MRR are present in the platform summary/API (all currencies are grouped separately).
- [ ] Remove unused `AdminContent` after confirming the routed dashboard no longer references it.

### Support agent

- [ ] ⚠️ Decide whether Support Agents receive the spec's read-only business overview; current backend denies it.
- [ ] Add ticket-age and assignment filters.
- [ ] ⚠️ Decide whether business detail may show staff names and emails to Support Agents; apply least-privilege fields after decision.

### Shared dashboard cleanup

- [ ] Wire up or remove unused Kitchen, Inventory, and Admin dashboard views in both frontend and backend.
- [x] Add an explicit timezone fallback for hourly dashboard aggregation (`Asia/Kathmandu`).
- [x] Avoid loading the cashier's completed-order rows for unrelated dashboard views.
- [x] Replace the destructive platform business-delete action with reversible suspension; update `PROJECT.md` route documentation.

## 3. Match the specification

- [x] Align kitchen permissions with the role matrix: Managers may reset items with a reason, but cannot advance kitchen tickets. Owner and Kitchen Staff can advance them.
- [x] Add missing `receipts.print`, `inventory.adjust`, `menu.read`, and `orders.update` capability names to the frontend role model. Backend menu reads exclude Kitchen Staff and include Inventory Managers; ingredient changes already use the Owner/Manager/Inventory Manager gate.
- [x] Remove destructive business deletion from the platform API and UI; suspension and reactivation preserve business history.
- [ ] Replace the localStorage offline queue with durable IndexedDB/Dexie storage, a service worker, and visible failed-order recovery.
- [ ] Complete purchasing: supplier payments, overdue tracking, purchase-order numbers, and full edit workflow.
- [ ] Add server-side pagination, filtering, sorting, and CSV export to all large lists.
- [ ] Finish business-timezone audit for expenses and operational summaries.
- [ ] 🔎 Verify subscription invoice generation plus daily past-due and suspension jobs; document scheduler ownership and retry behavior.

## 4. Operations and production readiness

- [ ] Run backend typecheck/build and inspect CI results on the target remote; the preceding review did not verify the first CI run.
- [ ] Add error tracking and uptime checks for `/health` and `/ready` after selecting/configuring the provider.
- [ ] Configure automated daily backups and document a monthly restore exercise.
- [ ] Add Playwright flows for login, sale, report, offline sale, and sync.
- [ ] Update the Tabula PDF to match this repository's product name, password hashing, auth, and feature behavior.
- [ ] Replace Morgan request logging with structured Pino request logs after checking existing redaction and request-ID behavior.

## 5. Later

- [ ] Replace short-interval polling with SSE after defining reconnect, authorization, and multi-instance delivery behavior.
- [ ] Add drag-and-drop table layout.
- [ ] Add expense receipt uploads after selecting storage, retention, and access controls.
- [ ] Add QR table ordering, customer records, and local wallet payments.
- [ ] Split `operations.routes.ts` and `RoleDashboard.tsx` by domain to reduce change risk and improve maintainability.

## Work recorded in this pass

- [x] Set Express proxy trust from the explicit `TRUST_PROXY` environment setting.
- [x] Reject public registrations for configured Super Admin addresses.
- [x] Add a safe `db:create-admin` script without replacing existing credentials.
- [x] Restrict JWT verification to HS256 in both auth middleware paths.
- [x] Remove an unnecessary cashier-order query from non-cashier/non-POS dashboards and add the hourly timezone fallback.
- [x] Remove platform business deletion; use status-based suspension to preserve records and history.
- [x] Add the Inventory Manager stock valuation metric to the existing low-stock, movement, purchasing, waste, and stocktake dashboard.
- [x] Add cashier sync state and queued-order count to the POS workspace.
- [x] Remove Manager food-cost and profit keys from overview responses, rather than returning null values.
- [x] Add role-targeted waiter ready-item and kitchen ticket notifications.
- [x] Add distinct status-colored due, applied, pending, settled, and overpaid panels to POS payment summary.
- [ ] Focused automated backend tests, database integration tests, CI run, and production configuration verification remain outstanding.
