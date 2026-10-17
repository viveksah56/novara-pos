import { Globe2 } from "lucide-react";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import type { PlatformRole } from "@/features/platform/api";
import { superAdminNavigation, supportNavigation } from "@/features/platform/config/navigation";

export function PlatformSidebar({ platformRole, pathname }: { platformRole: PlatformRole; pathname: string }) {
  const superAdmin = platformRole === "SUPER_ADMIN";
  const navItems = superAdmin ? superAdminNavigation : supportNavigation;
  const top = (
    <div className="mx-4 mb-3 rounded-xl border border-sidebar-border/70 bg-background/70 p-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Globe2 className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">Novara Platform</p><p className="mt-0.5 text-xs text-muted-foreground">{superAdmin ? "Control center" : "Customer support"}</p></div></div></div>
  );
  const footer = (
    <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/60 p-3"><div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-500" /><span className="text-xs font-semibold">Platform access active</span></div><p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{superAdmin ? "Protected administrative workspace" : "Support role · limited permissions"}</p></div>
  );
  return <WorkspaceSidebar role={platformRole} tenantName="Novara Platform" groups={[{ label: "Platform", items: navItems }]} activePath={pathname} brandHref={superAdmin ? "/admin" : "/admin/support"} topContent={top} footer={footer} />;
}
