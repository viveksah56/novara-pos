import { apiClient, apiRequest } from "@/lib/api-client";

export type Ingredient = { id: string; name: string; unit: string; unitCost: number | string | null; isActive: boolean };
export type StockItem = {
  id: string;
  quantity: number | string;
  reorderLevel: number | string;
  ingredient: Ingredient;
};

export async function getIngredients(tenantId: string): Promise<Ingredient[]> {
  const result = await apiRequest<{ ingredients: Ingredient[] }>(apiClient.get(`/tenants/${tenantId}/ingredients`));
  return result.ingredients;
}

export async function getStock(tenantId: string, branchId: string) {
  return apiRequest<{ stock: StockItem[]; movements: Record<string, unknown>[]; branchId: string }>(
    apiClient.get(`/tenants/${tenantId}/inventory`, { params: { branchId } }),
  );
}
