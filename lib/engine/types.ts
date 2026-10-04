/**
 * Engine-internal types.
 *
 * Everything the executor hands to a node's `execute`. Deliberately injectable:
 * `sleep`, `now` and `random` are passed in so unit tests can drive the engine
 * deterministically with no real timers and no flaky canned-response selection.
 */

import type { JsonObject, NodePayload } from "@/types/json";
import type { AgentTraceStep, EngineEvent, ExecutionSpeed, RunError } from "@/types/run";
import type { ConnectedSubNodes, FlowItem, TokenUsageSummary } from "@/types/registry";
import type { VariableScope } from "./variables";

export type StepContext = {
  nodeId: string;
  nodeLabel?: string;
  /** Variable scope for this step: merged input plus all finished upstream outputs. */
  scope: VariableScope;
  /** Incoming items in n8n-style `[{ json }]` form. */
  items?: readonly FlowItem[];
  /** Connected AI sub-nodes (`ai_model`, `ai_memory`, `ai_tool`) when executing an AI Agent. */
  subNodes?: ConnectedSubNodes;
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
  /**
   * Optional interactive approval gate callback used by the browser UI when a
   * `logic.waitForApproval` node executes. In headless unit tests where this is
   * omitted, approval resolves immediately.
   */
  requestApproval?: (request: {
    nodeId: string;
    nodeLabel: string;
    summary: string;
    details?: JsonObject;
  }) => Promise<boolean>;
};

export type EmitEvent = (event: EngineEvent) => void;

export type NodeOutput = {
  payload: NodePayload;
  /** Which output handle the data leaves through (`"out"`, `"true"`, `"false"`, `"case_0"`, etc.). */
  outputHandle?: string;
  /** Executor-specific extras surfaced in the run console. */
  meta?: { [key: string]: NodePayload[string] };
  /** Structured reasoning trace produced by an AI Agent node. */
  trace?: AgentTraceStep[];
  /** Human-readable log lines emitted by the node's simulator. */
  logs?: string[];
  /** Simulated token and cost metrics for AI nodes. */
  tokenUsage?: TokenUsageSummary;
  /** Number of items emitted by this node (`1`, `3`, etc.). */
  itemCount?: number;
  /** Optional interactive approval prompt metadata. */
  pauseForApproval?: {
    summary: string;
    details?: JsonObject;
  };
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
