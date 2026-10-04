import type { NodeTypes } from "@xyflow/react";
import { createNodeComponent } from "./flow-node";
import { listAllNodeDefs } from "@/lib/engine/registry";
import type { NodeType } from "@/types/nodes";

/**
 * Built once at module level from the full 144-node engine registry, so the object
 * identity is stable across renders — recreating it inside a component would make
 * React Flow remount every node on each render.
 */
export const nodeTypes: NodeTypes = Object.fromEntries(
  listAllNodeDefs().map((def) => [def.type, createNodeComponent(def.type as NodeType)]),
) as unknown as NodeTypes;
