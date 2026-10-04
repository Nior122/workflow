/**
 * Batch E — Logic, Flow Control & Utility Node Definitions (27 nodes).
 *
 * Includes the 5 foundational v1 action/logic nodes (`action.condition`, `action.delay`,
 * `action.transform`, `action.httpRequest`, `action.textFormatter`) with 100%
 * backwards-compatible configs and validators, plus 22 advanced flow-control, item,
 * human-in-the-loop approval, code, and sticky-note nodes.
 */

import { parseJsonObject, type JsonObject, type JsonValue } from "@/types/json";
import type { ConditionOperator, HttpMethod } from "@/types/nodes";
import type { RegistryNodeDef } from "@/types/registry";
import type { ConfigIssue } from "@/types/validation";
import { simulateHttpResponse, hashString } from "@/lib/engine/simulator";
import {
  BOOL_OUT,
  LOOP_OUT,
  MAIN_IN,
  MAIN_OUT,
  SWITCH_OUT,
  checkUnbalancedExpressions,
  defineRegistryNode,
} from "../helpers";

function evaluateCondition(
  left: JsonValue,
  operator: ConditionOperator,
  right: JsonValue,
  caseSensitive: boolean,
): boolean {
  if (operator === "gt" || operator === "lt") {
    const l = Number(left);
    const r = Number(right);
    if (Number.isNaN(l) || Number.isNaN(r)) return false;
    return operator === "gt" ? l > r : l < r;
  }

  const norm = (val: JsonValue): string => {
    const str = val === null || val === undefined ? "" : String(val);
    return caseSensitive ? str : str.toLowerCase();
  };

  const l = norm(left);
  const r = norm(right);

  switch (operator) {
    case "equals":
      return l === r;
    case "notEquals":
      return l !== r;
    case "contains":
      return r.length > 0 && l.includes(r);
  }
}

function filled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function missing(field: string, label: string): ConfigIssue {
  return {
    code: "missing-required-config",
    level: "error",
    message: `${label} is required.`,
    field,
  };
}

const URL_PATTERN = /^https?:\/\/\S+$/;

export const conditionNode = defineRegistryNode({
  id: "action.condition",
  label: "Filter / Condition",
  description: "Routes the flow down a true or false branch based on a comparison.",
  category: "logic",
  subcategory: "Branching",
  keywords: ["if", "condition", "filter", "branch", "boolean", "compare", "route"],
  icon: "lucide:GitBranch",
  accent: "#E4633F",
  type: "logic",
  inputs: MAIN_IN,
  outputs: BOOL_OUT,
  latencyMs: 360,
  configSchema: [
    {
      key: "left",
      label: "Left operand",
      type: "expression",
      required: true,
      hint: "literal or {{path}}",
      placeholder: "{{budget}}",
    },
    {
      key: "operator",
      label: "Operator",
      type: "select",
      options: [
        { value: "equals", label: "equals" },
        { value: "notEquals", label: "does not equal" },
        { value: "contains", label: "contains" },
        { value: "gt", label: "greater than" },
        { value: "lt", label: "less than" },
      ],
    },
    {
      key: "right",
      label: "Right operand",
      type: "expression",
      required: true,
      placeholder: "500",
    },
    {
      key: "caseSensitive",
      label: "Case sensitive comparison",
      type: "boolean",
    },
  ],
  defaultConfig: {
    left: "{{budget}}",
    operator: "gt",
    right: "500",
    caseSensitive: false,
  },
  sampleOutput: {
    matched: true,
    branch: "true",
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const left = String(config.left ?? "");
    const right = String(config.right ?? "");
    const operator = String(config.operator ?? "gt") as ConditionOperator;

    if (!filled(left)) issues.push(missing("config.left", "Left operand"));
    if (!filled(right)) issues.push(missing("config.right", "Right operand"));

    const numericOnly = operator === "gt" || operator === "lt";
    if (numericOnly) {
      for (const [field, raw] of [
        ["config.left", left],
        ["config.right", right],
      ] as const) {
        if (filled(raw) && !raw.includes("{{") && Number.isNaN(Number(raw))) {
          issues.push({
            code: "invalid-config",
            level: "error",
            message: `"${raw}" is not a number, but this operator compares numerically.`,
            field,
          });
        }
      }
    }
    return issues;
  },
  simulate: async (input, config, ctx) => {
    const rawLeft = String(config.left ?? "");
    const rawRight = String(config.right ?? "");
    const left = rawLeft.includes("{{") ? ctx.resolveExpression(rawLeft) : rawLeft;
    const right = rawRight.includes("{{") ? ctx.resolveExpression(rawRight) : rawRight;
    const operator = (config.operator as ConditionOperator) ?? "equals";
    const matched = evaluateCondition(left, operator, right, Boolean(config.caseSensitive));

    return {
      output: input,
      outputHandle: matched ? "true" : "false",
      logs: [`Condition (${left} ${operator} ${right}) evaluated to ${String(matched)}.`],
      meta: {
        left,
        operator,
        right,
        matched,
      },
    };
  },
});

