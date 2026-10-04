/**
 * Action node definitions — one input, one or more outputs.
 */

import { parseJsonObject } from "@/types/json";
import type { ConfigIssue } from "@/types/validation";
import type { JsonValue } from "@/types/json";
import type { ConditionOperator } from "@/types/nodes";
import { defineNode } from "../registry";
import { renderTemplate, resolveOperand, stringifyValue } from "../variables";
import { simulateAgentRun, simulateAiReply, simulateHttpResponse } from "../simulator";

function filled(value: string): boolean {
  return value.trim().length > 0;
}

function missing(field: string, label: string): ConfigIssue {
  return {
    code: "missing-required-config",
    level: "error",
    message: `${label} is required.`,
    field,
  };
}

/** Catches "{{name" typos, which otherwise fail silently at run time. */
export function checkUnbalancedTokens(field: string, template: string): ConfigIssue[] {
  const open = (template.match(/\{\{/g) ?? []).length;
  const close = (template.match(/\}\}/g) ?? []).length;
  if (open !== close) {
    return [
      {
        code: "invalid-config",
        level: "error",
        message: `Unbalanced {{ }} — found ${open} "{{" and ${close} "}}".`,
        field,
      },
    ];
  }
  return [];
}

export const aiPrompt = defineNode<"action.aiPrompt">({
  type: "action.aiPrompt",
  category: "action",
  title: "AI Prompt",
  description: "Sends a templated prompt to a simulated model and returns canned text.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    systemPrompt: "You are a concise, friendly assistant.",
    promptTemplate: "Write a short reply to {{user.name}} about their {{source}} signup.",
    model: "ff-pro",
    temperature: 0.7,
  },
  latencyMs: 1100,
  requiredFields: ["promptTemplate"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!filled(config.promptTemplate)) {
      issues.push(missing("config.promptTemplate", "Prompt template"));
    }
    if (config.temperature < 0 || config.temperature > 1) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Temperature must be between 0 and 1.",
        field: "config.temperature",
      });
    }
    return [...issues, ...checkUnbalancedTokens("config.promptTemplate", config.promptTemplate)];
  },
  execute: async (input, config, ctx) => {
    const prompt = renderTemplate(config.promptTemplate, ctx.scope);
    const reply = simulateAiReply({
      prompt: prompt.text,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      random: ctx.random,
    });

    return {
      payload: {
        ...input,
        text: reply.text,
        ai: {
          model: config.model,
          tokensIn: reply.tokensIn,
          tokensOut: reply.tokensOut,
          ...(reply.classification ? { classification: reply.classification } : {}),
        },
      },
      meta: {
        prompt: prompt.text,
        unresolvedVariables: prompt.unresolved.join(", "),
      },
    };
  },
});

