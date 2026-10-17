# 13 Subscriptions, billing and platform admin

## Real-world example

Sita signs up and gets a 14-day trial. On day 10 a banner reminds her the trial ends in four days. She pays the Professional plan (NPR 2,999 per month) by bank transfer and submits the reference. A platform admin confirms the payment and the subscription becomes ACTIVE for the next 30 days. When she tries to add a third branch the system answers that Professional allows two and offers an upgrade to Business.

## Models

| Model | Fields |
|---|---|
| Plan | id, code (STARTER, PROFESSIONAL, BUSINESS), name, priceMonthly, currency, maxBranches, maxUsers, maxProducts, features (inventory, expenses, multiBranch, exports), isActive |
| Subscription | id, tenantId, planId, status, trialEndsAt, currentPeriodStart, currentPeriodEnd, graceEndsAt, cancelAtPeriodEnd, cancelledAt, createdAt |
| SubscriptionInvoice | id, tenantId, subscriptionId, number, amount, status (OPEN, PAID, VOID), issuedAt, dueAt, paidAt, paymentMethod, reference, confirmedById |

Plans at launch (test prices): Starter NPR 1,499 with 1 branch and 3 users. Professional NPR 2,999 with 2 branches, 10 users and inventory. Business NPR 5,999 with 10 branches and 50 users.

Subscription status: TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED.

```
TRIAL -> ACTIVE (first invoice paid)
TRIAL -> SUSPENDED (trial ended and grace over)
ACTIVE -> PAST_DUE (period ended unpaid)
PAST_DUE -> ACTIVE (paid) or SUSPENDED (grace over)
SUSPENDED -> ACTIVE (paid)
ACTIVE -> CANCELLED (end of period)
```

## Tenant endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /billing | subscription.manage | Plan, status, usage, invoices |
| GET /plans | signed in | Available plans |
| POST /billing/change-plan | subscription.manage | Request upgrade or downgrade |
| POST /billing/invoices/:id/submit-payment | subscription.manage | Submit method and reference |
| POST /billing/cancel | subscription.manage | Cancel at period end |

## Platform admin endpoints

| Method and path | Role | Purpose |
|---|---|---|
| GET /admin/overview | SUPER_ADMIN, SUPPORT_AGENT | Counts of tenants by status, trials ending, MRR, health |
| GET /admin/tenants | SUPER_ADMIN, SUPPORT_AGENT | Search tenants |
| GET /admin/tenants/:id | SUPER_ADMIN, SUPPORT_AGENT | Account metadata, plan, usage, no business records |
| POST /admin/tenants/:id/suspend | SUPER_ADMIN | Suspend with reason |
| POST /admin/tenants/:id/reactivate | SUPER_ADMIN | Reactivate |
| POST /admin/tenants/:id/extend-trial | SUPER_ADMIN | Add days |
| POST /admin/tenants/:id/change-plan | SUPER_ADMIN | Set plan |
| POST /admin/invoices/:id/confirm | SUPER_ADMIN | Mark paid, extends the period |
| GET /admin/health | SUPER_ADMIN | DB and queue checks |
| PUT /admin/plans/:id | SUPER_ADMIN | Edit plan |

Platform roles never read orders, customers or stock of a tenant. Support access to business data requires a future explicit, time-limited, audited grant by the owner.

## Backend logic

### planGuard middleware

```ts
export const planGuard = (feature?: PlanFeature): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const t = mustTenant(req);
    const sub = await loadSubscription(t.tenantId);
    if (sub.tenantStatus === "SUSPENDED" || sub.status === "SUSPENDED") {
      throw new HttpError(403, "TENANT_SUSPENDED", "This business account is suspended");
    }
    if (feature && !sub.plan.features[feature]) {
      throw new HttpError(402, "PLAN_FEATURE", "Your plan does not include this feature");
    }
    next();
  });
```

Billing endpoints and `/auth/me` bypass the suspended check so owners can pay.

### Limits

`assertWithinLimit(tenantId, "branches" | "users" | "products")` counts active rows and compares with the plan. It is called when creating branches, accepting invitations and creating products. Over limit returns 402 PLAN_LIMIT with current, limit and suggested plan.

### Invoicing

1. At trial end or period end a daily job creates an OPEN invoice with number `INV-2026-0012` and due date seven days later.
2. The owner submits payment method and reference (bank transfer, eSewa, Khalti, FonePay).
3. A platform admin confirms. In one transaction the invoice becomes PAID, `currentPeriodStart` and `currentPeriodEnd` advance 30 days, status becomes ACTIVE, and `graceEndsAt` is cleared.
4. Payment gateway webhooks, when added, verify signatures, use the provider's event ID as an idempotency key and perform the same transition.

### Daily job

Runs at 02:00 Asia/Kathmandu with a lock so only one instance executes. It sends reminders (3 days before, on the day, 3 days after), sets PAST_DUE at period end, sets SUSPENDED after a 7-day grace period, and updates `Tenant.status`. Every transition writes an audit entry with actor type SYSTEM.

### Downgrade rule

A downgrade is refused while usage exceeds the target plan's limits and the response lists what to reduce.

### Admin overview

MRR is the sum of monthly prices of ACTIVE subscriptions. Trials ending in 7 days, past-due count and suspended count are computed with SQL counts.

## Frontend logic

### Billing page (`/settings/billing`)

Current plan card, status badge, next renewal date, usage meters (branches 2 of 2, users 6 of 10, products), plan comparison table with Upgrade buttons, invoices table. Pay dialog shows bank and wallet instructions, the invoice number as the payment reference, and a form for method and reference.

### Banners

Layout-level banner: trial days left, payment due, past due warning. A suspended tenant sees a full-page notice with the billing link only.

### Plan limit handling

On 402 PLAN_LIMIT the api-client throws a typed error. The UI opens an Upgrade dialog with the limit message.

### Admin console (`/admin`)

Overview cards, tenants table with filters by status, tenant detail drawer with usage and invoices, action buttons for suspend, reactivate, extend trial, change plan, confirm invoice. Every action requires a reason and shows a confirmation.

## Tests

Suspended tenant gets TENANT_SUSPENDED on orders but can read billing. Third branch on Professional returns PLAN_LIMIT. Confirming an invoice extends the period by 30 days. Daily job moves ACTIVE to PAST_DUE to SUSPENDED on schedule. Support agent cannot suspend. Admin endpoints never expose order data.
