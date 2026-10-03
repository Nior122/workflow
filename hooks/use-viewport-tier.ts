"use client";

import { useMediaQuery } from "./use-media-query";
import { WIDE_BREAKPOINT_PX } from "@/config/constants";

export type ViewportTier = "compact" | "wide";

/**
 * Two tiers, not three.
 *
 * A separate "tablet" band would need its own layout code for a size range that
 * is mostly landscape iPads — and those are happier with the compact, overlay
 * layout than with three docked panels fighting over ~1000px. So: below the wide
 * breakpoint everything is an overlay, above it panels dock (and can collapse).
 *
 * `useMediaQuery` is `useSyncExternalStore`-based and returns false on the server,
 * so the query is written as a max-width: the server guesses "wide", which is the
 * right default for the SSR pass and the majority of visits.
 */
export function useViewportTier(): ViewportTier {
  // Queried as a MAX width on purpose: `useMediaQuery` returns false on the
  // server, so the server and first client render both produce "wide". Asking for
  // min-width instead would stream the mobile dock to every desktop and then flip
  // it away on hydration.
  const isCompact = useMediaQuery(`(max-width: ${WIDE_BREAKPOINT_PX - 1}px)`);
  return isCompact ? "compact" : "wide";
}
