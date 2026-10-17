import { Router } from "express";

import { authRouter } from "@modules/auth/auth.routes.js";
import { dashboardRouter } from "@modules/dashboard/dashboard.routes.js";
import { platformRouter } from "@modules/platform/platform.routes.js";
import { operationsRouter } from "@modules/operations/operations.routes.js";
import { createOpenApiDocument } from "@lib/openapi.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/platform", platformRouter);
apiRouter.use("/tenants", operationsRouter);
apiRouter.get("/openapi.json", (_request, response) => {
  response.setHeader("Cache-Control", "public, max-age=300");
  response.json(createOpenApiDocument());
});
