"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/layout/LogoutButton";
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
  return (
    <SidebarPrimitive>
      <SidebarHeader><Brand href={brandHref} /></SidebarHeader>
      {topContent}
      <SidebarContent>
        {groups.map((group) => {
          const items = group.items.filter((item) =>
            item.allowed !== false && (!item.capability || roleHasCapability(role, item.capability)),
          );
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={`${item.href}:${item.label}`}>
                      <SidebarMenuButton
                        href={item.href}
                        icon={<Icon aria-hidden className="size-4" />}
                        isActive={activePath === item.href}
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
      <SidebarFooter>
        {footer ?? <div className="truncate rounded-xl bg-sidebar-accent p-3 text-xs text-muted-foreground">{tenantName}</div>}
        {showLogout ? <LogoutButton className="flex justify-end" /> : null}
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
