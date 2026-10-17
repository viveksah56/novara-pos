import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import { env } from "@config/env.js";
import { errorEnvelope } from "@lib/response.js";
import { optionalAuth, requireAuth } from "@middleware/auth.js";
import { validateBody } from "@middleware/validate.js";
import { acceptTeamInvitationController, changePasswordController, forgotPasswordController, loginController, logoutController, meController, refreshController, registerController, resetPasswordController, teamInvitationPreviewController } from "@modules/auth/auth.controller.js";
import { acceptInvitationSchema, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@modules/auth/auth.schemas.js";

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Keep production protection strict while allowing repeated role/account
  // switching during local development without locking out the shared demo IP.
  limit: env.isProd ? 12 : 120,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (request, response) => {
    response.status(429).json(errorEnvelope("RATE_LIMITED", "Too many attempts. Please wait and try again.", request.id));
  },
});

export const authRouter = Router();

const credentialRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 10 : 50,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (request) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "unknown";
    return `${ipKeyGenerator(request.ip ?? "0.0.0.0")}:${email}`;
  },
  handler: (request, response) => response.status(429).json(errorEnvelope("RATE_LIMITED", "Too many attempts. Please wait and try again.", request.id)),
});

authRouter.post("/register", authRateLimit, validateBody(registerSchema), registerController);
authRouter.post("/login", authRateLimit, credentialRateLimit, validateBody(loginSchema), loginController);
authRouter.post("/refresh", authRateLimit, refreshController);
authRouter.post("/password/forgot", authRateLimit, credentialRateLimit, validateBody(forgotPasswordSchema), forgotPasswordController);
authRouter.post("/password/reset", authRateLimit, validateBody(resetPasswordSchema), resetPasswordController);
authRouter.get("/team-invitations/:token", authRateLimit, teamInvitationPreviewController);
authRouter.post("/team-invitations/accept", authRateLimit, credentialRateLimit, optionalAuth, validateBody(acceptInvitationSchema), acceptTeamInvitationController);
authRouter.post("/password/change", requireAuth, validateBody(changePasswordSchema), changePasswordController);
authRouter.post("/logout", logoutController);
authRouter.get("/me", requireAuth, meController);
