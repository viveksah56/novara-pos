# 17 Testing, release and operations

## Real-world example

Before the first pilot at Himalayan Brew, the team runs the full test suite in CI, deploys to staging with the seeded Himalayan Brew data, and runs a half-day trial with Anil on a real tablet and thermal printer, including a forced internet cut at the counter. Only then is production deployed on a Sunday night.

## Test layers

| Layer | Tooling | Covers |
|---|---|---|
| Unit | Vitest | Money and tax calculation, consumption, permission map, branch scope, business date, weighted average |
| Integration | Vitest and Supertest against a real PostgreSQL | Every route with each role, tenant isolation, transactions, idempotency |
| Frontend unit | Vitest and Testing Library | Cart store, forms, `<Can>`, nav filtering, formatters |
| End to end | Playwright | Login, create order, pay, see report, offline sale then sync, one landing page per role |
| Manual field test | Real hardware | Printer, tablet, network cut, full trading day |

## Seed data

`prisma/seed.ts` creates Himalayan Brew with branches TH and PT, the six users from the README, categories, products with modifiers, ingredients with recipes, opening stock, and a trial subscription. Tests build their own data in a transaction or a fresh schema so they never depend on each other.

## Mandatory integration tests

| Area | Test |
|---|---|
| Isolation | A cashier from tenant A receives 404 for every tenant B resource by ID |
| Roles | Each route is called with every role and the expected status |
| Order totals | Worked example equals 1197.80 |
| Stock | Completing an order lowers stock and writes movements, rollback leaves nothing |
| Concurrency | Two payments on the same order complete it once, two sales of the last unit allow one |
| Idempotency | Same key and body replays, same key and different body returns 422 |
| Refund | Partial refund amount, status change, restock options |
| Shifts | Expected cash formula and variance |
| Auth | Lockout, rotation, reuse detection, reset flow |
| Plan | Limits and suspended behaviour |

Concurrency example:

```ts
it("completes an order once when payment is sent twice", async () => {
  const order = await createOpenOrder(ctx);
  const send = () => request(app).post(`/api/v1/orders/${order.id}/payments`).set(authHeaders(cashier)).send(cashPayment(order.total));
  const [a, b] = await Promise.all([send(), send()]);
  const statuses = [a.status, b.status].sort();
  expect(statuses).toEqual([200, 409]);
  expect(await countSaleMovements(order.id)).toBe(expectedMovements);
});
```

## CI pipeline

1. Install with a cached lockfile.
2. ESLint and Prettier check.
3. `tsc --noEmit` in both projects.
4. Start PostgreSQL service, `prisma migrate deploy`, run backend tests.
5. Generate OpenAPI and frontend types, fail if the generated file differs from the committed one.
6. Run frontend tests and build.
7. Run Playwright against the built app on pull requests to main.
8. On merge to main deploy to staging, then manual approval to production.

## Environments

| Environment | Data | Purpose |
|---|---|---|
| Local | Docker PostgreSQL, seed data | Development |
| Staging | Seed and demo data, production-like config | Pilot testing, release checks |
| Production | Real data | Customers |

Secrets live in the host's secret manager. Each environment has its own database, JWT secret and email credentials.

## Migrations

Use `prisma migrate dev` locally and `prisma migrate deploy` in CI and production. Follow expand then contract: add new columns or tables first, deploy code that uses both, backfill, then remove the old structure in a later release. Never edit an applied migration. Take a backup before each production migration.

## Operations

| Area | Practice |
|---|---|
| Backups | Daily automated, point-in-time recovery if the host offers it, restore tested monthly on staging |
| Monitoring | Sentry for frontend and backend errors, uptime check on /health and /ready, alert on error rate and slow requests |
| Logs | Pino JSON with request ID, searchable in the host's log tool |
| Jobs | Daily billing job with a database lock, alert if it fails |
| Security | Dependency audit in CI, HTTPS only, rate limits, secrets rotated on staff changes |
| Scaling | Vertical first, add read replica or Redis only after measuring a bottleneck |

## Release checklist

1. All tests green and no open critical or high defects.
2. Migrations reviewed and backed up.
3. Staging smoke test: login per role, sale, refund, report, offline sale.
4. Printer check on real hardware for any receipt change.
5. Release notes written with requirement IDs.
6. Deploy during low trading hours, watch errors for 30 minutes.
7. Rollback plan ready: previous container image and the backward-compatible schema.

## Incident handling

Severity 1 (cannot sell, data leak): acknowledge within 15 minutes, status message to affected owners, fix or rollback, written post-incident note within 48 hours. Every incident adds a regression test.
