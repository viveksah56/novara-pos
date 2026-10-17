import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarInset,  } from "@/components/ui/sidebar";
import type { DashboardView } from "@/features/dashboard/api";
import { AdminContent } from "@/features/dashboard/components/views/AdminContent";
import { InventoryContent } from "@/features/dashboard/components/views/InventoryContent";
import { KitchenContent } from "@/features/dashboard/components/views/KitchenContent";
import { OverviewContent } from "@/features/dashboard/components/views/OverviewContent";
import { PosContent } from "@/features/dashboard/components/views/PosContent";
import { DashboardFooter } from "@/features/dashboard/components/shell/DashboardFooter";
import { DashboardHeader } from "@/features/dashboard/components/shell/DashboardHeader";
import { DashboardPageHeader } from "@/features/dashboard/components/shell/DashboardPageHeader";
import { SidebarStatus } from "@/features/dashboard/components/shell/SidebarStatus";
import { WorkspaceSwitcher } from "@/features/dashboard/components/shell/WorkspaceSwitcher";
import { LoadingWorkspace } from "@/features/dashboard/components/shared/LoadingWorkspace";
import { WorkspaceError } from "@/features/dashboard/components/shared/WorkspaceError";
import { ROLE_HOME, roleTitles } from "@/features/dashboard/config/roles";
import { useDashboardSession } from "@/features/dashboard/hooks/useDashboardSession";
import { ApiError, getErrorMessage } from "@/lib/api-client";

/**
 * Role-aware workspace frame: resolves the session, handles loading / error / no-access
 * states, then renders the sidebar, header, and the view matching the dashboard payload.
 */
export function DashboardShell({ requestedView }: { requestedView?: DashboardView }) {
  const {
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
  } = useDashboardSession(requestedView);

  if (loggedInUserQuery.isPending) return <LoadingWorkspace />;
  if (loggedInUserQuery.isError)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <WorkspaceError
          message={getErrorMessage(loggedInUserQuery.error)}
          error={loggedInUserQuery.error}
          retry={() => void loggedInUserQuery.refetch()}
        />
      </main>
    );
  if (!loggedInUser || !role)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="max-w-md rounded-2xl border border-border bg-card p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Building2 className="size-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold">No workspace access</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your account is not assigned to a business workspace. Ask an owner
            to invite you, then sign in again.
          </p>
          <Button className="mt-5" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
            Sign out
          </Button>
          {logoutMutation.error ? <p role="alert" className="mt-3 text-sm text-destructive">{getErrorMessage(logoutMutation.error)}</p> : null}
        </section>
      </main>
    );
  if (dashboardQuery.isPending) return <LoadingWorkspace />;

  const isForbidden =
    dashboardQuery.error instanceof ApiError &&
    dashboardQuery.error.statusCode === 403;
  if (dashboardQuery.isError)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <WorkspaceError
          message={
            isForbidden
              ? "Your account does not have access to this dashboard."
              : getErrorMessage(dashboardQuery.error)
          }
          error={dashboardQuery.error}
          retry={() => void dashboardQuery.refetch()}
        />
      </main>
    );

  const dashboard = dashboardQuery.data;
  const heading = roleTitles[role] ?? "Workspace";

  return (<>


      <SidebarInset>
        <div className="min-w-0 flex-1">
          <DashboardHeader
            role={role}
            heading={heading}
            userName={loggedInUser.name}
            navItems={visibleNav}
          />
          <main className="mx-auto w-full max-w-[1440px] p-4 pb-10 sm:p-7 xl:px-10 xl:py-8">
            <DashboardPageHeader
              role={role}
              userName={loggedInUser.name}
              dataStatus={dashboard.dataStatus}
              onRefresh={() => void dashboardQuery.refetch()}
            />
            {dashboard.view === "overview" ? (
              <OverviewContent dashboard={dashboard} role={role} />
            ) : dashboard.view === "pos" ? (
              <PosContent key={`${dashboard.tenant?.id ?? "platform"}:${dashboard.activeBranch?.id ?? "default"}:${searchParams.get("tableId") ?? "walk-in"}:${searchParams.get("newOrder") ?? ""}`} dashboard={dashboard} role={role} actorId={loggedInUser?.id ?? "anonymous"} tableId={searchParams.get("tableId") ?? undefined} startNewOrder={searchParams.get("newOrder") === "1"} />
            ) : dashboard.view === "kitchen" ? (
              <KitchenContent dashboard={dashboard} />
            ) : dashboard.view === "inventory" ? (
              <InventoryContent dashboard={dashboard} />
            ) : (
              <AdminContent dashboard={dashboard} />
            )}
            <DashboardFooter />
          </main>
        </div>
      </SidebarInset>

  </>);
}
