import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, XCircle } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/data-table/DataTable";
import { SearchBar } from "@/components/shared/SearchBar";
import { QueryState } from "@/components/shared/QueryState";
import { Button } from "@/components/ui/button";
import { platformApi, platformKeys, type PlatformBusiness } from "@/features/platform/api";
import { EmptyState } from "@/features/platform/components/shared/EmptyState";
import { LoadingRows } from "@/features/platform/components/shared/Loading";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { StatusPill } from "@/features/platform/components/shared/StatusPill";
import { usePlatformActions } from "@/features/platform/context/PlatformActionsContext";
import { shortDate } from "@/features/platform/lib/format";
import { getErrorMessage } from "@/lib/api-client";

export function BusinessesSection({ canManage }: { canManage: boolean }) {
  const { requestAction: onAction } = usePlatformActions();
  const [value, onChange] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(value.trim()), 250); return () => window.clearTimeout(timer); }, [value]);
  const query = useQuery({ queryKey: platformKeys.businesses(debouncedSearch), queryFn: () => platformApi.businesses(debouncedSearch), retry: false });
  const rows = query.data ?? [];
  const columns: DataColumn<PlatformBusiness>[] = [
    { id: "name", header: "Business", accessorFn: (business) => business.name, cell: (business) => <div><Link href={`/admin/businesses/${business.id}`} className="font-semibold no-underline hover:underline">{business.name}</Link><p className="mt-1 text-xs text-muted-foreground">Joined {shortDate(business.createdAt)}</p></div> },
    { id: "plan", header: "Plan", accessorFn: (business) => business.plan?.name ?? "", cell: (business) => business.plan?.name ?? <span className="text-muted-foreground">Unassigned</span> },
    { id: "branches", header: "Branches", accessorFn: (business) => business._count.branches, cell: (business) => <span className="tabular-nums">{business._count.branches}</span> },
    { id: "team", header: "Team", accessorFn: (business) => business._count.memberships, cell: (business) => <span className="tabular-nums">{business._count.memberships}</span> },
    { id: "status", header: "Status", accessorFn: (business) => business.status, cell: (business) => <StatusPill status={business.status} /> },
  ];
  return <section className="overflow-hidden rounded-2xl border border-border/75 bg-card">
    <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h3 className="font-semibold">Business directory</h3><p className="mt-1 text-xs text-muted-foreground">Search workspace names and open a business to review its account.</p></div><SearchBar value={value} onValueChange={onChange} className="sm:max-w-sm" placeholder="Search businesses…" ariaLabel="Search businesses" /></div>
    <QueryState data={rows} isPending={query.isPending} isError={query.isError} isEmpty={(businesses) => businesses.length === 0} loading={<LoadingRows />} error={<StatePanel title="Businesses could not be loaded" description={getErrorMessage(query.error)} retry={() => void query.refetch()} />} empty={<EmptyState icon={Building2} title={value ? "No businesses match that search" : "No businesses registered"} description={value ? "Try another name or clear your search." : "New businesses will appear here when they join Novara."} />}>
      {(businesses) => <><div className="p-3 sm:p-4"><DataTable rows={businesses} columns={columns} getRowId={(business) => business.id} enableRowSelection={canManage ? (business) => business.status === "ACTIVE" : false} actions={canManage ? (business) => <><Button type="button" variant="ghost" size="sm" title={business.status === "ACTIVE" ? "Suspend business" : "Reactivate business"} onClick={() => onAction({ kind: business.status === "ACTIVE" ? "SUSPEND_BUSINESS" : "RESTORE_BUSINESS", subject: business.name, resourceId: business.id })}>{business.status === "ACTIVE" ? <XCircle className="size-4" /> : <Check className="size-4" />}</Button></> : undefined} bulkActions={({ selectedRows, clearSelection }) => <><Button type="button" size="sm" variant="outline" onClick={() => { onAction({ kind: "BULK_SUSPEND_BUSINESSES", subject: "selected businesses", resourceIds: selectedRows.map(({ id }) => id) }); clearSelection(); }}><XCircle className="size-4" />Suspend selected</Button></>} empty={<EmptyState icon={Building2} title={value ? "No businesses match that search" : "No businesses registered"} description={value ? "Try another name or clear your search." : "New businesses will appear here when they join Novara."} />} /></div><p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Showing up to 100 businesses. Use search to narrow the list.</p></>}
    </QueryState>
  </section>;
}
