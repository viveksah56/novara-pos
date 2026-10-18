import { z } from "zod";
import { MEASURE_UNIT_VALUES } from "@/constants/system-constants";

export const supplierFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const purchaseOrderFormSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  reference: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(z.object({
    ingredientId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    unit: z.enum(MEASURE_UNIT_VALUES),
    unitFactor: z.coerce.number().positive(),
    unitCost: z.coerce.number().min(0),
  })).min(1).max(100),
});
