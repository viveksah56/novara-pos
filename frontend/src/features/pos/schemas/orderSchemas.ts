import { z } from "zod";

export const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  tableId: z.string().uuid().optional(),
  guestCount: z.number().int().min(1).max(100).optional(),
  clientCreatedAt: z.iso.datetime().optional(),
  clientOrderId: z.string().min(8).max(80).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive().max(100), optionIds: z.array(z.string().uuid()).max(20).default([]), note: z.string().max(200).optional() })).min(1).max(100),
});
