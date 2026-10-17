"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Root layout failed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <main className="grid min-h-screen place-items-center p-5">
          <section role="alert" className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 shadow-sm">
            <h1 className="text-xl font-semibold">Novara couldn’t start</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">A page-level error interrupted the application. Try reloading this view.</p>
            {error.digest ? <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
            <button type="button" onClick={retry} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
