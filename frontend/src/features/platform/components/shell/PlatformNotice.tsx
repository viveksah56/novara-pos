import { XCircle } from "lucide-react";
import { usePlatformNotice } from "@/features/platform/context/PlatformActionsContext";
import { cn } from "@/lib/utils";

export function PlatformNotice() {
  const { notice, noticeError, dismiss } = usePlatformNotice();
  return (
    notice ? <div role={noticeError ? "alert" : "status"} className={cn("mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", noticeError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-600/20 bg-emerald-500/5 text-foreground")}><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => dismiss()}><XCircle className="size-4" /></button></div> : null
  );
}
