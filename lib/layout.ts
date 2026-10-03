/**
 * Auto-layout: a small layered (Sugiyama-lite) placement.
 *
 * Columns come straight from the executor's topological waves, so the visual
 * order always matches execution order. Rows are centred per column and
 * barycentre-ordered to reduce edge crossings.
 *
 * Hand-rolled rather than dagre/ELK: ~90 lines, deterministic, unit-testable and
 * zero dependencies (see PROJECT_NOTES.md §2).
 */

import { NODE_WIDTH } from "@/config/constants";
import { analyzeGraph } from "@/lib/engine/graph";
import type { FlowEdge, FlowNode } from "@/types";

const COLUMN_GAP = 120;
const ROW_GAP = 40;
const NODE_HEIGHT_ESTIMATE = 116;
const ORIGIN = { x: 80, y: 80 };

export type LayoutResult = {
  nodes: FlowNode[];
  /** Bounding box of the laid-out graph, so callers can fit the view. */
  bounds: { width: number; height: number };
};

/**
 * Lay nodes out left to right.
 *
 * Nodes that are not part of any wave (which happens when the graph has a cycle)
 * keep their current position rather than being stacked at the origin, so pressing
 * auto-layout on a broken graph does not destroy the user's arrangement.
 */
export function autoLayout(
  nodes: readonly FlowNode[],
  edges: readonly FlowEdge[],
): LayoutResult {
  if (nodes.length === 0) {
    return { nodes: [], bounds: { width: 0, height: 0 } };
  }

  const analysis = analyzeGraph(nodes, edges);

  if (analysis.waves.length === 0) {
    const xs = nodes.map((node) => node.position.x);
    const ys = nodes.map((node) => node.position.y);
    return {
      nodes: [...nodes],
      bounds: {
        width: Math.max(...xs) - Math.min(...xs) + NODE_WIDTH,
        height: Math.max(...ys) - Math.min(...ys) + NODE_HEIGHT_ESTIMATE,
      },
    };
  }

  // Order each column by the average row of its predecessors to untangle edges.
  const rowOf = new Map<string, number>();
  const orderedWaves: string[][] = [];

  for (const wave of analysis.waves) {
    const sorted = [...wave].sort((a, b) => {
      const aBary = barycentre(a, analysis.incoming, rowOf);
      const bBary = barycentre(b, analysis.incoming, rowOf);
      return aBary - bBary || a.localeCompare(b);
    });

    sorted.forEach((id, index) => rowOf.set(id, index));
    orderedWaves.push(sorted);
  }

  const tallestColumn = Math.max(...orderedWaves.map((wave) => wave.length));
  const columnHeight = (count: number) =>
    count * NODE_HEIGHT_ESTIMATE + (count - 1) * ROW_GAP;
  const maxHeight = columnHeight(tallestColumn);

  const placed = new Map<string, { x: number; y: number }>();

  orderedWaves.forEach((wave, columnIndex) => {
    const x = ORIGIN.x + columnIndex * (NODE_WIDTH + COLUMN_GAP);
    // Centre shorter columns against the tallest so the graph reads as a diamond.
    const startY = ORIGIN.y + (maxHeight - columnHeight(wave.length)) / 2;

    wave.forEach((id, rowIndex) => {
      placed.set(id, { x, y: startY + rowIndex * (NODE_HEIGHT_ESTIMATE + ROW_GAP) });
    });
  });

  const laidOut = nodes.map((node) => {
    const next = placed.get(node.id);
    return next ? { ...node, position: next } : node;
  });

  const xs = laidOut.map((node) => node.position.x);
  const ys = laidOut.map((node) => node.position.y);

  return {
    nodes: laidOut,
    bounds: {
      width: Math.max(...xs) - Math.min(...xs) + NODE_WIDTH,
      height: Math.max(...ys) - Math.min(...ys) + NODE_HEIGHT_ESTIMATE,
    },
  };
}

/** Average row index of a node's already-placed predecessors. */
function barycentre(
  nodeId: string,
  incoming: Map<string, { sourceId: string }[]>,
  rowOf: Map<string, number>,
): number {
  const refs = incoming.get(nodeId) ?? [];
  const rows = refs
    .map((ref) => rowOf.get(ref.sourceId))
    .filter((row): row is number => row !== undefined);

  if (rows.length === 0) return Number.MAX_SAFE_INTEGER;
  return rows.reduce((sum, row) => sum + row, 0) / rows.length;
}
