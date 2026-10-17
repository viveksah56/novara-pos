export function LoadingWorkspace() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[260px] border-r border-border/70 bg-card p-6 lg:block">
        <div className="h-9 w-36 animate-pulse rounded bg-secondary" />
        <div className="mt-10 h-16 animate-pulse rounded-xl bg-secondary" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-secondary/80"
            />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-6 sm:p-10">
        <div className="mx-auto max-w-6xl" aria-busy="true">
          <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded bg-secondary" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl bg-secondary/70"
              />
            ))}
          </div>
          <p className="sr-only">Loading your Novara workspace…</p>
        </div>
      </main>
    </div>
  );
}
