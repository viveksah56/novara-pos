export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="Loading workspace">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-secondary" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-secondary" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />)}</div>
      <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
    </main>
  );
}
