"use client";

import { RouteFailure } from "@/components/layout/RouteFailure";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteFailure error={error} retry={retry} title="We couldn’t load this workspace" />;
}
