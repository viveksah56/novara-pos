import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { AuthUser } from "@/features/auth/types";
import type { PlatformRole } from "@/features/platform/api";
import { PlatformSearch } from "@/features/platform/components/PlatformSearch";
import { initials } from "@/features/platform/lib/format";

export function PlatformHeader({ title, user, platformRole }: { title: string; user: AuthUser; platformRole: PlatformRole }) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl sm:px-7 xl:px-9"><div className="flex min-w-0 items-center gap-2"><SidebarTrigger /><div className="min-w-0"><p className="hidden text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground sm:block">Novara · Platform</p><h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1></div></div><div className="flex items-center gap-2"><PlatformSearch platformRole={platformRole} /><Button variant="ghost" size="icon-lg" aria-label="Search the platform" className="md:hidden" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}><Search className="size-4" /></Button><ThemeToggle /><div className="mx-1 hidden h-8 w-px bg-border sm:block" /><div className="hidden items-center gap-2 sm:flex"><span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials(user.name)}</span><div className="hidden xl:block"><p className="text-xs font-semibold">{user.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{platformRole === "SUPER_ADMIN" ? "Super Admin" : "Support Agent"}</p></div></div></div></header>
  );
}
