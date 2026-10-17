import { apiClient, apiRequest } from "@/lib/api-client";

export type MenuCategory = { id: string; name: string; sortOrder: number; isActive: boolean };
export type MenuProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  description: string | null;
  sku: string | null;
  price: number | string;
  isAvailable: boolean;
  modifierGroups?: { group: { id: string; name: string; minSelect: number; maxSelect: number; isActive: boolean; options: { id: string; name: string; priceDelta: number | string; isDefault: boolean; isActive: boolean; recipeEffects: { ingredientId: string; quantityDelta: number | string; ingredient: { id: string; name: string; unit: string } }[] }[] } }[];
};

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
