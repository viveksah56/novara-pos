"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platformApi, platformKeys, type PlatformRole } from "@/features/platform/api";
import { cn } from "@/lib/utils";

export function PlatformSearch({ platformRole }: { platformRole: PlatformRole }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTerm(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  const results = useQuery({ queryKey: platformKeys.search(debouncedTerm), queryFn: () => platformApi.search(debouncedTerm), enabled: open && debouncedTerm.length >= 2, retry: false, staleTime: 15_000 });

  function navigate(path: string) { setOpen(false); setTerm(""); router.push(path); }
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger render={<Button variant="outline" className="hidden h-10 w-64 justify-start gap-2 text-muted-foreground md:inline-flex" aria-label="Search the platform" />}><Search className="size-4" /><span className="flex-1 text-left">Search businesses…</span><kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">⌘ K</kbd></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
      <Dialog.Popup className="fixed left-1/2 top-[12vh] z-[71] flex max-h-[76dvh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0">
        <Dialog.Title className="sr-only">Search Novara</Dialog.Title><Dialog.Description className="sr-only">Search businesses and plans in the Novara platform.</Dialog.Description>
        <div className="flex items-center gap-3 border-b border-border px-4"><Search aria-hidden className="size-5 shrink-0 text-muted-foreground" /><Input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search businesses and plans…" className="h-14 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" /><kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd></div>
        <div className="overflow-y-auto p-2">
          {term.trim().length < 2 ? <p className="px-3 py-9 text-center text-sm text-muted-foreground">Type at least 2 characters to search the platform.</p> : results.isPending ? <p className="px-3 py-9 text-center text-sm text-muted-foreground">Searching…</p> : results.isError ? <p role="alert" className="px-3 py-9 text-center text-sm text-destructive">Search is temporarily unavailable. Try again.</p> : results.data?.businesses.length || results.data?.plans.length ? <div className="space-y-2">
            {results.data.businesses.length ? <section><p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Businesses</p>{results.data.businesses.map((business) => <button data-control-layout="content" key={business.id} onClick={() => navigate(`/admin/businesses/${business.id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Building2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{business.name}</span><span className="mt-0.5 block text-xs capitalize text-muted-foreground">{business.status.toLowerCase()}</span></span></button>)}</section> : null}
            {platformRole === "SUPER_ADMIN" && results.data.plans.length ? <section><p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Plans</p>{results.data.plans.map((plan) => <button data-control-layout="content" key={plan.id} onClick={() => navigate("/admin/plans")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Tag className="size-4" /></span><span className="text-sm font-medium">{plan.name}</span></button>)}</section> : null}
          </div> : <div className={cn("px-3 py-10 text-center text-sm text-muted-foreground")}>No matching businesses or plans found.</div>}
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
