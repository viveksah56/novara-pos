import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";

export function WorkspaceError({
  message,
  retry,
  error,
}: {
  message: string;
  retry: () => void;
  error?: unknown;
}) {
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive"><CircleAlert aria-hidden className="size-5" /></span>
      <div>
        <p className="text-lg font-semibold tracking-tight">We couldn’t load this workspace</p>
        <p className="mt-1.5 max-w-prose text-sm leading-6 text-muted-foreground">{message}</p>
        {apiError?.requestId ? <p className="mt-3 text-xs text-muted-foreground">Reference: <span className="font-mono">{apiError.requestId}</span></p> : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-3">
        <Button onClick={retry}>Try again</Button>
        <Button variant="outline" render={<Link href="/login" />}>Sign in again</Button>
      </div>
    </div>
  );
}
