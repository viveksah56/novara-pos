import { apiClient, apiRequest } from "@/lib/api-client";

export type SalesReport = {
  range: { from: string; to: string };
  currency: string;
  summary: { orderCount: number; grossSales: number; netSales: number; refunds: number; profit?: number; foodCostPercent?: number };
  daily: { date: string; orders: number; sales: number }[];
  bestSellers: { id: string; name: string; quantity: number; sales: number }[];
};
export type InventoryReport = {
  lowStock: { id: string; quantity: string | number; reorderLevel: string | number; ingredient: { id: string; name: string; unit: string }; branch: { id: string; name: string } }[];
  movements: { id: string; quantity: string | number; type: string; createdAt: string; ingredient: { name: string; unit: string }; branch: { name: string } }[];
};
export async function getSalesReport(tenantId: string, query: { branchId?: string; from?: string; to?: string }) {
  return apiRequest<SalesReport>(apiClient.get(`/tenants/${tenantId}/reports/sales`, { params: query }));
}
export async function getInventoryReport(tenantId: string, branchId?: string) {
  return apiRequest<InventoryReport>(apiClient.get(`/tenants/${tenantId}/reports/inventory`, { params: branchId ? { branchId } : undefined }));
}
