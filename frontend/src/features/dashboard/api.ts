import { apiClient, apiRequest } from "@/lib/api-client";

export type DashboardView = "overview" | "pos" | "kitchen" | "inventory" | "admin";
export type DashboardPayload = {
  view: DashboardView;
  role: "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN_STAFF" | "INVENTORY_MANAGER" | "PLATFORM_ADMIN";
  tenant?: { id: string; name: string; currency: string };
  branches?: { id: string; name: string }[];
  activeBranch?: { id: string; name: string; timezone?: string };
  permissions?: { reportsSalesRead: boolean; reportsProfitRead: boolean; staffRead: boolean; inventoryRead: boolean };
  metrics: Record<string, number | string | null>;
  trend?: { day: number; sales: number }[];
  shiftAlerts?: { id: string; closedAt: string | null; cashVariance: number | string; branch: { name: string }; user: { name: string } }[];
  activity?: unknown[];
  dataStatus?: "NO_OPERATIONAL_DATA";
  businessesList?: { id: string; name: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string }[];
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  view: (view: DashboardView, tenantId?: string, branchId?: string) => ["dashboard", view, tenantId, branchId] as const,
};

export async function getDashboard(view: DashboardView, tenantId?: string, branchId?: string): Promise<DashboardPayload> {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (branchId) params.set("branchId", branchId);
  const query = params.size ? `?${params.toString()}` : "";
  return apiRequest<DashboardPayload>(apiClient.get(`/dashboard/${view}${query}`));
}
