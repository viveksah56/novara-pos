import type { PlatformRole } from "@/features/platform/api";
import type { PlatformSection } from "@/features/platform/types";

/** Heading and subheading shown in the header and page title for each section. */
export function getPageMeta(section: PlatformSection, platformRole: PlatformRole) {
  const title = section === "overview" ? "Platform overview" : section === "businesses" ? "Businesses" : section === "business-detail" ? "Business details" : section === "plans" ? "Plans & billing" : section === "system" ? "System health" : section === "tickets" ? "Complaints & feedback" : platformRole === "SUPER_ADMIN" ? "Support staff" : "Support workspace";
  const description = section === "overview" ? "A live view of businesses, accounts and the Novara platform." : section === "businesses" ? "Search, inspect and manage every business on Novara." : section === "business-detail" ? "Review business status, branches, plan and team access." : section === "plans" ? "Set the plans available to businesses and control plan availability." : section === "system" ? "Service health and runtime status for the platform." : section === "tickets" ? "Triage customer complaints, feedback and support requests." : platformRole === "SUPER_ADMIN" ? "Manage the people who help Novara customers." : "Search business workspaces and review account context for customer support.";
  return { title, description };
}
