"use client";

import { ConfirmReasonModal } from "@/components/ui/confirm-reason-modal";

export type ActionKind = "LOGOUT" | "DELETE_RECORD" | "DEACTIVATE_MEMBER" | "SUSPEND_BUSINESS" | "RESTORE_BUSINESS" | "BULK_SUSPEND_BUSINESSES" | "DELETE_PLAN" | "DEACTIVATE_PLAN" | "ACTIVATE_PLAN" | "REMOVE_SUPPORT_AGENT";
export type ActionModel = { kind: ActionKind; subject: string; resourceId?: string; resourceIds?: string[] };

export function actionCopy(action: ActionModel) {
  switch (action.kind) {
    case "LOGOUT": return { title: "Sign out of Novara?", description: "You will need to sign in again to access your workspace.", confirm: "Sign out" };
    case "DELETE_RECORD": return { title: `Delete ${action.subject}?`, description: "This record will be permanently removed. This action cannot be undone.", confirm: "Delete record" };
    case "DEACTIVATE_MEMBER": return { title: `Remove access for ${action.subject}?`, description: "Their business access will be disabled. Their historical orders and audit records will remain available, and an Owner or Manager can reactivate them later.", confirm: "Remove access" };
    case "SUSPEND_BUSINESS": return { title: `Suspend ${action.subject}?`, description: "Staff at this business will lose access until it is reactivated.", confirm: "Suspend business" };
    case "RESTORE_BUSINESS": return { title: `Reactivate ${action.subject}?`, description: "Business users will be able to sign in again.", confirm: "Reactivate business" };
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
  const destructive = action.kind === "DELETE_RECORD" || action.kind === "DEACTIVATE_MEMBER" || action.kind === "DELETE_PLAN" || action.kind === "LOGOUT" || action.kind === "REMOVE_SUPPORT_AGENT";
  return <ConfirmReasonModal
    target={action}
    open={open}
    onOpenChange={onOpenChange}
    onConfirm={() => onConfirm()}
    title={copy.title}
    description={copy.description}
    confirmLabel={copy.confirm}
    confirmVariant={destructive ? "destructive" : "default"}
    requireReason={false}
    pending={pending}
    error={error}
  />;
}
