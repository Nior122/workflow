import type { EdgeTypes } from "@xyflow/react";
import { AnimatedFlowEdge } from "./animated-flow-edge";

/** Module-level so the identity stays stable across renders. */
export const edgeTypes = {
  "animated-flow": AnimatedFlowEdge,
} as unknown as EdgeTypes;
