import type { NodeTypes } from "@xyflow/react";
import { createNodeComponent } from "./flow-node";
import { listNodeDefs } from "@/lib/engine/registry";
import type { NodeType } from "@/types/nodes";

/**
 * Built once at module level from the engine registry, so the object identity is
 * stable across renders — recreating it inside a component would make React Flow
 * remount every node on each render.
 *
 * Deriving it from `listNodeDefs()` means adding a node type registers it here
 * automatically; there is no second list to forget.
 */
export const nodeTypes: NodeTypes = Object.fromEntries(
  listNodeDefs().map((def) => [def.type, createNodeComponent(def.type as NodeType)]),
) as unknown as NodeTypes;
