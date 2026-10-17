export function LoadingRows() {
  return <div className="mt-4 space-y-3" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary/60"/>)}<span className="sr-only">Loading report data…</span></div>;
}
