import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, BadgeCheck, Building2, CalendarClock, ChevronRight, CircleDollarSign, FileWarning, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { platformApi, platformKeys } from "@/features/platform/api";
import { BusinessListRow } from "@/features/platform/components/sections/BusinessListRow";
import { EmptyState } from "@/features/platform/components/shared/EmptyState";
import { HealthSummaryRow } from "@/features/platform/components/shared/HealthSummaryRow";
import { LoadingGrid } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { StatTile } from "@/features/platform/components/shared/StatTile";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatMoney";
import { pollWhenVisible } from "@/lib/polling";

export function OverviewSection() {
  const router = useRouter();
  const query = useQuery({ queryKey: platformKeys.overview, queryFn: platformApi.overview, refetchInterval: pollWhenVisible(30_000), retry: false });
  const healthQuery = useQuery({ queryKey: platformKeys.health, queryFn: platformApi.health, retry: false, refetchInterval: 60_000 });
  const health = healthQuery.data;
  const onNavigate = (path: string) => router.push(path);
  if (query.isPending) return <LoadingGrid />;
  if (query.isError || !query.data) return <StatePanel title="Platform overview is unavailable" description={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const { metrics, recentBusinesses } = query.data;
  const mrrText = metrics.monthlyRecurringRevenue.length ? metrics.monthlyRecurringRevenue.map((item) => formatMoney(item.amount, item.currency)).join(" · ") : "No active subscriptions";
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatTile label="Total businesses" value={metrics.businesses} detail="Registered workspaces" icon={Building2} tone="primary" /><StatTile label="Active businesses" value={metrics.activeBusinesses} detail={`${metrics.suspendedBusinesses} suspended`} icon={BadgeCheck} /><StatTile label="Monthly recurring revenue" value={mrrText} detail="Active subscriptions · grouped by currency" icon={CircleDollarSign} /><StatTile label="Trials ending soon" value={metrics.trialsEndingSoon} detail="Trial ends within 7 days" icon={CalendarClock} /></section>
    <section className="mt-4 grid gap-4 sm:grid-cols-2"><StatTile label="Past-due subscriptions" value={metrics.pastDueSubscriptions} detail="Billing follow-up required" icon={FileWarning} /><StatTile label="System health" value={health?.status === "operational" ? "Operational" : health?.status === "degraded" ? "Degraded" : "Checking"} detail={health ? `${health.services.filter((service) => service.status === "operational").length}/${health.services.length} core services operational` : "Health check is loading"} icon={Activity} /></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]"><article className="overflow-hidden rounded-2xl border border-border/75 bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><div><p className="text-xs font-medium text-muted-foreground">Recent activity</p><h3 className="mt-1 text-lg font-semibold">New businesses</h3></div><Button variant="outline" onClick={() => onNavigate("/admin/businesses")}>View all <ArrowRight className="size-4" /></Button></div>{recentBusinesses.length ? <div className="divide-y divide-border">{recentBusinesses.slice(0, 6).map((business) => <BusinessListRow key={business.id} business={business} onClick={() => onNavigate(`/admin/businesses/${business.id}`)} />)}</div> : <EmptyState icon={Building2} title="No businesses yet" description="New workspaces will appear here after they register." />}</article>
      <aside className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5" /></span><div><p className="text-xs text-muted-foreground">Operations</p><h3 className="text-lg font-semibold">Platform snapshot</h3></div></div><div className="mt-6 space-y-4"><HealthSummaryRow label="Active businesses" value={`${metrics.activeBusinesses}`} /><HealthSummaryRow label="Suspended businesses" value={`${metrics.suspendedBusinesses}`} /><HealthSummaryRow label="Plans without assignment" value={`${metrics.activePlans} plans · ${metrics.unassignedBusinesses} businesses`} /></div><button data-control-layout="content" className="mt-6 flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm font-medium hover:bg-secondary" onClick={() => onNavigate("/admin/system")}>Review system health <ChevronRight className="size-4 text-muted-foreground" /></button></aside></section>
  </>;
}
