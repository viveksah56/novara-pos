import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { RootProvider } from "@/provider/root-provider";

export const metadata: Metadata = {
  title: "Novara | Hospitality, in harmony",
  description: "A thoughtful operating system for modern cafes and restaurants.",
  icons: { icon: "/logo.svg", shortcut: "/logo.svg", apple: "/logo.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", "font-sans")}
    >
      <body className="min-h-full flex flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
