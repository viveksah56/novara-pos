import { Pencil, Tag, Trash2 } from "lucide-react";
import type { ActionModel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@/features/platform/api";
import { HealthSummaryRow } from "@/features/platform/components/shared/HealthSummaryRow";
import { StatusPill } from "@/features/platform/components/shared/StatusPill";
import { formatMoney } from "@/lib/formatMoney";

type PlanCardProps = {
  plan: SubscriptionPlan;
  onEdit: (plan: SubscriptionPlan) => void;
  onAction: (action: ActionModel) => void;
};

export function PlanCard({ plan, onEdit, onAction }: PlanCardProps) {
  return (
    <article className="rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary"><Tag className="size-5" /></span><StatusPill status={plan.isActive ? "ACTIVE" : "SUSPENDED"} /></div><h3 className="mt-5 text-xl font-semibold">{plan.name}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{plan.description || "A Novara subscription tier."}</p><p className="mt-5 text-3xl font-semibold tracking-tight">{formatMoney(plan.priceMonthly, plan.currency)}<span className="ml-1 text-sm font-normal text-muted-foreground">/ month</span></p><div className="mt-5 space-y-3 border-t border-border pt-4 text-sm"><HealthSummaryRow label="Trial" value={`${plan.trialDays} days`} /><HealthSummaryRow label="Branches" value={plan.maxBranches ? `Up to ${plan.maxBranches}` : "Unlimited"} /><HealthSummaryRow label="Staff" value={plan.maxStaff ? `Up to ${plan.maxStaff}` : "Unlimited"} /><HealthSummaryRow label="Businesses using plan" value={`${plan._count.tenants}`} /></div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => onEdit(plan)}><Pencil className="size-4" />Edit</Button>{plan.isActive ? <Button variant="outline" onClick={() => onAction({ kind: "DEACTIVATE_PLAN", subject: plan.name, resourceId: plan.id })}>Deactivate plan</Button> : <Button variant="outline" onClick={() => onAction({ kind: "ACTIVATE_PLAN", subject: plan.name, resourceId: plan.id })}>Activate plan</Button>}{!plan.isActive && plan._count.tenants === 0 ? <Button variant="destructive" onClick={() => onAction({ kind: "DELETE_PLAN", subject: plan.name, resourceId: plan.id })}><Trash2 className="size-4" />Delete plan</Button> : null}</div></article>
  );
}
