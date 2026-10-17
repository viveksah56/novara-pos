import { apiClient, apiRequest } from "@/lib/api-client";

export type CashShift = {
  id: string;
  branchId: string;
  status: "OPEN" | "CLOSED";
  openingCash: number | string;
  expectedCash: number | string;
  closingCash: number | string | null;
  cashVariance: number | string | null;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
  branch: { id: string; name: string };
  cashMovements?: { id: string; type: "PAY_IN" | "PAY_OUT"; amount: string | number; note: string | null; createdAt: string; createdBy: { id: string; name: string } }[];
};

export async function getCurrentShift(tenantId: string, branchId?: string) {
  const data = await apiRequest<{ shift: CashShift | null }>(apiClient.get(`/tenants/${tenantId}/shifts/current`, { params: branchId ? { branchId } : undefined }));
  return data.shift;
}
export async function openShift(tenantId: string, input: { branchId: string; openingCash: number }) {
  const data = await apiRequest<{ shift: CashShift }>(apiClient.post(`/tenants/${tenantId}/shifts/open`, input));
  return data.shift;
}
export async function closeShift(tenantId: string, shiftId: string, input: { closingCash: number; note?: string }) {
  const data = await apiRequest<{ shift: CashShift }>(apiClient.post(`/tenants/${tenantId}/shifts/${shiftId}/close`, input));
  return data.shift;
}
export async function createCashMovement(tenantId: string, shiftId: string, input: { type: "PAY_IN" | "PAY_OUT"; amount: number; reason: string }) {
  return apiRequest<{ movement: NonNullable<CashShift["cashMovements"]>[number] }>(apiClient.post(`/tenants/${tenantId}/shifts/${shiftId}/cash-movements`, input));
}
