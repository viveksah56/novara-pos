import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platformApi, platformKeys } from "@/features/platform/api";
import { EmptyState } from "@/features/platform/components/shared/EmptyState";
import { LoadingRows } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { usePlatformActions } from "@/features/platform/context/PlatformActionsContext";
import { initials } from "@/features/platform/lib/format";
import { getErrorMessage } from "@/lib/api-client";

export function SupportStaffSection() {
  const queryClient = useQueryClient();
  const { notify, requestAction: onAction } = usePlatformActions();
  const [email, onEmail] = useState("");
  const query = useQuery({ queryKey: platformKeys.agents, queryFn: platformApi.agents, retry: false });
  const addAgent = useMutation({
    mutationFn: platformApi.addAgent,
    onSuccess: async (agent) => { onEmail(""); notify(`${agent.user.name} now has Support Agent access.`); await queryClient.invalidateQueries({ queryKey: platformKeys.all }); },
    onError: (error) => notify(getErrorMessage(error), true),
  });
  const pending = addAgent.isPending;
  const onAdd = () => {
    if (!email.trim()) { notify("Enter the account email to assign.", true); return; }
    addAgent.mutate(email.trim());
  };
  return <><section className="mb-5 rounded-2xl border border-border/75 bg-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><UserPlus className="size-5" /></span><div><h3 className="font-semibold">Assign a Support Agent</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">The person must already have an active Novara account. They will be able to search and view business account context.</p></div></div><form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); onAdd(); }}><Input type="email" required value={email} onChange={(event) => onEmail(event.target.value)} placeholder="support@novara.com" aria-label="Support agent email" /><Button disabled={pending}><UserPlus className="size-4" />{pending ? "Assigning…" : "Assign role"}</Button></form></section>
    <section className="overflow-hidden rounded-2xl border border-border/75 bg-card"><div className="border-b border-border p-5"><p className="text-xs text-muted-foreground">Platform access</p><h3 className="mt-1 text-lg font-semibold">Support Agents</h3></div>{query.isPending ? <LoadingRows /> : query.isError ? <StatePanel title="Support staff could not be loaded" description={getErrorMessage(query.error)} retry={() => void query.refetch()} /> : query.data?.length ? <div className="divide-y divide-border">{query.data.map((agent) => <div key={agent.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5"><span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">{initials(agent.user.name)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{agent.user.name}</p><p className="truncate text-xs text-muted-foreground">{agent.user.email}</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium">Support Agent</span><Button variant="ghost" size="icon" aria-label={`Remove ${agent.user.name}`} onClick={() => onAction({ kind: "REMOVE_SUPPORT_AGENT", subject: agent.user.name, resourceId: agent.user.id })}><Trash2 className="size-4 text-destructive" /></Button></div>)}</div> : <EmptyState icon={LifeBuoy} title="No Support Agents assigned" description="Assign an existing Novara account when your support team is ready." />}</section></>;
}
