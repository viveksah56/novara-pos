"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatDateTime } from "@/lib/formatDateTime";
import { usePathname, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BarChart3, Building2, CalendarDays, CircleDollarSign, CreditCard, LayoutDashboard, Package, Plus, ReceiptText, Users } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { WorkspaceSidebar, type WorkspaceNavGroup } from "@/components/layout/WorkspaceSidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { createExpense, createExpenseCategory, getExpenseCategories, getExpenses, voidExpense, type ExpensePaymentMethod, type ExpenseRecord } from "@/features/expenses/api/expensesApi";
import { getErrorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatMoney";

const methodOptions = ["CASH", "CARD", "BANK_TRANSFER", "DIGITAL_WALLET", "OTHER"] as const;
const monthStart = (value: string) => `${value}-01`;
function monthEnd(value: string) { const [year, month] = value.split("-").map(Number); return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10); }

export function ExpensesPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false });
  const memberships = profile.data?.memberships ?? [];
  const membership = memberships.find((item) => item.tenant.id === params.get("tenantId")) ?? memberships[0];
  const tenantId = membership?.tenant.id ?? "";
  const role = membership?.role ?? "";
  const branches = useMemo(() => role === "OWNER" ? membership?.tenant.branches ?? [] : (membership?.tenant.branches ?? []).filter((branch) => membership?.branchAssignments.some((assignment) => assignment.branchId === branch.id)), [membership, role]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [branchId, setBranchId] = useState(params.get("branchId") ?? (role === "OWNER" ? "all" : branches[0]?.id ?? ""));
  const [addOpen, setAddOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [voidTarget, setVoidTarget] = useState<ExpenseRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [form, setForm] = useState({ branchId: "", categoryId: "", amount: "", expenseDate: new Date().toISOString().slice(0, 10), description: "", paymentMethod: "CASH" as ExpensePaymentMethod, reference: "" });
  const queryBranch = branchId && branchId !== "all" ? branchId : undefined;
  const categories = useQuery({ queryKey: ["expenses", tenantId, "categories"], queryFn: () => getExpenseCategories(tenantId), enabled: Boolean(tenantId && ["OWNER", "MANAGER"].includes(role)), retry: false });
  const expenses = useQuery({ queryKey: ["expenses", tenantId, queryBranch, month], queryFn: () => getExpenses(tenantId, { ...(queryBranch ? { branchId: queryBranch } : {}), from: monthStart(month), to: monthEnd(month) }), enabled: Boolean(tenantId && ["OWNER", "MANAGER"].includes(role)), retry: false });
  const invalidateExpenses = async () => { await queryClient.invalidateQueries({ queryKey: ["expenses", tenantId] }); await queryClient.invalidateQueries({ queryKey: ["reports", tenantId] }); };
  const createMutation = useMutation({ mutationFn: () => createExpense(tenantId, { ...form, amount: Number(form.amount), ...(form.reference.trim() ? { reference: form.reference.trim() } : {}) }), onSuccess: async () => { setAddOpen(false); setForm((current) => ({ ...current, amount: "", description: "", reference: "" })); await invalidateExpenses(); } });
  const categoryMutation = useMutation({ mutationFn: () => createExpenseCategory(tenantId, categoryName.trim()), onSuccess: async (result) => { setCategoryName(""); await queryClient.invalidateQueries({ queryKey: ["expenses", tenantId, "categories"] }); setForm((current) => ({ ...current, categoryId: result.category.id })); } });
  const voidMutation = useMutation({ mutationFn: () => voidExpense(tenantId, voidTarget!.id, voidReason.trim()), onSuccess: async () => { setVoidTarget(null); setVoidReason(""); await invalidateExpenses(); } });
  const allRows = expenses.data?.expenses ?? [];
  const rows = allRows.filter((expense) => branchId === "all" || !branchId || expense.branch.id === branchId);
  const total = rows.filter((row) => !row.voidedAt).reduce((sum, row) => sum + Number(row.amount), 0);
  const topCategory = (() => { const totals = new Map<string, number>(); for (const row of rows) if (!row.voidedAt) totals.set(row.category.name, (totals.get(row.category.name) ?? 0) + Number(row.amount)); return [...totals].sort((a, b) => b[1] - a[1])[0]; })();
  const columns: DataColumn<ExpenseRecord>[] = [
    { id: "expenseDate", header: "Date", accessorFn: (row) => row.expenseDate, cell: (row) => formatDateTime(new Date(row.expenseDate), "en", { dateStyle: "medium", timeZone: "UTC" }) },
    { id: "description", header: "Expense", accessorFn: (row) => `${row.description} ${row.category.name}`, cell: (row) => <div><p className="font-medium">{row.description}</p><p className="text-xs text-muted-foreground">{row.category.name} · {row.branch.name}</p></div> },
    { id: "amount", header: "Amount", accessorFn: (row) => Number(row.amount), cell: (row) => <span className="font-medium tabular-nums">{formatMoney(Number(row.amount), membership?.tenant.currency ?? "NPR")}</span> },
    { id: "paymentMethod", header: "Method", accessorFn: (row) => row.paymentMethod, cell: (row) => row.paymentMethod.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) },
    { id: "createdBy", header: "Recorded by", accessorFn: (row) => row.createdBy.name, cell: (row) => row.createdBy.name },
    { id: "status", header: "Status", accessorFn: (row) => row.voidedAt ? "Voided" : "Active", cell: (row) => row.voidedAt ? <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive" title={row.voidReason ?? undefined}>Voided</span> : <span className="text-xs text-emerald-700 dark:text-emerald-400">Recorded</span> },
  ];
  const navGroups: WorkspaceNavGroup[] = [
    { label: "Workspace", items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard, allowed: ["OWNER", "MANAGER"].includes(role) }, { label: "Point of sale", href: "/pos", icon: CreditCard, capability: "orders.create" }, { label: "Orders", href: "/orders", icon: ReceiptText, capability: "orders.read" }] },
    { label: "Finance", items: [{ label: "Sales reports", href: "/reports", icon: BarChart3, capability: "reports.sales.read" }, { label: "Expenses", href: "/expenses", icon: CircleDollarSign, capability: "expenses.read" }] },
    { label: "Business", items: [{ label: "Team", href: "/team", icon: Users, allowed: ["OWNER", "MANAGER"].includes(role) }, { label: "Branches", href: "/settings/branches", icon: Building2, allowed: role === "OWNER" }, { label: "Inventory", href: "/inventory", icon: Package, capability: "inventory.read" }] },
  ];
  const submitAllowed = Boolean(form.branchId && form.categoryId && Number(form.amount) > 0 && form.description.trim().length >= 2);
  const pageError = profile.error ?? categories.error ?? expenses.error;
  return <SidebarProvider><WorkspaceSidebar role={role} tenantName={membership?.tenant.name ?? "Workspace"} groups={navGroups} activePath={pathname} /><SidebarInset><header className="flex h-[72px] items-center gap-3 border-b px-4 sm:px-7"><SidebarTrigger /><div><p className="text-xs text-muted-foreground">Finance · {membership?.tenant.name ?? "Your workspace"}</p><h1 className="text-lg font-semibold">Expenses</h1></div></header><main className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-7 xl:px-10">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Record business costs and reconcile cash outflows.</p><p className="mt-1 text-xs text-muted-foreground">Operating profit is reported before income tax.</p></div><Button onClick={() => { setForm((current) => ({ ...current, branchId: branchId === "all" ? branches[0]?.id ?? "" : (branchId || branches[0]?.id || "") })); setAddOpen(true); }} disabled={!tenantId || !branches.length}><Plus className="size-4"/> Record expense</Button></div>
    {pageError ? <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{getErrorMessage(pageError)}</div> : null}
    {!membership ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Choose a business workspace to view its expenses.</div> : !["OWNER", "MANAGER"].includes(role) ? <div role="alert" className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Your role does not have access to expense records.</div> : <>
      <section className="grid gap-3 sm:grid-cols-3"><Metric label="Expenses this month" value={formatMoney(total, membership.tenant.currency)} icon={CircleDollarSign}/><Metric label="Expense entries" value={String(rows.filter((row) => !row.voidedAt).length)} icon={ReceiptText}/><Metric label="Top category" value={topCategory?.[0] ?? "—"} note={topCategory ? formatMoney(topCategory[1], membership.tenant.currency) : "No expenses yet"} icon={Activity}/></section>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end"><div className="flex-1"><label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="expense-month">Month</label><Input id="expense-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div className="flex-1"><label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="expense-branch">Branch</label><SelectField id="expense-branch" value={branchId || (role === "OWNER" ? "all" : branches[0]?.id ?? "")} onValueChange={setBranchId} options={[...(role === "OWNER" ? [{ value: "all", label: "All branches" }] : []), ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} /></div><Button type="button" variant="outline" onClick={() => void expenses.refetch()} disabled={expenses.isFetching}><CalendarDays className="size-4"/>{expenses.isFetching ? "Refreshing…" : "Refresh"}</Button></section>
      <section className="rounded-2xl border bg-card p-4 sm:p-5"><DataTable rows={rows} columns={columns} getRowId={(row) => row.id} enableSearch searchPlaceholder="Search expenses…" empty={<div className="py-12 text-center"><CircleDollarSign className="mx-auto size-8 text-muted-foreground/60"/><p className="mt-3 font-medium">No expenses for this month</p><p className="mt-1 text-sm text-muted-foreground">Record rent, supplies, payroll or other operating costs.</p></div>} actions={(row) => !row.voidedAt ? <Button size="sm" variant="outline" onClick={() => setVoidTarget(row)}>Void</Button> : null}/></section>
    </>}
  </main></SidebarInset>
  <Dialog open={addOpen} onOpenChange={(open) => { if (!createMutation.isPending) setAddOpen(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Record an expense</DialogTitle><DialogDescription>Cash expenses are linked to your open shift when one is available.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Branch"><SelectField value={form.branchId} onValueChange={(value) => setForm({ ...form, branchId: value })} options={branches.map((item) => ({ value: item.id, label: item.name }))} /></Field>
    <Field label="Category"><SelectField value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })} options={(categories.data?.categories ?? []).filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.name }))} placeholder="Choose a category" /></Field>
    <div className="sm:col-span-2 flex gap-2"><Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Create a category, e.g. Supplies" aria-label="New expense category"/><Button type="button" variant="outline" disabled={categoryName.trim().length < 2 || categoryMutation.isPending} onClick={() => categoryMutation.mutate()}>{categoryMutation.isPending ? "Adding…" : "Add category"}</Button></div>
    <Field label="Amount"><Input inputMode="decimal" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></Field>
    <Field label="Date"><Input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></Field>
    <Field label="Payment method"><SelectField value={form.paymentMethod} onValueChange={(value) => setForm({ ...form, paymentMethod: value as ExpensePaymentMethod })} options={methodOptions.map((value) => ({ value, label: value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }))} /></Field>
    <Field label="Reference (optional)"><Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} maxLength={120} placeholder="Receipt or transaction ID" /></Field>
    <div className="sm:col-span-2"><Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1000} placeholder="What was this expense for?" /></Field></div>
    {createMutation.error || categoryMutation.error ? <p role="alert" className="sm:col-span-2 text-sm text-destructive">{getErrorMessage(createMutation.error ?? categoryMutation.error)}</p> : null}
  </div><DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)} disabled={createMutation.isPending}>Cancel</Button><Button disabled={!submitAllowed || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "Saving…" : "Save expense"}</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={Boolean(voidTarget)} onOpenChange={(open) => { if (!open && !voidMutation.isPending) { setVoidTarget(null); setVoidReason(""); } }}><DialogContent><DialogHeader><DialogTitle>Void expense</DialogTitle><DialogDescription>This keeps an audit record. Any linked cash payout is reversed back into the shift ledger.</DialogDescription></DialogHeader><label className="grid gap-2 text-sm font-medium">Reason<Input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} placeholder="Explain why this is being voided" /></label>{voidMutation.error ? <p role="alert" className="text-sm text-destructive">{getErrorMessage(voidMutation.error)}</p> : null}<DialogFooter><Button variant="outline" onClick={() => setVoidTarget(null)}>Cancel</Button><Button variant="destructive" disabled={voidReason.trim().length < 3 || voidMutation.isPending} onClick={() => voidMutation.mutate()}>{voidMutation.isPending ? "Voiding…" : "Void expense"}</Button></DialogFooter></DialogContent></Dialog>
  </SidebarProvider>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 gap-2 text-xs font-medium text-muted-foreground">{label}{children}</label>; }
function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note?: string; icon: typeof CircleDollarSign }) { return <article className="rounded-2xl border bg-card p-4"><span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-4"/></span><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p>{note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}</article>; }
