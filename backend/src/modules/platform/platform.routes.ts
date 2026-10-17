import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "@lib/response.js";
import { HttpError } from "@lib/http-error.js";
import { prisma } from "@lib/prisma.js";
import { requireAuth } from "@middleware/auth.js";
import { requirePlatformRole } from "@middleware/platform-auth.js";
import {
  addSupportAgent, createPlan, deletePlan, getBusiness, getPlatformOverview,
  getSystemHealth, listBusinesses, listPlans, listSupportAgents, removeSupportAgent,
  searchPlatform, updateBusiness, updatePlan,
  createPlatformTicket, listMyPlatformTickets, listPlatformTickets, updatePlatformTicket,
  listTenantComplaints, updateTenantComplaint,
} from "@modules/platform/platform.service.js";

const idSchema = z.string().uuid();
const statusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
const planFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  priceMonthly: z.number().min(0).max(100_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  trialDays: z.number().int().min(0).max(365),
  maxBranches: z.number().int().positive().nullable(),
  maxStaff: z.number().int().positive().nullable(),
};
const createPlanSchema = z.object(planFields);
const updatePlanSchema = z.object({ ...planFields, isActive: z.boolean() }).partial().refine((value) => Object.keys(value).length > 0);

export const platformRouter = Router();
platformRouter.get("/public-plans", async (_request, response) => {
  const plans = await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" }, select: { id: true, name: true, description: true, priceMonthly: true, currency: true, trialDays: true, maxBranches: true, maxStaff: true } });
  sendSuccess(response, { plans });
});

platformRouter.use(requireAuth);

platformRouter.post("/feedback", async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  const input = z.object({ tenantId: idSchema.optional(), type: z.enum(["COMPLAINT", "FEEDBACK", "SUPPORT"]), subject: z.string().trim().min(4).max(160), message: z.string().trim().min(10).max(5000) }).superRefine((value, context) => {
    if (value.type === "COMPLAINT" && !value.tenantId) context.addIssue({ code: "custom", path: ["tenantId"], message: "A complaint must be linked to a business workspace." });
  }).parse(request.body);
  sendSuccess(response, { ticket: await createPlatformTicket(userId, input) }, 201);
});

platformRouter.get("/my-feedback", async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  sendSuccess(response, { tickets: await listMyPlatformTickets(userId) });
});

platformRouter.get("/businesses/:tenantId/complaints", async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  const tenantId = idSchema.parse(Array.isArray(request.params.tenantId) ? request.params.tenantId[0] : request.params.tenantId);
  sendSuccess(response, { tickets: await listTenantComplaints(userId, tenantId) });
});

platformRouter.patch("/businesses/:tenantId/complaints/:ticketId", async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  const tenantId = idSchema.parse(Array.isArray(request.params.tenantId) ? request.params.tenantId[0] : request.params.tenantId);
  const ticketId = idSchema.parse(Array.isArray(request.params.ticketId) ? request.params.ticketId[0] : request.params.ticketId);
  const input = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) }).parse(request.body);
  sendSuccess(response, { ticket: await updateTenantComplaint(userId, tenantId, ticketId, input) });
});

platformRouter.get("/tickets", requirePlatformRole("SUPER_ADMIN", "SUPPORT_AGENT"), async (request, response) => {
  const query = z.object({ q: z.string().trim().max(100).optional() }).parse(request.query);
  sendSuccess(response, { tickets: await listPlatformTickets(query.q) });
});

platformRouter.patch("/tickets/:ticketId", requirePlatformRole("SUPER_ADMIN", "SUPPORT_AGENT"), async (request, response) => {
  const ticketId = idSchema.parse(Array.isArray(request.params.ticketId) ? request.params.ticketId[0] : request.params.ticketId);
  const input = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional() }).parse(request.body);
  sendSuccess(response, { ticket: await updatePlatformTicket(ticketId, input, request.platformRole ?? "SUPPORT_AGENT") });
});

platformRouter.get("/overview", requirePlatformRole("SUPER_ADMIN"), async (_request, response) => {
  sendSuccess(response, await getPlatformOverview());
});

platformRouter.get("/businesses", requirePlatformRole("SUPER_ADMIN", "SUPPORT_AGENT"), async (request, response) => {
  const query = z.object({ q: z.string().trim().max(100).optional() }).parse(request.query);
  sendSuccess(response, { businesses: await listBusinesses(query.q) });
});

platformRouter.get("/businesses/:businessId", requirePlatformRole("SUPER_ADMIN", "SUPPORT_AGENT"), async (request, response) => {
  const businessId = idSchema.parse(Array.isArray(request.params.businessId) ? request.params.businessId[0] : request.params.businessId);
  sendSuccess(response, { business: await getBusiness(businessId) });
});

platformRouter.patch("/businesses/:businessId", requirePlatformRole("SUPER_ADMIN"), async (request, response) => {
  const businessId = idSchema.parse(Array.isArray(request.params.businessId) ? request.params.businessId[0] : request.params.businessId);
  const input = z.object({ status: statusSchema.optional(), planId: idSchema.nullable().optional() }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  sendSuccess(response, { business: await updateBusiness(businessId, input) });
});

platformRouter.get("/plans", requirePlatformRole("SUPER_ADMIN"), async (_request, response) => {
  sendSuccess(response, { plans: await listPlans() });
});

platformRouter.post("/plans", requirePlatformRole("SUPER_ADMIN"), async (request, response) => {
  const input = createPlanSchema.parse(request.body);
  sendSuccess(response, { plan: await createPlan({ ...input, maxBranches: input.maxBranches ?? null, maxStaff: input.maxStaff ?? null }) }, 201);
});

platformRouter.patch("/plans/:planId", requirePlatformRole("SUPER_ADMIN"), async (request, response) => {
  const planId = idSchema.parse(Array.isArray(request.params.planId) ? request.params.planId[0] : request.params.planId);
  const input = updatePlanSchema.parse(request.body);
  sendSuccess(response, { plan: await updatePlan(planId, input) });
});

platformRouter.delete("/plans/:planId", requirePlatformRole("SUPER_ADMIN"), async (request, response) => {
  const planId = idSchema.parse(Array.isArray(request.params.planId) ? request.params.planId[0] : request.params.planId);
  sendSuccess(response, await deletePlan(planId));
});

platformRouter.get("/support-agents", requirePlatformRole("SUPER_ADMIN"), async (_request, response) => {
  sendSuccess(response, { agents: await listSupportAgents() });
});

platformRouter.post("/support-agents", requirePlatformRole("SUPER_ADMIN"), async (request, response) => {
  const { email } = z.object({ email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()) }).parse(request.body);
  sendSuccess(response, { agent: await addSupportAgent(email) }, 201);
});

platformRouter.delete("/support-agents/:userId", requirePlatformRole("SUPER_ADMIN"), async (request, response) => {
  const userId = idSchema.parse(Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId);
  sendSuccess(response, await removeSupportAgent(userId));
});

platformRouter.get("/search", requirePlatformRole("SUPER_ADMIN", "SUPPORT_AGENT"), async (request, response) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(100) }).parse(request.query);
  const canSearchPlans = request.platformRole === "SUPER_ADMIN";
  sendSuccess(response, await searchPlatform(q, canSearchPlans));
});

platformRouter.get("/system-health", requirePlatformRole("SUPER_ADMIN"), async (_request, response) => {
  sendSuccess(response, await getSystemHealth());
});
