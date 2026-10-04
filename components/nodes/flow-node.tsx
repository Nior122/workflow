"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { AlertTriangle, RotateCw, ShieldAlert } from "lucide-react";
import { BaseNode } from "./base-node";
import { getNodeUi, summarizeConfig } from "./registry";
import { requireNodeDef } from "@/lib/engine/registry";
import { useNodeStatus } from "@/store/runStore";
import type { FlowNode, NodeType } from "@/types/nodes";

/**
 * One node component factory for all 144 node types (Main-Flow, AI Agent,
 * AI Model/Memory/Tool sub-nodes, and Sticky Notes).
 */
export function createNodeComponent(type: NodeType) {
  const ui = getNodeUi(type);
  const def = requireNodeDef(type);

  function FlowNodeComponent({
    id,
    data,
    selected,
    positionAbsoluteX,
    positionAbsoluteY,
  }: NodeProps<FlowNode>) {
    const status = useNodeStatus(id);
    const errors = [
      ...def.validateConfig(data.config),
      ...(data.validation ?? []),
    ].filter((issue) => issue.level === "error");

    const cfgRecord = (data.config ?? {}) as Record<string, unknown>;
    const stickyContent =
      ui.nodeKind === "annotation" ? String(cfgRecord.content ?? "") : undefined;
    const stickyColor =
      ui.nodeKind === "annotation" ? String(cfgRecord.color ?? "amber") : undefined;

    return (
      <BaseNode
        nodeId={id}
        position={{
          x: typeof positionAbsoluteX === "number" ? positionAbsoluteX : 0,
          y: typeof positionAbsoluteY === "number" ? positionAbsoluteY : 0,
        }}
        label={data.label}
        category={ui.category}
        subcategory={ui.subcategory}
        nodeKind={ui.nodeKind}
        accent={ui.accent}
        icon={ui.icon}
        hasInput={def.inputs.length > 0}
        outputs={def.outputs.map((port) => port.id)}
        outputSpecs={ui.outputs}
        selected={selected}
        errors={errors}
        status={status}
        stickyContent={stickyContent}
        stickyColor={stickyColor}
        summary={
          <div className="space-y-1">
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {summarizeConfig(type, data.config)}
            </p>

            {(data.simulateFailure || data.continueOnError || data.retryOnFail) && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                {data.simulateFailure && (
                  <span className="inline-flex items-center gap-1 rounded border border-error/35 bg-error/10 px-2 py-0.5 font-mono text-[10px] text-error">
                    <AlertTriangle className="size-2.5" aria-hidden />
                    failure forced
                  </span>
                )}
                {data.retryOnFail && (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                    <RotateCw className="size-2.5" aria-hidden />
                    retry {data.maxRetries ?? 2}x
                  </span>
                )}
                {data.continueOnError && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                    <ShieldAlert className="size-2.5" aria-hidden />
                    continue on error
                  </span>
                )}
              </div>
            )}
          </div>
        }
      />
    );
  }

  FlowNodeComponent.displayName = `FlowNode(${type})`;
  return memo(FlowNodeComponent);
}
