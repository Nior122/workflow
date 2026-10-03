import type { NodeTypes } from "@xyflow/react";
import { AiPromptNode } from "./ai-prompt-node";
import { LogNode } from "./log-node";
import { ManualTriggerNode } from "./manual-trigger-node";

/**
 * Module-level so the object identity is stable across renders — recreating this
 * inside a component makes React Flow remount every node on each render.
 *
 * The cast is required because each component is typed for one specific node type
 * (`NodeProps<FlowNodeOf<"action.aiPrompt">>`), while React Flow's map is keyed
 * loosely by string. The keys here match the registry exactly, and only types
 * present in `lib/engine/registry.ts` can ever be created, so the narrowing holds.
 */
export const nodeTypes = {
  "trigger.manual": ManualTriggerNode,
  "action.aiPrompt": AiPromptNode,
  "output.log": LogNode,
} as unknown as NodeTypes;
