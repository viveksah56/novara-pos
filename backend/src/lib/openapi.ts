import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { loginSchema, registerSchema } from "@modules/auth/auth.schemas.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();
const roleSchema = z.enum(["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF", "INVENTORY_MANAGER"]);
const dashboardViewSchema = z.enum(["overview", "pos", "kitchen", "inventory", "admin"]);
const branchSchema = z.object({ id: z.string().uuid(), name: z.string(), timezone: z.string() });
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

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Create a user, tenant, first branch, and owner membership",
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: {
    201: jsonResponse(successSchema(z.object({ user: userSchema })), "Account and workspace created; session cookies set."),
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
    200: jsonResponse(successSchema(z.object({ user: userSchema })), "Signed in; session cookies set."),
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
    200: jsonResponse(successSchema(z.object({ user: userSchema })), "Current account profile."),
    401: jsonResponse(errorSchema, "Not signed in."),
  },
});

export function createOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.3",
    info: { title: "Novara API", version: "1.0.0", description: "Novara cafe and restaurant management API." },
    servers: [{ url: "/api/v1" }],
  });
}
