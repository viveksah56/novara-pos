"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PosCartLine } from "@/features/pos/api/posApi";

export type QueuedPosOrder = { clientOrderId: string; tenantId: string; branchId: string; items: PosCartLine[] };
const EMPTY_QUEUE: QueuedPosOrder[] = [];
const EVENT_NAME = "novara:offline-order-queue";
const snapshots = new Map<string, { raw: string; value: QueuedPosOrder[] }>();

function getSnapshot(key: string): QueuedPosOrder[] {
  if (typeof window === "undefined") return EMPTY_QUEUE;
  let raw: string;
  try { raw = window.localStorage.getItem(key) ?? "[]"; } catch { return EMPTY_QUEUE; }
  const cached = snapshots.get(key);
  if (cached?.raw === raw) return cached.value;
  let value: QueuedPosOrder[] = EMPTY_QUEUE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) value = parsed as QueuedPosOrder[];
  } catch { /* Ignore an invalid local queue and leave it empty. */ }
  snapshots.set(key, { raw, value });
  return value;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT_NAME, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function replaceOfflineOrderQueue(key: string, update: (current: QueuedPosOrder[]) => QueuedPosOrder[]) {
  const next = update(getSnapshot(key));
  const raw = JSON.stringify(next);
  try { window.localStorage.setItem(key, raw); } catch { return; }
  snapshots.set(key, { raw, value: next });
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useOfflineOrderQueue(key: string) {
  const getClientSnapshot = useCallback(() => getSnapshot(key), [key]);
  return useSyncExternalStore(subscribe, getClientSnapshot, () => EMPTY_QUEUE);
}
