import { ShieldCheck } from "lucide-react";
import type { PlatformRole } from "@/features/platform/api";

export function PlatformFooter({ platformRole }: { platformRole: PlatformRole }) {
  return (
    <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5 text-xs text-muted-foreground"><span>Novara platform operations</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" />{platformRole === "SUPER_ADMIN" ? "Super Admin controls" : "Support Agent access"}</span></footer>
  );
}
