import { createFlowEdge, createFlowNode, resetNodeIdCounter } from "../registry";
import type { FlowEdge, FlowNode, NodeType } from "@/types";
import type { NodeConfig } from "@/types/nodes";
import type { EngineEffects } from "../types";

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

let edgeCounter = 0;

/** Build a node with an explicit id and optional config override. */
export function node<T extends NodeType>(
  id: string,
  type: T,
  config?: Partial<NodeConfig>,
  options: { simulateFailure?: boolean; latencyMs?: number; position?: { x: number; y: number } } = {},
): FlowNode {
  const built = createFlowNode(type, options.position ?? { x: 0, y: 0 }, id);

  return {
    ...built,
    id,
    data: {
      ...built.data,
      config: { ...built.data.config, ...(config ?? {}) } as typeof built.data.config,
      ...(options.simulateFailure !== undefined
        ? { simulateFailure: options.simulateFailure }
        : {}),
      ...(options.latencyMs !== undefined ? { latencyMs: options.latencyMs } : {}),
    },
  } as FlowNode;
}

/** Build an edge with a stable, readable id. */
export function edge(
  source: string,
  target: string,
  sourceHandle: "out" | "true" | "false" = "out",
): FlowEdge {
  edgeCounter += 1;
  return createFlowEdge(`e-${source}-${sourceHandle}-${target}-${edgeCounter}`, source, target, {
    sourceHandle,
    label: sourceHandle === "out" ? undefined : sourceHandle,
  });
}

/** Reset both id counters so tests are order-independent. */
export function resetCounters(): void {
  resetNodeIdCounter();
  edgeCounter = 0;
}
