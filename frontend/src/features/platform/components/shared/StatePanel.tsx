import { Button } from "@/components/ui/button";

export function StatePanel({ title, description, retry, loading = false }: { title: string; description: string; retry?: () => void; loading?: boolean }) {
  return <div className="rounded-2xl border border-border bg-card p-7 sm:p-10" aria-busy={loading}><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>{retry ? <Button className="mt-5" variant="outline" onClick={retry}>Try again</Button> : null}</div>;
}
