import type { NodePayload } from "./json";
import type { NodeType } from "./nodes";
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
};

/** A payload that moved along an edge, used to schedule the particle animation. */
export type EdgeTransition = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  startedAt: number;
  durationMs: number;
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
