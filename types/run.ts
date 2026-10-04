import type { NodePayload } from "./json";
import type { NodeType } from "./nodes";
import type { AgentTraceEntry, TokenUsageSummary } from "./registry";
import { EXECUTION_SPEEDS } from "@/config/constants";

export type NodeRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "error"
  | "skipped";

export type RunStatus =
  | "idle"
  | "validating"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ExecutionSpeed = (typeof EXECUTION_SPEEDS)[number];

export type EngineErrorCode =
  | "validation-failed"
  | "cycle-detected"
  | "missing-trigger"
  | "node-execution-failed"
  | "invalid-payload"
  | "template-resolution-failed"
  | "simulated-failure"
  | "aborted"
  | "timeout";

export type RunError = {
  code: EngineErrorCode;
  message: string;
  nodeId?: string;
};

/**
 * One reasoning-act-observe iteration produced by an AI Agent node.
 *
 * Aliased to the registry's `AgentTraceEntry` so a trace produced by the declarative
 * `/lib/nodes/ai` simulator and one produced by the engine's core node are the same
 * type — no casting, no drift.
 */
export type AgentTraceStep = AgentTraceEntry;

/** One row in the run console; expandable to reveal exact input/output JSON. */
export type StepLog = {
  stepId: string;
  nodeId: string;
  nodeType: NodeType;
  nodeLabel: string;
  status: Exclude<NodeRunStatus, "idle" | "queued">;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  input: NodePayload;
  output: NodePayload | null;
  error?: RunError;
  /** Executor-specific extras: branch taken, mock HTTP status, rows written… */
  meta?: { [key: string]: NodePayload[string] };
  /** Structured reasoning trace when the step is an AI Agent node. */
  trace?: AgentTraceStep[];
  /** Human-readable log lines emitted by the node's simulator. */
  logs?: string[];
  /** Simulated token and cost metrics for AI nodes. */
  tokenUsage?: TokenUsageSummary;
  /** Number of items emitted by this step (`1 item`, `3 items`, etc.). */
  itemCount?: number;
  /** Number of retries attempted before succeeding or failing. */
  retriesUsed?: number;
};

/** A payload that moved along an edge, used to schedule the particle animation. */
export type EdgeTransition = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  startedAt: number;
  durationMs: number;
  itemCount?: number;
};

export type RunResult = {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  speed: ExecutionSpeed;
  /** Sorted by startedAt. */
  steps: StepLog[];
  edges: EdgeTransition[];
  error?: RunError;
  /** Aggregated token usage across all AI steps in this run. */
  totalTokens?: number;
  /** Aggregated simulated LLM cost in USD across all AI steps in this run. */
  estimatedCostUsd?: number;
};

/**
 * Emitted by the executor and consumed by the run store to drive animation.
 * Deliberately free of any React or DOM types so it stays testable in plain Node.
 */
export type EngineEvent =
  | { kind: "run:start"; runId: string; at: number }
  | { kind: "node:queued"; nodeId: string; at: number }
  | { kind: "node:running"; nodeId: string; at: number }
  | {
      kind: "node:success";
      nodeId: string;
      at: number;
      output: NodePayload;
      durationMs: number;
      itemCount?: number;
    }
  | {
      kind: "node:error";
      nodeId: string;
      at: number;
      error: RunError;
      durationMs: number;
    }
  | { kind: "node:skipped"; nodeId: string; at: number; reason: string }
  | {
      kind: "edge:active";
      edgeId: string;
      fromNodeId: string;
      toNodeId: string;
      at: number;
      durationMs: number;
      itemCount?: number;
    }
  | {
      kind: "run:end";
      runId: string;
      at: number;
      status: RunStatus;
      durationMs: number;
    };

/** Statuses that mean the node produced usable output for downstream nodes. */
export function isTerminalStatus(status: NodeRunStatus): boolean {
  return status === "success" || status === "error" || status === "skipped";
}

export function statusLabel(status: NodeRunStatus): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "success":
      return "Success";
    case "error":
      return "Error";
    case "skipped":
      return "Skipped";
  }
}
