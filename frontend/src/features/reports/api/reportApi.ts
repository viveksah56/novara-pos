import { apiClient, apiRequest } from "@/lib/api-client";
import type { ApiQueryParams, ApiResponseData } from "@/types/api-contract";
import type { PaymentMethod } from "@/constants/system-constants";

type SalesReportContract = ApiResponseData<"/tenants/{tenantId}/reports/sales", "get">;
export type SalesReport = Omit<SalesReportContract, "paymentBreakdown"> & {
  paymentBreakdown: Array<{ method: PaymentMethod; amount: number }>;
};
export type InventoryReport = ApiResponseData<"/tenants/{tenantId}/reports/inventory", "get">;
export type SalesReportQuery = ApiQueryParams<"/tenants/{tenantId}/reports/sales", "get">;
export async function getSalesReport(tenantId: string, query: SalesReportQuery) {
  return apiRequest<SalesReport>(apiClient.get(`/tenants/${tenantId}/reports/sales`, { params: query }));
}
export async function getInventoryReport(tenantId: string, branchId?: string) {
  return apiRequest<InventoryReport>(apiClient.get(`/tenants/${tenantId}/reports/inventory`, { params: branchId ? { branchId } : undefined }));
}
