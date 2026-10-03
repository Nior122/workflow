"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowDownToLine } from "lucide-react";
import { BaseNode } from "./base-node";
import { getNodeUi } from "./registry";
import { requireNodeDef } from "@/lib/engine/registry";
import type { FlowNodeOf } from "@/types/nodes";

const TYPE = "output.log" as const;

function LogNodeInner({ data, selected }: NodeProps<FlowNodeOf<typeof TYPE>>) {
  const ui = getNodeUi(TYPE);
  const def = requireNodeDef(TYPE);

  return (
    <BaseNode
      label={data.label}
      category={ui.category}
      accent={ui.accent}
      icon={ui.icon}
      hasInput={def.inputs.length > 0}
      outputs={def.outputs.map((port) => port.id)}
      selected={selected}
      summary={
        <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <ArrowDownToLine className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{data.config.label || "untitled log"}</span>
        </p>
      }
    />
  );
}

export const LogNode = memo(LogNodeInner);
