/** Sidebar footer status pill. */
export function SidebarStatus() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[.06] px-3 py-2.5">
      <span className="relative grid size-2 shrink-0 place-items-center"><span className="absolute size-2 animate-ping rounded-full bg-emerald-500/40"/><span className="relative size-1.5 rounded-full bg-emerald-500"/></span>
      <div className="min-w-0"><p className="truncate text-xs font-medium">Workspace operational</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">Services are running normally</p></div>
    </div>
  );
}
