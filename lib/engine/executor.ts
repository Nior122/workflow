/**
 * The execution engine (v2 — supports 144 nodes, AI Agent bottom sub-nodes,
 * multi-output Switch/Loop/Error branches, Wait for Human Approval, per-node
 * retryOnFail / continueOnError, n8n-style item arrays, and token/cost accounting).
 */

import { analyzeGraph, type EdgeRef } from "./graph";
import { clampLatency, requireNodeDef } from "./registry";
import {
  EngineError,
  type EmitEvent,
  type EngineEffects,
  type NodeOutput,
  type StepContext,
} from "./types";
import { inferSubNodePortKind, validateWorkflow } from "./validator";
import type { VariableScope } from "./variables";
import type { JsonObject, NodePayload } from "@/types/json";
import type { ConnectedSubNode, ConnectedSubNodes, FlowItem } from "@/types/registry";
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

function deriveItemCount(payload: NodePayload, explicitCount?: number): number {
  if (typeof explicitCount === "number" && explicitCount > 0) return explicitCount;
  if (Array.isArray(payload.items)) return payload.items.length;
  if (Array.isArray(payload.data)) return payload.data.length;
  if (Array.isArray(payload.rows)) return payload.rows.length;
  return 1;
}

function payloadToFlowItems(payload: NodePayload): FlowItem[] {
  if (Array.isArray(payload.items) && payload.items.length > 0) {
    return payload.items.map((entry, idx) => ({
      json:
        typeof entry === "object" && entry !== null && !Array.isArray(entry)
          ? (entry as JsonObject)
          : { value: entry, index: idx },
    }));
  }
  if (Array.isArray(payload.data) && payload.data.length > 0) {
    return payload.data.map((entry, idx) => ({
      json:
        typeof entry === "object" && entry !== null && !Array.isArray(entry)
          ? (entry as JsonObject)
          : { value: entry, index: idx },
    }));
  }
  return [{ json: payload }];
}

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
  const outputsByLabel = new Map<string, NodePayload>();
  const deliveredEdges = new Set<string>();

  emit({ kind: "run:start", runId, at: startedAt });

  const finish = (
    status: RunResult["status"],
    error?: RunError,
  ): RunResult => {
    const endedAt = effects.now();
    let totalTokens = 0;
    let estimatedCostUsd = 0;
    for (const step of steps) {
      if (step.tokenUsage) {
        totalTokens += step.tokenUsage.totalTokens;
        estimatedCostUsd += step.tokenUsage.estimatedCostUsd;
      }
    }

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
      ...(totalTokens > 0
        ? {
            totalTokens,
            estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
          }
        : {}),
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
    nodesByLabel: Object.fromEntries(outputsByLabel),
    run: { id: runId, workflowName, startedAt, speed },
    now: effects.now,
  });

  /** Merge the payloads that arrived on this node's settled incoming edges. */
  const inputFor = (
    node: FlowNode,
  ): { payload: NodePayload; items: FlowItem[]; received: boolean } => {
    const incoming = graph.incoming.get(node.id) ?? [];
    if (incoming.length === 0) {
      return { payload: {}, items: [{ json: {} }], received: true };
    }

    let merged: NodePayload = {};
    const collectedItems: FlowItem[] = [];
    let received = false;

    for (const ref of incoming) {
      if (!deliveredEdges.has(ref.edgeId)) continue;
      const upstream = outputs.get(ref.sourceId);
      if (!upstream) continue;
      merged = { ...merged, ...upstream };
      collectedItems.push(...payloadToFlowItems(upstream));
      received = true;
    }

    // Special handling for `logic.merge` in "append" mode: preserve all branch items
    if (
      received &&
      node.type === "logic.merge" &&
      (node.data.config as Record<string, unknown>)?.mode === "append"
    ) {
      merged = {
        ...merged,
        items: collectedItems.map((it) => it.json),
        itemCount: collectedItems.length,
      };
    }

    return {
      payload: merged,
      items: collectedItems.length > 0 ? collectedItems : [{ json: merged }],
      received,
    };
  };

  /** Resolve connected AI sub-nodes (`ai_model`, `ai_memory`, `ai_tool`) for an AI Agent. */
  const resolveConnectedSubNodes = (
    agentNodeId: string,
  ): { subNodes: ConnectedSubNodes; refs: EdgeRef[] } => {
    const refs = graph.subNodeEdges.get(agentNodeId) ?? [];
    let model: ConnectedSubNode | undefined;
    let memory: ConnectedSubNode | undefined;
    const tools: ConnectedSubNode[] = [];

    for (const ref of refs) {
      const subNode = nodeById.get(ref.sourceId);
      if (!subNode) continue;
      const kind = inferSubNodePortKind(subNode.type);
      const entry: ConnectedSubNode = {
        nodeId: subNode.id,
        typeId: subNode.type,
        label: subNode.data.label,
        config: (subNode.data.config ?? {}) as JsonObject,
        edgeId: ref.edgeId,
      };
      if (kind === "ai_model") model = entry;
      else if (kind === "ai_memory") memory = entry;
      else if (kind === "ai_tool") tools.push(entry);
    }

    return { subNodes: { model, memory, tools }, refs };
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

    const { payload: input, items, received } = inputFor(node);
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

    const { subNodes, refs: subRefs } = resolveConnectedSubNodes(node.id);
    // Light up connected Model & Memory sub-nodes while the AI Agent runs
    for (const subRef of subRefs) {
      const subNode = nodeById.get(subRef.sourceId);
      if (!subNode) continue;
      const kind = inferSubNodePortKind(subNode.type);
      if (kind === "ai_model" || kind === "ai_memory") {
        emit({ kind: "node:running", nodeId: subNode.id, at: stepStartedAt });
        emit({
          kind: "edge:active",
          edgeId: subRef.edgeId,
          fromNodeId: subNode.id,
          toNodeId: node.id,
          at: stepStartedAt,
          durationMs: 420 / speed,
          itemCount: 1,
        });
      }
    }

    const latencyMs = clampLatency(node.data.latencyMs ?? def.latencyMs) / speed;

    const ctx: StepContext = {
      nodeId: node.id,
      nodeLabel: node.data.label,
      scope: scopeFor(input),
      items,
      subNodes,
      latencyMs,
      sleep: effects.sleep,
      now: effects.now,
      random: effects.random,
      speed,
    };

    const maxAttempts = node.data.retryOnFail
      ? 1 + Math.min(3, Math.max(1, Number(node.data.maxRetries ?? 2)))
      : 1;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        await effects.sleep(latencyMs);

        if (node.data.simulateFailure) {
          throw new EngineError(
            "simulated-failure",
            "This node is set to simulate a failure.",
            node.id,
          );
        }

        const result: NodeOutput = await def.execute(input, node.data.config, ctx);

        // Interactive Wait for Human Approval gate (when running in browser UI)
        if (result.pauseForApproval && effects.requestApproval) {
          const approved = await effects.requestApproval({
            nodeId: node.id,
            nodeLabel: node.data.label,
            summary: result.pauseForApproval.summary,
            details: result.pauseForApproval.details,
          });
          if (!approved) {
            throw new EngineError(
              "node-execution-failed",
              "Workflow rejected at human approval gate.",
              node.id,
            );
          }
        }

        const endedAt = effects.now();
        const itemCount = deriveItemCount(result.payload, result.itemCount);
        outputs.set(node.id, result.payload);
        outputsByLabel.set(node.data.label, result.payload);
        statuses.set(node.id, "success");

        // Mark connected AI sub-nodes as completed and pulse invoked tool edges
        const invokedSubNodeIds = new Set(
          (result.trace ?? [])
            .map((t) => t.subNodeId)
            .filter((id): id is string => Boolean(id)),
        );
        for (const subRef of subRefs) {
          const subNode = nodeById.get(subRef.sourceId);
          if (!subNode) continue;
          const kind = inferSubNodePortKind(subNode.type);
          if (
            kind === "ai_model" ||
            kind === "ai_memory" ||
            invokedSubNodeIds.has(subNode.id)
          ) {
            if (kind === "ai_tool") {
              edgeTransitions.push({
                edgeId: subRef.edgeId,
                fromNodeId: subNode.id,
                toNodeId: node.id,
                startedAt: endedAt,
                durationMs: 420 / speed,
                itemCount: 1,
              });
              emit({
                kind: "edge:active",
                edgeId: subRef.edgeId,
                fromNodeId: subNode.id,
                toNodeId: node.id,
                at: endedAt,
                durationMs: 420 / speed,
                itemCount: 1,
              });
            }
            statuses.set(subNode.id, "success");
            emit({
              kind: "node:success",
              nodeId: subNode.id,
              at: endedAt,
              output: (subNode.data.config ?? {}) as NodePayload,
              durationMs: endedAt - stepStartedAt,
              itemCount: 1,
            });
          }
        }

        emit({
          kind: "node:success",
          nodeId: node.id,
          at: endedAt,
          output: result.payload,
          durationMs: endedAt - stepStartedAt,
          itemCount,
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
          itemCount,
          ...(attempt > 1 ? { retriesUsed: attempt - 1 } : {}),
          ...(result.meta ? { meta: result.meta } : {}),
          ...(result.trace ? { trace: result.trace } : {}),
          ...(result.logs ? { logs: result.logs } : {}),
          ...(result.tokenUsage ? { tokenUsage: result.tokenUsage } : {}),
        });

        activateOutgoing(node, result.outputHandle ?? "out", endedAt, itemCount);
        return;
      } catch (error) {
        if (attempt < maxAttempts) {
          continue;
        }

        const endedAt = effects.now();
        const runError: RunError =
          error instanceof EngineError
            ? { code: error.code, message: error.message, nodeId: error.nodeId ?? node.id }
            : {
                code: "node-execution-failed",
                message: error instanceof Error ? error.message : "Unknown failure",
                nodeId: node.id,
              };

        const outgoing = graph.outgoing.get(node.id) ?? [];
        const hasErrorBranch = outgoing.some((ref) => ref.sourceHandle === "error");

        // Phase 5: Per-node "Continue on error" or explicit "error" branch
        if (node.data.continueOnError || hasErrorBranch) {
          const fallbackPayload: NodePayload = {
            ...input,
            error: runError.message,
            errorCode: runError.code,
            continuedOnError: true,
          };
          outputs.set(node.id, fallbackPayload);
          outputsByLabel.set(node.data.label, fallbackPayload);
          statuses.set(node.id, "success");

          emit({
            kind: "node:success",
            nodeId: node.id,
            at: endedAt,
            output: fallbackPayload,
            durationMs: endedAt - stepStartedAt,
            itemCount: 1,
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
            output: fallbackPayload,
            itemCount: 1,
            retriesUsed: attempt - 1,
            meta: {
              continuedOnError: true,
              originalError: runError.message,
            },
          });

          if (hasErrorBranch) {
            activateOutgoing(node, "error", endedAt, 1);
          }
          if (node.data.continueOnError) {
            activateOutgoing(node, "out", endedAt, 1);
          }
          return;
        }

        statuses.set(node.id, "error");
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
          ...(attempt > 1 ? { retriesUsed: attempt - 1 } : {}),
        });
      }
    }
  };

  /** Mark the edges leaving a node as carrying data, and emit their animation. */
  const activateOutgoing = (
    node: FlowNode,
    outputHandle: string,
    at: number,
    itemCount: number,
  ): void => {
    const outgoing: EdgeRef[] = graph.outgoing.get(node.id) ?? [];
    for (const ref of outgoing) {
      if ((ref.sourceHandle ?? "out") !== outputHandle) continue;

      deliveredEdges.add(ref.edgeId);
      const durationMs = 420 / speed;
      edgeTransitions.push({
        edgeId: ref.edgeId,
        fromNodeId: node.id,
        toNodeId: ref.targetId,
        startedAt: at,
        durationMs,
        itemCount,
      });
      emit({
        kind: "edge:active",
        edgeId: ref.edgeId,
        fromNodeId: node.id,
        toNodeId: ref.targetId,
        at,
        durationMs,
        itemCount,
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
