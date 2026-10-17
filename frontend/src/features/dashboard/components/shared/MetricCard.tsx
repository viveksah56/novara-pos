import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  accent = false,
}: {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article
      className={cn(
        "group rounded-2xl border border-border/75 bg-card p-5 shadow-[0_8px_32px_-24px_rgba(14,42,31,.28)] transition-transform hover:-translate-y-0.5",
        accent && "bg-primary text-primary-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className={cn(
            "text-sm font-medium",
            accent ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            accent ? "bg-white/10" : "bg-secondary text-primary",
          )}
        >
          <Icon aria-hidden className="size-[18px]" />
        </span>
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-[-.04em]">
        {value}
      </div>
      <p
        className={cn(
          "mt-1.5 text-xs",
          accent ? "text-primary-foreground/65" : "text-muted-foreground",
        )}
      >
        {note}
      </p>
    </article>
  );
}
