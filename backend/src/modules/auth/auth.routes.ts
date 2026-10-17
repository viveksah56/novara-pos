import { Router } from "express";
import rateLimit from "express-rate-limit";

import { errorEnvelope } from "@lib/response.js";
import { requireAuth } from "@middleware/auth.js";
import { validateBody } from "@middleware/validate.js";
import { loginController, logoutController, meController, refreshController, registerController } from "@modules/auth/auth.controller.js";
import { loginSchema, registerSchema } from "@modules/auth/auth.schemas.js";

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (request, response) => {
    response.status(429).json(errorEnvelope("RATE_LIMITED", "Too many attempts. Please wait and try again.", request.id));
  },
});

export const authRouter = Router();

authRouter.post("/register", authRateLimit, validateBody(registerSchema), registerController);
authRouter.post("/login", authRateLimit, validateBody(loginSchema), loginController);
authRouter.post("/refresh", authRateLimit, refreshController);
authRouter.post("/logout", logoutController);
authRouter.get("/me", requireAuth, meController);
