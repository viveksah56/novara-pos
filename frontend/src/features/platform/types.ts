import type { platformApi } from "@/features/platform/api";

export type PlatformSection = "overview" | "businesses" | "business-detail" | "plans" | "system" | "support" | "tickets";

/** Payload accepted when creating or editing a subscription plan. */
export type PlanInput = Parameters<typeof platformApi.createPlan>[0];
