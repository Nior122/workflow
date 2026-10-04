/** Single source of truth for magic numbers and storage keys. */

export const STORAGE_KEY = "flowforge.state.v1";

/** Per-node simulated latency is clamped into this range so animations stay visible. */
export const LATENCY_MIN_MS = 300;
export const LATENCY_MAX_MS = 1200;

/** Run console keeps this many past runs. */
export const RUN_HISTORY_LIMIT = 10;

export const EXECUTION_SPEEDS = [0.5, 1, 2] as const;
export const DEFAULT_SPEED = 1;

/** Canvas dot grid; 24 is a multiple of the 4px spacing grid the design uses. */
export const GRID_GAP = 24;
export const GRID_DOT_SIZE = 1.4;

export const NODE_WIDTH = 240;
export const NODE_DRAG_TYPE = "application/flowforge-node";

export const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const;
/** Max gap between two canvas clicks that still counts as a double-click (ms). */
export const PANE_DOUBLE_CLICK_MS = 320;

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2.5;

/**
 * At or above this width the builder docks its panels; below it they become
 * bottom sheets over a full-bleed canvas. 1024 is where a docked palette (256px)
 * plus inspector (320px) still leaves the canvas enough room to be usable.
 */
export const WIDE_BREAKPOINT_PX = 1024;

export const APP_NAME = "FlowForge";
export const APP_URL = "https://flowforge.dev";
