import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72, "Use no more than 72 characters.")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Password must be 72 bytes or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const commonPasswords = new Set(["password1234", "qwerty123456", "letmein12345", "welcome12345", "123456789012"]);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
  password: passwordSchema,
  businessName: z.string().trim().min(2).max(160),
  branchName: z.string().trim().min(2).max(120),
}).superRefine(({ email, password }, context) => {
  if (password.toLowerCase() === email.toLowerCase()) {
    context.addIssue({ code: "custom", path: ["password"], message: "Password must not match your email address." });
  }
  if (commonPasswords.has(password.toLowerCase())) {
    context.addIssue({ code: "custom", path: ["password"], message: "Choose a less common password." });
  }
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(512),
  password: passwordSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(512),
  name: z.string().trim().min(2).max(120).optional(),
  password: passwordSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ["newPassword"],
  message: "Choose a password you have not used for this account.",
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
