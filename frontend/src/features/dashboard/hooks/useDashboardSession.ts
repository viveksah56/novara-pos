import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { dashboardKeys, getDashboard, type DashboardView } from "@/features/dashboard/api";
import { navigation } from "@/features/dashboard/config/navigation";
import { ROLE_HOME, viewByRole, viewsByRole } from "@/features/dashboard/config/roles";
import { pollWhenVisible } from "@/lib/polling";
import { ApiError } from "@/lib/api-client";
import { roleHasCapability } from "@/lib/rbac";

/**
 * Owns everything the dashboard shell needs before it can render:
 * the signed-in user, the active tenant/branch from the URL, the dashboard payload,
 * role-based redirects, and the permission-filtered navigation.
 */
export function useDashboardSession(requestedView?: DashboardView) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const loggedInUserQuery = useQuery({
    queryKey: authQueryKeys.loggedInUser,
    queryFn: authApi.getLoggedInUser,
    retry: false,
    staleTime: 30_000,
  });
  const loggedInUser = loggedInUserQuery.data;
  const memberships = loggedInUser?.memberships ?? [];
  const activeTenantId =
    searchParams.get("tenantId") ?? memberships[0]?.tenant.id;
  const activeMembership =
    memberships.find((membership) => membership.tenant.id === activeTenantId) ??
    (searchParams.has("tenantId") ? undefined : memberships[0]);
  const role =
    loggedInUser?.platformRole ??
    (loggedInUser?.isPlatformAdmin ? "PLATFORM_ADMIN" : activeMembership?.role);
  const correctView = role ? viewByRole[role] : undefined;
  const view = requestedView ?? correctView;
  const activeBranchId = searchParams.get("branchId") ?? undefined;
  const dashboardQuery = useQuery({
    queryKey: dashboardKeys.view(
      view ?? "overview",
      activeTenantId,
      activeBranchId,
    ),
    queryFn: () =>
      getDashboard(view ?? "overview", activeTenantId, activeBranchId),
    enabled:
      !!loggedInUser &&
      !!view &&
      !!role &&
      !loggedInUser.platformRole &&
      (role === "PLATFORM_ADMIN" || !!activeMembership),
    refetchInterval: pollWhenVisible(30_000),
    retry: false,
  });
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  useEffect(() => {
    if (
      loggedInUserQuery.error instanceof ApiError &&
      loggedInUserQuery.error.statusCode === 401
    )
      router.replace("/login");
  }, [loggedInUserQuery.error, router]);
  useEffect(() => {
    if (!loggedInUser || !role || !correctView) return;
    if (pathname === "/dashboard" && (role === "OWNER" || role === "MANAGER"))
      return;
    if (
      pathname === "/dashboard" &&
      (role === "PLATFORM_ADMIN" ||
        role === "SUPER_ADMIN" ||
        role === "SUPPORT_AGENT")
    ) {
      router.replace(ROLE_HOME[role]);
      return;
    }
    if (
      pathname === "/dashboard" &&
      requestedView === undefined &&
      correctView !== "overview"
    )
      router.replace(ROLE_HOME[role]);
    if (requestedView && !viewsByRole[role]?.includes(requestedView))
      router.replace(ROLE_HOME[role]);
  }, [loggedInUser, role, correctView, pathname, requestedView, router]);

  const visibleNav = useMemo(() => {
    const items = navigation[role ?? ""] ?? [];
    return items.filter((item) => {
      if (item.capability && !roleHasCapability(role, item.capability))
        return false;
      return (
        !item.permission ||
        (dashboardQuery.data?.permissions?.[item.permission] ??
          (role === "OWNER" || role === "MANAGER"))
      );
    });
  }, [role, dashboardQuery.data?.permissions]);

  function switchTenant(tenantId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tenantId", tenantId);
    params.delete("branchId");
    router.push(`${pathname}?${params.toString()}`);
  }
  function switchBranch(branchId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (branchId) params.set("branchId", branchId);
    else params.set("branchId", "all");
    router.push(`${pathname}?${params.toString()}`);
  }

  return {
    pathname,
    searchParams,
    loggedInUserQuery,
    loggedInUser,
    memberships,
    activeTenantId,
    role,
    dashboardQuery,
    logoutMutation,
    visibleNav,
    switchTenant,
    switchBranch,
  };
}
