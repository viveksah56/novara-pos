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
};

export async function getMenuCategories(tenantId: string): Promise<MenuCategory[]> {
  const result = await apiRequest<{ categories: MenuCategory[] }>(apiClient.get(`/tenants/${tenantId}/categories`));
  return result.categories;
}

export async function getMenuProducts(tenantId: string): Promise<MenuProduct[]> {
  const result = await apiRequest<{ products: MenuProduct[] }>(apiClient.get(`/tenants/${tenantId}/products`));
  return result.products;
}
