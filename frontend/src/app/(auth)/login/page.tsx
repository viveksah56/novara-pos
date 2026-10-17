"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField, PasswordField } from "@/components/FormFields";
import { AuthPageFrame } from "@/features/auth/components/AuthPageFrame";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { loginFormSchema, type LoginFormValues } from "@/features/auth/schemas";
import { ApiError, getErrorMessage } from "@/lib/api-client";
import { capabilityForPath, roleHasCapability, type BusinessRole, type PlatformRole } from "@/lib/rbac";

function resolvePostLoginDestination(
  requestedDestination: string | null,
  session: { user: { platformRole?: PlatformRole | null; isPlatformAdmin?: boolean; memberships: Array<{ role: BusinessRole; tenant: { id: string } }> }; activeTenantId: string | null; homeRoute: string },
): string {
  const platformRole = session.user.platformRole ?? (session.user.isPlatformAdmin ? "PLATFORM_ADMIN" : undefined);
  const membership = session.user.memberships.find(({ tenant }) => tenant.id === session.activeTenantId) ?? session.user.memberships[0];
  const role: BusinessRole | PlatformRole | undefined = platformRole ?? membership?.role;

  if (requestedDestination) {
    try {
      const target = new URL(requestedDestination, window.location.origin);
      const pathname = target.pathname;
      const isLocal = target.origin === window.location.origin && requestedDestination.startsWith("/") && !requestedDestination.startsWith("//");
      const isAuthRoute = ["/login", "/register", "/forgot-password", "/reset-password", "/unauthorized"].includes(pathname);
      const requestedTenantId = target.searchParams.get("tenantId");
      const belongsToUser = !requestedTenantId || session.user.memberships.some(({ tenant }) => tenant.id === requestedTenantId);
      const isPlatformRoute = pathname === "/admin" || pathname.startsWith("/admin/");
      const canOpenPlatformRoute = Boolean(platformRole) && (platformRole !== "SUPPORT_AGENT" || pathname === "/admin/support" || pathname.startsWith("/admin/support/"));
      const isRoleHome = pathname === "/dashboard" ? role === "OWNER" || role === "MANAGER" : false;
      const capability = capabilityForPath(pathname);
      const hasRouteAccess = isPlatformRoute
        ? canOpenPlatformRoute
        : isRoleHome || (capability !== undefined && roleHasCapability(role, capability));

      if (isLocal && !isAuthRoute && belongsToUser && hasRouteAccess) {
        return `${pathname}${target.search}${target.hash}`;
      }
    } catch {
      // Ignore malformed, external, auth, and role-inaccessible return paths.
    }
  }

  const homeRoute = session.homeRoute.startsWith("/") && !session.homeRoute.startsWith("//") ? session.homeRoute : "/login";
  if (!session.activeTenantId || homeRoute.startsWith("/admin")) return homeRoute;
  const destination = new URL(homeRoute, window.location.origin);
  if (!destination.searchParams.has("tenantId")) destination.searchParams.set("tenantId", session.activeTenantId);
  return `${destination.pathname}${destination.search}`;
}

export default function LoginPage() {
  const queryClient = useQueryClient();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => {
      queryClient.setQueryData(authQueryKeys.loggedInUser, session.user);
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") ?? params.get("next");
      const destination = resolvePostLoginDestination(returnTo, session);
      window.location.replace(destination);
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
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>
        </div>
        <Button className="h-11 w-full text-base" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthPageFrame>
  );
}
