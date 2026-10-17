# 03 Team, roles and permissions

## Real-world example

Sita invites Anil as a cashier for Thamel only. Anil gets an email, sets a password and lands on the POS. Later Sita makes Ramesh the manager for both Thamel and Patan. When Anil leaves, Sita deactivates him and his next request fails immediately.

## Models

| Model | Fields |
|---|---|
| Membership | id, tenantId, userId, role, isActive, createdAt. Unique (tenantId, userId) |
| MembershipBranch | membershipId, branchId. Unique pair, foreign keys to both |
| Invitation | id, tenantId, email, role, branchIds (via InvitationBranch rows), tokenHash, invitedById, expiresAt, acceptedAt, revokedAt, createdAt |

Roles: OWNER, MANAGER, CASHIER, WAITER, KITCHEN_STAFF, INVENTORY_MANAGER. Platform roles: SUPER_ADMIN, SUPPORT_AGENT (on User, not Membership).

## Permissions

| Permission | Owner | Manager | Cashier | Waiter | Kitchen | Inventory |
|---|---|---|---|---|---|---|
| orders.read | Y | Y | Y | Y | - | - |
| orders.create | Y | Y | Y | Y | - | - |
| orders.update | Y | Y | - | Y | - | - |
| orders.pay | Y | Y | Y | - | - | - |
| orders.cancel | Y | Y | - | - | - | - |
| orders.refund | Y | Y | - | - | - | - |
| discounts.apply | Y | Y | Y | - | - | - |
| receipts.print | Y | Y | Y | - | - | - |
| tables.read | Y | Y | Y | Y | - | - |
| kitchen.orders.read | Y | Y | - | - | Y | - |
| kitchen.orders.update | Y | - | - | - | Y | - |
| menu.read | Y | Y | Y | Y | - | Y |
| menu.manage | Y | Y | - | - | - | - |
| inventory.read | Y | Y | - | - | - | Y |
| inventory.adjust | Y | Y | - | - | - | Y |
| purchases.manage | Y | Y | - | - | - | Y |
| suppliers.manage | Y | Y | - | - | - | Y |
| expenses.read | Y | Y | - | - | - | - |
| expenses.manage | Y | Y | - | - | - | - |
| shifts.review | Y | Y | - | - | - | - |
| reports.sales.read | Y | Y | - | - | - | - |
| reports.inventory.read | Y | Y | - | - | - | Y |
| reports.profit.read | Y | - | - | - | - | - |
| staff.read | Y | Y | - | - | - | - |
| staff.manage | Y | - | - | - | - | - |
| settings.read | Y | Y | - | - | - | - |
| settings.manage | Y | - | - | - | - | - |
| subscription.manage | Y | - | - | - | - | - |
| audit.read | Y | - | - | - | - | - |

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /team | staff.read | Members with role and branches |
| POST /team/invitations | staff.manage | Invite by email |
| GET /team/invitations | staff.manage | Pending invitations |
| DELETE /team/invitations/:id | staff.manage | Revoke |
| POST /team/invitations/accept | public with token | Accept and set password |
| PATCH /team/:membershipId | staff.manage | Change role or branches |
| POST /team/:membershipId/deactivate | staff.manage | Deactivate |
| POST /team/:membershipId/reactivate | staff.manage | Reactivate |

## Backend logic

### Authorization middleware

```ts
export const requirePermission = (...required: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const { role } = mustTenant(req);
    if (!required.every((p) => can(role, p))) {
      return next(new HttpError(403, "FORBIDDEN", "Your role cannot perform this action"));
    }
    next();
  };

export const branchScopeWhere = (t: TenantContext) =>
  t.role === "OWNER" ? {} : { branchId: { in: t.branchIds } };
```

`ROLE_PERMISSIONS` is `Record<UserRole, ReadonlySet<Permission>>` so a new role without permissions fails the build. The membership loader reads branch IDs from MembershipBranch.

### Invite

1. planGuard checks `maxUsers`.
2. Reject if an active membership for that email already exists in the tenant.
3. Only OWNER can invite another OWNER.
4. Non-owner roles require at least one branch in the owner's scope.
5. Create a token (32 random bytes), store its hash, expiry 7 days, email the link.
6. Audit `team.invite`.

### Accept

1. Hash the token and find an unused, unexpired, unrevoked invitation.
2. If a user with the email exists, the caller must be signed in as that user. Create Membership and branch links.
3. If no user exists, create the user with the submitted name and password, then the membership.
4. Mark the invitation accepted, set cookies, return homeRoute.

### Change role or branches

Rules: only an OWNER can grant or remove OWNER. The last active OWNER cannot be demoted or deactivated. A user cannot change their own role. Branch assignment replaces the MembershipBranch set in a transaction. Audit stores before and after.

### Deactivate

Sets `isActive` false on the membership. `requireTenant` rejects inactive memberships on the next request. Open orders created by the user stay intact. If the user has an open shift, deactivation is refused until it is closed.

## Frontend logic

### Team page (`/staff`)

Table with name, email, role badge, branches, status, last login. Actions per row are shown only with `staff.manage`. Invite dialog: email, role select (roles the actor may grant), branch multi-select. Pending invitations tab with resend and revoke.

### Session helpers

```tsx
export function useCan(permission: Permission) {
  const { permissions } = useSession();
  return permissions.includes(permission);
}

export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan(permission) ? <>{children}</> : null;
}
```

### Navigation config

```ts
export const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "reports.sales.read" },
  { label: "POS", href: "/pos", icon: ShoppingCart, permission: "orders.create" },
  { label: "Orders", href: "/orders", icon: Receipt, permission: "orders.read" },
  { label: "Menu", href: "/menu", icon: UtensilsCrossed, permission: "menu.read" },
  { label: "Inventory", href: "/inventory", icon: Boxes, permission: "inventory.read" },
  { label: "Reports", href: "/reports/sales", icon: BarChart3, permission: "reports.sales.read" },
  { label: "Staff", href: "/staff", icon: Users, permission: "staff.read" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings.read" },
] satisfies NavItem[];
```

The sidebar filters by `useCan`. Pages call a `RequirePermission` wrapper that renders `/no-access` when missing.

### Accept invitation page

`/accept-invite?token=` shows the business name and role, a name and password form for new users, or a sign-in prompt for existing users.

## Tests

Cashier gets 403 on POST /orders/:id/refunds. Manager cannot invite an owner. Last owner cannot be demoted. Deactivated member fails the next request. Invitation token cannot be reused. Manager of Thamel gets 404 for a Patan order.