export const delayNode = defineRegistryNode({
  id: "action.delay",
  label: "Delay",
  description: "Waits a number of seconds before passing data on. Shortened in simulation.",
  category: "logic",
  subcategory: "Flow Control",
  keywords: ["delay", "wait", "sleep", "timer", "pause"],
  icon: "lucide:Timer",
  accent: "#B98A5A",
  type: "logic",
  inputs: MAIN_IN,
  outputs: MAIN_OUT,
  latencyMs: 320,
  configSchema: [
    {
      key: "seconds",
      label: "Wait for",
      type: "number",
      min: 1,
      max: 300,
      suffix: "sec",
      hint: "simulation shortens this",
    },
  ],
  defaultConfig: { seconds: 2 },
  sampleOutput: {
    waitedMs: 2000,
  },
  validateConfig: (config) => {
    const seconds = Number(config.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return [
        {
          code: "invalid-config",
          level: "error",
          message: "Delay must be a positive number of seconds.",
          field: "config.seconds",
        },
      ];
    }
    if (seconds > 60) {
      return [
        {
          code: "invalid-config",
          level: "warning",
          message: "Delays over 60s are capped in simulation.",
          field: "config.seconds",
        },
      ];
    }
    return [];
  },
  simulate: async (input, config, ctx) => {
    const seconds = Math.min(Math.max(Number(config.seconds ?? 2), 0), 60);
    const ms = (seconds * 1000) / ctx.speed;
    await ctx.sleep(ms);
    return {
      output: input,
      logs: [`Waited ${Math.round(ms)}ms (${seconds}s scaled by ${ctx.speed}x).`],
      meta: { waitedMs: Math.round(ms) },
    };
  },
});

export const transformNode = defineRegistryNode({
  id: "action.transform",
  label: "Transform",
  description: "Maps or renames fields into a new payload using key-value pairs.",
  category: "logic",
  subcategory: "Data Shaping",
  keywords: ["transform", "set", "edit", "fields", "map", "merge", "rename"],
  icon: "lucide:Shuffle",
  accent: "#F2884B",
  type: "logic",
  inputs: MAIN_IN,
  outputs: MAIN_OUT,
  latencyMs: 420,
  configSchema: [
    {
      key: "mode",
      label: "Mode",
      type: "select",
      options: [
        { value: "map", label: "Map — replace the payload" },
        { value: "merge", label: "Merge — spread over the input" },
      ],
    },
    {
      key: "fields",
      label: "Field mapping",
      type: "keyValue",
      required: true,
      keyLabel: "Output key",
      valueLabel: "Value",
      placeholder: "{{user.name}}",
      hint: "values support {{variables}}",
    },
  ],
  defaultConfig: {
    mode: "map",
    fields: [
      { id: "tf-name", key: "customer", value: "{{user.name}}" },
      { id: "tf-plan", key: "plan", value: "{{user.plan}}" },
    ],
  },
  sampleOutput: {
    customer: "Ada Lovelace",
    plan: "pro",
  },
  validateConfig: (config) => {
    const fields = Array.isArray(config.fields)
      ? (config.fields as Array<{ key?: string; value?: string }>)
      : [];
    if (fields.length === 0) {
      return [
        {
          code: "missing-required-config",
          level: "error",
          message: "Add at least one field mapping.",
          field: "config.fields",
        },
      ];
    }
    if (fields.some((field) => !filled(field.key))) {
      return [
        {
          code: "invalid-config",
          level: "error",
          message: "Every mapping needs a target key.",
          field: "config.fields",
        },
      ];
    }
    return [];
  },
  simulate: async (input, config, ctx) => {
    const fields = Array.isArray(config.fields)
      ? (config.fields as Array<{ key: string; value: string }>)
      : [];
    const mapped: Record<string, JsonValue> = {};
    for (const field of fields) {
      const key = String(field.key ?? "").trim();
      if (!key) continue;
      mapped[key] = ctx.resolveExpression(String(field.value ?? ""));
    }
    const mode = config.mode === "merge" ? "merge" : "map";
    return {
      output: mode === "merge" ? { ...input, ...mapped } : mapped,
      logs: [`Transformed ${Object.keys(mapped).length} field(s) in ${mode} mode.`],
      meta: { mode, fields: Object.keys(mapped).length },
    };
  },
});

