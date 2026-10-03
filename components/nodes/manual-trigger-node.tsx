"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Braces } from "lucide-react";
import { BaseNode } from "./base-node";
import { getNodeUi } from "./registry";
import { requireNodeDef } from "@/lib/engine/registry";
import { parseJsonObject } from "@/types/json";
import type { FlowNodeOf } from "@/types/nodes";

const TYPE = "trigger.manual" as const;

function ManualTriggerNodeInner({ data, selected }: NodeProps<FlowNodeOf<typeof TYPE>>) {
  const ui = getNodeUi(TYPE);
  const def = requireNodeDef(TYPE);

  const parsed = parseJsonObject(data.config.payloadJson);
  const keyCount = parsed.ok ? Object.keys(parsed.value).length : 0;

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
        parsed.ok ? (
          <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Braces className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {keyCount === 0 ? "empty payload" : `${keyCount} field${keyCount === 1 ? "" : "s"}`}
            </span>
          </p>
        ) : (
          <p className="font-mono text-xs text-error">invalid JSON</p>
        )
      }
    />
  );
}

export const ManualTriggerNode = memo(ManualTriggerNodeInner);
