import { cn } from "@/lib/utils";
import { getStatusPresentation, type StatusDomain, type StatusFor } from "@/constants/system-constants";

export type { StatusTone } from "@/constants/system-constants";
import type { StatusTone } from "@/constants/system-constants";

export interface StatusBadgeProps {
  children: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  title?: string;
}

const toneClasses: Record<StatusTone, string> = {
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-blue-500/10 text-blue-800 dark:text-blue-300",
  neutral: "bg-muted text-muted-foreground",
};

const dotClasses: Record<StatusTone, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground",
};

export function StatusBadge({ children, tone = "neutral", dot = false, className, title }: StatusBadgeProps) {
  return <span title={title} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", toneClasses[tone], className)}>{dot ? <span aria-hidden className={cn("size-1.5 rounded-full", dotClasses[tone])} /> : null}{children}</span>;
}

export function EntityStatusBadge<Domain extends StatusDomain>({ domain, status, className, dot = false }: {
  domain: Domain;
  status: StatusFor<Domain>;
  className?: string;
  dot?: boolean;
}) {
  const presentation = getStatusPresentation(domain, status);
  return <StatusBadge tone={presentation.tone} className={className} dot={dot} title={presentation.description}>{presentation.label}</StatusBadge>;
}
