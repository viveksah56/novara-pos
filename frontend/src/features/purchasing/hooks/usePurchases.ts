"use client";

import { useQuery } from "@tanstack/react-query";
import { getPurchaseOrders, getSuppliers } from "@/features/purchasing/api/purchasingApi";

export function useSuppliers(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: ["purchasing", tenantId, "suppliers"],
    queryFn: () => getSuppliers(tenantId),
    enabled: Boolean(tenantId) && enabled,
    retry: false,
  });
}

export function usePurchaseOrders(tenantId: string, enabled = true) {
  return useQuery({
    queryKey: ["purchasing", tenantId, "orders"],
    queryFn: () => getPurchaseOrders(tenantId),
    enabled: Boolean(tenantId) && enabled,
    retry: false,
  });
}
