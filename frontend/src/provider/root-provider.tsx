import type { ReactNode } from "react";
import { Suspense } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/provider/query-provider";
import { ThemeProvider } from "@/provider/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";

type RootProviderProps = {
  children: ReactNode;
};

export function RootProvider({ children }: RootProviderProps) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <TooltipProvider delay={200}>
          <Suspense fallback={children}><AppShell>{children}</AppShell></Suspense>
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          duration={4000}
          visibleToasts={5}
        />
      </QueryProvider>
    </ThemeProvider>
  );
}

export default RootProvider;
