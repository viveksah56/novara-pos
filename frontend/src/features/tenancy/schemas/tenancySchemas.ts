import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const tenantProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: optionalText(180),
  phone: optionalText(40),
  email: z.union([z.email().max(320), z.literal("")]).transform((value) => value || null),
  address: optionalText(500),
  logoUrl: z.union([z.url().max(1000), z.literal("")]).transform((value) => value || null),
});
export const branchSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/),
  address: optionalText(500),
  phone: optionalText(40),
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  taxRate: z.coerce.number().min(0).max(100),
  taxInclusive: z.boolean(),
  serviceChargeRate: z.coerce.number().min(0).max(100),
  taxRegistrationNumber: optionalText(80),
  receiptHeader: optionalText(500),
  receiptFooter: optionalText(500),
  businessDayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  allowNegativeStock: z.boolean(),
  requireShift: z.boolean(),
  requirePaymentReference: z.boolean(),
  shiftVarianceTolerance: z.coerce.number().min(0).max(100_000_000),
  cashierMaxDiscountPercent: z.coerce.number().min(0).max(100),
});
export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;
export type BranchSettingsInput = z.infer<typeof branchSettingsSchema>;
export type TenantProfileFormValues = z.input<typeof tenantProfileSchema>;
export type BranchSettingsFormValues = z.input<typeof branchSettingsSchema>;
