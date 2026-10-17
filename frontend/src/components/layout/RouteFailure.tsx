"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteFailure({ error, retry, title = "This page hit a problem" }: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error("Route rendering failed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center p-5 sm:p-8">
      <section role="alert" className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle aria-hidden className="size-5" /></span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The page couldn’t finish loading. Your data is safe. Check your connection or try again.</p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={retry}><RefreshCw aria-hidden className="size-4" />Try again</Button>
          <Button type="button" variant="outline" render={<Link href="/dashboard" />}>Back to workspace</Button>
        </div>
      </section>
    </main>
  );
}
