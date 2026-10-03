"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * `navigator` is unavailable during SSR, and reading it in a render would make
 * the server tree ("Ctrl") and the first client tree ("⌘") differ for Mac users
 * — the same class of bug the theme provider had. `useSyncExternalStore` with a
 * server snapshot resolves it: React renders the snapshot during hydration and
 * treats the switch as a store update.
 */
const noop = () => () => {};

function getIsMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

function useIsMac(): boolean {
  return useSyncExternalStore(noop, getIsMac, () => false);
}

/** The platform's modifier key, rendered as a symbol on Mac and a word elsewhere. */
export function useModKey(): string {
  return useIsMac() ? "⌘" : "Ctrl";
}

/**
 * A keyboard shortcut rendered as keycaps, for tooltips and menu items.
 *
 * `mod` prefixes the platform modifier; pass plain keys for the rest so a
 * shortcut reads `⌘ ⇧ Z` on a Mac and `Ctrl Shift Z` everywhere else.
 */
export function Kbd({
  mod = false,
  keys,
  className,
}: {
  mod?: boolean;
  keys: string[];
  className?: string;
}) {
  const modKey = useModKey();
  const parts = mod ? [modKey, ...keys] : keys;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {parts.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className="rounded border border-border bg-surface px-1 py-px font-mono text-[10px] leading-none text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
