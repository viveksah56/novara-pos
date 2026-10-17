import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Globe2, PackageCheck } from "lucide-react";
import { platformApi, platformKeys } from "@/features/platform/api";
import { LoadingGrid } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { StatusPill } from "@/features/platform/components/shared/StatusPill";
import { formatUptime } from "@/features/platform/lib/format";
import { getErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/formatDateTime";

export function SystemSection() {
  const query = useQuery({ queryKey: platformKeys.health, queryFn: platformApi.health, retry: false, refetchInterval: 60_000 });
  if (query.isPending) return <LoadingGrid />;
  if (query.isError || !query.data) return <StatePanel title="System health is unavailable" description={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const health = query.data;
  return <><section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Activity className="size-5" /></span><div><p className="text-xs text-muted-foreground">Overall platform status</p><h3 className="mt-1 text-xl font-semibold">All systems {health.status}</h3></div></div><StatusPill status={health.status} /></div><p className="mt-5 text-xs text-muted-foreground">Last checked {formatDateTime(new Date(health.checkedAt), "en", { dateStyle: "medium", timeStyle: "short" })} · Refreshes every minute</p></section>
    <section className="mt-5 grid gap-4 md:grid-cols-2">{health.services.map((service) => <article key={service.name} className="flex items-center gap-4 rounded-2xl border border-border/75 bg-card p-5"><span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">{service.name === "PostgreSQL" ? <Database className="size-5" /> : <Globe2 className="size-5" />}</span><div className="min-w-0 flex-1"><h4 className="font-semibold">{service.name}</h4><p className="mt-1 text-xs text-muted-foreground">Core platform dependency</p></div><StatusPill status={service.status} /></article>)}</section>
    <section className="mt-5 rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><PackageCheck className="size-5" /></span><div><p className="text-xs text-muted-foreground">Runtime</p><h3 className="text-lg font-semibold">Service environment</h3></div></div><div className="grid gap-3 sm:grid-cols-3"><RuntimeValue label="Environment" value={health.runtime.environment} /><RuntimeValue label="Node.js" value={health.runtime.nodeVersion} /><RuntimeValue label="Process uptime" value={formatUptime(health.runtime.uptimeSeconds)} /></div></section></>;
}

function RuntimeValue({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/60 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold capitalize">{value}</p></div>; }
