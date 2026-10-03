"use client";

import { useEffect } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { useUiStore } from "@/store/uiStore";
import { useRunWorkflow } from "./use-run-workflow";

/** True when focus is in something that should keep the keystroke. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Global keyboard shortcuts.
 *
 * Delete/Backspace is deliberately absent: React Flow owns those through its own
 * `deleteKeyCode`, and handling them here too would delete twice.
 */
export function useKeyboardShortcuts(): void {
  const { run } = useRunWorkflow();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const store = useWorkflowStore.getState();
      const ui = useUiStore.getState();

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        store.undo();
        return;
      }

      // Both ⌘⇧Z and the common ⌘Y convention redo.
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        store.redo();
        return;
      }

      if (key === "d") {
        event.preventDefault();
        store.duplicateSelection();
        return;
      }

      if (key === "enter") {
        if (ui.isRunning || store.nodes.length === 0) return;
        event.preventDefault();
        void run();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [run]);
}
