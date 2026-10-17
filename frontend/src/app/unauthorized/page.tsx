import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border/70 bg-card p-7 text-center shadow-xl shadow-primary/5 sm:p-10">
        <div className="flex justify-center"><Brand href="/" /></div>
        <span className="mx-auto mt-9 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert aria-hidden className="size-7" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Access restricted</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">You don’t have permission to view this page</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Your current Novara role does not include access to this area. If you need access, contact your business owner or administrator.
        </p>
        <Button className="mt-7" render={<Link href="/" />}>
            <ArrowLeft aria-hidden className="size-4" />
            Return to Novara
        </Button>
      </section>
    </main>
  );
}