export const httpRequestNode = defineRegistryNode({
  id: "action.httpRequest",
  label: "HTTP Request",
  description: "Makes a request and returns the response body. Simulated with mock JSON.",
  category: "logic",
  subcategory: "Network",
  keywords: ["http", "request", "fetch", "api", "rest", "get", "post", "webhook"],
  icon: "lucide:Globe",
  accent: "#FF6B35",
  type: "action",
  inputs: MAIN_IN,
  outputs: MAIN_OUT,
  latencyMs: 900,
  configSchema: [
    {
      key: "method",
      label: "Method",
      type: "select",
      options: [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" },
        { value: "PATCH", label: "PATCH" },
        { value: "DELETE", label: "DELETE" },
      ],
    },
    {
      key: "url",
      label: "URL",
      type: "expression",
      required: true,
      placeholder: "https://api.example.com/v1/invoices?status=overdue",
    },
    {
      key: "headers",
      label: "Headers",
      type: "keyValue",
      keyLabel: "Header",
      valueLabel: "Value",
      placeholder: "application/json",
    },
    {
      key: "bodyJson",
      label: "Request body (JSON)",
      type: "json",
      showWhen: { key: "method", equals: ["POST", "PUT", "PATCH", "DELETE"] },
      placeholder: '{"key": "value"}',
    },
  ],
  defaultConfig: {
    method: "GET",
    url: "https://api.example.com/v1/invoices?status=overdue",
    headers: [{ id: "hdr-accept", key: "Accept", value: "application/json" }],
    bodyJson: "",
  },
  sampleOutput: {
    status: 200,
    data: [
      { id: "inv-1042", customer: "Hopper Ltd", amount: 2400, daysOverdue: 18 },
      { id: "inv-1051", customer: "Lovelace Lab", amount: 5120, daysOverdue: 41 },
    ],
    page: 1,
    total: 2,
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const url = String(config.url ?? "").trim();
    const method = String(config.method ?? "GET") as HttpMethod;
    const bodyJson = String(config.bodyJson ?? "");
    const headers = Array.isArray(config.headers)
      ? (config.headers as Array<{ key?: string; value?: string }>)
      : [];

    if (!filled(url)) {
      issues.push(missing("config.url", "URL"));
    } else if (!url.includes("{{") && !URL_PATTERN.test(url)) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "URL must start with http:// or https://",
        field: "config.url",
      });
    }

    if (bodyJson.trim().length > 0 && method !== "GET") {
      const parsed = parseJsonObject(bodyJson);
      if (!parsed.ok) {
        issues.push({
          code: "invalid-json",
          level: "error",
          message: `Request body: ${parsed.error}`,
          field: "config.bodyJson",
        });
      }
    }

    const blankHeader = headers.some((h) => filled(h.value) && !filled(h.key));
    if (blankHeader) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "A header has a value but no name.",
        field: "config.headers",
      });
    }

    return issues;
  },
  simulate: async (_input, config, ctx) => {
    const method = (config.method as HttpMethod) ?? "GET";
    const url = ctx.resolveExpression(String(config.url ?? ""));
    const { status, body } = simulateHttpResponse({
      method,
      url,
      random: ctx.random,
    });
    return {
      output: { ...body, status },
      logs: [`HTTP ${method} ${url} -> ${status}.`],
      meta: { method, url, status, simulated: true },
    };
  },
});

export const textFormatterNode = defineRegistryNode({
  id: "action.textFormatter",
  label: "Text Formatter",
  description: "Renders a template string with {{variables}} from the incoming data.",
  category: "logic",
  subcategory: "Transform",
  keywords: ["text", "formatter", "template", "string", "interpolate", "variables"],
  icon: "lucide:Type",
  accent: "#FF8A5C",
  type: "action",
  inputs: MAIN_IN,
  outputs: MAIN_OUT,
  latencyMs: 380,
  configSchema: [
    {
      key: "template",
      label: "Template",
      type: "textarea",
      required: true,
      hint: "{{variables}}",
      placeholder: "Lead: {{user.name}} — {{budget}}",
    },
  ],
  defaultConfig: {
    template: "Lead: {{user.name}} ({{user.plan}} plan) — {{budget}} budget from {{source}}.",
  },
  sampleOutput: {
    text: "Lead: Ada Lovelace (pro plan) — 1200 budget from landing-page.",
  },
  validateConfig: (config) => {
    const template = String(config.template ?? "");
    const issues: ConfigIssue[] = [];
    if (!filled(template)) issues.push(missing("config.template", "Template"));
    return [...issues, ...checkUnbalancedExpressions("template", template)];
  },
  simulate: async (input, config, ctx) => {
    const template = String(config.template ?? "");
    const text = ctx.resolveExpression(template);
    return {
      output: { ...input, text },
      logs: [`Formatted template (${text.length} chars).`],
      meta: { template },
    };
  },
});

