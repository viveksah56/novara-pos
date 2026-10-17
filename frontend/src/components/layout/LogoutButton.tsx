"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { getErrorMessage } from "@/lib/api-client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: async () => { await queryClient.cancelQueries(); queryClient.clear(); router.replace("/login"); router.refresh(); } });
  return <div className={className}><Button type="button" variant="ghost" size="icon" title="Sign out" aria-label="Sign out" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut className="size-4" /></Button>{logout.error ? <p role="alert" className="mt-2 text-xs text-destructive">{getErrorMessage(logout.error)}</p> : null}</div>;
}
