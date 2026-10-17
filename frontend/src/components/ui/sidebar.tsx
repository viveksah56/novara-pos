"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SidebarState = { mobileOpen: boolean; setMobileOpen: (open: boolean) => void };
const SidebarContext = createContext<SidebarState | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("Sidebar components must be wrapped in SidebarProvider.");
  return context;
}

export function SidebarProvider({ children, className }: { children: ReactNode; className?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}><div data-slot="sidebar-provider" className={cn("flex min-h-screen w-full", className)}>{children}</div></SidebarContext.Provider>;
}

export function Sidebar({ children, className }: { children: ReactNode; className?: string }) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  return <>
    <aside data-slot="sidebar" className={cn("fixed inset-y-0 left-0 z-40 hidden w-[270px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex", className)}>{children}</aside>
    {mobileOpen ? <div className="fixed inset-0 z-50 md:hidden"><button data-control-layout="overlay" type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/45" onClick={() => setMobileOpen(false)} /><aside className={cn("absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl", className)}>{children}</aside></div> : null}
  </>;
}

export function SidebarHeader({ children, className }: { children: ReactNode; className?: string }) { return <div data-slot="sidebar-header" className={cn("flex min-h-16 items-center justify-between px-5 py-4", className)}>{children}</div>; }
export function SidebarContent({ children, className }: { children: ReactNode; className?: string }) { return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto px-3", className)}>{children}</div>; }
export function SidebarFooter({ children, className }: { children: ReactNode; className?: string }) { return <div data-slot="sidebar-footer" className={cn("mt-auto p-4", className)}>{children}</div>; }
export function SidebarGroup({ children, className }: { children: ReactNode; className?: string }) { return <section data-slot="sidebar-group" className={cn("mb-4", className)}>{children}</section>; }
export function SidebarGroupLabel({ children }: { children: ReactNode }) { return <p data-slot="sidebar-group-label" className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{children}</p>; }
export function SidebarMenu({ children, className }: { children: ReactNode; className?: string }) { return <ul data-slot="sidebar-menu" className={cn("space-y-1", className)}>{children}</ul>; }
export function SidebarMenuItem({ children }: { children: ReactNode }) { return <li data-slot="sidebar-menu-item">{children}</li>; }

type SidebarMenuButtonProps = Omit<ComponentProps<typeof Link>, "className"> & { className?: string; isActive?: boolean; icon?: ReactNode; badge?: string; disabled?: boolean };
export function SidebarMenuButton({ className, isActive, icon, badge, disabled, children, ...props }: SidebarMenuButtonProps) {
  const { setMobileOpen } = useSidebar();
  const classes = cn("flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium no-underline transition-colors", isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", disabled && "cursor-not-allowed opacity-55 hover:bg-transparent", className);
  const content = <>{icon ? <span className="grid size-5 shrink-0 place-items-center">{icon}</span> : null}<span className="min-w-0 flex-1 truncate">{children}</span>{badge ? <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[9px] font-semibold text-sidebar-foreground/70">{badge}</span> : null}</>;
  return disabled ? <div aria-disabled="true" title="This module is planned for a later release" className={classes}>{content}</div> : <Link {...props} onClick={(event) => { setMobileOpen(false); props.onClick?.(event); }} className={classes}>{content}</Link>;
}

export function SidebarTrigger({ className, ...props }: ComponentProps<typeof Button>) {
  const { setMobileOpen } = useSidebar();
  return <Button variant="ghost" size="icon-lg" aria-label="Open navigation" className={cn("md:hidden", className)} onClick={() => setMobileOpen(true)} {...props}><PanelLeftClose className="size-5" /></Button>;
}

export function SidebarInset({ children, className }: { children: ReactNode; className?: string }) { return <main data-slot="sidebar-inset" className={cn("min-w-0 flex-1 md:ml-[270px]", className)}>{children}</main>; }
