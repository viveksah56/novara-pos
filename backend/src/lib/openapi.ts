import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { acceptInvitationSchema, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@modules/auth/auth.schemas.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();
const roleSchema = z.enum(["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF", "INVENTORY_MANAGER"]);
const dashboardViewSchema = z.enum(["overview", "pos", "kitchen", "inventory", "admin"]);
const branchSchema = z.object({ id: z.string().uuid(), name: z.string(), code: z.string(), timezone: z.string() });
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  platformRole: z.enum(["SUPER_ADMIN", "SUPPORT_AGENT"]).nullable(),
  isPlatformAdmin: z.boolean(),
  memberships: z.array(z.object({
    id: z.string().uuid(),
    role: roleSchema,
    tenant: z.object({
      id: z.string().uuid(),
      name: z.string(),
      status: z.enum(["ACTIVE", "SUSPENDED"]),
      currency: z.string(),
      branches: z.array(branchSchema),
    }),
    branchAssignments: z.array(z.object({ branchId: z.string().uuid() })),
  })),
});
const successSchema = <T extends z.ZodType>(data: T) => z.object({ data, status: z.literal("success") });
const authSessionSchema = z.object({ user: userSchema, activeTenantId: z.string().uuid().nullable(), homeRoute: z.string() });
const errorSchema = z.object({
  data: z.null(),
  status: z.literal("error"),
  error: z.object({ code: z.string(), message: z.string(), details: z.record(z.string(), z.array(z.string())).optional(), requestId: z.string().optional() }),
});
const jsonResponse = (schema: z.ZodType, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const authCookie = registry.registerComponent("securitySchemes", "accessCookie", {
  type: "apiKey",
  in: "cookie",
  name: "novara_access",
});

const tenantProfile = z.object({
  id: z.string().uuid(), name: z.string(), slug: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]), currency: z.string(),
  legalName: z.string().nullable(), phone: z.string().nullable(), email: z.string().nullable(), address: z.string().nullable(), logoUrl: z.string().nullable(),
  createdAt: z.string().datetime().optional(), updatedAt: z.string().datetime().optional(),
});
const branchSettings = z.object({
  name: z.string().min(2).max(120), code: z.string().regex(/^[A-Z]{2,4}$/), address: z.string().max(500).nullable().optional(), phone: z.string().max(40).nullable().optional(),
  timezone: z.string().min(1).max(64), currency: z.string().regex(/^[A-Z]{3}$/).optional(), taxRate: z.number().min(0).max(100).optional(), taxInclusive: z.boolean().optional(),
  serviceChargeRate: z.number().min(0).max(100).optional(), taxRegistrationNumber: z.string().max(80).nullable().optional(), receiptHeader: z.string().max(500).nullable().optional(), receiptFooter: z.string().max(500).nullable().optional(),
  businessDayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), allowNegativeStock: z.boolean().optional(), requireShift: z.boolean().optional(), requirePaymentReference: z.boolean().optional(),
  shiftVarianceTolerance: z.number().min(0).optional(), cashierMaxDiscountPercent: z.number().min(0).max(100).optional(),
});
const branchRecord = z.object({
  id: z.string().uuid(), tenantId: z.string().uuid(), name: z.string(), code: z.string(), address: z.string().nullable(), phone: z.string().nullable(), timezone: z.string(), currency: z.string(),
  taxRate: z.union([z.number(), z.string()]), taxInclusive: z.boolean(), serviceChargeRate: z.union([z.number(), z.string()]), taxRegistrationNumber: z.string().nullable(), receiptHeader: z.string().nullable(), receiptFooter: z.string().nullable(), businessDayStart: z.string(),
  allowNegativeStock: z.boolean(), requireShift: z.boolean(), requirePaymentReference: z.boolean(), shiftVarianceTolerance: z.union([z.number(), z.string()]), cashierMaxDiscountPercent: z.union([z.number(), z.string()]), isActive: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
const tenantHeader = z.object({ "x-tenant-id": z.string().uuid() });
const branchCreate = branchSettings.extend({ code: z.string().regex(/^[A-Z]{2,4}$/) });

registry.registerPath({ method: "get", path: "/tenants/current", summary: "Get current business profile", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader }, responses: { 200: jsonResponse(successSchema(z.object({ tenant: tenantProfile })), "Business profile."), 403: jsonResponse(errorSchema, "Membership or role is not permitted."), 400: jsonResponse(errorSchema, "Tenant context is required.") } });
registry.registerPath({ method: "patch", path: "/tenants/current", summary: "Update current business profile", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader, body: { content: { "application/json": { schema: z.object({ name: z.string().trim().min(2).max(160).optional(), legalName: z.string().max(180).nullable().optional(), phone: z.string().max(40).nullable().optional(), email: z.union([z.string().email(), z.literal("")]).nullable().optional(), address: z.string().max(500).nullable().optional(), logoUrl: z.union([z.string().url(), z.literal("")]).nullable().optional() }) } } } }, responses: { 200: jsonResponse(successSchema(z.object({ tenant: tenantProfile })), "Business profile updated; slug remains unchanged."), 403: jsonResponse(errorSchema, "Only an owner can update business details.") } });
registry.registerPath({ method: "get", path: "/branches", summary: "List branches in the signed-in user's tenant scope", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader, query: z.object({ includeInactive: z.enum(["true", "false"]).optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ branches: z.array(branchRecord) })), "Active branches or owner-visible inactive branches."), 403: jsonResponse(errorSchema, "Tenant access denied.") } });
registry.registerPath({ method: "post", path: "/branches", summary: "Create branch under the active plan limit", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader, body: { content: { "application/json": { schema: branchCreate } } } }, responses: { 201: jsonResponse(successSchema(z.object({ branch: branchRecord })), "Branch created and audited."), 402: jsonResponse(errorSchema, "Active plan branch limit reached."), 409: jsonResponse(errorSchema, "Branch name or code already exists."), 403: jsonResponse(errorSchema, "Only an owner can create branches.") } });
registry.registerPath({ method: "get", path: "/branches/{id}", summary: "Get branch settings in the user's access scope", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader, params: z.object({ id: z.string().uuid() }) }, responses: { 200: jsonResponse(successSchema(z.object({ branch: branchRecord })), "Branch settings."), 404: jsonResponse(errorSchema, "Branch not found in this scope.") } });
registry.registerPath({ method: "patch", path: "/branches/{id}", summary: "Update branch operational and receipt settings", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader, params: z.object({ id: z.string().uuid() }), body: { content: { "application/json": { schema: branchSettings.partial() } } } }, responses: { 200: jsonResponse(successSchema(z.object({ branch: branchRecord })), "Branch updated; the before and after state is audited."), 409: jsonResponse(errorSchema, "Branch name or code already exists."), 403: jsonResponse(errorSchema, "Only an owner can update branch settings.") } });
registry.registerPath({ method: "post", path: "/branches/{id}/deactivate", summary: "Deactivate branch while preserving history", security: [{ [authCookie.name]: [] }], request: { headers: tenantHeader, params: z.object({ id: z.string().uuid() }) }, responses: { 200: jsonResponse(successSchema(z.object({ branch: branchRecord, deactivated: z.boolean() })), "Branch deactivated."), 409: jsonResponse(errorSchema, "Cannot deactivate the last branch or a branch with open operations."), 403: jsonResponse(errorSchema, "Only an owner can deactivate branches.") } });

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Create a user, tenant, first branch, and owner membership",
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: {
    201: jsonResponse(successSchema(authSessionSchema), "Account and workspace created; session cookies set."),
    400: jsonResponse(errorSchema, "Invalid registration input."),
    409: jsonResponse(errorSchema, "Account already exists."),
  },
});

