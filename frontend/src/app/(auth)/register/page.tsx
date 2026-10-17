"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField, PasswordField } from "@/components/FormFields";
import { AuthPageFrame } from "@/features/auth/components/AuthPageFrame";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { registerFormSchema, type RegisterFormValues } from "@/features/auth/schemas";
import { ApiError, getErrorMessage } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: "", email: "", password: "", businessName: "", branchName: "" },
  });
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.loggedInUser, user);
      router.replace("/dashboard");
      router.refresh();
    },
    onError: (error) => {
      if (!(error instanceof ApiError) || !error.details) return;
      const fields = ["name", "email", "businessName", "branchName", "password"] as const;
      for (const field of fields) {
        const message = error.details[field]?.[0];
        if (message) form.setError(field, { type: "server", message });
      }
    },
  });
  const fieldErrors = registerMutation.error instanceof ApiError ? registerMutation.error.details : undefined;
  const hasFieldErrors = Object.values(fieldErrors ?? {}).some((messages) => Boolean(messages?.length));
  const serverError = registerMutation.error && !hasFieldErrors ? getErrorMessage(registerMutation.error) : undefined;

  return (
    <AuthPageFrame
      title="Start your Novara workspace"
      description="Set up your business and first branch to get started."
      footer={<>Already with Novara? <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/login">Sign in</Link></>}
    >
      <form aria-busy={registerMutation.isPending} className="space-y-4" noValidate onSubmit={form.handleSubmit((values) => registerMutation.mutate(values))}>
        {serverError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {serverError}
          </div>
        ) : null}
        <FormField {...form.register("name")} label="Your name" autoComplete="name" placeholder="Bibek Sah" error={form.formState.errors.name?.message} />
        <FormField {...form.register("email")} label="Email address" type="email" autoComplete="email" autoCapitalize="none" placeholder="you@yourcafe.com" error={form.formState.errors.email?.message} />
        <FormField {...form.register("businessName")} label="Business name" autoComplete="organization" placeholder="The Green Cup" error={form.formState.errors.businessName?.message} />
        <FormField {...form.register("branchName")} label="First branch" placeholder="Thamel" error={form.formState.errors.branchName?.message} />
        <PasswordField {...form.register("password")} label="Password" autoComplete="new-password" placeholder="Create a secure password" hint="At least 12 characters, including a letter and a number." error={form.formState.errors.password?.message} />
        <Button className="h-11 w-full text-base" type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthPageFrame>
  );
}