export const aiAgent = defineNode<"action.aiAgent">({
  type: "action.aiAgent",
  category: "action",
  title: "AI Agent",
  description:
    "Reasons in multi-step thought, tool, and observation loops and records a full trace.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    systemPrompt:
      "You are an autonomous operations agent. Verify facts with tools before answering.",
    goal: "Investigate {{user.name}}'s request from {{source}} and recommend the next action.",
    model: "ff-pro",
    tools: ["kbLookup", "calculator"],
    maxSteps: 3,
  },
  latencyMs: 1150,
  requiredFields: ["goal"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!filled(config.goal)) {
      issues.push(missing("config.goal", "Agent goal"));
    }
    if (!Number.isInteger(config.maxSteps) || config.maxSteps < 1 || config.maxSteps > 6) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Max steps must be a whole number between 1 and 6.",
        field: "config.maxSteps",
      });
    }
    return [
      ...issues,
      ...checkUnbalancedTokens("config.goal", config.goal),
      ...checkUnbalancedTokens("config.systemPrompt", config.systemPrompt),
    ];
  },
  execute: async (input, config, ctx) => {
    // If Phase 4 bottom sub-nodes (Chat Model, Memory, or Tools) are connected,
    // delegate to the declarative AI Agent simulator so sub-nodes, edge pulsing,
    // keyword tool selection, and nested multi-agent delegation run.
    if (
      ctx.subNodes &&
      (ctx.subNodes.model ||
        ctx.subNodes.memory ||
        ctx.subNodes.tools.length > 0)
    ) {
      const { aiAgentNode } = await import("@/lib/nodes/ai");
      const { createSeededFaker } = await import("@/lib/nodes/faker-seed");
      const simResult = await aiAgentNode.simulate(
        input,
        config as unknown as Record<string, unknown>,
        {
          nodeId: ctx.nodeId,
          nodeLabel: ctx.nodeLabel ?? "AI Agent",
          items: ctx.items ?? [{ json: input }],
          itemIndex: 0,
          scope: ctx.scope,
          subNodes: ctx.subNodes,
          faker: createSeededFaker(ctx.random),
          random: ctx.random,
          now: ctx.now,
          sleep: ctx.sleep,
          speed: ctx.speed,
          resolveExpression: (expr: string) => renderTemplate(expr, ctx.scope).text,
        },
      );
      const outputPayload = Array.isArray(simResult.output)
        ? (simResult.output[0]?.json ?? {})
        : simResult.output;
      return {
        payload: outputPayload,
        trace: simResult.agentTrace,
        logs: simResult.logs,
        tokenUsage: simResult.tokenUsage,
        meta: simResult.meta,
      };
    }

    const renderedGoal = renderTemplate(config.goal, ctx.scope);
    const renderedSystem = renderTemplate(config.systemPrompt, ctx.scope);
    const run = simulateAgentRun({
      goal: renderedGoal.text,
      systemPrompt: renderedSystem.text,
      tools: config.tools,
      maxSteps: config.maxSteps,
      random: ctx.random,
    });

    const unresolved = [
      ...renderedGoal.unresolved,
      ...renderedSystem.unresolved,
    ];

    return {
      payload: {
        ...input,
        text: run.answer,
        agent: {
          model: config.model,
          answer: run.answer,
          stepsUsed: run.steps.length,
          toolsUsed: run.toolsUsed,
          tokensIn: run.tokensIn,
          tokensOut: run.tokensOut,
          trace: run.steps,
        },
      },
      trace: run.steps,
      meta: {
        goal: renderedGoal.text,
        stepsUsed: run.steps.length,
        toolsUsed: run.toolsUsed.join(", ") || "none",
        unresolvedVariables: unresolved.join(", "),
      },
    };
  },
});

const URL_PATTERN = /^https?:\/\/\S+$/;

export const httpRequest = defineNode<"action.httpRequest">({
  type: "action.httpRequest",
  category: "action",
  title: "HTTP Request",
  description: "Makes a request and returns the response body. Simulated with mock JSON.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    method: "GET",
    url: "https://api.example.com/v1/invoices?status=overdue",
    headers: [{ id: "hdr-accept", key: "Accept", value: "application/json" }],
    bodyJson: "",
  },
  latencyMs: 900,
  requiredFields: ["url"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const url = config.url.trim();

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

    if (config.bodyJson.trim().length > 0 && config.method !== "GET") {
      const parsed = parseJsonObject(config.bodyJson);
      if (!parsed.ok) {
        issues.push({
          code: "invalid-json",
          level: "error",
          message: `Request body: ${parsed.error}`,
          field: "config.bodyJson",
        });
      }
    }

    const blankHeader = config.headers.some(
      (header) => filled(header.value) && !filled(header.key),
    );
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
  execute: async (input, config, ctx) => {
    const url = renderTemplate(config.url, ctx.scope).text;
    const { status, body } = simulateHttpResponse({
      method: config.method,
      url,
      random: ctx.random,
    });

    return {
      payload: { ...body, status },
      meta: { method: config.method, url, status, simulated: true },
    };
  },
});

