import { EntityStatusBadge, StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import type { TenantStatus } from "@/constants/system-constants";

export function StatusPill({ status }: { status: TenantStatus | "operational" | "degraded" }) {
  if (status === "ACTIVE" || status === "SUSPENDED") return <EntityStatusBadge domain="TenantStatus" status={status} dot />;
  const tone: StatusTone = status === "operational" ? "positive" : "warning";
  const label = status === "operational" ? "Operational" : "Needs attention";
  return <StatusBadge tone={tone} dot>{label}</StatusBadge>;
}
