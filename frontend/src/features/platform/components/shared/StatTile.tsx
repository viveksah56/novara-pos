import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: "default" | "primary" }) {
  return <article className={cn("rounded-2xl border border-border/75 bg-card p-5 shadow-[0_8px_32px_-24px_rgba(14,42,31,.25)]", tone === "primary" && "bg-primary text-primary-foreground")}><div className="flex items-center justify-between gap-3"><span className={cn("text-sm font-medium", tone === "primary" ? "text-primary-foreground/75" : "text-muted-foreground")}>{label}</span><span className={cn("grid size-10 place-items-center rounded-xl", tone === "primary" ? "bg-white/10" : "bg-secondary text-primary")}><Icon aria-hidden className="size-[18px]" /></span></div><p className="mt-5 text-3xl font-semibold tracking-[-.045em]">{value}</p><p className={cn("mt-1.5 text-xs", tone === "primary" ? "text-primary-foreground/70" : "text-muted-foreground")}>{detail}</p></article>;
}
