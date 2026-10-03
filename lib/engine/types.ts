/**
 * Engine-internal types.
 *
 * Everything the executor hands to a node's `execute`. Deliberately injectable:
 * `sleep`, `now` and `random` are passed in so unit tests can drive the engine
 * deterministically with no real timers and no flaky canned-response selection.
 */

import type { NodePayload } from "@/types/json";
import type { EngineEvent, ExecutionSpeed, RunError } from "@/types/run";
import type { VariableScope } from "./variables";

export type StepContext = {
  nodeId: string;
  /** Variable scope for this step: merged input plus all finished upstream outputs. */
  scope: VariableScope;
  /** Simulated latency for this node, already divided by the speed multiplier. */
  latencyMs: number;
  /** Injected delay. Delay nodes use this for their extra wait. */
  sleep: (ms: number) => Promise<void>;
  /** Injected clock. */
  now: () => number;
  /** Injected RNG in [0, 1). */
  random: () => number;
  speed: ExecutionSpeed;
};

/** Injectable effects, so tests never wait on real time. */
export type EngineEffects = {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
};

export type EmitEvent = (event: EngineEvent) => void;

export type NodeOutput = {
  payload: NodePayload;
  /** For condition nodes: which output handle the data leaves through. */
  outputHandle?: "out" | "true" | "false";
  /** Executor-specific extras surfaced in the run console. */
  meta?: { [key: string]: NodePayload[string] };
};

/** Thrown by an executor to fail the step with a structured error. */
export class EngineError extends Error {
  readonly code: RunError["code"];
  readonly nodeId?: string;

  constructor(code: RunError["code"], message: string, nodeId?: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.nodeId = nodeId;
  }
}
