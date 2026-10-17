# 02 Tenants and branches

## Real-world example

Himalayan Brew starts with one cafe in Thamel. After six months Sita opens a second location in Patan. She adds the Patan branch in Settings, sets its own opening hours and tax number, assigns Ramesh as manager of Thamel only, and compares both branches on her dashboard.

## Models

| Model | Fields |
|---|---|
| Tenant | id, name, slug (unique), status (ACTIVE, SUSPENDED), legalName, phone, email, address, logoUrl, createdAt, updatedAt |
| Branch | id, tenantId, name, code, address, phone, timezone, currency, taxRate, taxInclusive, serviceChargeRate, taxRegistrationNumber, receiptHeader, receiptFooter, businessDayStart, allowNegativeStock, requireShift, requirePaymentReference, shiftVarianceTolerance, cashierMaxDiscountPercent, isActive, createdAt, updatedAt |

Constraints: unique (tenantId, name), unique (tenantId, code). Index on tenantId.

Branch settings in the example: code TH, taxRate 13.00, taxInclusive false, serviceChargeRate 0.00, businessDayStart 04:00, cashierMaxDiscountPercent 10, requireShift true, allowNegativeStock false.

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /tenants/current | settings.read | Business profile |
| PATCH /tenants/current | settings.manage | Update profile |
| GET /branches | any member | Branches in the user's scope |
| POST /branches | settings.manage | Create branch, plan limit checked |
| GET /branches/:id | settings.read | Branch details |
| PATCH /branches/:id | settings.manage | Update branch settings |
| POST /branches/:id/deactivate | settings.manage | Deactivate branch |

## Backend logic

### Create branch

1. planGuard checks `maxBranches` of the active plan against the count of active branches. Over the limit returns 402 PLAN_LIMIT.
2. Validate name, code (2 to 4 uppercase letters), timezone (must be a valid IANA zone), taxRate 0 to 100, businessDayStart in HH:mm.
3. Check uniqueness of name and code within the tenant.
4. Create the branch with defaults copied from the tenant's first branch when present.
5. Create IngredientStock rows lazily when the first movement occurs. No bulk insert.
6. Write audit `branch.create`.

### Update settings

Only the fields in the schema can change. Changing taxRate, taxInclusive, businessDayStart or serviceChargeRate affects future orders only, because orders snapshot their calculated amounts. The audit entry stores before and after.

### Deactivate

Rejected while an open shift or open orders exist in the branch. Deactivation hides the branch from POS and pickers but keeps all history. Reports can still include it.

### Branch scope

`GET /branches` returns every active branch for an OWNER and only the assigned branches for others.

### Tenant profile

Name and contact details are editable. Slug never changes after creation. Status changes only through the platform admin (see 13).

## Frontend logic

### Onboarding wizard (`/onboarding`)

Shown after signup when the tenant has no products. Steps: business details, branch details with tax settings, add first categories, add first products, invite staff. Each step saves on Next. Steps can be skipped and resumed.

### Settings pages

| Route | Content |
|---|---|
| /settings | Business profile form |
| /settings/branches | Table of branches, add branch dialog |
| /settings/branches/[id] | Tax, service charge, receipt text, business day start, shift and stock rules |

Forms use React Hook Form with Zod. Tax rate and percent fields are strings validated as decimals. A preview card shows how the receipt header and footer will look.

### Branch switcher

Header dropdown, shown when the user has more than one branch. Owners also get All branches on dashboards and reports. The selected branch ID lives in a Zustand store and is part of query keys and request filters. The POS always works against one branch and shows its name in the top bar.

## Edge cases

| Case | Handling |
|---|---|
| Invalid timezone string | 400 with a list of valid zones in the UI picker |
| Duplicate branch code | 409 CONFLICT, field error on code |
| Last active branch | Cannot be deactivated |
| Manager opens another branch's URL | 404 |

## Tests

Plan limit blocks the second branch on a one-branch plan. Cashier cannot PATCH a branch. Manager of Thamel gets 404 for the Patan branch ID. Changing tax rate does not change a completed order's total.
