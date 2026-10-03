"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { getNodeUi } from "./registry";
import { requireNodeDef } from "@/lib/engine/registry";
import type { FlowNodeOf } from "@/types/nodes";

const TYPE = "action.aiPrompt" as const;

function AiPromptNodeInner({ data, selected }: NodeProps<FlowNodeOf<typeof TYPE>>) {
  const ui = getNodeUi(TYPE);
  const def = requireNodeDef(TYPE);
  const { promptTemplate, model } = data.config;

  const missing = promptTemplate.trim().length === 0;

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
        <div className="space-y-1.5">
          <p
            className={
              missing
                ? "text-xs text-error"
                : "line-clamp-2 font-mono text-[11px] leading-relaxed text-muted-foreground"
            }
          >
            {missing ? "prompt template required" : promptTemplate}
          </p>
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground/70 uppercase">
            {model}
          </p>
        </div>
      }
    />
  );
}

export const AiPromptNode = memo(AiPromptNodeInner);
