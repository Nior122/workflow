/**
 * The execution engine.
 *
 * Runs the graph in topological waves. Within a wave every node runs concurrently,
 * which is what makes branches animate in parallel; because a wave only contains
 * nodes whose dependencies sit in earlier waves, merges still wait correctly.
 *
 * Merge semantics (see PROJECT_NOTES.md §5.4): a node runs when every incoming edge
 * has settled. An edge settles with data (source succeeded) or without (source was
 * skipped or errored). If *all* incoming edges settle without data the node is
 * skipped too, so a dead branch does not fire its downstream outputs.
 *
 * Everything time- or chance-related is injected via `effects`, so unit tests drive
 * the whole engine deterministically with no real timers.
 */

import { analyzeGraph, type EdgeRef } from "./graph";
import { clampLatency, requireNodeDef } from "./registry";
import { EngineError, type EmitEvent, type EngineEffects, type NodeOutput, type StepContext } from "./types";
import { validateWorkflow } from "./validator";
import type { VariableScope } from "./variables";
import type { NodePayload } from "@/types/json";
import type { FlowEdge, FlowNode } from "@/types";
import type {
  EdgeTransition,
  ExecutionSpeed,
  NodeRunStatus,
  RunError,
  RunResult,
  StepLog,
} from "@/types/run";

export type ExecuteOptions = {
  runId: string;
  workflowId: string;
  workflowName: string;
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
  speed: ExecutionSpeed;
  effects: EngineEffects;
  emit: EmitEvent;
  signal?: AbortSignal;
};

/** Real effects for the browser. Tests pass fakes instead. */
export const browserEffects: EngineEffects = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  random: () => Math.random(),
};

