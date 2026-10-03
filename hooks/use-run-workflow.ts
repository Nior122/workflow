"use client";

import { useCallback, useRef } from "react";
import { browserEffects, executeWorkflow } from "@/lib/engine/executor";
import { analyzeGraph } from "@/lib/engine/graph";
import { validateWorkflow } from "@/lib/engine/validator";
import { useRunStore } from "@/store/runStore";
import { useUiStore } from "@/store/uiStore";
import { useWorkflowStore } from "@/store/workflowStore";

let runCounter = 0;

/**
 * Drives a run: validate, seed statuses, hand the graph to the pure engine, and
 * route its event stream into the run store.
 *
 * All timing and randomness live in `browserEffects`, so this hook is the only
 * place the engine meets the real clock.
 */
export function useRunWorkflow() {
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const { nodes, edges, workflowName } = useWorkflowStore.getState();
    const speed = useUiStore.getState().speed;
    const runStore = useRunStore.getState();

    if (runStore.status === "running") return;

    // Validate first so a broken flow never starts animating.
    const validation = validateWorkflow(nodes, edges);
    if (!validation.valid) {
      const firstError = validation.issues.find((issue) => issue.level === "error");
      runStore.setBlockingMessage(
        firstError?.message ?? "The flow has configuration errors.",
      );
      return;
    }
    runStore.setBlockingMessage(null);

    runCounter += 1;
    const runId = `run-${runCounter}`;
    const graph = analyzeGraph(nodes, edges);

    runStore.beginRun(runId, graph.reachableFromTriggers);
    useUiStore.getState().setIsRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await executeWorkflow({
        runId,
        workflowId: "local",
        workflowName,
        nodes,
        edges,
        speed,
        effects: browserEffects,
        emit: (event) => useRunStore.getState().applyEvent(event),
        signal: controller.signal,
      });

      useRunStore.getState().completeRun(result);
    } finally {
      abortRef.current = null;
      useUiStore.getState().setIsRunning(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, cancel };
}
