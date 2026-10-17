"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormFields";
import { AuthPageFrame } from "@/features/auth/components/AuthPageFrame";
import { authApi } from "@/features/auth/api";
import { forgotPasswordFormSchema, type ForgotPasswordFormValues } from "@/features/auth/schemas";
import { getErrorMessage } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordFormSchema), defaultValues: { email: "" } });
  const mutation = useMutation({ mutationFn: authApi.requestPasswordReset });

  return (
    <AuthPageFrame title="Reset your password" description="Enter the email address for your Novara account. We’ll send a secure reset link if it exists."
      footer={<>Remembered it? <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link></>}>
      {mutation.isSuccess ? (
        <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
          If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.
        </div>
      ) : (
        <form className="space-y-5" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          {mutation.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{getErrorMessage(mutation.error)}</p> : null}
          <FormField {...form.register("email")} label="Email address" type="email" autoComplete="email" autoCapitalize="none" placeholder="you@yourcafe.com" error={form.formState.errors.email?.message} />
          <Button className="h-11 w-full text-base" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
    </AuthPageFrame>
  );
}
