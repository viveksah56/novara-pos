import { apiClient, apiRequest } from "@/lib/api-client";

export type StocktakeLine = {
  id: string;
  ingredientId: string;
  countedQuantity: number | string;
  countedAt: string;
  expectedAtCount: number | string | null;
  variance: number | string | null;
  unitCost: number | string | null;
  ingredient: { id: string; name: string; unit: string };
};

export type StocktakeRecord = {
  id: string;
  branchId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "CANCELLED";
  startedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  note: string | null;
  branch?: { id: string; name: string };
  createdBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  _count?: { lines: number };
  lines?: StocktakeLine[];
};

export async function getStocktakes(tenantId: string, branchId?: string): Promise<StocktakeRecord[]> {
  const result = await apiRequest<{ stocktakes: StocktakeRecord[] }>(apiClient.get(`/tenants/${tenantId}/stocktakes`, { params: branchId ? { branchId } : undefined }));
  return result.stocktakes;
}

export async function getStocktake(tenantId: string, stocktakeId: string): Promise<StocktakeRecord> {
  const result = await apiRequest<{ stocktake: StocktakeRecord }>(apiClient.get(`/tenants/${tenantId}/stocktakes/${stocktakeId}`));
  return result.stocktake;
}

export async function createStocktake(tenantId: string, branchId: string, note?: string): Promise<StocktakeRecord> {
  const result = await apiRequest<{ stocktake: StocktakeRecord }>(apiClient.post(`/tenants/${tenantId}/stocktakes`, { branchId, note }));
  return result.stocktake;
}

export async function saveStocktakeLines(tenantId: string, stocktakeId: string, lines: { ingredientId: string; countedQuantity: number }[]): Promise<StocktakeRecord> {
  const result = await apiRequest<{ stocktake: StocktakeRecord }>(apiClient.put(`/tenants/${tenantId}/stocktakes/${stocktakeId}/lines`, { lines }));
  return result.stocktake;
}

export async function transitionStocktake(tenantId: string, stocktakeId: string, action: "submit" | "approve" | "cancel"): Promise<StocktakeRecord | { stocktakeId: string; cancelled: boolean }> {
  const result = await apiRequest<{ stocktake?: StocktakeRecord; stocktakeId?: string; cancelled?: boolean }>(apiClient.post(`/tenants/${tenantId}/stocktakes/${stocktakeId}/${action}`, {}));
  return result.stocktake ?? { stocktakeId: result.stocktakeId ?? stocktakeId, cancelled: result.cancelled ?? false };
}
