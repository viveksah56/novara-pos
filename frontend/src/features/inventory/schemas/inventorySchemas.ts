import { z } from "zod";
import { MEASURE_UNIT_VALUES, STOCK_ADJUSTMENT_TYPE_VALUES } from "@/constants/system-constants";

export const ingredientFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  unit: z.enum(MEASURE_UNIT_VALUES),
  unitCost: z.union([z.number().min(0).max(100_000_000), z.null()]).optional(),
  isActive: z.boolean().optional(),
});

export const stockAdjustmentSchema = z.object({
  branchId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  quantity: z.coerce.number().finite().refine((value) => value !== 0),
  type: z.enum(STOCK_ADJUSTMENT_TYPE_VALUES),
  reorderLevel: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(500).optional(),
});
