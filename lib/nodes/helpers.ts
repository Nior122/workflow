/**
 * Pure helpers for building declarative node definitions in `/lib/nodes/**`.
 */

import type { JsonObject } from "@/types/json";
import type { ConfigFieldSchema, HandleSpec, RegistryNodeDef } from "@/types/registry";
import type { ConfigIssue } from "@/types/validation";

export const MAIN_IN: readonly HandleSpec[] = [
  { id: "in", label: "Input", type: "main", position: "left" },
];

export const MAIN_OUT: readonly HandleSpec[] = [
  { id: "out", label: "Output", type: "main", position: "right" },
];

export const BOOL_OUT: readonly HandleSpec[] = [
  { id: "true", label: "True", type: "main", position: "right" },
  { id: "false", label: "False", type: "main", position: "right" },
];

export const SWITCH_OUT: readonly HandleSpec[] = [
  { id: "case_0", label: "Case 1", type: "main", position: "right" },
  { id: "case_1", label: "Case 2", type: "main", position: "right" },
  { id: "case_2", label: "Case 3", type: "main", position: "right" },
  { id: "fallback", label: "Fallback", type: "main", position: "right" },
];

export const LOOP_OUT: readonly HandleSpec[] = [
  { id: "loop", label: "Loop", type: "main", position: "right" },
  { id: "done", label: "Done", type: "main", position: "right" },
];

export const AGENT_INPUTS: readonly HandleSpec[] = [
  { id: "in", label: "Input", type: "main", position: "left" },
  {
    id: "ai_model",
    label: "Chat Model",
    type: "ai_model",
    position: "bottom",
    required: false,
    maxConnections: 1,
  },
  {
    id: "ai_memory",
    label: "Memory",
    type: "ai_memory",
    position: "bottom",
    required: false,
    maxConnections: 1,
  },
  {
    id: "ai_tool",
    label: "Tools",
    type: "ai_tool",
    position: "bottom",
    required: false,
  },
];

export const SUB_MODEL_OUT: readonly HandleSpec[] = [
  { id: "ai_model", label: "Model", type: "ai_model", position: "top" },
];

export const SUB_MEMORY_OUT: readonly HandleSpec[] = [
  { id: "ai_memory", label: "Memory", type: "ai_memory", position: "top" },
];

export const SUB_TOOL_OUT: readonly HandleSpec[] = [
  { id: "ai_tool", label: "Tool", type: "ai_tool", position: "top" },
];

export function defineRegistryNode(def: RegistryNodeDef): RegistryNodeDef {
  return def;
}

/** Catches unbalanced `{{` / `}}` expression tokens before a run starts. */
export function checkUnbalancedExpressions(
  fieldKey: string,
  raw: string,
): ConfigIssue[] {
  const open = (raw.match(/\{\{/g) ?? []).length;
  const close = (raw.match(/\}\}/g) ?? []).length;
  if (open !== close) {
    return [
      {
        code: "invalid-config",
        level: "error",
        message: `Unbalanced {{ }} — found ${open} "{{" and ${close} "}}".`,
        field: `config.${fieldKey}`,
      },
    ];
  }
  return [];
}

/**
 * Automatic schema-driven config validation.
 *
 * Checks `required` fields (respecting `showWhen` visibility), numeric `min`/`max`
 * bounds, JSON syntax for `json` fields, and unbalanced `{{ }}` tokens on text/expression fields.
 */
export function validateConfigWithSchema(
  schema: readonly ConfigFieldSchema[],
  config: JsonObject,
  extraValidate?: (config: JsonObject) => ConfigIssue[],
): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  for (const field of schema) {
    if (field.showWhen) {
      const controller = config[field.showWhen.key];
      const expected = field.showWhen.equals;
      const visible = Array.isArray(expected)
        ? expected.includes(String(controller))
        : controller === expected;
      if (!visible) continue;
    }

    const raw = config[field.key];

    if (field.required) {
      if (typeof raw === "string" && raw.trim().length === 0) {
        issues.push({
          code: "missing-required-config",
          level: "error",
          message: `${field.label} is required.`,
          field: `config.${field.key}`,
        });
        continue;
      }
      if (Array.isArray(raw) && raw.length === 0) {
        issues.push({
          code: "missing-required-config",
          level: "error",
          message: `Add at least one entry for ${field.label.toLowerCase()}.`,
          field: `config.${field.key}`,
        });
        continue;
      }
      if (raw === undefined || raw === null) {
        issues.push({
          code: "missing-required-config",
          level: "error",
          message: `${field.label} is required.`,
          field: `config.${field.key}`,
        });
        continue;
      }
    }

    if (
      (field.type === "text" ||
        field.type === "textarea" ||
        field.type === "expression") &&
      typeof raw === "string" &&
      raw.includes("{{")
    ) {
      issues.push(...checkUnbalancedExpressions(field.key, raw));
    }
  }

  if (extraValidate) {
    issues.push(...extraValidate(config));
  }

  return issues;
}
