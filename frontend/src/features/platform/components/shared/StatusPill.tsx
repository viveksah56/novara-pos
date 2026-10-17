import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: "ACTIVE" | "SUSPENDED" | "operational" | "degraded" }) {
  const good = status === "ACTIVE" || status === "operational";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", good ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}><span className={cn("size-1.5 rounded-full", good ? "bg-emerald-500" : "bg-amber-500")} />{status === "ACTIVE" ? "Active" : status === "SUSPENDED" ? "Suspended" : status === "operational" ? "Operational" : "Needs attention"}</span>;
}
