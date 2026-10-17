import { apiClient, apiRequest } from "@/lib/api-client";
import { createOrderSchema } from "@/features/pos/schemas/orderSchemas";

export type PosCartLine = { productId: string; quantity: number; optionIds: string[]; note?: string };
export type PosOrderStatus = "OPEN" | "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED" | "CANCELLED";
export type PosOrder = { id: string; status: PosOrderStatus; totalAmount: number | string };
export type KitchenItemStatus = "NEW" | "PREPARING" | "READY" | "SERVED";
export type DiningTableRecord = { id: string; tenantId: string; branchId: string; name: string; section: string | null; seats: number; sortOrder: number; isActive: boolean; branch: { id: string; name: string }; status: "FREE" | "OCCUPIED" | "BILL_REQUESTED"; openOrder: { id: string; totalAmount: number | string; createdAt: string; guestCount: number | null; billRequestedAt: string | null; createdBy: { id: string; name: string } } | null };
export type PosOrderRecord = PosOrder & {
  createdAt: string;
  completedAt?: string | null;
  branch: { id: string; name: string };
  table?: { id: string; name: string; section: string | null } | null;
  billRequestedAt?: string | null;
  createdBy: { id: string; name: string; role?: "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN_STAFF" | "INVENTORY_MANAGER" | null };
  items: { id: string; quantity: number; unitPrice: number | string; lineTotal: number | string; note?: string | null; kitchenStatus?: KitchenItemStatus; sentToKitchenAt?: string | null; modifiers?: { id: string; groupName: string; optionName: string; priceDelta: number | string }[]; product: { id: string; name: string; sku: string | null } }[];
};

export async function listPosOrders(tenantId: string, branchId?: string): Promise<PosOrderRecord[]> {
  const result = await apiRequest<{ orders: PosOrderRecord[] }>(apiClient.get(`/tenants/${tenantId}/orders`, { params: branchId ? { branchId } : undefined }));
  return result.orders;
}

export async function createPosOrder(tenantId: string, branchId: string, items: PosCartLine[], clientOrderId?: string, tableId?: string, offlineOrigin = false, clientCreatedAt?: number): Promise<PosOrder> {
  const input = createOrderSchema.parse({ branchId, items, ...(clientOrderId ? { clientOrderId } : {}), ...(tableId ? { tableId } : {}), ...(offlineOrigin && clientCreatedAt ? { clientCreatedAt: new Date(clientCreatedAt).toISOString() } : {}) });
  const result = await apiRequest<{ order: PosOrder }>(apiClient.post(`/tenants/${tenantId}/orders`, input, clientOrderId || offlineOrigin ? { headers: { ...(clientOrderId ? { "Idempotency-Key": clientOrderId } : {}), ...(offlineOrigin ? { "X-Offline-Order": "1" } : {}), ...(offlineOrigin && clientCreatedAt ? { "X-Offline-Created-At": new Date(clientCreatedAt).toISOString() } : {}) } } : undefined));
  return result.order;
}
export async function appendPosOrderItems(tenantId: string, orderId: string, items: PosCartLine[]): Promise<PosOrder> {
  const result = await apiRequest<{ order: PosOrder }>(apiClient.post(`/tenants/${tenantId}/orders/${orderId}/items`, { items }));
  return result.order;
}

export async function listDiningTables(tenantId: string, branchId?: string): Promise<DiningTableRecord[]> {
  const result = await apiRequest<{ tables: DiningTableRecord[] }>(apiClient.get(`/tenants/${tenantId}/tables`, { params: branchId ? { branchId } : undefined }));
  return result.tables;
}

export async function sendOrderToKitchen(tenantId: string, orderId: string) {
  return apiRequest<{ items: Array<{ id: string }> }>(apiClient.post(`/tenants/${tenantId}/orders/${orderId}/send-to-kitchen`, {}));
}
export async function requestOrderBill(tenantId: string, orderId: string) {
  return apiRequest<{ order: { id: string; billRequestedAt: string } }>(apiClient.post(`/tenants/${tenantId}/orders/${orderId}/request-bill`, {}));
}

export type KitchenTicket = { orderId: string; createdAt: string; table: { id: string; name: string; section: string | null } | null; branch: { id: string; name: string }; items: Array<{ id: string; quantity: number | string; note: string | null; kitchenStatus: KitchenItemStatus; station: string | null; sentToKitchenAt: string; modifiers: Array<{ groupName: string; optionName: string }>; product: { id: string; name: string } }> };
export async function getKitchenQueue(tenantId: string, branchId?: string): Promise<KitchenTicket[]> {
  const result = await apiRequest<{ tickets: KitchenTicket[] }>(apiClient.get(`/tenants/${tenantId}/kitchen/queue`, { params: branchId ? { branchId } : undefined }));
  return result.tickets;
}
export async function updateKitchenItem(tenantId: string, itemId: string, status: "PREPARING" | "READY") {
  return apiRequest<{ item: { id: string; kitchenStatus: KitchenItemStatus } }>(apiClient.patch(`/tenants/${tenantId}/kitchen/items/${itemId}`, { status }));
}
export type ReadyOrderItem = { id: string; quantity: number | string; product: { id: string; name: string }; modifiers: Array<{ optionName: string }>; order: { id: string; table: { name: string } | null; createdBy: { id: string; name: string } } };
export async function listReadyOrderItems(tenantId: string, branchId?: string): Promise<ReadyOrderItem[]> {
  const result = await apiRequest<{ items: ReadyOrderItem[] }>(apiClient.get(`/tenants/${tenantId}/orders/ready`, { params: branchId ? { branchId } : undefined }));
  return result.items;
}
export async function markOrderItemServed(tenantId: string, orderId: string, itemId: string) {
  return apiRequest<{ item: { id: string; kitchenStatus: KitchenItemStatus } }>(apiClient.patch(`/tenants/${tenantId}/orders/${orderId}/items/${itemId}/served`, {}));
}

export type PosPaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "DIGITAL_WALLET" | "OTHER";
export type PosPaymentLineInput = { method: PosPaymentMethod; amount: number; tendered?: number; reference?: string };
export type PosPaymentInput = { method: PosPaymentMethod; cashReceived?: number; reference?: string; payments?: PosPaymentLineInput[] };

export async function completePosOrder(tenantId: string, orderId: string, payment: PosPaymentInput = { method: "CASH" }): Promise<PosOrder> {
  const result = await apiRequest<{ order: PosOrder }>(apiClient.post(`/tenants/${tenantId}/orders/${orderId}/complete`, payment));
  return result.order;
}

export type PosRefundInput = {
  reason: string;
  restock: boolean;
  method: "CASH" | "CARD" | "OTHER";
  items: { orderItemId: string; quantity: number }[];
};

export async function refundPosOrder(tenantId: string, orderId: string, input: PosRefundInput) {
  return apiRequest<{ refund: { id: string; amount: number | string; reason: string } }>(
    apiClient.post(`/tenants/${tenantId}/orders/${orderId}/refunds`, input),
  );
}
