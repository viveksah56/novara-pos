import { z } from "zod";

const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72, "Use no more than 72 characters.")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Password must be 72 bytes or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const loginFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(320),
  password: z.string().min(1, "Enter your password.").max(72),
});

const commonPasswords = new Set(["password1234", "qwerty123456", "letmein12345", "welcome12345", "123456789012"]);

export const registerFormSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(320),
  password,
  businessName: z.string().trim().min(2, "Enter your business name.").max(160),
  branchName: z.string().trim().min(2, "Enter your first branch name.").max(120),
}).superRefine(({ email, password: value }, context) => {
  if (value.toLowerCase() === email.trim().toLowerCase()) context.addIssue({ code: "custom", path: ["password"], message: "Password must not match your email address." });
  if (commonPasswords.has(value.toLowerCase())) context.addIssue({ code: "custom", path: ["password"], message: "Choose a less common password." });
});

export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(320),
});

export const resetPasswordFormSchema = z.object({
  password,
  confirmPassword: z.string(),
}).refine(({ password: nextPassword, confirmPassword }) => nextPassword === confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

export const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(72),
  newPassword: password,
  confirmPassword: z.string(),
}).refine(({ newPassword, confirmPassword }) => newPassword === confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
}).refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
  path: ["newPassword"],
  message: "Choose a password you have not used for this account.",
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
