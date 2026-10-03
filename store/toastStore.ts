import { create } from "zustand";

export type ToastTone = "ok" | "error" | "info";

export type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastState = {
  toasts: Toast[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
};

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 3200;

let nextId = 1;

/**
 * Transient, non-blocking feedback.
 *
 * Lifted out of `workflow-menu` (which had a private one) so anything can raise
 * a toast — import, export, share, autosave — and they all render in one stack
 * in one place instead of competing local copies.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (tone, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }].slice(-MAX_VISIBLE) }));
    window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function pushToast(tone: ToastTone, message: string): void {
  useToastStore.getState().push(tone, message);
}
