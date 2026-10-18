"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button, type buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VariantProps } from "class-variance-authority";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export interface ConfirmReasonModalProps<T extends object> {
  target: T | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: T, reason: string) => void;
  title: string | ((target: T) => string);
  description: string | ((target: T) => string);
  reasonLabel?: string;
  placeholder?: string;
  confirmLabel: string | ((target: T) => string);
  pendingLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  pending?: boolean;
  error?: string;
  minReasonLength?: number;
  maxReasonLength?: number;
  requireReason?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode | ((target: T) => ReactNode);
}

/** Controlled, typed confirmation dialog with optional auditable reason input. */
export function ConfirmReasonModal<T extends object>({
  target,
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  reasonLabel = "Reason",
  placeholder = "Add a reason…",
  confirmLabel,
  pendingLabel = "Working…",
  cancelLabel = "Cancel",
  confirmVariant = "default",
  pending = false,
  error,
  minReasonLength = 3,
  maxReasonLength = 500,
  requireReason = true,
  confirmDisabled = false,
  children,
}: ConfirmReasonModalProps<T>) {
  const [reasonDraft, setReasonDraft] = useState<{ target: T | null; value: string }>({ target, value: "" });

  if (!target) return null;

  const resolvedTitle = typeof title === "function" ? title(target) : title;
  const resolvedDescription = typeof description === "function" ? description(target) : description;
  const resolvedConfirmLabel = typeof confirmLabel === "function" ? confirmLabel(target) : confirmLabel;
  const reason = reasonDraft.target === target ? reasonDraft.value : "";
  const trimmedReason = reason.trim();
  const reasonIsValid = !requireReason || trimmedReason.length >= minReasonLength;
  const content = typeof children === "function" ? children(target) : children;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (pending) return;
      setReasonDraft({ target, value: "" });
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[min(90dvh,48rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        {content}
        {requireReason ? <label className="grid gap-2 text-sm font-medium">
          {reasonLabel}
          <Textarea value={reason} onChange={(event) => setReasonDraft({ target, value: event.target.value })} minLength={minReasonLength} maxLength={maxReasonLength} required placeholder={placeholder} disabled={pending} />
          <span className="text-xs font-normal text-muted-foreground">{trimmedReason.length}/{maxReasonLength}</span>
        </label> : null}
        {error ? <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button type="button" variant={confirmVariant} disabled={pending || !reasonIsValid || confirmDisabled} onClick={() => onConfirm(target, trimmedReason)}>
            {pending ? pendingLabel : resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
