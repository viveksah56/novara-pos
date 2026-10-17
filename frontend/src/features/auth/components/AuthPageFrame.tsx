import type { ReactNode } from "react";

import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthPageFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthPageFrame({ title, description, children, footer }: AuthPageFrameProps) {
  return (
    <main className="min-h-screen-dvh bg-background">
      <div className="mx-auto grid min-h-screen-dvh max-w-[1600px] lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.9fr)]">
        <aside className="relative hidden min-h-screen-dvh overflow-hidden bg-[#173e2f] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div aria-hidden className="pointer-events-none absolute -right-44 -top-36 size-[34rem] rounded-full border border-white/10" />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-16 size-[26rem] rounded-full border border-white/10" />
          <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-44 size-[32rem] rounded-full bg-white/[0.035] blur-2xl" />
          <div className="relative z-10"><Brand light /></div>

          <div className="relative z-10 max-w-2xl py-12">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium tracking-wide text-white/80">
              <span className="size-1.5 rounded-full bg-[#c7ad76]" />
              HOSPITALITY, IN HARMONY
            </div>
            <p className="max-w-xl font-heading text-5xl font-medium leading-[1.08] tracking-[-0.055em] text-white xl:text-6xl">
              Make room for the work you love.
            </p>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/65 xl:text-lg">
              One calm place to run service, understand your numbers, and take better care of every guest.
            </p>

            <div className="mt-12 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
                <p className="font-heading text-2xl tracking-tight text-white">One view</p>
                <p className="mt-1 text-xs text-white/70">for every location</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
                <p className="font-heading text-2xl tracking-tight text-white">More present</p>
                <p className="mt-1 text-xs text-white/70">with every guest</p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs tracking-wide text-white/65">Thoughtfully made for the people behind the table.</p>
        </aside>

        <section className="flex min-h-screen-dvh flex-col px-5 pb-safe pt-safe sm:px-8 lg:px-12 xl:px-20">
          <header className="flex items-center justify-between py-5 sm:py-7">
            <div className="lg:hidden"><Brand /></div>
            <div className="hidden lg:block" aria-hidden />
            <ThemeToggle />
          </header>

          <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-7 sm:py-12">
            <header className="mb-8 sm:mb-9">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Your workspace awaits</p>
              <h1 className="font-heading text-[2rem] font-semibold leading-tight tracking-[-0.045em] sm:text-[2.35rem]">{title}</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">{description}</p>
            </header>
            {children}
            <footer className="mt-8 border-t border-border/70 pt-5 text-center text-sm text-muted-foreground">
              {footer}
            </footer>
          </div>

          <p className="pb-5 text-center text-[0.68rem] tracking-wide text-muted-foreground/65 sm:pb-6">Novara · Made for hospitality</p>
        </section>
      </div>
    </main>
  );
}
