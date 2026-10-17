import { z } from "zod";

export const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  clientOrderId: z.string().min(8).max(80).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive() })).min(1).max(100),
});
