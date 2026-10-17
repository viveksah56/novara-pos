"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { KeyRound, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { authApi, authQueryKeys } from "@/features/auth/api";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Capability } from "@/lib/rbac";
import { roleHasCapability } from "@/lib/rbac";

export type WorkspaceNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  capability?: Capability;
  allowed?: boolean;
  ready?: boolean;
  badge?: string;
};
export type WorkspaceNavGroup = { label: string; items: WorkspaceNavItem[] };

export function WorkspaceSidebar({
  role,
  tenantName,
  groups,
  activePath,
  brandHref = "/dashboard",
  treatUnspecifiedAsReady = true,
  topContent,
  footer,
  showLogout = true,
}: {
  role: string;
  tenantName: string;
  groups: WorkspaceNavGroup[];
  activePath: string;
  brandHref?: string;
  treatUnspecifiedAsReady?: boolean;
  topContent?: ReactNode;
  footer?: ReactNode;
  showLogout?: boolean;
}) {
  const profile = useQuery({
    queryKey: authQueryKeys.loggedInUser,
    queryFn: authApi.getLoggedInUser,
    retry: false,
  });
  const userName = profile.data?.name?.trim() || "Signed-in user";
  const initials = userName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
    <SidebarPrimitive>
      <SidebarHeader><Brand href={brandHref} /></SidebarHeader>
      {topContent ? <div className="shrink-0">{topContent}</div> : null}
      <SidebarContent className="space-y-2 py-4">
        {groups.map((group) => {
          const items = group.items.filter((item) =>
            item.allowed !== false && (!item.capability || roleHasCapability(role, item.capability)),
          );
          if (!items.length) return null;
          const activeItem = items
            .filter(({ href }) => activePath === href || activePath.startsWith(`${href}/`))
            .sort((left, right) => right.href.length - left.href.length)[0];
          return (
            <SidebarGroup key={group.label} className="mb-0">
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={`${item.href}:${item.label}`}>
                      <SidebarMenuButton
                        href={item.href}
                        icon={<Icon aria-hidden className="size-4" />}
                        isActive={activeItem?.href === item.href}
                        disabled={item.ready === false || (!treatUnspecifiedAsReady && item.ready !== true)}
                        badge={item.badge ?? (item.ready === false ? "SOON" : undefined)}
                      >
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="space-y-2.5 px-3 pb-4">
        {footer ?? <div className="truncate rounded-xl bg-sidebar-accent p-3 text-xs text-muted-foreground">{tenantName}</div>}
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-sidebar-border/80 bg-sidebar-accent/45 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
            {initials || <UserRound aria-hidden className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{userName}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{profile.data?.email ?? tenantName}</p>
            <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[.13em] text-muted-foreground">{role.replaceAll("_", " ")}</p>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/change-password" icon={<KeyRound aria-hidden className="size-4" />}>
              Change password
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarPrimitive>
    {showLogout ? <div className="fixed right-4 top-3 z-[60]"><LogoutButton compact /></div> : null}
    </>
  );
}
