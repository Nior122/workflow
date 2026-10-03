import type { ComponentType } from "react";
import type { NodeConfig, NodeType } from "@/types/nodes";
import type { ValidationIssue } from "@/types/validation";

export type ConfigFormProps<T extends NodeConfig = NodeConfig> = {
  config: T;
  onChange: (config: T) => void;
  /** True while a run is in flight; forms lock so config cannot change mid-run. */
  disabled?: boolean;
  /** Issues from the validator, used for inline field errors. */
  issues?: ValidationIssue[];
};

export type AnyConfigForm = ComponentType<ConfigFormProps<never>>;

/**
 * Pull the message for one field out of a node's issue list.
 *
 * Issues carry fully-qualified fields ("config.to") so they survive the trip
 * through the engine; forms address them by the short key.
 */
export function errorFor(issues: ValidationIssue[] | undefined, key: string): string | undefined {
  if (!issues) return undefined;
  const match = issues.find(
    (issue) => issue.level === "error" && issue.field === `config.${key}`,
  );
  return match?.message;
}

export type { NodeConfig, NodeType };
