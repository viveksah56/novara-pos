import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SubscriptionPlan } from "@/features/platform/api";
import { Field } from "@/features/platform/components/shared/Field";
import { usePlatformActions } from "@/features/platform/context/PlatformActionsContext";
import type { PlanInput } from "@/features/platform/types";

type PlanFormProps = {
  /** Plan being edited, or null to create a new one. Remount (via `key`) to reset the draft. */
  plan: SubscriptionPlan | null;
  pending: boolean;
  onSubmit: (input: PlanInput) => void;
};

export function PlanForm({ plan, pending, onSubmit }: PlanFormProps) {
  const { notify } = usePlatformActions();
  const editing = plan !== null;
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(plan ? String(plan.priceMonthly) : "0");
  const [currency, setCurrency] = useState(plan?.currency ?? "NPR");
  const [trialDays, setTrialDays] = useState(plan ? String(plan.trialDays) : "14");
  const [branches, setBranches] = useState(plan?.maxBranches ? String(plan.maxBranches) : "");
  const [staff, setStaff] = useState(plan?.maxStaff ? String(plan.maxStaff) : "");

  function onSave() {
    if (!name.trim()) { notify("Enter a name for the plan.", true); return; }
    onSubmit({ name: name.trim(), description: description.trim() || null, priceMonthly: Number(price), currency: currency.toUpperCase(), trialDays: Number(trialDays), maxBranches: branches ? Number(branches) : null, maxStaff: staff ? Number(staff) : null });
  }

  return (
    <form className="mb-5 rounded-2xl border border-border bg-card p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); onSave(); }}><div className="mb-5"><h3 className="font-semibold">{editing ? "Edit plan" : "Create a plan"}</h3><p className="mt-1 text-sm text-muted-foreground">Set pricing, trial length and service limits for business assignments.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Plan name"><Input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Starter" /></Field><Field label="Monthly price"><Input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></Field><Field label="Currency"><Input required minLength={3} maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></Field><Field label="Trial days"><Input required type="number" min="0" max="365" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} /></Field><Field label="Branch limit"><Input type="number" min="1" value={branches} onChange={(event) => setBranches(event.target.value)} placeholder="Unlimited" /></Field><Field label="Staff limit"><Input type="number" min="1" value={staff} onChange={(event) => setStaff(event.target.value)} placeholder="Unlimited" /></Field><div className="sm:col-span-2 xl:col-span-3"><Field label="Description"><Input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is included in this plan?" /></Field></div></div><div className="mt-5 flex justify-end"><Button type="submit" disabled={pending}>{editing ? <Check className="size-4" /> : <Plus className="size-4" />}{pending ? "Saving…" : editing ? "Save changes" : "Create plan"}</Button></div></form>
  );
}
