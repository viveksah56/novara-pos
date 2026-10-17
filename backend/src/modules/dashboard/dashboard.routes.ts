import { Router } from "express";
import { z } from "zod";
import { HttpError } from "@lib/http-error.js";
import { sendSuccess } from "@lib/response.js";
import { requireAuth } from "@middleware/auth.js";
import { getDashboard, type DashboardView } from "@modules/dashboard/dashboard.service.js";

const querySchema = z.object({ tenantId: z.string().uuid().optional(), branchId: z.union([z.string().uuid(), z.literal("all")]).optional() });
export const dashboardRouter = Router();
dashboardRouter.get("/:view", requireAuth, async (request, response) => {
  const viewParam = request.params.view;
  const view = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  if (!view || !["overview", "pos", "kitchen", "inventory", "admin"].includes(view)) {
    throw new HttpError(404, "NOT_FOUND", "Dashboard not found.");
  }
  const query = querySchema.parse(request.query);
  const userId = request.auth?.userId;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  const data = await getDashboard(userId, view as DashboardView, query.tenantId, query.branchId);
  sendSuccess(response, data);
});
