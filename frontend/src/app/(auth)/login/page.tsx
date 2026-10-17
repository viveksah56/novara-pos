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
import { loginFormSchema, type LoginFormValues } from "@/features/auth/schemas";
import { ApiError, getErrorMessage } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.loggedInUser, user);
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      const destination = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
      router.replace(destination);
      router.refresh();
    },
    onError: (error) => {
      if (!(error instanceof ApiError) || !error.details) return;
      const emailError = error.details.email?.[0];
      const passwordError = error.details.password?.[0];
      if (emailError) form.setError("email", { type: "server", message: emailError });
      if (passwordError) form.setError("password", { type: "server", message: passwordError });
    },
  });
  const fieldErrors = loginMutation.error instanceof ApiError ? loginMutation.error.details : undefined;
  const hasFieldErrors = Boolean(fieldErrors?.email?.length || fieldErrors?.password?.length);
  const serverError = loginMutation.error && !hasFieldErrors ? getErrorMessage(loginMutation.error) : undefined;

  return (
    <AuthPageFrame
      title="Welcome back"
      description="Sign in to manage your cafe or restaurant."
      footer={<>New to Novara? <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/register">Create an account</Link></>}
    >
      <form aria-busy={loginMutation.isPending} className="space-y-5" noValidate onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}>
        {serverError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {serverError}
          </div>
        ) : null}
        <FormField
          {...form.register("email")}
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@yourcafe.com"
          error={form.formState.errors.email?.message}
        />
        <PasswordField
          {...form.register("password")}
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={form.formState.errors.password?.message}
        />
        <Button className="h-11 w-full text-base" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthPageFrame>
  );
}
