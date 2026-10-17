import { apiClient, apiRequest } from "@/lib/api-client";
import type { PosOrderRecord } from "@/features/pos/api/posApi";
export type KitchenOrder = PosOrderRecord & { kitchenStatus: "PENDING" | "PREPARING" | "READY" };
export async function getKitchenOrders(tenantId: string, branchId?: string) {
  const result = await apiRequest<{ orders: KitchenOrder[] }>(apiClient.get(`/tenants/${tenantId}/kitchen/orders`, { params: branchId ? { branchId } : undefined }));
  return result.orders;
}
export async function updateKitchenOrder(tenantId: string, orderId: string, kitchenStatus: "PREPARING" | "READY") {
  const result = await apiRequest<{ order: KitchenOrder }>(apiClient.patch(`/tenants/${tenantId}/kitchen/orders/${orderId}`, { kitchenStatus }));
  return result.order;
}
