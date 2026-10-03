"use client";

import { useEffect, useRef } from "react";
import { validateWorkflow, issuesByNode } from "@/lib/engine/validator";
import { useWorkflowStore } from "@/store/workflowStore";
import { useUiStore } from "@/store/uiStore";

/**
 * Revalidates the graph shortly after it stops changing and writes graph-level
 * issues (cycles, unreachable nodes) onto the nodes that caused them.
 *
 * Config-level issues are computed inside each node component instead, because
 * those depend only on the node's own config and can never go stale. Graph-level
 * issues need the whole graph, so they belong here.
 *
 * Debounced: dragging a node fires a change per frame, and validation walks every
 * edge.
 */
export function useLiveValidation(debounceMs = 220): void {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const isRunning = useUiStore((state) => state.isRunning);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isRunning) return;
    if (nodes.length === 0) return;

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      const result = validateWorkflow(nodes, edges);
      const grouped = issuesByNode(result.issues);

      // Only write when something actually changed, or every keystroke during a
      // drag would re-render the whole canvas.
      const patch = nodes.map((node) => {
        const issues = grouped.get(node.id) ?? [];
        const previous = node.data.validation ?? [];
        if (sameIssues(previous, issues)) return null;
        return { id: node.id, issues };
      });

      const changed = patch.filter((entry) => entry !== null);
      if (changed.length === 0) return;

      useWorkflowStore.setState((state) => ({
        nodes: state.nodes.map((node) => {
          const entry = changed.find((item) => item!.id === node.id);
          if (!entry) return node;
          const issues = entry.issues;
          return {
            ...node,
            data: {
              ...node.data,
              ...(issues.length > 0 ? { validation: issues } : {}),
            },
          } as typeof node;
        }),
      }));
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [nodes, edges, isRunning, debounceMs]);
}

function sameIssues(a: readonly { code: string; message: string }[], b: readonly { code: string; message: string }[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (issue, index) => issue.code === b[index].code && issue.message === b[index].message,
  );
}
