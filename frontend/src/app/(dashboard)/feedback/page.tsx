"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/formatDateTime";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleHelp, Clock3, LifeBuoy, MessageSquareText, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField, type SelectOption } from "@/components/ui/select";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { platformApi, platformKeys, type PlatformTicket } from "@/features/platform/api";
import { ApiError, getErrorMessage } from "@/lib/api-client";

type RequestType = PlatformTicket["type"];
const requestOptions: SelectOption[] = [
  { value: "SUPPORT", label: "Support request", description: "Get help using Novara" },
  { value: "COMPLAINT", label: "Complaint", description: "Report a service or account issue" },
  { value: "FEEDBACK", label: "Product feedback", description: "Share an idea or suggestion" },
];
const statusOptions: SelectOption[] = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export default function FeedbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const [tenantId, setTenantId] = useState("");
  const [complaintTenantId, setComplaintTenantId] = useState("");
  const [type, setType] = useState<RequestType>("SUPPORT");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState("");

  const memberships = useMemo(() => profile.data?.memberships ?? [], [profile.data?.memberships]);
  const manageableMemberships = useMemo(() => memberships.filter(({ role }) => role === "OWNER" || role === "MANAGER"), [memberships]);
  const effectiveComplaintTenant = manageableMemberships.some(({ tenant }) => tenant.id === complaintTenantId)
    ? complaintTenantId
    : manageableMemberships[0]?.tenant.id ?? "";
  const selectedTenantId = type === "COMPLAINT" ? tenantId : tenantId || undefined;
  const history = useQuery({ queryKey: platformKeys.myFeedback, queryFn: platformApi.myFeedback, retry: false });
  const complaintQueue = useQuery({
    queryKey: platformKeys.tenantComplaints(effectiveComplaintTenant),
    queryFn: () => platformApi.tenantComplaints(effectiveComplaintTenant),
    enabled: Boolean(effectiveComplaintTenant),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: platformApi.submitFeedback,
    onSuccess: async () => {
      setSubject(""); setMessage(""); setSuccess(true); setFormError("");
      await queryClient.invalidateQueries({ queryKey: platformKeys.myFeedback });
      if (type === "COMPLAINT" && selectedTenantId) await queryClient.invalidateQueries({ queryKey: platformKeys.tenantComplaints(selectedTenantId) });
    },
    onError: () => setSuccess(false),
  });
  const resolveComplaint = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: PlatformTicket["status"] }) => platformApi.updateTenantComplaint(effectiveComplaintTenant, ticketId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: platformKeys.tenantComplaints(effectiveComplaintTenant) });
      await queryClient.invalidateQueries({ queryKey: platformKeys.myFeedback });
    },
  });

  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.statusCode === 401) router.replace("/login");
  }, [profile.error, router]);

  if (profile.isPending) return <div className="min-h-screen animate-pulse bg-secondary/35" />;
  if (profile.isError || !profile.data) return <main className="grid min-h-screen place-items-center p-6"><StatePanel title="Your session needs attention" message={getErrorMessage(profile.error)} /></main>;

  const currentRole = profile.data.platformRole ?? memberships[0]?.role ?? "MEMBER";
  const typeLabel = type === "SUPPORT" ? "Support request" : type === "COMPLAINT" ? "Complaint" : "Product feedback";
  const submitRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (type === "COMPLAINT" && !tenantId) {
      setFormError("Choose the business this complaint is about.");
      return;
    }
    setSuccess(false);
    setFormError("");
    submit.mutate({ tenantId: selectedTenantId, type, subject, message });
  };

  return (<>


      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur sm:px-8">
          <SidebarTrigger />
          <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Novara · Help center</p><h1 className="mt-0.5 text-base font-semibold sm:text-lg">Complaints & feedback</h1></div>
        </header>
        <main className="mx-auto w-full max-w-6xl space-y-7 p-4 pb-12 sm:p-8">
          <section className="relative isolate overflow-hidden rounded-3xl border border-border/70 bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <div aria-hidden className="absolute -right-16 -top-24 -z-10 size-64 rounded-full bg-primary/8 blur-3xl" />
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><LifeBuoy aria-hidden className="size-6" /></span>
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">We’re here to help</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Tell us what’s on your mind.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Send a request to our support team or share feedback. Business Owners and Managers can review and resolve complaints for their workspace.</p></div>
            </div>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)]">
            <section className="rounded-2xl border border-border/75 bg-card p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3 border-b border-border/70 pb-5"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><MessageSquareText className="size-5" /></span><div><h3 className="font-semibold">Create a request</h3><p className="mt-0.5 text-xs text-muted-foreground">Usually reviewed within one business day.</p></div></div>
              {success ? <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-4 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><p>Your {typeLabel.toLowerCase()} was sent. Track its status under Recent submissions.</p></div> : null}
              {submit.error ? <div role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(submit.error)}</div> : null}
              {formError ? <div role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{formError}</div> : null}
              <form className="mt-5 space-y-5" onSubmit={submitRequest}>
                <Field label="Request type" htmlFor="request-type"><SelectField id="request-type" value={type} onValueChange={(value) => { setType(value as RequestType); setFormError(""); }} options={requestOptions} /></Field>
                {memberships.length ? <Field label={type === "COMPLAINT" ? "Business workspace" : "Related business (optional)"} htmlFor="business-workspace"><SelectField id="business-workspace" value={tenantId} onValueChange={setTenantId} placeholder="Choose a business" options={[
                  { value: "", label: "Personal / account-level" },
                  ...memberships.map(({ tenant }) => ({ value: tenant.id, label: tenant.name })),
                ]} />{type === "COMPLAINT" ? <p className="text-xs text-muted-foreground">A complaint must be linked to a workspace so its Owner or Manager can follow up.</p> : null}</Field> : null}
                <Field label="Subject" htmlFor="feedback-subject"><Input id="feedback-subject" required minLength={4} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A short summary of your request" /></Field>
                <Field label="Details" htmlFor="feedback-message"><Textarea id="feedback-message" required minLength={10} maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className="resize-y rounded-xl px-4 py-3 text-sm leading-6" placeholder="Share the details that will help us understand…" /><span className="block text-right text-[11px] text-muted-foreground">{message.length}/5000</span></Field>
                <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Your submission is only visible to authorized staff.</p><Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">{submit.isPending ? "Sending…" : "Send request"}<Send aria-hidden className="size-4" /></Button></div>
              </form>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/75 bg-card shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-border/70 p-5 sm:px-6"><div><h3 className="font-semibold">Recent submissions</h3><p className="mt-1 text-xs text-muted-foreground">Status updates from the support team.</p></div><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Clock3 className="size-5" /></span></div>
              {history.isPending ? <LoadingState /> : history.isError ? <StatePanel title="Submissions could not be loaded" message={getErrorMessage(history.error)} onRetry={() => void history.refetch()} /> : history.data?.length ? <div className="divide-y divide-border/70">{history.data.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</div> : <EmptyState title="No requests yet" description="Support requests and feedback you send will appear here." icon="sparkles" />}
            </section>
          </div>

          {manageableMemberships.length ? <section className="overflow-hidden rounded-2xl border border-border/75 bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Business manager view</p><h3 className="mt-1 text-lg font-semibold">Complaint queue</h3><p className="mt-1 text-xs text-muted-foreground">Only Owners and Managers can update complaint status.</p></div>{manageableMemberships.length > 1 ? <div className="w-full sm:max-w-xs"><SelectField aria-label="Choose complaint workspace" value={effectiveComplaintTenant} onValueChange={setComplaintTenantId} options={manageableMemberships.map(({ tenant }) => ({ value: tenant.id, label: tenant.name }))} /></div> : <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{manageableMemberships[0].tenant.name}</span>}</div>
            {complaintQueue.isPending ? <LoadingState /> : complaintQueue.isError ? <StatePanel title="Complaint queue unavailable" message={getErrorMessage(complaintQueue.error)} onRetry={() => void complaintQueue.refetch()} /> : complaintQueue.data?.length ? <div className="divide-y divide-border/70">{complaintQueue.data.map((ticket) => <article key={ticket.id} className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-start sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300">Complaint</span><StatusBadge status={ticket.status} /></div><h4 className="mt-2 font-semibold">{ticket.subject}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{ticket.message}</p><p className="mt-3 text-xs text-muted-foreground">From {ticket.createdBy.name} · {formatDate(ticket.createdAt)}</p></div><div className="space-y-2"><label className="block text-xs font-medium text-muted-foreground" htmlFor={`complaint-status-${ticket.id}`}>Update status</label><SelectField id={`complaint-status-${ticket.id}`} value={ticket.status} options={statusOptions} disabled={resolveComplaint.isPending} triggerClassName="h-10" onValueChange={(value) => resolveComplaint.mutate({ ticketId: ticket.id, status: value as PlatformTicket["status"] })} /></div></article>)}</div> : <EmptyState title="No open complaints" description="Complaints submitted for this business will appear here for an Owner or Manager to review." icon="help" />}
            {resolveComplaint.error ? <p role="alert" className="border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">{getErrorMessage(resolveComplaint.error)}</p> : null}
          </section> : null}
        </main>
      </SidebarInset>

  </>);
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div className="space-y-2"><label htmlFor={htmlFor} className="block text-sm font-medium">{label}</label>{children}</div>; }
function TicketCard({ ticket }: { ticket: PlatformTicket }) { return <article className="p-5 sm:px-6"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{ticket.type === "SUPPORT" ? "Support" : ticket.type === "COMPLAINT" ? "Complaint" : "Product feedback"}</span><StatusBadge status={ticket.status} /></div><h4 className="mt-2 text-sm font-semibold">{ticket.subject}</h4><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{ticket.message}</p><p className="mt-3 text-xs text-muted-foreground">{ticket.tenant?.name ? `${ticket.tenant.name} · ` : ""}{formatDate(ticket.createdAt)}</p></article>; }
function StatusBadge({ status }: { status: PlatformTicket["status"] }) { const styles = status === "OPEN" ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : status === "IN_PROGRESS" ? "bg-blue-500/10 text-blue-800 dark:text-blue-300" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles}`}>{status.replaceAll("_", " ")}</span>; }
function EmptyState({ title, description, icon }: { title: string; description: string; icon: "sparkles" | "help" }) { const Icon = icon === "sparkles" ? Sparkles : CircleHelp; return <div className="px-6 py-12 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-secondary text-primary"><Icon className="size-5" /></span><h4 className="mt-3 text-sm font-semibold">{title}</h4><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p></div>; }
function LoadingState() { return <div className="space-y-3 p-5" aria-busy="true">{[0, 1, 2].map((index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-secondary/60" />)}<span className="sr-only">Loading submissions…</span></div>; }
function StatePanel({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) { return <div className="p-5"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{message}</p>{onRetry ? <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button> : null}</div>; }
function formatDate(value: string) { return formatDateTime(new Date(value), "en", { dateStyle: "medium" }); }
