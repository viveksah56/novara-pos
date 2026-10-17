"use client";

import { usePathname } from "next/navigation";
import { Sidebar as SidebarPrimitive } from "@/components/ui/sidebar";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { SidebarStatus } from "@/features/dashboard/components/shell/SidebarStatus";
import { WorkspaceSwitcher } from "@/features/dashboard/components/shell/WorkspaceSwitcher";
import { navigation } from "@/features/dashboard/config/navigation";
import { useDashboardSession } from "@/features/dashboard/hooks/useDashboardSession";
import { roleHasCapability } from "@/lib/rbac";

/** Persistent role-aware navigation mounted once by the dashboard route layout. */
export function AppSidebar() {
  const pathname = usePathname();
  const session = useDashboardSession();
  const role = session.role;

  if (!role) {
    return (
      <SidebarPrimitive className="animate-pulse">
        <div className="m-5 h-10 rounded-xl bg-sidebar-accent" />
        <div className="mx-3 mt-8 h-40 rounded-xl bg-sidebar-accent/60" />
      </SidebarPrimitive>
    );
  }

  const membership = session.memberships.find(
    ({ tenant }) => tenant.id === session.activeTenantId,
  );
  const dashboard = session.dashboardQuery.data;
  const navItems = (navigation[role] ?? []).filter((item) => {
    if (item.capability && !roleHasCapability(role, item.capability)) return false;
    if (!item.permission) return true;
    return dashboard?.permissions?.[item.permission] ?? ["OWNER", "MANAGER"].includes(role);
  });

  return (
    <WorkspaceSidebar
      role={role}
      tenantName={dashboard?.tenant?.name ?? membership?.tenant.name ?? "Novara Platform"}
      groups={[{ label: "Workspace", items: navItems }]}
      activePath={pathname}
      brandHref={role === "SUPPORT_AGENT" ? "/admin/support" : role.startsWith("SUPER_") || role === "PLATFORM_ADMIN" ? "/admin" : "/dashboard"}
      treatUnspecifiedAsReady
      topContent={dashboard && session.activeTenantId ? (
        <WorkspaceSwitcher
          dashboard={dashboard}
          role={role}
          memberships={session.memberships}
          activeTenantId={session.activeTenantId}
          onSwitchTenant={session.switchTenant}
          onSwitchBranch={session.switchBranch}
        />
      ) : undefined}
      footer={<SidebarStatus />}
    />
  );
}
