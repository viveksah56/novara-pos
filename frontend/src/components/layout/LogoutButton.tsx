"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/alert-dialog";
import { authApi } from "@/features/auth/api";
import { getErrorMessage } from "@/lib/api-client";

export function LogoutButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: async () => { await queryClient.cancelQueries(); queryClient.clear(); router.replace("/login"); router.refresh(); } });
  return <>
    <div className={className}>
      <Button type="button" variant={compact ? "outline" : "ghost"} size={compact ? "icon" : "default"} aria-label={compact ? "Sign out" : undefined} title={compact ? "Sign out" : undefined} className={compact ? "size-10 rounded-xl bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:text-destructive" : "w-full justify-start gap-3 px-3 text-muted-foreground hover:text-destructive"} disabled={logout.isPending} onClick={() => setConfirmOpen(true)}>
        <LogOut aria-hidden className="size-4" />
        {compact ? <span className="sr-only">{logout.isPending ? "Signing out…" : "Sign out"}</span> : <span>{logout.isPending ? "Signing out…" : "Sign out"}</span>}
      </Button>
    </div>
    <ActionDialog
      action={{ kind: "LOGOUT", subject: "your account" }}
      open={confirmOpen}
      pending={logout.isPending}
      onOpenChange={setConfirmOpen}
      onConfirm={() => logout.mutate()}
      error={logout.error ? getErrorMessage(logout.error) : undefined}
    />
  </>;
}