registry.registerPath({
  method: "get",
  path: "/dashboard/{view}",
  summary: "Read a role-specific, access-scoped dashboard",
  security: [{ [authCookie.name]: [] }],
  request: {
    params: z.object({ view: dashboardViewSchema }),
    query: z.object({ tenantId: z.string().uuid().optional(), branchId: z.union([z.string().uuid(), z.literal("all")]).optional() }),
  },
  responses: {
    200: jsonResponse(successSchema(z.object({
      view: dashboardViewSchema,
      role: z.enum(["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF", "INVENTORY_MANAGER", "PLATFORM_ADMIN"]),
      tenant: z.object({ id: z.string().uuid(), name: z.string(), currency: z.string() }).optional(),
      branches: z.array(z.object({ id: z.string().uuid(), name: z.string() })).optional(),
      activeBranch: z.object({ id: z.string().uuid(), name: z.string() }).optional(),
      permissions: z.object({ reportsSalesRead: z.boolean(), reportsProfitRead: z.boolean(), staffRead: z.boolean(), inventoryRead: z.boolean() }).optional(),
      metrics: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
      trend: z.array(z.object({ day: z.number(), sales: z.number() })).optional(),
      activity: z.array(z.unknown()).optional(),
      dataStatus: z.literal("NO_OPERATIONAL_DATA").optional(),
      businessesList: z.array(z.object({ id: z.string().uuid(), name: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]), createdAt: z.string().datetime() })).optional(),
    })), "Role-specific dashboard data."),
    401: jsonResponse(errorSchema, "Not signed in."),
    403: jsonResponse(errorSchema, "The account is not permitted to read this dashboard or branch."),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Sign in and create a cookie session",
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: jsonResponse(successSchema(authSessionSchema), "Signed in; session cookies set."),
    400: jsonResponse(errorSchema, "Invalid login input."),
    401: jsonResponse(errorSchema, "Credentials are invalid."),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Rotate the refresh token",
  responses: {
    200: jsonResponse(successSchema(z.object({ authenticated: z.literal(true) })), "Session refreshed; cookies rotated."),
    401: jsonResponse(errorSchema, "Refresh token is invalid, expired, or reused."),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Revoke the refresh-token family and clear cookies",
  responses: { 200: jsonResponse(successSchema(z.object({ loggedOut: z.literal(true) })), "Signed out.") },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  summary: "Return the signed-in user and tenant memberships",
  security: [{ [authCookie.name]: [] }],
  responses: {
    200: jsonResponse(successSchema(authSessionSchema), "Current account profile and active workspace."),
    401: jsonResponse(errorSchema, "Not signed in."),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password/forgot",
  summary: "Send a time-limited password reset link when the account exists",
  request: { body: { content: { "application/json": { schema: forgotPasswordSchema } } } },
  responses: {
    200: jsonResponse(successSchema(z.object({ message: z.string() })), "Always returns the same response to prevent account enumeration."),
    429: jsonResponse(errorSchema, "Too many password recovery attempts."),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password/reset",
  summary: "Set a new password using a one-time reset token",
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: jsonResponse(successSchema(z.object({ passwordReset: z.literal(true) })), "Password changed and active refresh sessions revoked."),
    400: jsonResponse(errorSchema, "The reset token is invalid or expired."),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password/change",
  summary: "Change the signed-in user's password",
  security: [{ [authCookie.name]: [] }],
  request: { body: { content: { "application/json": { schema: changePasswordSchema } } } },
  responses: {
    200: jsonResponse(successSchema(z.object({ passwordChanged: z.literal(true) })), "Password changed and all sessions revoked."),
    401: jsonResponse(errorSchema, "Not signed in or current password is incorrect."),
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/team-invitations/{token}",
  summary: "Preview an invitation before accepting it",
  request: { params: z.object({ token: z.string().min(32).max(512) }) },
  responses: { 200: jsonResponse(successSchema(z.object({ invitation: z.object({ email: z.string().email(), role: roleSchema, businessName: z.string(), branches: z.array(z.string()), expiresAt: z.string().datetime() }) })), "Invitation details."), 404: jsonResponse(errorSchema, "Invitation is invalid, expired, revoked, or already used.") },
});
registry.registerPath({
  method: "post",
  path: "/auth/team-invitations/accept",
  summary: "Accept an invitation, creating an account when needed",
  request: { body: { content: { "application/json": { schema: acceptInvitationSchema } } } },
  responses: { 200: jsonResponse(successSchema(z.object({ accepted: z.literal(true), invitation: z.object({ tenantId: z.string().uuid(), businessName: z.string(), role: roleSchema }), user: userSchema, activeTenantId: z.string().uuid().nullable(), homeRoute: z.string() })), "Invitation accepted; new accounts also receive session cookies."), 401: jsonResponse(errorSchema, "Sign in with the email address that received this invitation."), 409: jsonResponse(errorSchema, "An active membership already exists or invitation state conflicts.") },
});

const teamInvitationBody = z.object({ email: z.string().email(), role: roleSchema, branchIds: z.array(z.string().uuid()).min(1).max(100) });
registry.registerPath({
  method: "get",
  path: "/tenants/{tenantId}/team/invitations",
  summary: "List pending invitations in the caller's authorized branch scope",
  security: [{ [authCookie.name]: [] }],
  request: { params: z.object({ tenantId: z.string().uuid() }) },
  responses: { 200: jsonResponse(successSchema(z.object({ invitations: z.array(z.unknown()) })), "Pending team invitations."), 403: jsonResponse(errorSchema, "Owner or Manager role is required.") },
});
registry.registerPath({
  method: "post",
  path: "/tenants/{tenantId}/team/invitations",
  summary: "Invite a team member with a branch-scoped, single-use token",
  security: [{ [authCookie.name]: [] }],
  request: { params: z.object({ tenantId: z.string().uuid() }), body: { content: { "application/json": { schema: teamInvitationBody } } } },
  responses: { 201: jsonResponse(successSchema(z.object({ invitation: z.unknown() })), "Invitation created and sent by email."), 402: jsonResponse(errorSchema, "Plan staff limit has been reached."), 403: jsonResponse(errorSchema, "Role or branch scope is not permitted.") },
});
registry.registerPath({
  method: "delete",
  path: "/tenants/{tenantId}/team/invitations/{invitationId}",
  summary: "Revoke a pending team invitation",
  security: [{ [authCookie.name]: [] }],
  request: { params: z.object({ tenantId: z.string().uuid(), invitationId: z.string().uuid() }) },
  responses: { 200: jsonResponse(successSchema(z.object({ invitationId: z.string().uuid(), revoked: z.literal(true) })), "Invitation revoked."), 403: jsonResponse(errorSchema, "Role or branch scope is not permitted."), 404: jsonResponse(errorSchema, "Pending invitation not found.") },
});
registry.registerPath({
  method: "patch",
  path: "/tenants/{tenantId}/team/{membershipId}",
  summary: "Update membership role and/or branch scope",
  security: [{ [authCookie.name]: [] }],
  request: { params: z.object({ tenantId: z.string().uuid(), membershipId: z.string().uuid() }), body: { content: { "application/json": { schema: z.object({ role: roleSchema.optional(), branchIds: z.array(z.string().uuid()).min(1).max(100).optional() }).refine((body) => body.role !== undefined || body.branchIds !== undefined) } } } },
  responses: { 200: jsonResponse(successSchema(z.object({ membership: z.unknown() })), "Membership updated and audited."), 403: jsonResponse(errorSchema, "Role grant or branch scope is not permitted."), 409: jsonResponse(errorSchema, "A last Owner cannot be demoted.") },
});
registry.registerPath({
  method: "delete",
  path: "/tenants/{tenantId}/team/{membershipId}",
  summary: "Deactivate membership access without deleting history",
  security: [{ [authCookie.name]: [] }],
  request: { params: z.object({ tenantId: z.string().uuid(), membershipId: z.string().uuid() }) },
  responses: { 200: jsonResponse(successSchema(z.object({ membershipId: z.string().uuid(), isActive: z.literal(false) })), "Membership deactivated."), 403: jsonResponse(errorSchema, "Role or branch scope is not permitted."), 409: jsonResponse(errorSchema, "Last Owner or open shift rules prevent deactivation.") },
});
registry.registerPath({
  method: "post",
  path: "/tenants/{tenantId}/team/{membershipId}/reactivate",
  summary: "Reactivate a deactivated membership",
  security: [{ [authCookie.name]: [] }],
  request: { params: z.object({ tenantId: z.string().uuid(), membershipId: z.string().uuid() }) },
  responses: { 200: jsonResponse(successSchema(z.object({ membershipId: z.string().uuid(), isActive: z.literal(true) })), "Membership reactivated."), 403: jsonResponse(errorSchema, "Role or branch scope is not permitted.") },
});

const paymentMethodSchema = z.enum(["CASH", "CARD", "BANK_TRANSFER", "DIGITAL_WALLET", "OTHER"]);
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/orders", summary: "Create a POS order with server-calculated prices and optional offline idempotency", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), headers: z.object({ "idempotency-key": z.string().min(8).max(80).optional(), "x-offline-order": z.literal("1").optional(), "x-offline-created-at": z.string().datetime().optional() }), body: { content: { "application/json": { schema: z.object({ branchId: z.string().uuid(), tableId: z.string().uuid().optional(), guestCount: z.number().int().min(1).max(100).optional(), clientOrderId: z.string().min(8).max(80).optional(), clientCreatedAt: z.string().datetime().optional(), items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive().max(100), optionIds: z.array(z.string().uuid()).max(20).default([]), note: z.string().max(200).optional() })).min(1).max(100) }) } } } }, responses: { 201: jsonResponse(successSchema(z.object({ order: z.unknown() })), "Order created with current server pricing."), 422: jsonResponse(errorSchema, "Idempotency key was reused with a different payload.") } });
const tableParams = z.object({ tenantId: z.string().uuid(), id: z.string().uuid() });
const tableInput = z.object({ branchId: z.string().uuid(), name: z.string().trim().min(1).max(80), section: z.string().max(100).nullable().optional(), seats: z.number().int().min(1).max(100).default(2), sortOrder: z.number().int().min(0).default(0), isActive: z.boolean().default(true) });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/tables", summary: "List accessible branch tables with derived occupancy", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ tables: z.array(z.unknown()) })), "Tables and open-order summary; status is derived."), 403: jsonResponse(errorSchema, "Table access is denied.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/tables", summary: "Create a dining table", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), body: { content: { "application/json": { schema: tableInput } } } }, responses: { 201: jsonResponse(successSchema(z.object({ table: z.unknown() })), "Table created."), 403: jsonResponse(errorSchema, "Only Owners and Managers can manage tables.") } });
registry.registerPath({ method: "patch", path: "/tenants/{tenantId}/tables/{id}", summary: "Update table details or deactivate an unused table", security: [{ [authCookie.name]: [] }], request: { params: tableParams, body: { content: { "application/json": { schema: tableInput.omit({ branchId: true }).partial() } } } }, responses: { 200: jsonResponse(successSchema(z.object({ table: z.unknown() })), "Table updated."), 409: jsonResponse(errorSchema, "An active order prevents deactivation.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/orders/{id}/send-to-kitchen", summary: "Send only unsent order items to the kitchen", security: [{ [authCookie.name]: [] }], request: { params: tableParams }, responses: { 200: jsonResponse(successSchema(z.object({ items: z.array(z.unknown()) })), "Items sent to kitchen."), 409: jsonResponse(errorSchema, "Order is not open.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/orders/{id}/request-bill", summary: "Mark an open table order as bill requested", security: [{ [authCookie.name]: [] }], request: { params: tableParams }, responses: { 200: jsonResponse(successSchema(z.object({ order: z.unknown() })), "Bill request recorded.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/kitchen/queue", summary: "Read oldest active kitchen items grouped into tickets", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional(), station: z.string().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ tickets: z.array(z.unknown()) })), "Active unsatisfied kitchen items, scoped by branch.") } });
registry.registerPath({ method: "patch", path: "/tenants/{tenantId}/kitchen/items/{id}", summary: "Advance a kitchen item one step or manager-reset it with a reason", security: [{ [authCookie.name]: [] }], request: { params: tableParams, body: { content: { "application/json": { schema: z.object({ status: z.enum(["NEW", "PREPARING", "READY"]), reason: z.string().min(3).max(300).optional() }) } } } }, responses: { 200: jsonResponse(successSchema(z.object({ item: z.unknown() })), "Kitchen item updated."), 409: jsonResponse(errorSchema, "Kitchen transition must follow New → Preparing → Ready."), 403: jsonResponse(errorSchema, "Kitchen role cannot mark items served or reset them.") } });
registry.registerPath({ method: "patch", path: "/tenants/{tenantId}/orders/{id}/items/{itemId}/served", summary: "Mark a ready order item served", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid(), id: z.string().uuid(), itemId: z.string().uuid() }) }, responses: { 200: jsonResponse(successSchema(z.object({ item: z.unknown() })), "Item marked served."), 409: jsonResponse(errorSchema, "Only ready items may be served.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/orders/ready", summary: "List ready items for waiter service", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ items: z.array(z.unknown()) })), "Ready items in accessible branches.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/orders/{id}/items", summary: "Append priced items to an existing open table order", security: [{ [authCookie.name]: [] }], request: { params: tableParams, body: { content: { "application/json": { schema: z.object({ items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive().max(100), optionIds: z.array(z.string().uuid()).max(20).default([]), note: z.string().max(200).optional() })).min(1).max(100) }) } } } }, responses: { 200: jsonResponse(successSchema(z.object({ order: z.unknown() })), "Items, modifiers and recalculated totals saved atomically."), 409: jsonResponse(errorSchema, "Only open orders can receive additional items.") } });
registry.registerPath({
  method: "post",
  path: "/tenants/{tenantId}/orders/{id}/complete",
  summary: "Complete an order with cash or split tender and deduct recipe stock atomically",
  security: [{ [authCookie.name]: [] }],
  request: {
    params: z.object({ tenantId: z.string().uuid(), id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({
      method: paymentMethodSchema.optional(),
      cashReceived: z.number().nonnegative().optional(),
      reference: z.string().max(120).optional(),
      payments: z.array(z.object({ method: paymentMethodSchema, amount: z.number().positive(), tendered: z.number().nonnegative().optional(), reference: z.string().max(120).optional() })).max(10).optional(),
    }) } } },
  },
  responses: {
    200: jsonResponse(successSchema(z.object({ order: z.unknown() })), "Order completed and payment rows saved."),
    400: jsonResponse(errorSchema, "Payment is invalid, insufficient, or exceeds the order amount."),
    409: jsonResponse(errorSchema, "Order is not open, shift is required, or stock is insufficient."),
  },
});
registry.registerPath({
  method: "post",
  path: "/tenants/{tenantId}/orders/{id}/refunds",
  summary: "Issue an Owner or Manager approved full or partial refund",
  security: [{ [authCookie.name]: [] }],
  request: {
    params: z.object({ tenantId: z.string().uuid(), id: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({
      reason: z.string().min(3).max(500), restock: z.boolean().default(false), method: paymentMethodSchema.default("CASH"),
      items: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.number().positive() })).min(1).max(100),
    }) } } },
  },
  responses: {
    201: jsonResponse(successSchema(z.object({ refund: z.unknown() })), "Refund recorded and order status updated."),
    403: jsonResponse(errorSchema, "Only an Owner or Manager may issue a refund."),
    409: jsonResponse(errorSchema, "Refund amount or item quantities exceed the remaining refundable amount."),
  },
});