export async function executeWorkflow(options: ExecuteOptions): Promise<RunResult> {
  const {
    runId,
    workflowId,
    workflowName,
    nodes,
    edges,
    speed,
    effects,
    emit,
    signal,
  } = options;

  const startedAt = effects.now();
  const steps: StepLog[] = [];
  const edgeTransitions: EdgeTransition[] = [];
  const statuses = new Map<string, NodeRunStatus>();
  const outputs = new Map<string, NodePayload>();
  const deliveredEdges = new Set<string>();

  emit({ kind: "run:start", runId, at: startedAt });

  const finish = (
    status: RunResult["status"],
    error?: RunError,
  ): RunResult => {
    const endedAt = effects.now();
    const result: RunResult = {
      id: runId,
      workflowId,
      workflowName,
      status,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      speed,
      steps: [...steps].sort((a, b) => a.startedAt - b.startedAt),
      edges: edgeTransitions,
      ...(error ? { error } : {}),
    };
    emit({ kind: "run:end", runId, at: endedAt, status, durationMs: result.durationMs });
    return result;
  };

  // ---- pre-flight validation ----
  const validation = validateWorkflow(nodes, edges);
  if (!validation.valid) {
    const firstError = validation.issues.find((issue) => issue.level === "error");
    return finish("failed", {
      code: firstError?.code === "cycle-detected" ? "cycle-detected" : "validation-failed",
      message: firstError?.message ?? "The flow has configuration errors.",
      nodeId: firstError?.nodeId,
    });
  }

  const graph = analyzeGraph(nodes, edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const reachable = new Set(graph.reachableFromTriggers);

  const scopeFor = (payload: NodePayload): VariableScope => ({
    payload,
    nodes: Object.fromEntries(outputs),
    run: { id: runId, workflowName, startedAt, speed },
  });

  /** Merge the payloads that arrived on this node's settled incoming edges. */
  const inputFor = (nodeId: string): { payload: NodePayload; received: boolean } => {
    const incoming = graph.incoming.get(nodeId) ?? [];
    if (incoming.length === 0) return { payload: {}, received: true };

    let merged: NodePayload = {};
    let received = false;
    for (const ref of incoming) {
      if (!deliveredEdges.has(ref.edgeId)) continue;
      const upstream = outputs.get(ref.sourceId);
      if (!upstream) continue;
      merged = { ...merged, ...upstream };
      received = true;
    }
    return { payload: merged, received };
  };

  const runNode = async (node: FlowNode): Promise<void> => {
    if (signal?.aborted) {
      statuses.set(node.id, "skipped");
      emit({ kind: "node:skipped", nodeId: node.id, at: effects.now(), reason: "cancelled" });
      return;
    }

    if (!reachable.has(node.id)) {
      statuses.set(node.id, "skipped");
      emit({
        kind: "node:skipped",
        nodeId: node.id,
        at: effects.now(),
        reason: "not reachable from a trigger",
      });
      return;
    }

    const { payload: input, received } = inputFor(node.id);
    if (!received) {
      statuses.set(node.id, "skipped");
      emit({
        kind: "node:skipped",
        nodeId: node.id,
        at: effects.now(),
        reason: "no upstream branch delivered data",
      });
      steps.push({
        stepId: `${runId}-${node.id}`,
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.data.label,
        status: "skipped",
        startedAt: effects.now(),
        endedAt: effects.now(),
        durationMs: 0,
        input,
        output: null,
        meta: { reason: "no upstream branch delivered data" },
      });
      return;
    }

    const def = requireNodeDef(node.type);
    const stepStartedAt = effects.now();
    statuses.set(node.id, "running");
    emit({ kind: "node:running", nodeId: node.id, at: stepStartedAt });

    const latencyMs = clampLatency(node.data.latencyMs ?? def.latencyMs) / speed;

    const ctx: StepContext = {
      nodeId: node.id,
      scope: scopeFor(input),
      latencyMs,
      sleep: effects.sleep,
      now: effects.now,
      random: effects.random,
      speed,
    };

    try {
      // The base latency is what makes the animation visible; nodes such as Delay
      // add their own wait on top of it.
      await effects.sleep(latencyMs);

      if (node.data.simulateFailure) {
        throw new EngineError(
          "simulated-failure",
          "This node is set to simulate a failure.",
          node.id,
        );
      }

      const result: NodeOutput = await def.execute(input, node.data.config, ctx);

      const endedAt = effects.now();
      outputs.set(node.id, result.payload);
      statuses.set(node.id, "success");
      emit({
        kind: "node:success",
        nodeId: node.id,
        at: endedAt,
        output: result.payload,
        durationMs: endedAt - stepStartedAt,
      });

      steps.push({
        stepId: `${runId}-${node.id}`,
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.data.label,
        status: "success",
        startedAt: stepStartedAt,
        endedAt,
        durationMs: endedAt - stepStartedAt,
        input,
        output: result.payload,
        ...(result.meta ? { meta: result.meta } : {}),
        ...(result.trace ? { trace: result.trace } : {}),
      });

      activateOutgoing(node, result.outputHandle ?? "out", endedAt);
    } catch (error) {
      const endedAt = effects.now();
      statuses.set(node.id, "error");

      const runError: RunError =
        error instanceof EngineError
          ? { code: error.code, message: error.message, nodeId: error.nodeId ?? node.id }
          : {
              code: "node-execution-failed",
              message: error instanceof Error ? error.message : "Unknown failure",
              nodeId: node.id,
            };

      emit({
        kind: "node:error",
        nodeId: node.id,
        at: endedAt,
        error: runError,
        durationMs: endedAt - stepStartedAt,
      });

      steps.push({
        stepId: `${runId}-${node.id}`,
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.data.label,
        status: "error",
        startedAt: stepStartedAt,
        endedAt,
        durationMs: endedAt - stepStartedAt,
        input,
        output: null,
        error: runError,
      });
      // An errored node delivers nothing downstream, so its edges stay undelivered.
    }
  };

  /** Mark the edges leaving a node as carrying data, and emit their animation. */
  const activateOutgoing = (
    node: FlowNode,
    outputHandle: "out" | "true" | "false",
    at: number,
  ): void => {
    const outgoing: EdgeRef[] = graph.outgoing.get(node.id) ?? [];
    for (const ref of outgoing) {
      // A condition node only feeds the branch it chose.
      if ((ref.sourceHandle ?? "out") !== outputHandle) continue;

      deliveredEdges.add(ref.edgeId);
      const durationMs = 420 / speed;
      edgeTransitions.push({
        edgeId: ref.edgeId,
        fromNodeId: node.id,
        toNodeId: ref.targetId,
        startedAt: at,
        durationMs,
      });
      emit({
        kind: "edge:active",
        edgeId: ref.edgeId,
        fromNodeId: node.id,
        toNodeId: ref.targetId,
        at,
        durationMs,
      });
    }
  };

  // ---- run wave by wave ----
  for (const wave of graph.waves) {
    if (signal?.aborted) break;

    const waveNodes = wave
      .map((id) => nodeById.get(id))
      .filter((node): node is FlowNode => node !== undefined);

    await Promise.all(waveNodes.map(runNode));
  }

  const errored = steps.some((step) => step.status === "error");
  const anySuccess = steps.some((step) => step.status === "success");

  if (signal?.aborted) return finish("cancelled");
  if (errored) {
    const firstError = steps.find((step) => step.status === "error");
    return finish("failed", firstError?.error);
  }
  return finish(anySuccess ? "completed" : "failed", undefined);
}

/** Convenience for the UI: current status of every node after a run. */
export function statusMapFromSteps(steps: readonly StepLog[]): Map<string, NodeRunStatus> {
  const map = new Map<string, NodeRunStatus>();
  for (const step of steps) map.set(step.nodeId, step.status);
  return map;
}
