import type { DashboardView } from "@/features/dashboard/api";

export const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  MANAGER: "/dashboard",
  CASHIER: "/pos",
  WAITER: "/tables",
  KITCHEN_STAFF: "/kitchen",
  INVENTORY_MANAGER: "/inventory",
  PLATFORM_ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
  SUPPORT_AGENT: "/admin/support",
};

export const viewByRole: Record<string, DashboardView> = {
  OWNER: "overview",
  MANAGER: "overview",
  CASHIER: "pos",
  WAITER: "pos",
  KITCHEN_STAFF: "kitchen",
  INVENTORY_MANAGER: "inventory",
  PLATFORM_ADMIN: "admin",
  SUPER_ADMIN: "admin",
  SUPPORT_AGENT: "admin",
};
export const viewsByRole: Record<string, DashboardView[]> = {
  OWNER: ["overview", "pos", "inventory"],
  MANAGER: ["overview", "pos", "inventory"],
  CASHIER: ["pos"],
  WAITER: ["pos"],
  KITCHEN_STAFF: ["kitchen"],
  INVENTORY_MANAGER: ["inventory"],
  PLATFORM_ADMIN: ["admin"],
  SUPER_ADMIN: ["admin"],
  SUPPORT_AGENT: ["admin"],
};
export const roleTitles: Record<string, string> = {
  OWNER: "Business overview",
  MANAGER: "Branch overview",
  CASHIER: "Point of sale",
  WAITER: "Service floor",
  KITCHEN_STAFF: "Kitchen queue",
  INVENTORY_MANAGER: "Stock overview",
  PLATFORM_ADMIN: "Platform overview",
  SUPER_ADMIN: "Platform overview",
  SUPPORT_AGENT: "Support workspace",
};
export const roleDescriptions: Record<string, string> = {
  OWNER: "A clear view of how your business is performing.",
  MANAGER: "Your branch, at a glance.",
  CASHIER: "Your register and today’s service.",
  WAITER: "Keep tables and orders moving.",
  KITCHEN_STAFF: "Prepare every order with the team.",
  INVENTORY_MANAGER: "Stock health across your operation.",
  PLATFORM_ADMIN: "The Novara platform, at a glance.",
  SUPER_ADMIN: "The Novara platform, at a glance.",
  SUPPORT_AGENT: "Help Novara customers with their workspace.",
};

export function roleName(role: string) {
  return role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
