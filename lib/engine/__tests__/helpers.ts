import { buildEdge, buildNode } from "@/lib/graph-builder";
import { resetNodeIdCounter } from "../registry";
import type { EngineEffects } from "../types";
import type { FlowNode, NodeConfigOf, NodeType } from "@/types";

/**
 * A fake clock and RNG.
 *
 * `sleep` advances the clock instead of waiting, so a whole run — including its
 * latency — completes synchronously in tests. That is what makes the executor
 * testable without fake timers.
 */
export function makeEffects(random = 0.5) {
  let clock = 0;
  const sleeps: number[] = [];

  const effects: EngineEffects = {
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    random: () => random,
  };

  return {
    effects,
    sleeps,
    get clock() {
      return clock;
    },
  };
}

/** Thin aliases over the shared graph builder, kept for readable test call sites. */
export function node<T extends NodeType>(
  id: string,
  type: T,
  config?: Partial<NodeConfigOf<T>>,
  options: { simulateFailure?: boolean; latencyMs?: number; position?: { x: number; y: number } } = {},
): FlowNode {
  // Widened: callers pass a generic NodeType and want the union back.
  return buildNode(id, type, config, options) as FlowNode;
}

export const edge = buildEdge;

/** Reset the id counter so tests are order-independent. */
export function resetCounters(): void {
  resetNodeIdCounter();
}
