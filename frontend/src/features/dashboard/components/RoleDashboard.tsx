"use client";

import { Suspense } from "react";
import type { DashboardView } from "@/features/dashboard/api";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";
import { LoadingWorkspace } from "@/features/dashboard/components/shared/LoadingWorkspace";

export function DashboardHome() {
  return <RoleDashboard />;
}

export function RoleDashboard({
  requestedView,
}: {
  requestedView?: DashboardView;
}) {
  return (
    <Suspense fallback={<LoadingWorkspace />}>
      <DashboardShell requestedView={requestedView} />
    </Suspense>
  );
}