const expenseIdParams = z.object({ tenantId: z.string().uuid(), id: z.string().uuid() });
const stocktakeParams = z.object({ tenantId: z.string().uuid(), id: z.string().uuid() });
const expenseCategoryInput = z.object({ name: z.string().trim().min(2).max(100), isActive: z.boolean().optional() });
const expenseInput = z.object({ branchId: z.string().uuid(), categoryId: z.string().uuid(), amount: z.number().positive(), expenseDate: z.iso.date(), description: z.string().min(2).max(1000), paymentMethod: paymentMethodSchema, reference: z.string().max(120).nullable().optional() });
const stocktakeLineInput = z.object({ ingredientId: z.string().uuid(), countedQuantity: z.number().min(0).max(999_999_999.999) });
const stocktakeRecord = z.unknown();
const purchaseItemInput = z.object({ ingredientId: z.string().uuid(), quantity: z.number().positive(), unit: z.enum(["EACH", "GRAM", "KILOGRAM", "MILLILITER", "LITER", "OUNCE", "POUND"]).default("EACH"), unitFactor: z.number().positive().default(1), unitCost: z.number().min(0) });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/purchases", summary: "List purchases scoped to assigned branches", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }) }, responses: { 200: jsonResponse(successSchema(z.object({ purchases: z.array(z.unknown()) })), "Purchase orders and receipt progress.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/purchases", summary: "Create a draft purchase order with purchase units and conversion factors", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), body: { content: { "application/json": { schema: z.object({ branchId: z.string().uuid(), supplierId: z.string().uuid(), reference: z.string().max(80).nullable().optional(), notes: z.string().max(1000).nullable().optional(), items: z.array(purchaseItemInput).min(1).max(100) }) } } } }, responses: { 201: jsonResponse(successSchema(z.object({ purchase: z.unknown() })), "Draft purchase order created.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/purchases/{id}/order", summary: "Place a draft purchase order", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams }, responses: { 200: jsonResponse(successSchema(z.object({ purchase: z.unknown() })), "Purchase placed.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/purchases/{id}/receive", summary: "Receive partial or full purchase quantities and update weighted average cost", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams, body: { content: { "application/json": { schema: z.object({ lines: z.array(z.object({ purchaseItemId: z.string().uuid(), quantity: z.number().positive() })).min(1).max(100) }) } } } }, responses: { 200: jsonResponse(successSchema(z.object({ purchase: z.unknown() })), "Receipt saved; stock levels, weighted cost and movements updated atomically."), 422: jsonResponse(errorSchema, "Received quantity exceeds the outstanding purchase quantity.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/purchases/{id}/cancel", summary: "Cancel a purchase that has no received stock", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams }, responses: { 200: jsonResponse(successSchema(z.object({ purchaseId: z.string().uuid(), cancelled: z.boolean() })), "Purchase cancelled."), 409: jsonResponse(errorSchema, "Purchase is not cancellable.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/stocktakes", summary: "List stocktakes in the caller's accessible branch scope", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ stocktakes: z.array(z.unknown()) })), "Stocktakes with branch, creator and line counts."), 403: jsonResponse(errorSchema, "Inventory access is denied.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/stocktakes", summary: "Start a branch stocktake", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), body: { content: { "application/json": { schema: z.object({ branchId: z.string().uuid(), note: z.string().max(500).optional() }) } } } }, responses: { 201: jsonResponse(successSchema(z.object({ stocktake: stocktakeRecord })), "Draft stocktake started."), 403: jsonResponse(errorSchema, "Inventory access is denied.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/stocktakes/{id}", summary: "Read a scoped stocktake and its ingredient counts", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams }, responses: { 200: jsonResponse(successSchema(z.object({ stocktake: stocktakeRecord })), "Stocktake details."), 404: jsonResponse(errorSchema, "Stocktake not found.") } });
registry.registerPath({ method: "put", path: "/tenants/{tenantId}/stocktakes/{id}/lines", summary: "Save physical counts on a draft stocktake", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams, body: { content: { "application/json": { schema: z.object({ lines: z.array(stocktakeLineInput).min(1).max(500) }) } } } }, responses: { 200: jsonResponse(successSchema(z.object({ stocktake: stocktakeRecord })), "Counts saved with count timestamps."), 409: jsonResponse(errorSchema, "Only draft stocktakes can be counted.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/stocktakes/{id}/submit", summary: "Submit saved counts for owner or manager approval", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams }, responses: { 200: jsonResponse(successSchema(z.object({ stocktake: stocktakeRecord })), "Stocktake submitted."), 409: jsonResponse(errorSchema, "Stocktake is empty or is not a draft.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/stocktakes/{id}/approve", summary: "Approve counts and apply count-time variances atomically", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams }, responses: { 200: jsonResponse(successSchema(z.object({ stocktake: stocktakeRecord })), "Variance movements applied; post-count stock movements are preserved."), 403: jsonResponse(errorSchema, "Only owners and managers can approve stocktakes."), 409: jsonResponse(errorSchema, "Stocktake has not been submitted or was already processed.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/stocktakes/{id}/cancel", summary: "Cancel a draft or submitted stocktake", security: [{ [authCookie.name]: [] }], request: { params: stocktakeParams }, responses: { 200: jsonResponse(successSchema(z.object({ stocktakeId: z.string().uuid(), cancelled: z.boolean() })), "Stocktake cancelled."), 409: jsonResponse(errorSchema, "Approved stocktakes cannot be cancelled.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/inventory/valuation", summary: "Read branch stock valuation using weighted average ingredient costs", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ total: z.string(), byBranch: z.array(z.object({ branchId: z.string().uuid(), branchName: z.string(), value: z.string() })), stock: z.array(z.unknown()) })), "Stock valuation grouped by branch.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/reports/sales", summary: "Read sales and refund totals using each branch business-day calendar", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional(), from: z.iso.date().optional(), to: z.iso.date().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ range: z.object({ from: z.string().datetime(), to: z.string().datetime() }), currency: z.string(), summary: z.unknown(), daily: z.array(z.unknown()), bestSellers: z.array(z.unknown()) })), "Sales report grouped by branch-local business dates."), 403: jsonResponse(errorSchema, "Owner or Manager role is required.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/reports/inventory", summary: "Read low stock alerts, stock valuation and recent movement ledger", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ lowStock: z.array(z.unknown()), movements: z.array(z.unknown()), valuation: z.object({ total: z.string(), currency: z.string() }) })), "Inventory report scoped to accessible branches.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/expense-categories", summary: "List business expense categories", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }) }, responses: { 200: jsonResponse(successSchema(z.object({ categories: z.array(z.unknown()) })), "Expense categories."), 403: jsonResponse(errorSchema, "Only Owners and Managers can read expenses.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/expense-categories", summary: "Create an expense category", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), body: { content: { "application/json": { schema: expenseCategoryInput } } } }, responses: { 201: jsonResponse(successSchema(z.object({ category: z.unknown() })), "Expense category created."), 403: jsonResponse(errorSchema, "Only Owners and Managers can manage expenses.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/expenses", summary: "List branch-scoped expenses with date filters", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), includeVoided: z.enum(["true", "false"]).optional() }) }, responses: { 200: jsonResponse(successSchema(z.object({ expenses: z.array(z.unknown()) })), "Expenses with category, branch, creator and void metadata."), 403: jsonResponse(errorSchema, "Only Owners and Managers can read expenses.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/expenses", summary: "Record an expense and reconcile cash against an open shift", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), body: { content: { "application/json": { schema: expenseInput } } } }, responses: { 201: jsonResponse(successSchema(z.object({ expense: z.unknown() })), "Expense recorded and audit event created."), 400: jsonResponse(errorSchema, "Expense date, branch, category or amount is invalid."), 403: jsonResponse(errorSchema, "Only Owners and Managers can manage expenses.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/expenses/{id}/void", summary: "Void an expense with an auditable reason and reverse cash payout", security: [{ [authCookie.name]: [] }], request: { params: expenseIdParams, body: { content: { "application/json": { schema: z.object({ reason: z.string().trim().min(3).max(500) }) } } } }, responses: { 200: jsonResponse(successSchema(z.object({ expense: z.unknown() })), "Expense voided; a linked cash movement is reversed."), 404: jsonResponse(errorSchema, "Expense not found."), 409: jsonResponse(errorSchema, "Expense has already been voided.") } });
registry.registerPath({ method: "get", path: "/tenants/{tenantId}/reports/expenses", summary: "Read expense totals grouped by category and month", security: [{ [authCookie.name]: [] }], request: { params: z.object({ tenantId: z.string().uuid() }), query: z.object({ branchId: z.string().uuid().optional(), from: z.iso.date(), to: z.iso.date() }) }, responses: { 200: jsonResponse(successSchema(z.object({ range: z.object({ from: z.string().datetime(), to: z.string().datetime() }), total: z.number(), byCategoryAndMonth: z.array(z.object({ categoryId: z.string().uuid(), category: z.string(), month: z.string(), total: z.number() })) })), "Non-voided expenses grouped by category and month."), 403: jsonResponse(errorSchema, "Only Owners and Managers can read expenses.") } });
registry.registerPath({ method: "post", path: "/tenants/{tenantId}/shifts/{id}/cash-movements", summary: "Record an auditable cash pay-in or pay-out against an open shift", security: [{ [authCookie.name]: [] }], request: { params: expenseIdParams, body: { content: { "application/json": { schema: z.object({ type: z.enum(["PAY_IN", "PAY_OUT"]), amount: z.number().positive(), reason: z.string().trim().min(3).max(500) }) } } } }, responses: { 201: jsonResponse(successSchema(z.object({ movement: z.unknown() })), "Movement recorded and the shift cash expectation adjusted."), 403: jsonResponse(errorSchema, "Shift or branch access denied."), 409: jsonResponse(errorSchema, "Shift is closed or the drawer does not have enough expected cash.") } });

export function createOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.3",
    info: { title: "Novara API", version: "1.0.0", description: "Novara cafe and restaurant management API." },
    servers: [{ url: "/api/v1" }],
  });
}
