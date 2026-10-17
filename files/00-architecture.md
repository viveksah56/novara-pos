# 00 Architecture and shared rules

## System

```
Browser or tablet (Next.js PWA)
  same-origin /api/* via Next.js rewrites
Express API  /api/v1
  requestId > httpLogger > rateLimit > auth > tenant > planGuard > permission > branch > validate > controller > service > Prisma
PostgreSQL
```

Two projects in one repository: `backend` and `frontend`. PostgreSQL runs from docker-compose locally and as a managed service in production.

## Backend structure

```
backend/
  prisma/            schema.prisma, migrations, seed.ts
  src/
    config/          env.ts, cors.ts, constants.ts
    lib/             prisma.ts, logger.ts, jwt.ts, password.ts, openapi.ts, mailer.ts
    middleware/      requestId.ts, rateLimit.ts, auth.ts, tenant.ts, planGuard.ts, permission.ts, branch.ts, validate.ts, errors.ts
    modules/<name>/  <name>.routes.ts, .controller.ts, .service.ts, .schema.ts
    routes/index.ts  mounts every module under /api/v1
    utils/           money.ts, dates.ts, pagination.ts, idempotency.ts, slug.ts
    types/express.d.ts
    app.ts  server.ts
  tests/             unit, integration
```

## Frontend structure

```
frontend/src/
  app/               (auth), (dashboard), pos, admin, layout.tsx, providers.tsx
  components/        ui (shadcn), layout, shared
  features/<name>/   api.ts, hooks.ts, schemas.ts, components
  stores/            cart.store.ts
  lib/               api-client.ts, query-client.ts, query-keys.ts, format.ts, nav.ts, offline-queue.ts
  types/api.d.ts     generated from the backend OpenAPI file
  middleware.ts
```

## Request lifecycle

| Step | Middleware | Result on failure |
|---|---|---|
| 1 | requestId | none |
| 2 | httpLogger | none |
| 3 | rateLimit on auth routes | 429 RATE_LIMITED |
| 4 | requireAuth reads the access cookie | 401 UNAUTHENTICATED |
| 5 | requireTenant verifies membership from X-Tenant-Id | 403 FORBIDDEN |
| 6 | planGuard blocks suspended tenants and enforces plan limits | 403 TENANT_SUSPENDED, 402 PLAN_LIMIT |
| 7 | requirePermission | 403 FORBIDDEN |
| 8 | requireBranch | 404 NOT_FOUND |
| 9 | validate parses body, query and params with Zod | 400 VALIDATION_ERROR |
| 10 | controller calls service | domain errors |

## Response format

Success: `{ "data": ..., "meta": { "nextCursor": "..." } }`.
Failure: `{ "error": { "code": "...", "message": "...", "issues": [] } }`.

| Code | Status | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Zod failed |
| UNAUTHENTICATED | 401 | No valid session |
| INVALID_CREDENTIALS | 401 | Login failed |
| FORBIDDEN | 403 | Missing permission or membership |
| TENANT_SUSPENDED | 403 | Business suspended |
| PLAN_LIMIT | 402 | Plan limit reached |
| NOT_FOUND | 404 | Missing or out of scope |
| CONFLICT | 409 | Duplicate or invalid state transition |
| INSUFFICIENT_STOCK | 409 | Stock would go negative |
| IDEMPOTENCY_MISMATCH | 422 | Same key, different body |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL | 500 | Unexpected |

```ts
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", issues: err.issues } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return res.status(409).json({ error: { code: "CONFLICT", message: "Already exists" } });
  }
  req.log.error({ err }, "unhandled");
  return res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
};
```

## Environment

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection |
| JWT_ACCESS_SECRET | Signs access tokens |
| COOKIE_DOMAIN | Cookie scope |
| APP_ORIGIN | Allowed origin and CSRF check |
| SMTP_URL, MAIL_FROM | Email sending |
| NODE_ENV, PORT | Runtime |
| LOG_LEVEL | Pino level |

