import { apiClient, apiRequest } from "@/lib/api-client";

export type Supplier = { id: string; name: string; isActive: boolean; email: string | null; phone: string | null };
export type PurchaseOrder = {
  id: string;
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
  totalAmount: number | string;
  supplier: { id: string; name: string };
  branch: { id: string; name: string };
  items: Array<{ id: string; quantity: number | string; unitCost: number | string; ingredient: { id: string; name: string } }>;
};

export async function getSuppliers(tenantId: string): Promise<Supplier[]> {
  const result = await apiRequest<{ suppliers: Supplier[] }>(apiClient.get(`/tenants/${tenantId}/suppliers`));
  return result.suppliers;
}

export async function getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
  const result = await apiRequest<{ purchases: PurchaseOrder[] }>(apiClient.get(`/tenants/${tenantId}/purchases`));
  return result.purchases;
}

export async function receivePurchase(tenantId: string, purchaseId: string): Promise<PurchaseOrder> {
  const result = await apiRequest<{ purchase: PurchaseOrder }>(apiClient.post(`/tenants/${tenantId}/purchases/${purchaseId}/receive`, {}));
  return result.purchase;
}

export async function placePurchaseOrder(tenantId: string, purchaseId: string): Promise<PurchaseOrder> {
  const result = await apiRequest<{ purchase: PurchaseOrder }>(apiClient.post(`/tenants/${tenantId}/purchases/${purchaseId}/order`, {}));
  return result.purchase;
}
