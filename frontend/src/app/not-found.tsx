import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">404 · Not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">We can’t find that page</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">The link may be outdated, or the page may have moved.</p>
        <Button render={<Link href="/" />} className="mt-6">Return home</Button>
      </section>
    </main>
  );
}
