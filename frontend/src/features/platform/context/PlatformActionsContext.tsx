"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActionDialog, type ActionModel } from "@/components/ui/alert-dialog";
import { platformApi, platformKeys } from "@/features/platform/api";
import { getErrorMessage } from "@/lib/api-client";

type PlatformActionsContextValue = {
  state: { notice: string; noticeError: boolean };
  actions: {
    notify: (message: string, error?: boolean) => void;
    dismissNotice: () => void;
    requestAction: (model: ActionModel) => void;
  };
};

const PlatformActionsContext = createContext<PlatformActionsContextValue | null>(null);

function usePlatformActionsContext() {
  const context = use(PlatformActionsContext);
  if (!context) throw new Error("Platform actions must be used inside <PlatformActionsProvider>.");
  return context;
}

/** Notify the user and ask for confirmation of destructive actions (suspend, delete, remove). */
export function usePlatformActions() {
  return usePlatformActionsContext().actions;
}

/** Current page-level notice, for the banner. */
export function usePlatformNotice() {
  const { state, actions } = usePlatformActionsContext();
  return { ...state, dismiss: actions.dismissNotice };
}

/**
 * Owns the notice banner and the confirm-action dialog so sections only describe
 * what should happen (`requestAction`) and report results (`notify`).
 */
export function PlatformActionsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [action, setAction] = useState<ActionModel | null>(null);

  const actionMutation = useMutation({
    mutationFn: async (current: ActionModel) => {
      if (current.resourceIds?.length) {
        if (current.kind === "BULK_SUSPEND_BUSINESSES") return Promise.all(current.resourceIds.map((id) => platformApi.updateBusiness(id, { status: "SUSPENDED" })));
      }
      if (!current.resourceId) throw new Error("The selected item is missing its identifier.");
      if (current.kind === "SUSPEND_BUSINESS") return platformApi.updateBusiness(current.resourceId, { status: "SUSPENDED" });
      if (current.kind === "RESTORE_BUSINESS") return platformApi.updateBusiness(current.resourceId, { status: "ACTIVE" });
      if (current.kind === "DELETE_PLAN") return platformApi.deletePlan(current.resourceId);
      if (current.kind === "DEACTIVATE_PLAN") return platformApi.updatePlan(current.resourceId, { isActive: false });
      if (current.kind === "ACTIVATE_PLAN") return platformApi.updatePlan(current.resourceId, { isActive: true });
      if (current.kind === "REMOVE_SUPPORT_AGENT") return platformApi.removeAgent(current.resourceId);
    },
    onSuccess: async (_, current) => {
      setAction(null); setNotice(`${current.subject} updated successfully.`); setNoticeError(false);
      await queryClient.invalidateQueries({ queryKey: platformKeys.all });
    },
    onError: (error) => { setNotice(getErrorMessage(error)); setNoticeError(true); },
  });

  const value = useMemo<PlatformActionsContextValue>(
    () => ({
      state: { notice, noticeError },
      actions: {
        notify: (message, error = false) => { setNotice(message); setNoticeError(error); },
        dismissNotice: () => setNotice(""),
        requestAction: (model) => { setNotice(""); setAction(model); },
      },
    }),
    [notice, noticeError],
  );

  return (
    <PlatformActionsContext value={value}>
      {children}
      {action ? <ActionDialog action={action} open pending={actionMutation.isPending} onOpenChange={(open) => { if (!open) setAction(null); }} onConfirm={() => actionMutation.mutate(action)} error={actionMutation.error ? getErrorMessage(actionMutation.error) : undefined} /> : null}
    </PlatformActionsContext>
  );
}
