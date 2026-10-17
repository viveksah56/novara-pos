"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

const defaultThemeProps = {
  attribute: "class",
  defaultTheme: "system",
  enableSystem: true,
  disableTransitionOnChange: true,
  storageKey: "novara-theme",
  themes: ["light", "dark"],
  value: { light: "light", dark: "dark" },
} satisfies Omit<ThemeProviderProps, "children">;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...defaultThemeProps} {...props}>
      {children}
    </NextThemesProvider>
  );
}
