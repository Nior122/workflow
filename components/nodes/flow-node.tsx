"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { BaseNode } from "./base-node";
import { getNodeUi, summarizeConfig } from "./registry";
import { requireNodeDef } from "@/lib/engine/registry";
import { useNodeStatus } from "@/store/runStore";
import type { FlowNode, NodeType } from "@/types/nodes";

/**
 * One node component for all thirteen types.
 *
 * Every node type renders the same chrome with different metadata, so a factory
 * parameterised by NodeType beats thirteen near-identical files. `createNodeComponent`
 * closes over the type, keeping React Flow's `nodeTypes` map static and memo-safe.
 */
export function createNodeComponent(type: NodeType) {
  const ui = getNodeUi(type);
  const def = requireNodeDef(type);

  function FlowNodeComponent({ id, data, selected }: NodeProps<FlowNode>) {
    const status = useNodeStatus(id);
    // Config-level issues are computed here so they can never go stale. Graph-level
    // issues (cycles, unreachable nodes) are written to data.validation by the
    // validator, which needs the whole graph to reason about.
    const errors = [
      ...def.validateConfig(data.config),
      ...(data.validation ?? []),
    ].filter((issue) => issue.level === "error");

    return (
      <BaseNode
        label={data.label}
        category={ui.category}
        accent={ui.accent}
        icon={ui.icon}
        hasInput={def.inputs.length > 0}
        outputs={def.outputs.map((port) => port.id)}
        selected={selected}
        errors={errors}
        status={status}
        summary={
          <div className="space-y-1.5">
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {summarizeConfig(type, data.config)}
            </p>

            {data.simulateFailure && (
              <p className="inline-flex items-center gap-1 rounded border border-error/35 bg-error/10 px-1.5 py-0.5 font-mono text-[10px] text-error">
                <AlertTriangle className="size-2.5" aria-hidden />
                failure forced
              </p>
            )}
          </div>
        }
      />
    );
  }

  FlowNodeComponent.displayName = `FlowNode(${type})`;
  return memo(FlowNodeComponent);
}
