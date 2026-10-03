"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type ToastTone } from "@/store/toastStore";

const TONE = {
  ok: { icon: CheckCircle2, className: "border-success/40 text-success" },
  error: { icon: AlertCircle, className: "border-error/40 text-error" },
  info: { icon: Info, className: "border-border text-muted-foreground" },
} satisfies Record<ToastTone, { icon: typeof Info; className: string }>;

/**
 * The one place toasts render, mounted once by the shell.
 *
 * Pinned top-right below the top bar rather than bottom-centre: the bottom of
 * the viewport is occupied by the run console on desktop and the dock on a
 * phone, and the top bar's own blocking-error alert already owns top-centre.
 */
export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="z-toast pointer-events-none fixed top-16 right-4 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TONE[toast.tone];
          const Icon = tone.icon;

          return (
            <motion.div
              key={toast.id}
              role="status"
              layout
              initial={{ opacity: 0, x: 16, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={cn(
                "pointer-events-auto flex items-center gap-2 rounded-lg border bg-surface-raised",
                "px-3 py-2 shadow-lg",
                tone.className,
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 text-xs text-foreground">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground active:bg-border"
              >
                <X className="size-3" aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
