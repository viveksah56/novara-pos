"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi, authQueryKeys } from "@/features/auth/api";
import { teamInvitationApi } from "@/features/tenancy/api/teamInvitationApi";
import { getErrorMessage } from "@/lib/api-client";

export default function AcceptInvitationPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background"><LoaderCircle className="size-6 animate-spin text-primary" /></div>}><AcceptInvitationContent /></Suspense>;
}

function AcceptInvitationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = params.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const invitation = useQuery({ queryKey: ["team-invitation", token], queryFn: () => teamInvitationApi.preview(token), enabled: token.length >= 32, retry: false });
  const profile = useQuery({ queryKey: authQueryKeys.loggedInUser, queryFn: authApi.getLoggedInUser, retry: false, staleTime: 30_000 });
  const accept = useMutation({
    mutationFn: () => teamInvitationApi.accept({ token, ...(profile.data ? {} : { name: name.trim(), password }) }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.loggedInUser });
      const destination = result.homeRoute === "/onboarding" ? "/dashboard" : result.homeRoute;
      router.replace(destination + "?tenantId=" + encodeURIComponent(result.invitation.tenantId));
    },
  });
  const currentUser = profile.data;
  const wrongAccount = Boolean(currentUser && invitation.data && currentUser.email.toLowerCase() !== invitation.data.email.toLowerCase());

  return <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
    <Card className="w-full max-w-lg border-border/80 shadow-xl shadow-black/5">
      <CardHeader className="space-y-4">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><MailCheck className="size-6" /></div>
        <div><CardTitle className="font-heading text-2xl">Accept your team invitation</CardTitle><CardDescription className="mt-2">Join your Novara workspace and start using your assigned role.</CardDescription></div>
      </CardHeader>
      <CardContent>
        {!token || token.length < 32 ? <MessageState title="Invitation link is incomplete" description="Open the full invitation link from your email and try again." />
          : invitation.isPending ? <div className="flex items-center gap-3 rounded-xl border p-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Verifying your invitation…</div>
            : invitation.isError ? <MessageState title="Invitation unavailable" description={getErrorMessage(invitation.error)} />
              : invitation.data ? <div className="space-y-5">
                <div className="rounded-xl border bg-muted/30 p-4"><div className="flex items-start gap-3"><Building2 className="mt-0.5 size-5 text-primary" /><div className="min-w-0"><p className="font-semibold">{invitation.data.businessName}</p><p className="mt-1 text-sm text-muted-foreground">{invitation.data.email} · {invitation.data.role.toLowerCase().replaceAll("_", " ")}</p><p className="mt-2 text-xs text-muted-foreground">Branches: {invitation.data.branches.join(", ")}</p></div></div></div>
                {profile.isPending ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Checking your sign-in…</div>
                  : wrongAccount ? <div role="alert" className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><p>This invitation is for <strong>{invitation.data.email}</strong>, but you are signed in as <strong>{currentUser?.email}</strong>.</p><Button render={<Link href={"/login?returnTo=" + encodeURIComponent("/accept-invite?token=" + token)} />} variant="outline">Switch account</Button></div>
                    : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); accept.mutate(); }}>
                      {currentUser ? <p className="text-sm text-muted-foreground">Signed in as {currentUser.email}. Accepting adds this business to your account.</p> : <>
                        <label className="block space-y-1.5 text-sm font-medium">Your name<Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} required /></label>
                        <label className="block space-y-1.5 text-sm font-medium">Create a password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={72} required /><span className="block text-xs font-normal text-muted-foreground">Use at least 12 characters, including a letter and a number.</span></label>
                      </>}
                      {accept.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{getErrorMessage(accept.error)}</p> : null}
                      <Button className="w-full" disabled={accept.isPending || profile.isPending || wrongAccount}>{accept.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}{accept.isPending ? "Joining workspace…" : "Accept invitation"}<ArrowRight className="size-4" /></Button>
                    </form>}
              </div> : null}
      </CardContent>
    </Card>
  </main>;
}

function MessageState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed p-6 text-center"><p className="font-medium">{title}</p><p className="mt-2 text-sm text-muted-foreground">{description}</p><Button className="mt-5" render={<Link href="/login" />} variant="outline">Go to sign in</Button></div>;
}
