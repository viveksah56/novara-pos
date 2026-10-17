"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/FormFields";
import { AuthPageFrame } from "@/features/auth/components/AuthPageFrame";
import { authApi } from "@/features/auth/api";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordFormSchema), defaultValues: { password: "", confirmPassword: "" } });
  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) throw new Error("This reset link is missing its security token. Request a new one.");
      return authApi.resetPassword(token, values);
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace("/login?reason=password-reset");
      router.refresh();
    },
  });

  return (
    <AuthPageFrame title="Choose a new password" description="Use at least 12 characters, including a letter and a number. Reset links expire after 30 minutes."
      footer={<>Need another link? <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">Request a reset</Link></>}>
      <form className="space-y-5" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {mutation.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{getErrorMessage(mutation.error)}</p> : null}
        <PasswordField {...form.register("password")} label="New password" autoComplete="new-password" placeholder="Create a secure password" hint="At least 12 characters, including a letter and a number." error={form.formState.errors.password?.message} />
        <PasswordField {...form.register("confirmPassword")} label="Confirm new password" autoComplete="new-password" placeholder="Enter it again" error={form.formState.errors.confirmPassword?.message} />
        <Button className="h-11 w-full text-base" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Updating password…" : "Update password"}</Button>
      </form>
    </AuthPageFrame>
  );
}
