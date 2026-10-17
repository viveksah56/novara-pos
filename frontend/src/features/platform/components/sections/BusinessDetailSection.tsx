import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { platformApi, platformKeys } from "@/features/platform/api";
import { EmptyState } from "@/features/platform/components/shared/EmptyState";
import { LoadingGrid } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { StatusPill } from "@/features/platform/components/shared/StatusPill";
import { usePlatformActions } from "@/features/platform/context/PlatformActionsContext";
import { initials, shortDate } from "@/features/platform/lib/format";
import { getErrorMessage } from "@/lib/api-client";

export function BusinessDetailSection({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify, requestAction: onAction } = usePlatformActions();
  const query = useQuery({ queryKey: platformKeys.business(businessId), queryFn: () => platformApi.business(businessId), retry: false });
  const assignablePlans = useQuery({ queryKey: platformKeys.plans, queryFn: platformApi.plans, enabled: canManage, retry: false });
  const assignPlan = useMutation({
    mutationFn: (planId: string | null) => platformApi.updateBusiness(businessId, { planId }),
    onSuccess: async () => { notify("Business plan updated."); await queryClient.invalidateQueries({ queryKey: platformKeys.all }); },
    onError: (error) => notify(getErrorMessage(error), true),
  });
  const plans = assignablePlans.data ?? [];
  const planPending = assignPlan.isPending || assignablePlans.isPending;
  const onPlanChange = (planId: string | null) => assignPlan.mutate(planId);
  const onBack = () => router.push("/admin/businesses");
  if (query.isPending) return <LoadingGrid />;
  if (query.isError || !query.data) return <StatePanel title="Business details are unavailable" description={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const business = query.data;
  return <>
    <button className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={onBack}><ArrowDownRight className="size-4 rotate-45" />Back to businesses</button>
    <section className="rounded-2xl border border-border/75 bg-card p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><Building2 className="size-6" /></span><div><div className="flex flex-wrap items-center gap-3"><h3 className="text-2xl font-semibold">{business.name}</h3><StatusPill status={business.status} /></div><p className="mt-1.5 text-sm text-muted-foreground">Joined {shortDate(business.createdAt)} · {business.currency}</p></div></div>{canManage ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onAction({ kind: business.status === "ACTIVE" ? "SUSPEND_BUSINESS" : "RESTORE_BUSINESS", subject: business.name, resourceId: business.id })}>{business.status === "ACTIVE" ? "Suspend business" : "Reactivate"}</Button></div> : null}</div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-secondary/55 p-4"><p className="text-xs text-muted-foreground">Subscription plan</p>{canManage ? <SelectField aria-label="Assign subscription plan" value={business.planId ?? "none"} disabled={planPending} onValueChange={(value) => onPlanChange(value === "none" ? null : value)} options={[{ value: "none", label: "No plan assigned" }, ...plans.filter((plan) => plan.isActive).map((plan) => ({ value: plan.id, label: plan.name }))]} triggerClassName="mt-2 bg-card" /> : <p className="mt-2 text-sm font-semibold">{business.plan?.name ?? "No plan assigned"}</p>}</div><div className="rounded-xl bg-secondary/55 p-4"><p className="text-xs text-muted-foreground">Branches</p><p className="mt-2 text-sm font-semibold">{business._count.branches}</p></div><div className="rounded-xl bg-secondary/55 p-4"><p className="text-xs text-muted-foreground">Team members</p><p className="mt-2 text-sm font-semibold">{business._count.memberships}</p></div></div></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="rounded-2xl border border-border bg-card"><div className="border-b border-border p-5"><p className="text-xs text-muted-foreground">Locations</p><h3 className="mt-1 text-lg font-semibold">Branches</h3></div>{business.branches.length ? <ul className="divide-y divide-border">{business.branches.map((branch) => <li key={branch.id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{branch.name}</p><p className="mt-1 text-xs text-muted-foreground">{branch.timezone}</p></div><span className="shrink-0 text-xs text-muted-foreground">{shortDate(branch.createdAt)}</span></li>)}</ul> : <EmptyState icon={Building2} title="No branches" description="This business has not created a branch." />}</article>
      <article className="rounded-2xl border border-border bg-card"><div className="border-b border-border p-5"><p className="text-xs text-muted-foreground">Access</p><h3 className="mt-1 text-lg font-semibold">Business team</h3></div>{business.memberships.length ? <ul className="divide-y divide-border">{business.memberships.map((membership) => <li key={membership.user.id} className="flex items-center gap-3 px-5 py-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">{initials(membership.user.name)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{membership.user.name}</span><span className="block truncate text-xs text-muted-foreground">{membership.user.email}</span></span><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium">{membership.role.toLowerCase().replaceAll("_", " ")}</span></li>)}</ul> : <EmptyState icon={Users} title="No team members" description="No users have been assigned to this business." />}</article></section>
  </>;
}
