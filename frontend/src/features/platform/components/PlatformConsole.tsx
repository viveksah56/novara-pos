"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi, authQueryKeys } from "@/features/auth/api";
import type { PlatformRole } from "@/features/platform/api";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import { PlatformShell } from "@/features/platform/components/shell/PlatformShell";
import type { PlatformSection } from "@/features/platform/types";
import { ApiError, getErrorMessage } from "@/lib/api-client";

export type { PlatformSection } from "@/features/platform/types";

export function PlatformConsolePage({ section, businessId }: { section: PlatformSection; businessId?: string }) {
  const router = useRouter();
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false, staleTime: 30_000 });
  const user = profile.data;
  const platformRole: PlatformRole | null = user?.platformRole ?? (user?.isPlatformAdmin ? "SUPER_ADMIN" : null);

  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.statusCode === 401) router.replace("/login");
  }, [profile.error, router]);
  useEffect(() => {
    if (platformRole === "SUPPORT_AGENT" && section === "overview") router.replace("/admin/support");
    if (platformRole === "SUPPORT_AGENT" && ["plans", "system"].includes(section)) router.replace("/admin/support");
  }, [platformRole, section, router]);

  if (profile.isPending) return <div className="min-h-screen animate-pulse bg-secondary/35" />;
  if (profile.isError) return <main className="grid min-h-screen place-items-center p-6"><StatePanel title="Your session needs attention" description={getErrorMessage(profile.error)} retry={() => void profile.refetch()} /></main>;
  if (!user || !platformRole) return <main className="grid min-h-screen place-items-center bg-background p-6"><section className="max-w-lg rounded-2xl border border-border bg-card p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Shield className="size-5" /></span><h1 className="mt-4 text-xl font-semibold">Platform access required</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">This area is reserved for Novara platform staff. Café roles cannot access platform administration.</p><Button className="mt-5" variant="outline" onClick={() => router.replace("/dashboard")}>Return to workspace</Button></section></main>;
  return <PlatformShell section={section} businessId={businessId} user={user} platformRole={platformRole} />;
}
