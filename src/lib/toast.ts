/**
 * Lightweight toast notification atom (nanostores).
 */

import { atom } from "nanostores";

export interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  durationMs?: number;
}

export const $toasts = atom<Toast[]>([]);

let _counter = 0;

/** Add a toast. Returns the id so callers can dismiss early if needed. */
export function addToast(
  message: string,
  type: Toast["type"] = "info",
  durationMs = 3500,
): string {
  const id = `toast-${Date.now()}-${++_counter}`;
  const toast: Toast = { id, message, type, durationMs };
  $toasts.set([...$toasts.get(), toast]);

  if (durationMs > 0) {
    setTimeout(() => dismissToast(id), durationMs);
  }

  return id;
}

/** Dismiss a specific toast by id. */
export function dismissToast(id: string) {
  $toasts.set($toasts.get().filter((t) => t.id !== id));
}
