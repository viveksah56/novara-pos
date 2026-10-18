import { apiClient, apiRequest } from "@/lib/api-client";
import type { ApiRequestBody, ApiResponseData } from "@/types/api-contract";

type CategoriesResponse = ApiResponseData<"/tenants/{tenantId}/categories", "get">;
type ProductsResponse = ApiResponseData<"/tenants/{tenantId}/products", "get">;
type CreateProductResponse = ApiResponseData<"/tenants/{tenantId}/products", "post">;
type UpdateProductResponse = ApiResponseData<"/tenants/{tenantId}/products/{id}", "patch">;
export type MenuCategory = CategoriesResponse extends { categories: (infer Category)[] } ? Category : never;
export type MenuProduct = ProductsResponse extends { products: (infer Product)[] } ? Product : never;
export type MenuProductWriteResult = (CreateProductResponse extends { product: infer Product } ? Product : never) | (UpdateProductResponse extends { product: infer Product } ? Product : never);
export type MenuProductInput = ApiRequestBody<"/tenants/{tenantId}/products", "post">;
export type MenuProductUpdate = ApiRequestBody<"/tenants/{tenantId}/products/{id}", "patch">;

export type ModifierEffectInput = { ingredientId: string; quantityDelta: number };
export type ModifierOptionInput = {
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  effects: ModifierEffectInput[];
};
export type ModifierGroupInput = {
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  isActive: boolean;
  options: ModifierOptionInput[];
};
export type ModifierGroupRecord = Omit<ModifierGroupInput, "options"> & {
  id: string;
  options: (Omit<ModifierOptionInput, "effects"> & { id: string; effects?: ModifierEffectInput[]; recipeEffects: (ModifierEffectInput & { ingredient: { id: string; name: string; unit: string } })[] })[];
};

export async function getModifierGroups(tenantId: string): Promise<ModifierGroupRecord[]> {
  const result = await apiRequest<{ groups: ModifierGroupRecord[] }>(apiClient.get(`/tenants/${tenantId}/modifier-groups`));
  return result.groups;
}

export async function saveModifierGroup(tenantId: string, input: ModifierGroupInput, id?: string): Promise<ModifierGroupRecord> {
  const request = id
    ? apiClient.patch(`/tenants/${tenantId}/modifier-groups/${id}`, input)
    : apiClient.post(`/tenants/${tenantId}/modifier-groups`, input);
  const result = await apiRequest<{ group: ModifierGroupRecord }>(request);
  return result.group;
}

export async function assignModifierGroups(tenantId: string, productId: string, groupIds: string[]): Promise<void> {
  await apiRequest(apiClient.put(`/tenants/${tenantId}/products/${productId}/modifier-groups`, { groupIds }));
}

export async function getMenuCategories(tenantId: string): Promise<MenuCategory[]> {
  const result = await apiRequest<{ categories: MenuCategory[] }>(apiClient.get(`/tenants/${tenantId}/categories`));
  return result.categories;
}

export async function getMenuProducts(tenantId: string): Promise<MenuProduct[]> {
  const result = await apiRequest<{ products: MenuProduct[] }>(apiClient.get(`/tenants/${tenantId}/products`));
  return result.products;
}

export async function saveMenuProduct(tenantId: string, input: MenuProductInput | MenuProductUpdate, id?: string): Promise<MenuProductWriteResult> {
  const request = id
    ? apiClient.patch(`/tenants/${tenantId}/products/${id}`, input)
    : apiClient.post(`/tenants/${tenantId}/products`, input);
  const result = await apiRequest<{ product: MenuProductWriteResult }>(request);
  return result.product;
}

export async function deleteMenuProduct(tenantId: string, id: string): Promise<void> {
  await apiRequest(apiClient.delete(`/tenants/${tenantId}/products/${id}`));
}
