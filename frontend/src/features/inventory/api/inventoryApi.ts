import { apiClient, apiRequest } from "@/lib/api-client";
import type { ApiRequestBody, ApiResponseData } from "@/types/api-contract";

type IngredientsResponse = ApiResponseData<"/tenants/{tenantId}/ingredients", "get">;
type InventoryResponse = ApiResponseData<"/tenants/{tenantId}/inventory", "get">;
export type Ingredient = IngredientsResponse extends { ingredients: (infer IngredientRecord)[] } ? IngredientRecord : never;
export type StockItem = InventoryResponse extends { stock: (infer StockRecord)[] } ? StockRecord : never;
export type StockAdjustmentInput = ApiRequestBody<"/tenants/{tenantId}/inventory/adjustments", "post">;

export async function getIngredients(tenantId: string): Promise<Ingredient[]> {
  const result = await apiRequest<{ ingredients: Ingredient[] }>(apiClient.get(`/tenants/${tenantId}/ingredients`));
  return result.ingredients;
}

export async function getStock(tenantId: string, branchId: string) {
  return apiRequest<InventoryResponse>(
    apiClient.get(`/tenants/${tenantId}/inventory`, { params: { branchId } }),
  );
}

export async function recordStockAdjustment(tenantId: string, input: StockAdjustmentInput): Promise<void> {
  await apiRequest(apiClient.post(`/tenants/${tenantId}/inventory/adjustments`, input));
}
