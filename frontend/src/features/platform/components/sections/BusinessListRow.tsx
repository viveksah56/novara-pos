import { Building2, ChevronRight } from "lucide-react";
import type { PlatformBusiness } from "@/features/platform/api";
import { StatusPill } from "@/features/platform/components/shared/StatusPill";

export function BusinessListRow({ business, onClick }: { business: PlatformBusiness; onClick: () => void }) {
  return <button data-control-layout="content" onClick={onClick} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/45 sm:px-6"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{business.name}</span><span className="mt-1 block text-xs text-muted-foreground">{business._count.branches} branches · {business._count.memberships} team members</span></span><span className="hidden sm:inline"><StatusPill status={business.status} /></span><span className="hidden text-xs text-muted-foreground md:block">{business.plan?.name ?? "No plan"}</span><ChevronRight className="size-4 text-muted-foreground" /></button>;
}
