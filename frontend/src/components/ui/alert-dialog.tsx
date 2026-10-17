"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionKind = "LOGOUT" | "DELETE_RECORD" | "DEACTIVATE_MEMBER" | "DELETE_BUSINESS" | "SUSPEND_BUSINESS" | "RESTORE_BUSINESS" | "BULK_DELETE_BUSINESSES" | "BULK_SUSPEND_BUSINESSES" | "DELETE_PLAN" | "DEACTIVATE_PLAN" | "ACTIVATE_PLAN" | "REMOVE_SUPPORT_AGENT";
export type ActionModel = { kind: ActionKind; subject: string; resourceId?: string; resourceIds?: string[] };

export function actionCopy(action: ActionModel) {
  switch (action.kind) {
    case "LOGOUT": return { title: "Sign out of Novara?", description: "You will need to sign in again to access your workspace.", confirm: "Sign out" };
    case "DELETE_RECORD": return { title: `Delete ${action.subject}?`, description: "This record will be permanently removed. This action cannot be undone.", confirm: "Delete record" };
    case "DEACTIVATE_MEMBER": return { title: `Remove access for ${action.subject}?`, description: "Their business access will be disabled. Their historical orders and audit records will remain available, and an Owner or Manager can reactivate them later.", confirm: "Remove access" };
    case "DELETE_BUSINESS": return { title: `Delete ${action.subject}?`, description: "This permanently removes the business, its branches, and staff memberships. This action cannot be undone.", confirm: "Delete business" };
    case "SUSPEND_BUSINESS": return { title: `Suspend ${action.subject}?`, description: "Staff at this business will lose access until it is reactivated.", confirm: "Suspend business" };
    case "RESTORE_BUSINESS": return { title: `Reactivate ${action.subject}?`, description: "Business users will be able to sign in again.", confirm: "Reactivate business" };
    case "BULK_DELETE_BUSINESSES": return { title: `Delete ${action.resourceIds?.length ?? 0} businesses?`, description: "This permanently removes the selected businesses, branches, and staff memberships. This action cannot be undone.", confirm: "Delete selected" };
    case "BULK_SUSPEND_BUSINESSES": return { title: `Suspend ${action.resourceIds?.length ?? 0} businesses?`, description: "Staff in the selected businesses will lose access until each business is reactivated.", confirm: "Suspend selected" };
    case "DELETE_PLAN": return { title: `Delete ${action.subject}?`, description: "This plan will be permanently removed. Plans assigned to a business cannot be deleted.", confirm: "Delete plan" };
    case "DEACTIVATE_PLAN": return { title: `Deactivate ${action.subject}?`, description: "Businesses already using this plan will keep their assignment, but it will no longer be available to new businesses.", confirm: "Deactivate plan" };
    case "ACTIVATE_PLAN": return { title: `Activate ${action.subject}?`, description: "This plan will be available for new business assignments.", confirm: "Activate plan" };
    case "REMOVE_SUPPORT_AGENT": return { title: `Remove ${action.subject} from support?`, description: "This person will lose access to the platform support workspace.", confirm: "Remove agent" };
  }
}

export function ActionDialog({ action, open, pending, onOpenChange, onConfirm, error }: {
  action: ActionModel;
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  error?: string;
}) {
  const copy = actionCopy(action);
  const destructive = action.kind === "DELETE_RECORD" || action.kind === "DEACTIVATE_MEMBER" || action.kind === "DELETE_BUSINESS" || action.kind === "BULK_DELETE_BUSINESSES" || action.kind === "DELETE_PLAN" || action.kind === "LOGOUT" || action.kind === "REMOVE_SUPPORT_AGENT";
  return <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <AlertDialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0">
        <div><AlertDialogPrimitive.Title className="text-lg font-semibold tracking-tight">{copy.title}</AlertDialogPrimitive.Title><AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</AlertDialogPrimitive.Description></div>
        {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><AlertDialogPrimitive.Close render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</AlertDialogPrimitive.Close><Button type="button" variant={destructive ? "destructive" : "default"} disabled={pending} onClick={onConfirm} className={cn("min-w-28")}>{pending ? "Working…" : copy.confirm}</Button></div>
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  </AlertDialogPrimitive.Root>;
}
