# 01 Authentication

## Real-world example

Sita Sharma opens Novara on her laptop, signs up as the owner of Himalayan Brew, and lands in an empty workspace with a 14-day trial. Next morning Anil Gurung logs in on the Thamel counter tablet and goes straight to the POS. A week later Anil forgets his password and resets it by email.

## Models

| Model | Fields |
|---|---|
| User | id, email (unique, lowercase), passwordHash, name, phone, isActive, failedLoginCount, lockedUntil, lastLoginAt, emailVerifiedAt, platformRole, createdAt, updatedAt |
| RefreshToken | id, userId, familyId, tokenHash (unique), expiresAt, usedAt, revokedAt, ip, userAgent, createdAt |
| PasswordResetToken | id, userId, tokenHash (unique), expiresAt, usedAt, createdAt |

Indexes: RefreshToken (userId), (familyId). PasswordResetToken (userId).

## Endpoints

| Method and path | Access | Purpose |
|---|---|---|
| POST /auth/register | public, rate limited | Create user, business, first branch, owner membership, trial |
| POST /auth/login | public, rate limited | Sign in |
| POST /auth/refresh | refresh cookie | Rotate tokens |
| POST /auth/logout | any | Revoke session |
| GET /auth/me | signed in | Session, memberships, permissions, homeRoute |
| POST /auth/password/forgot | public, rate limited | Send reset email |
| POST /auth/password/reset | public, rate limited | Set new password |
| POST /auth/password/change | signed in | Change password |

## Backend logic

### Password hashing

Argon2id with memoryCost 19456, timeCost 2, parallelism 1. A fixed dummy hash is verified when the email is unknown so response time stays similar.

### Register

Schema:

```ts
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
  businessName: z.string().trim().min(2).max(80),
  branchName: z.string().trim().min(2).max(60).default("Main"),
  timezone: z.string().default("Asia/Kathmandu"),
});
```

Steps, all in one transaction:

1. Reject if the email exists, with the same success-shaped timing as other failures where possible, or return 409 CONFLICT.
2. Reject a password equal to the email or in a common-password list.
3. Hash the password.
4. Create User.
5. Create Tenant with a unique slug from the business name (`himalayan-brew`, then `himalayan-brew-2`).
6. Create Branch with a code from the branch name (`MA`), default tax settings, `businessDayStart` 04:00.
7. Create Membership with role OWNER.
8. Create Subscription with status TRIAL and `currentPeriodEnd` 14 days ahead.
9. Write AuditLog `auth.register`.
10. Create the session and set cookies.
11. Return user, membership and homeRoute `/dashboard`.

### Login

1. Rate limit 10 attempts per 15 minutes per IP and per email.
2. Validate body with Zod.
3. Load user by lowercase email.
4. Verify the hash, using the dummy hash if the user is missing.
5. Reject if not found, inactive, locked or password wrong, with `401 INVALID_CREDENTIALS` and the message "Invalid email or password".
6. On a wrong password for a real user, increment `failedLoginCount`. At 5, set `lockedUntil` to 15 minutes ahead and write an audit entry.
7. On success reset the counter, set `lastLoginAt`, rehash if parameters changed.
8. Load memberships with tenant status.
9. Create a session: random 32-byte refresh token, store its SHA-256 hash under a new `familyId`, sign a 15-minute access JWT with `sub`.
10. Set cookies and return `{ user, memberships, activeTenantId, homeRoute }`.

### Cookies

| Cookie | Lifetime | Flags | Path |
|---|---|---|---|
| access | 15 minutes | httpOnly, Secure in production, SameSite=Lax | / |
| refresh | 14 days | httpOnly, Secure, SameSite=Lax | /api/v1/auth |

### Refresh

1. Hash the refresh cookie and find the row.
2. Missing: 401, clear cookies.
3. Already used or revoked: revoke the whole family, 401.
4. Expired: 401.
5. User inactive: revoke the family, 401.
6. Mark the row used, insert a new token in the same family, issue a new access token, set cookies.

### Logout

Revoke the family of the presented refresh token, clear both cookies, write audit. Succeeds even without a cookie.

### Me

Returns user, each membership with tenant name and status, branches, role permissions from the permission map, the active tenant (from `X-Tenant-Id` if valid, otherwise the first active membership) and `homeRoute`.

| Role | homeRoute |
|---|---|
| OWNER, MANAGER | /dashboard |
| CASHIER | /pos |
| WAITER | /tables |
| KITCHEN_STAFF | /kitchen |
| INVENTORY_MANAGER | /inventory |
| platform SUPER_ADMIN | /admin |

### Forgot and reset

Forgot always returns 200. If the user exists, create a 32-byte token, store its hash with a 30-minute expiry, email a link `APP_ORIGIN/reset-password?token=...`. Reset: hash the token, find an unused unexpired row, set the new password, mark the token used, revoke every refresh family for the user, clear lock state.

### Change password

Requires the current password. Sets the new hash and revokes all other families.

### CSRF

Mutating requests require header `X-Requested-With`, and the `Origin` header must match APP_ORIGIN.

## Frontend logic

### Pages

| Route | Behaviour |
|---|---|
| /signup | Form: name, email, password, business name, branch name. Submits register, then redirects to homeRoute |
| /login | Form: email, password. Submit, then redirect |
| /forgot-password | Email field, always shows "If the account exists, an email was sent" |
| /reset-password | Reads token from the query, new password field |

### Login form

React Hook Form with the same Zod rules. Shows a password toggle, disables the button while pending, sets `autocomplete="email"` and `autocomplete="current-password"`.

| Response | Message |
|---|---|
| 401 | Invalid email or password |
| 429 | Too many attempts. Try again later |
| network error | You appear to be offline |
| 403 TENANT_SUSPENDED | This business account is suspended |

### Redirect

```ts
const next = searchParams.get("next");
const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
router.replace(safe ?? session.homeRoute);
```

### Session provider

Loads `/auth/me` once with a long `staleTime`. Exposes user, memberships, activeTenant, role, permissions, branches, `useCan(permission)` and `<Can permission>`. Choosing a business: one membership is selected automatically, several use the last used value if still valid or show a picker. The active tenant ID is stored in localStorage and sent as `X-Tenant-Id`.

### Route protection

`middleware.ts` redirects unauthenticated users to `/login?next=<path>` and signed-in users away from `/login`. The (dashboard) layout checks required permission and renders `/no-access` otherwise.

### Offline rule

If a refresh fails because the network is down, the POS stays usable and queues orders. Logout happens only when the server answers 401 to a refresh.

### Logout

Calls `POST /auth/logout`, clears the query cache and tenant selection, goes to `/login`. If the offline queue has pending orders, a confirmation dialog warns first.

## Edge cases

| Case | Handling |
|---|---|
| Deactivated staff | Next refresh fails, user is signed out |
| Suspended business | Login works, business routes return TENANT_SUSPENDED and the UI shows a suspended page |
| User with no membership | Redirect to onboarding |
| Role changed mid-session | Permissions are read from the database on each request, effective immediately |
| Two tabs | One shared refresh through the single-flight lock, refetch /auth/me on window focus |

## Tests

Same error and status for unknown email and wrong password. Sixth failed attempt locks. Refresh rotates and reuse revokes the family. Deactivated user cannot refresh. Parallel 401s trigger one refresh. `next=//evil.com` is ignored. Registration rolls back fully if any step fails. Password reset revokes sessions.