`env.ts` parses `process.env` with Zod at boot and exits on failure.

## Multi-tenancy rules

1. The tenant comes from the verified membership, never from a body field.
2. Every `findFirst`, `findMany`, `update` and `delete` includes `tenantId`. Branch-owned reads add `branchScopeWhere`.
3. Related IDs in a request (product, ingredient, supplier, table) are loaded with tenantId before use.
4. A miss returns 404.

## Money

```ts
import { Prisma } from "@prisma/client";

const D = Prisma.Decimal;

export const money = (v: Prisma.Decimal.Value) => new D(v).toDecimalPlaces(2, D.ROUND_HALF_UP);
export const qty = (v: Prisma.Decimal.Value) => new D(v).toDecimalPlaces(4, D.ROUND_HALF_UP);
export const toApi = (v: Prisma.Decimal) => v.toFixed(2);
```

Prices and totals are Decimal(12,2). Quantities and unit costs are Decimal(12,4). The client never calculates money except for display previews.

## Time and business date

Each branch has `timezone` and `businessDayStart` (for example 04:00). A sale at 01:30 on 18 October at Thamel belongs to business date 17 October.

```ts
import { DateTime } from "luxon";

export function businessDate(now: Date, timezone: string, dayStart: string): string {
  const [h, m] = dayStart.split(":").map(Number);
  return DateTime.fromJSDate(now, { zone: timezone }).minus({ hours: h, minutes: m }).toISODate()!;
}
```

Orders store `businessDate` so reports group by a plain DATE column.

## Pagination

Cursor pagination for orders, stock movements, audit log. Query: `limit` (1 to 100, default 25) and `cursor`. Response meta carries `nextCursor`. Page and limit for small lists such as products. Date filters require `from <= to` and a maximum span of 366 days.

## Idempotency

Order and payment creation accept `Idempotency-Key`. The server stores the key, tenantId, a hash of the request body and the response. A replay with the same key and body returns the stored response. The same key with a different body returns 422 IDEMPOTENCY_MISMATCH.

## Transactions

Interactive Prisma transactions, short, no network calls inside. Sale completion, refunds, stock receipts, stocktake approval and registration always run in one transaction.

## Frontend foundations

Providers in `app/providers.tsx`: QueryClientProvider, SessionProvider, Toaster, Theme.

```ts
let refreshing: Promise<boolean> | null = null;

export async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "novara",
      "X-Tenant-Id": getActiveTenantId() ?? "",
      ...init.headers,
    },
  });
  if (res.status !== 401 || !retry || path.startsWith("/auth/")) return res;
  refreshing ??= refreshSession().finally(() => { refreshing = null; });
  const ok = await refreshing;
  if (!ok) {
    redirectToLogin();
    return res;
  }
  return api(path, init, false);
}
```

```ts
export const keys = {
  session: ["session"] as const,
  menu: (t: string) => ["menu", t] as const,
  orders: {
    list: (t: string, f: object) => ["orders", t, "list", f] as const,
    detail: (t: string, id: string) => ["orders", t, id] as const,
  },
  stock: (t: string, branchId: string) => ["stock", t, branchId] as const,
  reports: (t: string, name: string, f: object) => ["reports", t, name, f] as const,
};
```

Query defaults: `staleTime` 5 minutes for menu and settings, 15 seconds for orders and stock, `retry` only on network errors. Every key includes the tenant ID so switching business never shows old data. Switching tenant calls `queryClient.clear()`.

Formatting:

```ts
export const npr = (v: string) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR" }).format(Number(v));
```

The number is used for display only.

## Logging and security

Pino with request ID on every line. Passwords, tokens and cookies are redacted. helmet, CORS allowlist from APP_ORIGIN, compression, body size limit 1 MB, trust proxy set correctly for IP rate limits.
