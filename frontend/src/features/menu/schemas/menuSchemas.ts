import { z } from "zod";

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const productFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  price: z.coerce.number().min(0).max(100_000_000),
  isAvailable: z.coerce.boolean().default(true),
});

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type ProductFormInput = z.input<typeof productFormSchema>;
