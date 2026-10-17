import { Activity } from "lucide-react";

export function DashboardFooter() {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5 text-xs text-muted-foreground">
      <span>
        © {new Date().getFullYear()} Novara · Hospitality, in harmony
      </span>
      <span className="flex items-center gap-1.5">
        <Activity className="size-3.5" />
        Workspace status normal
      </span>
    </footer>
  );
}
