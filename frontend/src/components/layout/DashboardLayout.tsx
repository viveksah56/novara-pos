"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

/** Keeps the provider and application sidebar mounted while child routes change. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(139,159,151,.12),transparent_35%),var(--background)] text-foreground">
      <AppSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </SidebarProvider>
  );
}
