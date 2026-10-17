"use client";

import { useQuery } from "@tanstack/react-query";
import { getMenuCategories, getMenuProducts } from "@/features/menu/api/menuApi";

export function useMenuCategories(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: ["menu", tenantId, "categories"],
    queryFn: () => getMenuCategories(tenantId),
    enabled: Boolean(tenantId) && enabled,
    retry: false,
  });
}

export function useMenuProducts(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: ["menu", tenantId, "products"],
    queryFn: () => getMenuProducts(tenantId),
    enabled: Boolean(tenantId) && enabled,
    retry: false,
  });
}