export const LOGIC_NODES: readonly RegistryNodeDef[] = [
  conditionNode,

  // 82. Switch (Multi-Output)
  defineRegistryNode({
    id: "logic.switch",
    label: "Switch",
    description: "Routes items to one of 3 named case handles or a fallback handle.",
    category: "logic",
    subcategory: "Branching",
    keywords: ["switch", "case", "router", "branch", "multi", "route", "fallback"],
    icon: "lucide:GitFork",
    accent: "#E4633F",
    type: "logic",
    inputs: MAIN_IN,
    outputs: SWITCH_OUT,
    latencyMs: 340,
    configSchema: [
      {
        key: "value",
        label: "Value to match",
        type: "expression",
        required: true,
        placeholder: "{{category}} or {{ai.classification}}",
      },
      {
        key: "case0",
        label: "Case 1 value (→ case_0)",
        type: "text",
        required: true,
        placeholder: "billing",
      },
      {
        key: "case1",
        label: "Case 2 value (→ case_1)",
        type: "text",
        placeholder: "technical",
      },
      {
        key: "case2",
        label: "Case 3 value (→ case_2)",
        type: "text",
        placeholder: "sales",
      },
    ],
    defaultConfig: {
      value: "{{category}}",
      case0: "billing",
      case1: "technical",
      case2: "sales",
    },
    sampleOutput: {
      matchedCase: "case_0",
      evaluatedValue: "billing",
    },
    simulate: async (input, config, ctx) => {
      const rawVal = String(config.value ?? "");
      const evaluated = (rawVal.includes("{{") ? ctx.resolveExpression(rawVal) : rawVal)
        .trim()
        .toLowerCase();
      const c0 = String(config.case0 ?? "").trim().toLowerCase();
      const c1 = String(config.case1 ?? "").trim().toLowerCase();
      const c2 = String(config.case2 ?? "").trim().toLowerCase();

      let handle = "fallback";
      if (c0 && evaluated.includes(c0)) handle = "case_0";
      else if (c1 && evaluated.includes(c1)) handle = "case_1";
      else if (c2 && evaluated.includes(c2)) handle = "case_2";

      return {
        output: { ...input, matchedCase: handle, evaluatedValue: evaluated },
        outputHandle: handle,
        logs: [`Switch matched "${evaluated || "(empty)"}" -> ${handle}.`],
        meta: { matchedCase: handle, evaluatedValue: evaluated },
      };
    },
  }),

  // 83. Merge
  defineRegistryNode({
    id: "logic.merge",
    label: "Merge",
    description: "Combines data from multiple upstream branches (Wait for All, Append, or Combine).",
    category: "logic",
    subcategory: "Flow Control",
    keywords: ["merge", "join", "combine", "append", "wait", "branches"],
    icon: "lucide:GitMerge",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "mode",
        label: "Merge mode",
        type: "select",
        options: [
          { value: "waitAll", label: "Wait for All & Shallow Merge" },
          { value: "append", label: "Append Items" },
          { value: "combine", label: "Combine by Key" },
        ],
      },
    ],
    defaultConfig: { mode: "waitAll" },
    sampleOutput: {
      merged: true,
      mode: "waitAll",
    },
    simulate: async (input, config) => {
      const mode = String(config.mode || "waitAll");
      return {
        output: { ...input, merged: true, mergeMode: mode },
        logs: [`Merged upstream branches in "${mode}" mode.`],
        meta: { mode },
      };
    },
  }),

  // 84. Loop Over Items
  defineRegistryNode({
    id: "logic.loopOverItems",
    label: "Loop Over Items",
    description: "Iterates over an array of items in batches and emits summary statistics.",
    category: "logic",
    subcategory: "Flow Control",
    keywords: ["loop", "batch", "foreach", "iterate", "items", "repeat"],
    icon: "lucide:Repeat",
    accent: "#F59E0B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: LOOP_OUT,
    latencyMs: 420,
    configSchema: [
      {
        key: "batchSize",
        label: "Batch size",
        type: "number",
        min: 1,
        max: 100,
      },
      {
        key: "activeBranch",
        label: "Completion output handle",
        type: "select",
        options: [
          { value: "done", label: "Done handle (after iterating all batches)" },
          { value: "loop", label: "Loop handle (per-batch output)" },
        ],
      },
    ],
    defaultConfig: { batchSize: 1, activeBranch: "done" },
    sampleOutput: {
      totalItemsProcessed: 3,
      batchesRun: 3,
      loopCompleted: true,
    },
    simulate: async (input, config, ctx) => {
      const batchSize = Math.max(1, Number(config.batchSize ?? 1));
      const itemCount = Math.max(1, ctx.items.length);
      const batchesRun = Math.ceil(itemCount / batchSize);
      const handle = String(config.activeBranch || "done");
      return {
        output: {
          ...input,
          totalItemsProcessed: itemCount,
          batchesRun,
          loopCompleted: true,
        },
        outputHandle: handle,
        logs: [`Processed ${itemCount} item(s) across ${batchesRun} batch(es).`],
        meta: { totalItemsProcessed: itemCount, batchesRun },
      };
    },
  }),

  // 85. Split Out
  defineRegistryNode({
    id: "logic.splitOut",
    label: "Split Out",
    description: "Splits an array field on the payload into separate workflow items.",
    category: "logic",
    subcategory: "Items",
    keywords: ["split", "array", "unwind", "expand", "items", "list"],
    icon: "lucide:Split",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "fieldToSplit",
        label: "Field to split out",
        type: "text",
        required: true,
        placeholder: "data",
      },
    ],
    defaultConfig: { fieldToSplit: "data" },
    sampleOutput: {
      splitField: "data",
      itemCount: 3,
    },
    simulate: async (input, config) => {
      const field = String(config.fieldToSplit || "data");
      const candidate = input[field];
      if (Array.isArray(candidate) && candidate.length > 0) {
        const items = candidate.map((entry, index) => ({
          json:
            typeof entry === "object" && entry !== null && !Array.isArray(entry)
              ? (entry as JsonObject)
              : { value: entry, index },
        }));
        return {
          output: items,
          logs: [`Split "${field}" into ${items.length} items.`],
          meta: { splitField: field, itemCount: items.length },
        };
      }
      return {
        output: [
          { json: { ...input, splitIndex: 0 } },
          { json: { ...input, splitIndex: 1 } },
        ],
        logs: [`Split payload into 2 items.`],
        meta: { splitField: field, itemCount: 2 },
      };
    },
  }),

  // 86. Aggregate
  defineRegistryNode({
    id: "logic.aggregate",
    label: "Aggregate",
    description: "Combines multiple incoming items into a single aggregated array field.",
    category: "logic",
    subcategory: "Items",
    keywords: ["aggregate", "group", "collect", "array", "reduce", "items"],
    icon: "lucide:Layers",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 340,
    configSchema: [
      {
        key: "outputField",
        label: "Destination array field",
        type: "text",
        required: true,
        placeholder: "aggregatedItems",
      },
    ],
    defaultConfig: { outputField: "aggregatedItems" },
    sampleOutput: {
      count: 3,
      aggregatedItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
    simulate: async (input, config, ctx) => {
      const outputField = String(config.outputField || "aggregatedItems");
      const collected = ctx.items.map((item) => item.json);
      return {
        output: {
          ...input,
          count: collected.length,
          [outputField]: collected,
        },
        logs: [`Aggregated ${collected.length} item(s) into "${outputField}".`],
        meta: { count: collected.length, outputField },
      };
    },
  }),

  // 87. Filter Items
  defineRegistryNode({
    id: "logic.filter",
    label: "Filter Items",
    description: "Keeps only items matching a field expression without branching the graph.",
    category: "logic",
    subcategory: "Items",
    keywords: ["filter", "where", "keep", "items", "array"],
    icon: "lucide:Filter",
    accent: "#E4633F",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "field",
        label: "Field name",
        type: "text",
        required: true,
        placeholder: "status",
      },
      {
        key: "equalsValue",
        label: "Expected value",
        type: "text",
        required: true,
        placeholder: "active",
      },
    ],
    defaultConfig: { field: "status", equalsValue: "active" },
    sampleOutput: {
      filteredCount: 2,
      kept: true,
    },
    simulate: async (input, config, ctx) => {
      const field = String(config.field || "status");
      const expected = String(config.equalsValue || "active");
      return {
        output: {
          ...input,
          filteredBy: `${field} === ${expected}`,
          filteredCount: ctx.items.length,
          kept: true,
        },
        logs: [`Filtered items where ${field} == "${expected}".`],
        meta: { field, expected },
      };
    },
  }),

  // 88. Sort Items
  defineRegistryNode({
    id: "logic.sort",
    label: "Sort Items",
    description: "Sorts items ascending or descending by a key.",
    category: "logic",
    subcategory: "Items",
    keywords: ["sort", "order", "ascending", "descending", "rank"],
    icon: "lucide:ArrowUpDown",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "sortKey",
        label: "Sort key",
        type: "text",
        required: true,
        placeholder: "createdAt",
      },
      {
        key: "direction",
        label: "Direction",
        type: "select",
        options: [
          { value: "desc", label: "Descending (Z→A / 9→0)" },
          { value: "asc", label: "Ascending (A→Z / 0→9)" },
        ],
      },
    ],
    defaultConfig: { sortKey: "createdAt", direction: "desc" },
    sampleOutput: {
      sortedBy: "createdAt",
      direction: "desc",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        sortedBy: String(config.sortKey || "createdAt"),
        direction: String(config.direction || "desc"),
      },
      logs: [`Sorted items by ${String(config.sortKey)} (${String(config.direction)}).`],
    }),
  }),

  // 89. Limit Items
  defineRegistryNode({
    id: "logic.limit",
    label: "Limit Items",
    description: "Caps the number of items passed downstream to a maximum count.",
    category: "logic",
    subcategory: "Items",
    keywords: ["limit", "take", "slice", "top", "cap", "max"],
    icon: "lucide:Scissors",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "maxItems",
        label: "Max items",
        type: "number",
        min: 1,
        max: 500,
      },
    ],
    defaultConfig: { maxItems: 5 },
    sampleOutput: {
      maxItems: 5,
      keptItems: 1,
    },
    simulate: async (input, config, ctx) => {
      const maxItems = Math.max(1, Number(config.maxItems ?? 5));
      const sliced = ctx.items.slice(0, maxItems);
      return {
        output: sliced.length > 1 ? sliced : { ...input, maxItems, keptItems: sliced.length },
        logs: [`Limited stream to ${sliced.length} item(s) (max ${maxItems}).`],
        meta: { maxItems, keptItems: sliced.length },
      };
    },
  }),

  // 90. Remove Duplicates
  defineRegistryNode({
    id: "logic.removeDuplicates",
    label: "Remove Duplicates",
    description: "Deduplicates items by a unique key or hash.",
    category: "logic",
    subcategory: "Items",
    keywords: ["deduplicate", "unique", "distinct", "duplicates", "remove"],
    icon: "lucide:CopyCheck",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "dedupeKey",
        label: "Unique field path",
        type: "text",
        required: true,
        placeholder: "email",
      },
    ],
    defaultConfig: { dedupeKey: "email" },
    sampleOutput: {
      dedupeKey: "email",
      duplicatesRemoved: 0,
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        dedupeKey: String(config.dedupeKey || "email"),
        duplicatesRemoved: 0,
      },
      logs: [`Deduplicated stream on field "${String(config.dedupeKey || "email")}".`],
    }),
  }),

  // 91. Delay (v1)
  delayNode,

  // 92. Wait for Human Approval
  defineRegistryNode({
    id: "logic.waitForApproval",
    label: "Wait for Human Approval",
    description:
      "Pauses the workflow run and surfaces an interactive Approve / Reject card in the builder UI.",
    category: "logic",
    subcategory: "Human-in-Loop",
    keywords: ["approval", "human", "wait", "pause", "review", "confirm", "hitl"],
    icon: "lucide:UserCheck",
    accent: "#F5B301",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 360,
    configSchema: [
      {
        key: "summary",
        label: "Approval prompt",
        type: "expression",
        required: true,
        placeholder: "Approve sending reply to {{from}}?",
      },
      {
        key: "approverRole",
        label: "Approver role / channel",
        type: "text",
        placeholder: "Support Lead (#approvals)",
      },
      {
        key: "requireInteractiveClick",
        label: "Pause for interactive click in browser",
        type: "boolean",
        hint: "Pauses live runs until you click Approve",
      },
    ],
    defaultConfig: {
      summary: "Approve outbound message: {{text}}",
      approverRole: "Support Lead",
      requireInteractiveClick: true,
    },
    sampleOutput: {
      approvalStatus: "approved",
      approvedBy: "Support Lead",
      summary: "Approve outbound message",
    },
    simulate: async (input, config, ctx) => {
      const summary = ctx.resolveExpression(
        String(config.summary || "Approve outbound workflow action"),
      );
      const approverRole = String(config.approverRole || "Support Lead");
      return {
        output: {
          ...input,
          approvalStatus: "approved",
          approvedBy: approverRole,
          approvalSummary: summary,
        },
        pauseForApproval: config.requireInteractiveClick
          ? {
              summary,
              details: { approverRole, nodeLabel: ctx.nodeLabel },
            }
          : undefined,
        logs: [`Human approval granted by ${approverRole} ("${summary}").`],
        meta: { approvalStatus: "approved", approverRole },
      };
    },
  }),

  // 93. Transform / Set Fields (v1)
  transformNode,

  // 94. Code (JavaScript)
  defineRegistryNode({
    id: "logic.code",
    label: "Code (JavaScript)",
    description: "Runs custom JavaScript transformation expressions over `$input` in a safe simulator.",
    category: "logic",
    subcategory: "Custom Code",
    keywords: ["code", "javascript", "js", "script", "function", "custom"],
    icon: "lucide:Code2",
    accent: "#FFA23A",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 380,
    configSchema: [
      {
        key: "code",
        label: "JavaScript snippet",
        type: "code",
        language: "javascript",
        required: true,
        placeholder: "return { ...$input, processedAt: new Date().toISOString() };",
      },
    ],
    defaultConfig: {
      code: "// Transform the incoming payload\nreturn {\n  ...$input,\n  computedScore: 95,\n  processedBy: 'logic.code'\n};",
    },
    sampleOutput: {
      computedScore: 95,
      processedBy: "logic.code",
    },
    simulate: async (input, config) => {
      const snippet = String(config.code || "");
      return {
        output: {
          ...input,
          computedScore: 95,
          processedBy: "logic.code",
          codeLength: snippet.length,
        },
        logs: [`Executed JavaScript snippet (${snippet.split("\n").length} lines).`],
        meta: { lines: snippet.split("\n").length },
      };
    },
  }),

  // 95. HTTP Request (v1)
  httpRequestNode,

  // 96. Text Formatter (v1)
  textFormatterNode,

  // 97. Date and Time
  defineRegistryNode({
    id: "logic.dateTime",
    label: "Date & Time",
    description: "Formats timestamps, adds/subtracts intervals, or converts timezones.",
    category: "logic",
    subcategory: "Utility",
    keywords: ["date", "time", "timezone", "format", "iso", "calendar", "add"],
    icon: "lucide:Clock",
    accent: "#B98A5A",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "format", label: "Format Current Timestamp" },
          { value: "addDays", label: "Add Days" },
        ],
      },
      {
        key: "daysOffset",
        label: "Days offset",
        type: "number",
        min: -365,
        max: 365,
      },
    ],
    defaultConfig: { operation: "format", daysOffset: 7 },
    sampleOutput: {
      isoDate: "2026-10-04T09:00:00.000Z",
      formattedDate: "2026-10-11",
    },
    simulate: async (input, config, ctx) => {
      const days = Number(config.daysOffset ?? 0);
      const baseMs = ctx.now() + days * 86_400_000;
      const isoDate = new Date(baseMs).toISOString();
      return {
        output: {
          ...input,
          isoDate,
          formattedDate: isoDate.slice(0, 10),
        },
        logs: [`Computed date ${isoDate}.`],
      };
    },
  }),

  // 98. JSON Parse / Stringify
  defineRegistryNode({
    id: "logic.jsonCodec",
    label: "JSON Parse / Stringify",
    description: "Parses a JSON string field into an object or serializes an object to JSON.",
    category: "logic",
    subcategory: "Utility",
    keywords: ["json", "parse", "stringify", "serialize", "object"],
    icon: "lucide:Braces",
    accent: "#FF8A5C",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "mode",
        label: "Operation",
        type: "select",
        options: [
          { value: "stringify", label: "Stringify payload to JSON" },
          { value: "parse", label: "Parse JSON string" },
        ],
      },
    ],
    defaultConfig: { mode: "stringify" },
    sampleOutput: {
      jsonString: '{"ok":true}',
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        jsonCodecMode: String(config.mode || "stringify"),
        jsonString: JSON.stringify(input),
      },
      logs: [`JSON ${String(config.mode || "stringify")} completed.`],
    }),
  }),

  // 99. HTML Extract
  defineRegistryNode({
    id: "logic.htmlExtract",
    label: "HTML Extract",
    description: "Extracts text or attributes from HTML using CSS selectors.",
    category: "logic",
    subcategory: "Utility",
    keywords: ["html", "scrape", "extract", "css", "selector", "dom"],
    icon: "lucide:FileCode",
    accent: "#FF8A5C",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 360,
    configSchema: [
      {
        key: "selector",
        label: "CSS selector",
        type: "text",
        required: true,
        placeholder: "article h1.post-title",
      },
    ],
    defaultConfig: { selector: "article h1.post-title" },
    sampleOutput: {
      selector: "article h1.post-title",
      extractedText: "FlowForge v2 Release Notes",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        selector: String(config.selector || "h1"),
        extractedText: "FlowForge v2 Release Notes",
      },
      logs: [`Extracted HTML content matching "${String(config.selector || "h1")}".`],
    }),
  }),

  // 100. Markdown to HTML
  defineRegistryNode({
    id: "logic.markdownToHtml",
    label: "Markdown to HTML",
    description: "Converts Markdown text into sanitized HTML markup.",
    category: "logic",
    subcategory: "Utility",
    keywords: ["markdown", "md", "html", "convert", "render"],
    icon: "lucide:FileText",
    accent: "#FF8A5C",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "markdown",
        label: "Markdown source",
        type: "textarea",
        required: true,
        placeholder: "# Summary\n\n{{text}}",
      },
    ],
    defaultConfig: { markdown: "# Summary\n\n{{text}}" },
    sampleOutput: {
      html: "<h1>Summary</h1><p>Processed workflow output.</p>",
    },
    simulate: async (input, config, ctx) => {
      const md = ctx.resolveExpression(String(config.markdown || "# Summary"));
      const html = `<article>${md.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")}</article>`;
      return {
        output: { ...input, html },
        logs: ["Converted Markdown to HTML."],
      };
    },
  }),

  // 101. Crypto / Hash
  defineRegistryNode({
    id: "logic.cryptoHash",
    label: "Crypto / Hash",
    description: "Computes a deterministic hash digest or HMAC signature of a value.",
    category: "logic",
    subcategory: "Utility",
    keywords: ["crypto", "hash", "sha256", "hmac", "digest", "signature"],
    icon: "lucide:KeyRound",
    accent: "#B98A5A",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "algorithm",
        label: "Algorithm",
        type: "select",
        options: [
          { value: "SHA-256", label: "SHA-256" },
          { value: "HMAC-SHA256", label: "HMAC-SHA256" },
          { value: "MD5", label: "MD5" },
        ],
      },
      {
        key: "value",
        label: "Input string",
        type: "expression",
        required: true,
        placeholder: "{{user.email}}",
      },
    ],
    defaultConfig: { algorithm: "SHA-256", value: "{{user.email}}" },
    sampleOutput: {
      algorithm: "SHA-256",
      digest: "sha256_1a92f88c01",
    },
    simulate: async (input, config, ctx) => {
      const raw = ctx.resolveExpression(String(config.value || ""));
      const algorithm = String(config.algorithm || "SHA-256");
      const digest = `${algorithm.toLowerCase().replace(/[^a-z0-9]/g, "")}_${hashString(raw)}`;
      return {
        output: { ...input, algorithm, digest },
        logs: [`Computed ${algorithm} digest: ${digest}.`],
      };
    },
  }),

  // 102. Compare Datasets
  defineRegistryNode({
    id: "logic.compareDatasets",
    label: "Compare Datasets",
    description: "Diffs two sets of records by key to identify added, updated, and unchanged items.",
    category: "logic",
    subcategory: "Items",
    keywords: ["compare", "diff", "datasets", "sync", "delta"],
    icon: "lucide:Columns2",
    accent: "#F2884B",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 360,
    configSchema: [
      {
        key: "matchKey",
        label: "Primary key field",
        type: "text",
        required: true,
        placeholder: "id",
      },
    ],
    defaultConfig: { matchKey: "id" },
    sampleOutput: {
      matchKey: "id",
      addedCount: 1,
      updatedCount: 0,
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        matchKey: String(config.matchKey || "id"),
        addedCount: 1,
        updatedCount: 0,
      },
      logs: [`Compared datasets on key "${String(config.matchKey || "id")}".`],
    }),
  }),

  // 103. Respond to Webhook
  defineRegistryNode({
    id: "output.respondToWebhook",
    label: "Respond to Webhook",
    description: "Returns a custom HTTP status code and JSON body to the caller of a Webhook trigger.",
    category: "output",
    subcategory: "Network",
    keywords: ["webhook", "respond", "response", "http", "status", "return"],
    icon: "lucide:Reply",
    accent: "#7FA88F",
    type: "output",
    inputs: MAIN_IN,
    outputs: [],
    latencyMs: 320,
    configSchema: [
      {
        key: "statusCode",
        label: "HTTP status code",
        type: "number",
        min: 200,
        max: 599,
      },
      {
        key: "responseBody",
        label: "Response summary",
        type: "expression",
        placeholder: '{"ok": true, "message": "{{text}}"}',
      },
    ],
    defaultConfig: {
      statusCode: 200,
      responseBody: '{"ok": true}',
    },
    sampleOutput: {
      webhookResponded: true,
      statusCode: 200,
    },
    simulate: async (input, config, ctx) => {
      const statusCode = Number(config.statusCode ?? 200);
      const body = ctx.resolveExpression(String(config.responseBody || '{"ok": true}'));
      return {
        output: { ...input, webhookResponded: true, statusCode, responseBody: body },
        logs: [`Responded to webhook caller with HTTP ${statusCode}.`],
        meta: { statusCode },
      };
    },
  }),

  // 104. Execute Sub-Workflow
  defineRegistryNode({
    id: "logic.executeSubWorkflow",
    label: "Execute Sub-Workflow",
    description: "Calls another workflow with the current payload and returns its output.",
    category: "logic",
    subcategory: "Flow Control",
    keywords: ["subworkflow", "call", "workflow", "modular", "nested", "invoke"],
    icon: "lucide:Workflow",
    accent: "#FFA23A",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 480,
    configSchema: [
      {
        key: "targetWorkflowName",
        label: "Target sub-workflow name",
        type: "text",
        required: true,
        placeholder: "Enrich Customer Profile",
      },
    ],
    defaultConfig: { targetWorkflowName: "Enrich Customer Profile" },
    sampleOutput: {
      subWorkflow: "Enrich Customer Profile",
      subWorkflowStatus: "completed",
      enriched: true,
    },
    simulate: async (input, config) => {
      const target = String(config.targetWorkflowName || "Enrich Customer Profile");
      return {
        output: {
          ...input,
          subWorkflow: target,
          subWorkflowStatus: "completed",
          enriched: true,
        },
        logs: [`Sub-workflow "${target}" executed and returned enriched payload.`],
        meta: { subWorkflow: target },
      };
    },
  }),

  // 105. Stop and Error
  defineRegistryNode({
    id: "logic.stopAndError",
    label: "Stop and Error",
    description: "Intentionally halts the workflow or logs a structured business-rule guard message.",
    category: "logic",
    subcategory: "Flow Control",
    keywords: ["stop", "error", "throw", "abort", "halt", "guard"],
    icon: "lucide:OctagonX",
    accent: "#F2555A",
    type: "logic",
    inputs: MAIN_IN,
    outputs: [],
    latencyMs: 300,
    configSchema: [
      {
        key: "errorMessage",
        label: "Error / halt reason",
        type: "expression",
        required: true,
        placeholder: "Guard triggered: invalid account tier",
      },
    ],
    defaultConfig: { errorMessage: "Guard triggered: invalid account tier" },
    sampleOutput: {
      halted: true,
      reason: "Guard triggered: invalid account tier",
    },
    simulate: async (input, config, ctx) => {
      const reason = ctx.resolveExpression(String(config.errorMessage || "Halted"));
      return {
        output: { ...input, halted: true, reason },
        logs: [`Stop and Error guard recorded: "${reason}".`],
        meta: { reason },
      };
    },
  }),

  // 106. No-Op
  defineRegistryNode({
    id: "logic.noOp",
    label: "No-Op",
    description: "Passes incoming items through unchanged — useful as a clean junction point.",
    category: "logic",
    subcategory: "Utility",
    keywords: ["noop", "pass", "passthrough", "junction", "nothing"],
    icon: "lucide:CircleDot",
    accent: "#8B93A7",
    type: "logic",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "note",
        label: "Junction note",
        type: "text",
        placeholder: "Pass-through junction",
      },
    ],
    defaultConfig: { note: "Pass-through junction" },
    sampleOutput: { passthrough: true },
    simulate: async (input) => ({
      output: input,
      logs: ["No-Op passed payload through unchanged."],
    }),
  }),

  // 107. Sticky Note (Non-executable canvas annotation)
  defineRegistryNode({
    id: "logic.stickyNote",
    label: "Sticky Note",
    description: "A canvas annotation card for documenting sections of your workflow. Not executed.",
    category: "logic",
    subcategory: "Annotation",
    keywords: ["sticky", "note", "comment", "annotation", "markdown", "docs"],
    icon: "lucide:StickyNote",
    accent: "#F5B301",
    type: "annotation",
    inputs: [],
    outputs: [],
    latencyMs: 300,
    configSchema: [
      {
        key: "content",
        label: "Note text",
        type: "textarea",
        required: true,
        placeholder: "## Architecture note\nExplain why this branch exists…",
      },
      {
        key: "color",
        label: "Tint",
        type: "select",
        options: [
          { value: "amber", label: "Amber" },
          { value: "ember", label: "Ember" },
          { value: "emerald", label: "Emerald" },
          { value: "stone", label: "Stone" },
        ],
      },
    ],
    defaultConfig: {
      content: "📌 Workflow note: incoming payloads are validated here before fan-out.",
      color: "amber",
    },
    sampleOutput: { annotation: true },
    simulate: async (input) => ({
      output: input,
      logs: [],
    }),
  }),
];
