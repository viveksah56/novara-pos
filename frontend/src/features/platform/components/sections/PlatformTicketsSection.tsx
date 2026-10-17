import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { SelectField } from "@/components/ui/select";
import { platformApi, platformKeys, type PlatformTicket } from "@/features/platform/api";
import { EmptyState } from "@/features/platform/components/shared/EmptyState";
import { LoadingRows } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { usePlatformActions } from "@/features/platform/context/PlatformActionsContext";
import { shortDate } from "@/features/platform/lib/format";
import { getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function PlatformTicketsSection({ canResolveBusinessComplaints }: { canResolveBusinessComplaints: boolean }) {
  const queryClient = useQueryClient();
  const { notify } = usePlatformActions();
  const query = useQuery({ queryKey: platformKeys.tickets, queryFn: platformApi.tickets, retry: false });
  const ticketMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PlatformTicket["status"] }) => platformApi.updateTicket(id, status),
    onSuccess: async () => { notify("Ticket status updated."); await queryClient.invalidateQueries({ queryKey: platformKeys.tickets }); },
    onError: (error) => notify(getErrorMessage(error), true),
  });
  const pending = ticketMutation.isPending;
  const onStatusChange = (id: string, status: PlatformTicket["status"]) => ticketMutation.mutate({ id, status });
  return <section className="overflow-hidden rounded-2xl border border-border/75 bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6"><div><h3 className="font-semibold">Customer inbox</h3><p className="mt-1 text-xs text-muted-foreground">Global visibility for Super Admins and Support Agents. Business complaints are resolved by their Owner or Manager.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{query.data?.filter((ticket) => ticket.status === "OPEN" || ticket.status === "IN_PROGRESS").length ?? 0} active</span></div>
    {query.isPending ? <LoadingRows /> : query.isError ? <StatePanel title="Support tickets could not be loaded" description={getErrorMessage(query.error)} retry={() => void query.refetch()} /> : query.data?.length ? <div className="divide-y divide-border">{query.data.map((ticket) => <article key={ticket.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-start sm:px-6 sm:py-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{ticket.type}</span><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", ticket.status === "OPEN" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : ticket.status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-800 dark:text-blue-300" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>{ticket.status.replaceAll("_", " ")}</span><span className="text-[11px] text-muted-foreground">{ticket.priority} priority</span></div><h4 className="mt-2 text-sm font-semibold">{ticket.subject}</h4><p className="mt-1 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{ticket.message}</p><p className="mt-3 text-xs text-muted-foreground">{ticket.createdBy.name} · {ticket.createdBy.email}{ticket.tenant ? ` · ${ticket.tenant.name}` : ""} · {shortDate(ticket.createdAt)}</p></div>{ticket.type === "COMPLAINT" && ticket.tenantId && !canResolveBusinessComplaints ? <p className="text-xs leading-5 text-muted-foreground">A Super Admin or the business Owner/Manager can update this complaint.</p> : <div className="space-y-2"><label className="block text-xs font-medium text-muted-foreground" htmlFor={`platform-ticket-${ticket.id}`}>Update status</label><SelectField id={`platform-ticket-${ticket.id}`} value={ticket.status} disabled={pending} onValueChange={(value) => onStatusChange(ticket.id, value as PlatformTicket["status"])} options={[{ value: "OPEN", label: "Open" }, { value: "IN_PROGRESS", label: "In progress" }, { value: "RESOLVED", label: "Resolved" }, { value: "CLOSED", label: "Closed" }]} triggerClassName="h-10" /> </div>}</article>)}</div> : <EmptyState icon={MessageSquareText} title="Your inbox is clear" description="Customer complaints, feedback and support requests will show up here." />}
  </section>;
}
