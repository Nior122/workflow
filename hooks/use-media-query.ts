"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook, built on `useSyncExternalStore`.
 *
 * `matchMedia` is an external store, so subscribing through the store API is both
 * correct and tear-free — an effect plus setState would render the wrong value for
 * one frame and cascade a second render.
 *
 * `getServerSnapshot` returns false, so the server and the first client render agree
 * and the desktop layout is what gets streamed. The mobile notice is a client-only
 * concern, which is what we want.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
