import type { NodeType } from "./nodes";

export type ValidationCode =
  | "empty-workflow"
  | "missing-trigger"
  | "multiple-triggers"
  | "cycle-detected"
  | "unreachable-node"
  | "dangling-edge"
  | "missing-required-config"
  | "invalid-config"
  | "invalid-json";

export interface ValidationIssue {
  code: ValidationCode;
  level: "error" | "warning";
  message: string;
  /** Attaches the issue to a specific node so it can be drawn on the canvas. */
  nodeId?: string;
  edgeId?: string;
  /** Config field the issue concerns, e.g. "config.to". */
  field?: string;
}

/** Issues scoped to a node type, produced by a NodeTypeDef's own validateConfig. */
export type ConfigIssue = Omit<ValidationIssue, "nodeId">;

export interface ValidationResult {
  /** True when there are no level:"error" issues. */
  valid: boolean;
  issues: ValidationIssue[];
  /** Topological execution waves. Empty when a cycle was found. */
  waves: string[][];
  /** Node ids reachable from a trigger. */
  reachable: string[];
}

export function issuesForNode(
  issues: readonly ValidationIssue[],
  nodeId: string,
): ValidationIssue[] {
  return issues.filter((issue) => issue.nodeId === nodeId);
}

export function hasBlockingIssue(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

export type { NodeType };
