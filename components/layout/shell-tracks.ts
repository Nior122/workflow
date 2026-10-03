/**
 * Track widths for the builder grid, plus the arithmetic that decides whether a
 * given viewport can still show a usable canvas.
 *
 * Extracted from `app-shell.tsx` so the numbers are the *same* numbers the
 * layout renders — the grid definition reads these constants, and the tests
 * assert against them, so the two can never drift apart.
 *
 * Widths are stored in px and emitted in rem (1rem = 16px) so the grid respects
 * a user's root font size, which is the whole point of using rem.
 */

/** Collapsed rail: just an icon and a vertical label. */
export const RAIL_PX = 40;
/** Node palette, open. */
export const PALETTE_PX = 256;
/** Node inspector, open. */
export const INSPECTOR_PX = 320;

const PX_PER_REM = 16;

const toRem = (px: number) => `${px / PX_PER_REM}rem`;

export type RailState = {
  paletteOpen: boolean;
  inspectorOpen: boolean;
};

/**
 * The `grid-template-columns` value for the wide builder tier.
 *
 * The canvas track is always `minmax(0, 1fr)`: `minmax(0, …)` rather than a
 * bare `1fr` because `1fr` has an implicit `auto` minimum, which lets a long
 * label inside the canvas widen the track and push the inspector off-screen.
 */
export function builderGridColumns({ paletteOpen, inspectorOpen }: RailState): string {
  return [
    toRem(paletteOpen ? PALETTE_PX : RAIL_PX),
    "minmax(0, 1fr)",
    toRem(inspectorOpen ? INSPECTOR_PX : RAIL_PX),
  ].join(" ");
}

/**
 * Horizontal space left for the canvas at a given viewport, in px, ignoring
 * scrollbars (the shell is `h-dvh overflow-hidden`, so there are none).
 *
 * `max(0, …)` rather than a negative number: a negative track is meaningless,
 * and clamping means callers can assert "the canvas is still usable" without
 * special-casing an impossible geometry.
 */
export function canvasWidthAt(viewportPx: number, rails: RailState): number {
  const palette = rails.paletteOpen ? PALETTE_PX : RAIL_PX;
  const inspector = rails.inspectorOpen ? INSPECTOR_PX : RAIL_PX;
  return Math.max(0, viewportPx - palette - inspector);
}
