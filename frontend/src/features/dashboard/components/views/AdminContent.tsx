import { Building2, ShieldCheck, Store, Users } from "lucide-react";
import type { DashboardPayload } from "@/features/dashboard/api";
import { MetricCard } from "@/features/dashboard/components/shared/MetricCard";

export function AdminContent({ dashboard }: { dashboard: DashboardPayload }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Businesses"
          value={String(dashboard.metrics.businesses ?? 0)}
          note="All registered workspaces"
          icon={Building2}
          accent
        />
        <MetricCard
          title="Active"
          value={String(dashboard.metrics.activeBusinesses ?? 0)}
          note="Currently operating"
          icon={Store}
        />
        <MetricCard
          title="Suspended"
          value={String(dashboard.metrics.suspendedBusinesses ?? 0)}
          note="Access paused"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Accounts"
          value={String(dashboard.metrics.users ?? 0)}
          note="Across all businesses"
          icon={Users}
        />
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-border/75 bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-sm text-muted-foreground">Platform</p>
            <h2 className="mt-1 text-xl font-semibold">Recent businesses</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">
            Latest 8
          </span>
        </div>
        {dashboard.businessesList?.length ? (
          <ul className="divide-y divide-border">
            {dashboard.businessesList.map((business) => (
              <li
                key={business.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{business.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {new Date(business.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                  {business.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No businesses registered yet.
          </div>
        )}
      </section>
    </>
  );
}
