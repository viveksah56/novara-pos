# 14 Audit log

## Real-world example

Sita opens Settings and then Audit log and filters for refunds this week. She sees "Ramesh Thapa refunded NPR 474.60 on order TH-20261017-0042, reason: Customer said coffee was cold". Another entry shows Dipak's stock adjustment of -1,000 ml dairy milk with the reason "Spilled" and the balance before and after.

## Model

| Field | Meaning |
|---|---|
| id | Primary key |
| tenantId | Business, null for platform-only events |
| branchId | Branch if relevant |
| actorId | User ID, null for the system |
| actorType | USER, PLATFORM, SYSTEM |
| action | Dotted name such as `order.refund` |
| entityType, entityId | Affected record |
| before, after | JSON snapshots of changed fields |
| ip, userAgent, requestId | Request context |
| createdAt | UTC timestamp |

Indexes: (tenantId, createdAt), (tenantId, action, createdAt), (tenantId, entityType, entityId).

## Actions recorded

| Area | Actions |
|---|---|
| Auth | auth.register, auth.login, auth.login_failed, auth.locked, auth.password_reset, auth.password_change, auth.logout |
| Team | team.invite, team.accept, team.role_change, team.branches_change, team.deactivate, team.reactivate |
| Business | tenant.update, branch.create, branch.update, branch.deactivate |
| Menu | product.create, product.update, product.price_change, product.archive, recipe.update |
| Orders | order.create, order.item.void, order.discount, order.cancel, order.complete, order.refund, receipt.reprint |
| Shifts | shift.open, shift.cash_movement, shift.close, shift.review |
| Stock | stock.adjust, stock.waste, stocktake.approve, purchase.create, purchase.receive, purchase.payment |
| Money | expense.create, expense.void |
| Billing | subscription.change, invoice.confirm, tenant.suspend, tenant.reactivate |

## Backend logic

### Writing entries

```ts
export async function audit(
  db: Tx | PrismaClient,
  ctx: Ctx,
  action: string,
  entityType: string,
  entityId: string,
  data: { before?: unknown; after?: unknown; branchId?: string } = {},
) {
  await db.auditLog.create({
    data: {
      tenantId: ctx.tenantId ?? null,
      branchId: data.branchId ?? null,
      actorId: ctx.userId ?? null,
      actorType: ctx.actorType,
      action,
      entityType,
      entityId,
      before: redact(data.before) as Prisma.InputJsonValue,
      after: redact(data.after) as Prisma.InputJsonValue,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    },
  });
}
```

Rules:

1. Business-changing actions call `audit` with the transaction client so the log row commits or rolls back with the change.
2. `redact` removes `passwordHash`, token fields, cookies and any key matching `secret`.
3. Entries are append-only. No update or delete endpoint exists, and the application database role has INSERT and SELECT only on the table.
4. Failed logins are logged without the attempted password and store only the email hash prefix when the user does not exist.
5. Retention: 24 months online, then exported to cold storage.

### Viewing

`GET /audit` requires `audit.read`. Filters: `action`, `actorId`, `entityType`, `entityId`, `from`, `to`, `branchId`. Cursor on (createdAt, id). Scoped by tenant. Platform events about a tenant are visible to the owner only when marked `visibleToTenant`.

## Frontend logic

### Audit page (`/audit`)

Table with time (branch timezone), actor, action label, entity link, branch. Filters bar with action multi-select, user select, entity type, date range. Row click opens a drawer with a before and after field diff (removed in red, added in green) and request metadata. Entity links go to the order, product, shift or purchase page.

### Contextual history

Order and product drawers include a Timeline tab that calls `GET /audit?entityType=Order&entityId=...` and renders entries in order.

### States

Skeleton rows, empty state "No activity for these filters", infinite scroll through the cursor.

## Tests

A refund writes one entry in the same transaction and a rolled-back refund writes none. Redaction removes secrets. Cashier and manager get 403 on /audit. Order and product timelines are visible to the owner only. Entries cannot be updated through the application role.
