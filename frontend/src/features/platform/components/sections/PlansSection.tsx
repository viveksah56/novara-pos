import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { platformApi, platformKeys, type SubscriptionPlan } from "@/features/platform/api";
import { PlanCard } from "@/features/platform/components/sections/PlanCard";
import { PlanForm } from "@/features/platform/components/sections/PlanForm";
import { EmptyState } from "@/features/platform/components/shared/EmptyState";
import { LoadingGrid } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { usePlatformActions } from "@/features/platform/context/PlatformActionsContext";
import type { PlanInput } from "@/features/platform/types";
import { getErrorMessage } from "@/lib/api-client";

export function PlansSection() {
  const queryClient = useQueryClient();
  const { notify, requestAction } = usePlatformActions();
  const query = useQuery({ queryKey: platformKeys.plans, queryFn: platformApi.plans, retry: false });
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const savePlan = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: PlanInput }) => id ? platformApi.updatePlan(id, input) : platformApi.createPlan(input),
    onSuccess: async (_, { id }) => { setFormOpen(false); setEditingPlan(null); notify(id ? "Subscription plan updated." : "Subscription plan created."); await queryClient.invalidateQueries({ queryKey: platformKeys.all }); },
    onError: (error) => notify(getErrorMessage(error), true),
  });
  function toggleForm() {
    if (formOpen) setEditingPlan(null);
    setFormOpen(!formOpen);
  }
  function onEdit(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setFormOpen(true);
  }
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Plans define pricing and usage limits.</p></div><Button onClick={() => toggleForm()}>{formOpen ? <XCircle className="size-4" /> : <Plus className="size-4" />}{formOpen ? "Cancel" : "New plan"}</Button></div>
    {formOpen ? <PlanForm key={editingPlan?.id ?? "new"} plan={editingPlan} pending={savePlan.isPending} onSubmit={(input) => savePlan.mutate({ id: editingPlan?.id ?? null, input })} /> : null}
    {query.isPending ? <LoadingGrid /> : query.isError ? <StatePanel title="Plans could not be loaded" description={getErrorMessage(query.error)} retry={() => void query.refetch()} /> : query.data?.length ? <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{query.data.map((plan) => <PlanCard key={plan.id} plan={plan} onEdit={onEdit} onAction={requestAction} />)}</section> : <EmptyState icon={Tag} title="Create the first subscription plan" description="Plans can be created now and assigned to businesses as billing enrollment is added." />}
  </>;
}
