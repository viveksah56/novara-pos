import { z } from "zod";

export const ingredientFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  unit: z.enum(["EACH", "GRAM", "KILOGRAM", "MILLILITER", "LITER", "OUNCE", "POUND"]),
  unitCost: z.union([z.number().min(0).max(100_000_000), z.null()]).optional(),
  isActive: z.boolean().optional(),
});

export const stockAdjustmentSchema = z.object({
  branchId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  quantity: z.coerce.number().finite().refine((value) => value !== 0),
  type: z.enum(["WASTE", "ADJUSTMENT"]),
  reorderLevel: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(500).optional(),
});
