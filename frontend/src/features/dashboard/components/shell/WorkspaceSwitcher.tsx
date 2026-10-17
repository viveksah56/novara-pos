import { Building2, ChevronDown } from "lucide-react";
import { SelectField } from "@/components/ui/select";
import type { DashboardPayload } from "@/features/dashboard/api";

type WorkspaceSwitcherProps = {
  dashboard: DashboardPayload;
  role: string;
  memberships: Array<{ tenant: { id: string; name: string } }>;
  activeTenantId: string;
  onSwitchTenant: (tenantId: string) => void;
  onSwitchBranch: (branchId: string) => void;
};

/** Sidebar header: current business, business switcher, and branch filter. */
export function WorkspaceSwitcher({
  dashboard,
  role,
  memberships,
  activeTenantId,
  onSwitchTenant,
  onSwitchBranch,
}: WorkspaceSwitcherProps) {
  return (
    <div className="mt-4 space-y-3 px-4">
      <div className="relative rounded-xl border border-border/70 bg-background p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {dashboard.tenant?.name ?? "Novara Platform"}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {dashboard.activeBranch?.name ??
                (role === "PLATFORM_ADMIN"
                  ? "Platform administration"
                  : "Workspace")}
            </p>
          </div>
          {memberships.length > 1 ? (
            <SelectField aria-label="Switch business" value={activeTenantId} onValueChange={onSwitchTenant} options={memberships.map(({ tenant }) => ({ value: tenant.id, label: tenant.name }))} triggerClassName="h-9 w-9 justify-center gap-0 border-0 bg-transparent px-0 shadow-none hover:bg-secondary/80" />
          ) : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </div>
      {dashboard.branches && dashboard.branches.length > 1 ? (
        <label className="mt-3 block px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Branch
          <SelectField value={dashboard.activeBranch?.id ?? "all"} onValueChange={onSwitchBranch} options={[{ value: "all", label: "All assigned branches" }, ...dashboard.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} triggerClassName="mt-1.5 normal-case tracking-normal" />
        </label>
      ) : null}
    </div>
  );
}
