"use client";

import { useQuery } from "@tanstack/react-query";
import { getIngredients, getStock } from "@/features/inventory/api/inventoryApi";

export function useIngredients(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: ["inventory", tenantId, "ingredients"],
    queryFn: () => getIngredients(tenantId),
    enabled: Boolean(tenantId) && enabled,
    retry: false,
  });
}

export function useStock(tenantId: string, branchId: string, enabled = true) {
  return useQuery({
    queryKey: ["inventory", tenantId, "stock", branchId],
    queryFn: () => getStock(tenantId, branchId),
    enabled: Boolean(tenantId && branchId) && enabled,
    retry: false,
  });
}