export const transform = defineNode<"action.transform">({
  type: "action.transform",
  category: "action",
  title: "Transform",
  description: "Maps or renames fields into a new payload using key-value pairs.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    mode: "map",
    fields: [
      { id: "tf-name", key: "customer", value: "{{user.name}}" },
      { id: "tf-plan", key: "plan", value: "{{user.plan}}" },
    ],
  },
  latencyMs: 420,
  requiredFields: [],
  validateConfig: (config) => {
    if (config.fields.length === 0) {
      return [
        {
          code: "missing-required-config",
          level: "error",
          message: "Add at least one field mapping.",
          field: "config.fields",
        },
      ];
    }
    if (config.fields.some((field) => !filled(field.key))) {
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
  execute: async (input, config, ctx) => {
    const mapped: Record<string, JsonValue> = {};
    for (const field of config.fields) {
      const key = field.key.trim();
      if (key.length === 0) continue;
      // Values render to strings; that keeps the mapping predictable and avoids
      // surprising "1" vs 1 coercion. Cast explicitly downstream if you need a number.
      mapped[key] = renderTemplate(field.value, ctx.scope).text;
    }

    return {
      payload: config.mode === "merge" ? { ...input, ...mapped } : mapped,
      meta: { mode: config.mode, fields: Object.keys(mapped).length },
    };
  },
});

export const condition = defineNode<"action.condition">({
  type: "action.condition",
  category: "action",
  title: "Filter / Condition",
  description: "Routes the flow down a true or false branch based on a comparison.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [
    { id: "true", label: "True" },
    { id: "false", label: "False" },
  ],
  defaultConfig: {
    left: "{{budget}}",
    operator: "gt",
    right: "500",
    caseSensitive: false,
  },
  latencyMs: 360,
  requiredFields: ["left", "right"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!filled(config.left)) issues.push(missing("config.left", "Left operand"));
    if (!filled(config.right)) issues.push(missing("config.right", "Right operand"));

    const numericOnly = config.operator === "gt" || config.operator === "lt";
    if (numericOnly) {
      for (const [field, raw] of [
        ["config.left", config.left],
        ["config.right", config.right],
      ] as const) {
        // A {{token}} may resolve to a number at run time, so only literals are checked.
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
  execute: async (input, config, ctx) => {
    const left = resolveOperand(config.left, ctx.scope);
    const right = resolveOperand(config.right, ctx.scope);
    const matched = evaluateCondition(left, config.operator, right, config.caseSensitive);

    return {
      payload: input,
      outputHandle: matched ? "true" : "false",
      meta: {
        left: stringifyValue(left),
        operator: config.operator,
        right: stringifyValue(right),
        matched,
      },
    };
  },
});

/**
 * Compare two resolved operands.
 *
 * Numeric operators coerce both sides with Number(); textual ones compare strings.
 * A NaN on either side of a numeric comparison yields false rather than throwing,
 * so one bad field cannot abort a whole run.
 */
export function evaluateCondition(
  left: JsonValue,
  operator: ConditionOperator,
  right: JsonValue,
  caseSensitive: boolean,
): boolean {
  const normalise = (value: JsonValue): string => {
    const text = stringifyValue(value);
    return caseSensitive ? text : text.toLowerCase();
  };

  switch (operator) {
    case "equals":
      return normalise(left) === normalise(right);
    case "notEquals":
      return normalise(left) !== normalise(right);
    case "contains":
      return normalise(left).includes(normalise(right));
    case "gt": {
      const a = Number(stringifyValue(left));
      const b = Number(stringifyValue(right));
      return Number.isNaN(a) || Number.isNaN(b) ? false : a > b;
    }
    case "lt": {
      const a = Number(stringifyValue(left));
      const b = Number(stringifyValue(right));
      return Number.isNaN(a) || Number.isNaN(b) ? false : a < b;
    }
  }
}

export const delay = defineNode<"action.delay">({
  type: "action.delay",
  category: "action",
  title: "Delay",
  description: "Waits a number of seconds before passing data on. Shortened in simulation.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: { seconds: 2 },
  latencyMs: 320,
  requiredFields: [],
  validateConfig: (config) => {
    if (!Number.isFinite(config.seconds) || config.seconds <= 0) {
      return [
        {
          code: "invalid-config",
          level: "error",
          message: "Delay must be a positive number of seconds.",
          field: "config.seconds",
        },
      ];
    }
    if (config.seconds > 60) {
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
  execute: async (input, config, ctx) => {
    // Capped so a mistyped 9999 does not hang the demo; divided by speed so 2x is
    // genuinely twice as fast.
    const seconds = Math.min(Math.max(config.seconds, 0), 60);
    const ms = (seconds * 1000) / ctx.speed;
    await ctx.sleep(ms);
    return { payload: input, meta: { waitedMs: Math.round(ms) } };
  },
});

export const textFormatter = defineNode<"action.textFormatter">({
  type: "action.textFormatter",
  category: "action",
  title: "Text Formatter",
  description: "Renders a template string with {{variables}} from the incoming data.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    template:
      "Lead: {{user.name}} ({{user.plan}} plan) — {{budget}} budget from {{source}}.",
  },
  latencyMs: 380,
  requiredFields: ["template"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!filled(config.template)) issues.push(missing("config.template", "Template"));
    return [...issues, ...checkUnbalancedTokens("config.template", config.template)];
  },
  execute: async (input, config, ctx) => {
    const rendered = renderTemplate(config.template, ctx.scope);
    return {
      payload: { ...input, text: rendered.text },
      meta: {
        template: config.template,
        unresolvedVariables: rendered.unresolved.join(", "),
      },
    };
  },
});
