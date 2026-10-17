import { Bell } from "lucide-react";
import { WorkspaceSearch } from "@/components/layout/WorkspaceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { NavItem } from "@/features/dashboard/config/navigation";
import { roleName } from "@/features/dashboard/config/roles";

type DashboardHeaderProps = {
  role: string;
  heading: string;
  userName: string;
  navItems: NavItem[];
};

/** Sticky top bar: sidebar toggle, role/heading, search, notifications, theme, user chip. */
export function DashboardHeader({ role, heading, userName, navItems }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-7 xl:px-10">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SidebarTrigger />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
            {roleName(role)} workspace
          </p>
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {heading}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <WorkspaceSearch groups={[{ label: "Workspace", items: navItems }]} />
        <Button
          variant="ghost"
          size="icon-lg"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
        </Button>
        <ThemeToggle />
        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {userName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div className="hidden xl:block">
            <p className="text-xs font-semibold">{userName}</p>
            <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
              {roleName(role)}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
