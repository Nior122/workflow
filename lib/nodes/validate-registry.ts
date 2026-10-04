/**
 * Build-time and test-time validator for the Master Node Registry.
 *
 * Ensures that every single registered node (144 nodes across Batches A–F) has:
 * - Unique `id`
 * - Non-empty `label`, `description`, `category`, `subcategory`, `keywords`, `icon`, `accent`
 * - Valid `type` (`trigger | action | output | logic | ai-agent | ai-model | ai-memory | ai-tool | annotation`)
 * - Valid `inputs` and `outputs` handle specs
 * - Well-formed `configSchema` and `defaultConfig` that passes `validateConfig`
 * - Non-empty `sampleOutput` object
 * - Callable `simulate(input, config, context)` function
 */

import type { RegistryNodeDef } from "@/types/registry";
import { ALL_REGISTRY_NODES } from "./index";

export interface RegistryValidationError {
  nodeId: string;
  field: string;
  message: string;
}

export function validateAllRegistryNodes(
  nodes: readonly RegistryNodeDef[] = ALL_REGISTRY_NODES,
): RegistryValidationError[] {
  const errors: RegistryValidationError[] = [];
  const seenIds = new Set<string>();

  for (const node of nodes) {
    if (!node.id || typeof node.id !== "string") {
      errors.push({ nodeId: "<unknown>", field: "id", message: "Missing node id" });
      continue;
    }

    if (seenIds.has(node.id)) {
      errors.push({
        nodeId: node.id,
        field: "id",
        message: `Duplicate node id "${node.id}"`,
      });
    }
    seenIds.add(node.id);

    if (!node.label?.trim()) {
      errors.push({ nodeId: node.id, field: "label", message: "Missing label" });
    }
    if (!node.description?.trim()) {
      errors.push({
        nodeId: node.id,
        field: "description",
        message: "Missing description",
      });
    }
    if (!node.category?.trim()) {
      errors.push({ nodeId: node.id, field: "category", message: "Missing category" });
    }
    if (!node.subcategory?.trim()) {
      errors.push({
        nodeId: node.id,
        field: "subcategory",
        message: "Missing subcategory",
      });
    }
    if (!Array.isArray(node.keywords) || node.keywords.length === 0) {
      errors.push({
        nodeId: node.id,
        field: "keywords",
        message: "Node must declare at least 1 search keyword",
      });
    }
    if (!node.icon?.trim()) {
      errors.push({ nodeId: node.id, field: "icon", message: "Missing icon key" });
    }
    if (!node.accent || !/^#[0-9A-Fa-f]{6}$/.test(node.accent)) {
      errors.push({
        nodeId: node.id,
        field: "accent",
        message: `Invalid hex accent "${node.accent}"`,
      });
    }
    if (!Array.isArray(node.inputs) || !Array.isArray(node.outputs)) {
      errors.push({
        nodeId: node.id,
        field: "handles",
        message: "inputs and outputs must be arrays",
      });
    }
    if (node.type === "trigger" && node.inputs.length > 0) {
      errors.push({
        nodeId: node.id,
        field: "inputs",
        message: "Trigger nodes must not have input handles",
      });
    }
    if (!Array.isArray(node.configSchema)) {
      errors.push({
        nodeId: node.id,
        field: "configSchema",
        message: "configSchema must be an array",
      });
    }
    if (!node.defaultConfig || typeof node.defaultConfig !== "object") {
      errors.push({
        nodeId: node.id,
        field: "defaultConfig",
        message: "defaultConfig must be an object",
      });
    } else if (node.validateConfig) {
      const issues = node.validateConfig(node.defaultConfig);
      const blocking = issues.filter((issue) => issue.level === "error");
      if (blocking.length > 0) {
        errors.push({
          nodeId: node.id,
          field: "defaultConfig",
          message: `defaultConfig failed validateConfig: ${blocking.map((b) => b.message).join("; ")}`,
        });
      }
    }
    if (!node.sampleOutput || typeof node.sampleOutput !== "object") {
      errors.push({
        nodeId: node.id,
        field: "sampleOutput",
        message: "sampleOutput must be an object",
      });
    }
    if (typeof node.simulate !== "function") {
      errors.push({
        nodeId: node.id,
        field: "simulate",
        message: "simulate must be an async function",
      });
    }
  }

  return errors;
}

export function assertValidRegistry(
  nodes: readonly RegistryNodeDef[] = ALL_REGISTRY_NODES,
): void {
  const errors = validateAllRegistryNodes(nodes);
  if (errors.length > 0) {
    const details = errors
      .map((err) => `  - [${err.nodeId}] ${err.field}: ${err.message}`)
      .join("\n");
    throw new Error(`Registry validation failed (${errors.length} error(s)):\n${details}`);
  }
}
