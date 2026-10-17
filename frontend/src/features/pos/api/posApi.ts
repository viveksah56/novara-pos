import { apiClient, apiRequest } from "@/lib/api-client";
import { createOrderSchema } from "@/features/pos/schemas/orderSchemas";

export type PosCartLine = { productId: string; quantity: number };
export type PosOrder = { id: string; status: "OPEN" | "COMPLETED" | "CANCELLED"; totalAmount: number | string };
export type PosOrderRecord = PosOrder & {
  createdAt: string;
  branch: { id: string; name: string };
  createdBy: { id: string; name: string };
  items: { id: string; quantity: number; unitPrice: number | string; lineTotal: number | string; product: { id: string; name: string; sku: string | null } }[];
};

export async function listPosOrders(tenantId: string, branchId?: string): Promise<PosOrderRecord[]> {
  const result = await apiRequest<{ orders: PosOrderRecord[] }>(apiClient.get(`/tenants/${tenantId}/orders`, { params: branchId ? { branchId } : undefined }));
  return result.orders;
}

export async function createPosOrder(tenantId: string, branchId: string, items: PosCartLine[], clientOrderId?: string): Promise<PosOrder> {
  const input = createOrderSchema.parse({ branchId, items, ...(clientOrderId ? { clientOrderId } : {}) });
  const result = await apiRequest<{ order: PosOrder }>(apiClient.post(`/tenants/${tenantId}/orders`, input));
  return result.order;
}

export async function completePosOrder(tenantId: string, orderId: string, payment: { method: "CASH" | "CARD" | "OTHER"; cashReceived?: number } = { method: "CASH" }): Promise<PosOrder> {
  const result = await apiRequest<{ order: PosOrder }>(apiClient.post(`/tenants/${tenantId}/orders/${orderId}/complete`, payment));
  return result.order;
}
