import type { LucideIcon } from "lucide-react";

export function EmptyPanel({
  icon: Icon,
  title,
  description,
  tag = "COMING NEXT",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tag?: string;
}) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/65 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="mt-4 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold tracking-[.16em] text-muted-foreground">
        {tag}
      </span>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
