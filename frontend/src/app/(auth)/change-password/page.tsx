"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/FormFields";
import { AuthPageFrame } from "@/features/auth/components/AuthPageFrame";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { changePasswordFormSchema, type ChangePasswordFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordFormSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordFormValues) => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      queryClient.clear();
      router.replace("/login?reason=password-changed");
      router.refresh();
    },
  });

  return (
    <AuthPageFrame title="Change your password" description="For your security, changing your password signs out all active sessions. Sign in again with your new password."
      footer={<>Need help signing in? <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">Reset your password</Link></>}>
      <form className="space-y-5" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {mutation.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{getErrorMessage(mutation.error)}</p> : null}
        <PasswordField {...form.register("currentPassword")} label="Current password" autoComplete="current-password" error={form.formState.errors.currentPassword?.message} />
        <PasswordField {...form.register("newPassword")} label="New password" autoComplete="new-password" hint="At least 12 characters, including a letter and a number." error={form.formState.errors.newPassword?.message} />
        <PasswordField {...form.register("confirmPassword")} label="Confirm new password" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} />
        <Button className="h-11 w-full text-base" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Updating password…" : "Change password"}</Button>
      </form>
    </AuthPageFrame>
  );
}
