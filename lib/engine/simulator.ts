/**
 * Deterministic stand-ins for the third-party services.
 *
 * No network calls happen anywhere in this project. Every "integration" returns
 * canned data built from the inputs it was given, so a flow produces the same
 * result every run given the same RNG — which is what makes the engine testable
 * and the demo reproducible.
 */

import type { JsonValue, NodePayload } from "@/types/json";
import type { AgentTool, HttpMethod } from "@/types/nodes";
import type { AgentTraceStep } from "@/types/run";

const AI_REPLIES = [
  "Thanks for reaching out — I've read through your note and I think we can help. Could we book 20 minutes this week to walk through your current setup?",
  "Appreciate the detail here. Based on what you've described, the quickest win would be automating the first step and reviewing the output for a week before going further.",
  "Good news: this is a problem we see often and it has a straightforward fix. I'll send over a short outline of the approach and a couple of examples.",
  "Thanks for the context. I'd suggest starting small — one workflow, one metric — and expanding once the numbers look right. Happy to sketch that out.",
] as const;

const AI_CLASSIFICATIONS = ["billing", "technical", "sales", "account"] as const;

/**
 * Pick a canned AI reply.
 *
 * `random` is injected, and temperature biases how far from the first entry we
 * reach, so the knob visibly changes output without making tests unpredictable.
 */
export function simulateAiReply(options: {
  prompt: string;
  temperature: number;
  random: () => number;
  systemPrompt: string;
}): { text: string; tokensIn: number; tokensOut: number; classification?: string } {
  const { prompt, temperature, random, systemPrompt } = options;

  const classifying = /classif|categoris|categoriz|label|triage|route/i.test(
    `${systemPrompt} ${prompt}`,
  );

  if (classifying) {
    const classification = AI_CLASSIFICATIONS[Math.floor(random() * AI_CLASSIFICATIONS.length)];
    return {
      text: classification,
      tokensIn: Math.ceil(prompt.length / 4),
      tokensOut: 1,
      classification,
    };
  }

  // Higher temperature reaches further into the list.
  const reach = Math.max(1, Math.round(AI_REPLIES.length * Math.min(1, temperature + 0.25)));
  const index = Math.floor(random() * reach) % AI_REPLIES.length;
  const text = AI_REPLIES[index];

  return {
    text,
    tokensIn: Math.ceil(prompt.length / 4),
    tokensOut: Math.ceil(text.length / 4),
  };
}

const AGENT_CONCLUSIONS = [
  "Verified context across connected tools. Recommended action: proceed with priority handling, attach the enriched summary, and notify the owning channel.",
  "Completed multi-step verification. Thresholds and policy checks passed — routing the synthesized action plan downstream.",
  "Cross-checked historical records and live signals. Flagged key metrics in the summary and prepared the next-step payload.",
] as const;

function summarizeGoal(goal: string): string {
  const flat = goal.replace(/\s+/g, " ").trim();
  return flat.length > 56 ? `${flat.slice(0, 55)}…` : flat || "incoming payload";
}

function buildToolStep(
  tool: AgentTool,
  stepNumber: number,
  goalSummary: string,
  random: () => number,
): AgentTraceStep {
  const durationMs = 110 + stepNumber * 35 + Math.floor(random() * 45);

  switch (tool) {
    case "kbLookup":
      return {
        step: stepNumber,
        thought: "Searching the internal knowledge base for policies and prior runbooks matching the goal.",
        tool: "kbLookup",
        toolInput: `kb.search("${goalSummary}")`,
        observation:
          "Matched 2 runbooks: standard SLA is 4h response; priority escalation applies above the configured threshold.",
        durationMs,
      };
    case "webSearch":
      return {
        step: stepNumber,
        thought: "Querying public company and domain signals to enrich the incoming entity.",
        tool: "webSearch",
        toolInput: `search("${goalSummary}")`,
        observation:
          "Found 3 recent signals: active B2B engineering org, cloud-native stack, expanding automation workflows.",
        durationMs,
      };
    case "calculator":
      return {
        step: stepNumber,
        thought: "Evaluating quantitative thresholds and composite score weights from the payload.",
        tool: "calculator",
        toolInput: `eval("score = base_weight * 1.35 + priority_bonus")`,
        observation: "Computed composite score: 87.5 / 100 (clears the 70.0 action threshold).",
        durationMs,
      };
    case "httpFetch":
      return {
        step: stepNumber,
        thought: "Fetching live account and service metadata from the simulated enrichment endpoint.",
        tool: "httpFetch",
        toolInput: `GET https://api.example.com/v1/context?q=${encodeURIComponent(goalSummary.slice(0, 24))}`,
        observation: "200 OK — tier: enterprise, healthScore: 92, owner: ops-primary.",
        durationMs,
      };
  }
}

/**
 * Simulate a multi-step AI Agent reasoning loop.
 *
 * Produces up to `maxSteps` trace entries: tool-invocation steps followed by a
 * final synthesis step (`tool: null`). Everything is deterministic given `random`.
 */
export function simulateAgentRun(options: {
  goal: string;
  systemPrompt: string;
  tools: readonly AgentTool[];
  maxSteps: number;
  random: () => number;
}): {
  answer: string;
  steps: AgentTraceStep[];
  toolsUsed: AgentTool[];
  tokensIn: number;
  tokensOut: number;
} {
  const { goal, systemPrompt, tools, random } = options;
  const maxSteps = Math.max(1, Math.min(6, Math.floor(options.maxSteps)));
  const goalSummary = summarizeGoal(goal);

  const steps: AgentTraceStep[] = [];
  const toolsUsed: AgentTool[] = [];

  const toolBudget = Math.min(maxSteps - 1, tools.length);
  for (let idx = 0; idx < toolBudget; idx += 1) {
    const tool = tools[idx];
    toolsUsed.push(tool);
    steps.push(buildToolStep(tool, idx + 1, goalSummary, random));
  }

  const finalStepNumber = steps.length + 1;
  const finalDurationMs = 95 + finalStepNumber * 30 + Math.floor(random() * 35);
  steps.push({
    step: finalStepNumber,
    thought:
      toolsUsed.length > 0
        ? `Synthesizing observations from ${toolsUsed.length} tool call${toolsUsed.length === 1 ? "" : "s"} (${toolsUsed.join(", ")}) into the final recommendation.`
        : "Synthesizing a direct response from the input payload with no external tool calls.",
    tool: null,
    toolInput: null,
    observation: null,
    durationMs: finalDurationMs,
  });

  const pickIndex = Math.floor(random() * AGENT_CONCLUSIONS.length) % AGENT_CONCLUSIONS.length;
  const conclusion = AGENT_CONCLUSIONS[pickIndex];
  const answer = `${conclusion} [Goal: ${goalSummary}]`;

  const promptChars = goal.length + systemPrompt.length;
  const traceChars = steps.reduce(
    (sum, entry) =>
      sum +
      entry.thought.length +
      (entry.toolInput?.length ?? 0) +
      (entry.observation?.length ?? 0),
    0,
  );

  return {
    answer,
    steps,
    toolsUsed,
    tokensIn: Math.max(1, Math.ceil((promptChars + traceChars * 0.5) / 4)),
    tokensOut: Math.max(1, Math.ceil((answer.length + traceChars * 0.5) / 4)),
  };
}

const HTTP_STATUSES: Record<HttpMethod, number> = {
  GET: 200,
  POST: 201,
  PUT: 200,
  PATCH: 200,
  DELETE: 204,
};

/**
 * Mock HTTP response.
 *
 * Shaped like a real paginated API so downstream Transform and Filter nodes have
 * something realistic to work with, and the URL influences the payload so
 * different requests do not return identical data.
 */
export function simulateHttpResponse(options: {
  method: HttpMethod;
  url: string;
  random: () => number;
}): { status: number; body: NodePayload } {
  const { method, url, random } = options;
  const status = HTTP_STATUSES[method];

  if (method === "DELETE") {
    return { status, body: { deleted: true, url } };
  }

  const overdue = /invoice|overdue|payment/i.test(url);

  if (overdue) {
    return {
      status,
      body: {
        data: [
          { id: "inv-1042", customer: "Hopper Ltd", amount: 2400, daysOverdue: 18 },
          { id: "inv-1043", customer: "Turing Co", amount: 890, daysOverdue: 4 },
          { id: "inv-1051", customer: "Lovelace Lab", amount: 5120, daysOverdue: 41 },
        ],
        page: 1,
        total: 3,
      },
    };
  }

  const id = Math.floor(random() * 9000) + 1000;
  return {
    status,
    body: {
      data: { id, ok: true, requestedUrl: url },
      meta: { latencyMs: 120 + Math.floor(random() * 200) },
    },
  };
}

/** Echo of what an email node "sent". */
export function simulateEmailSent(options: {
  to: string;
  subject: string;
  body: string;
}): NodePayload {
  return {
    delivered: true,
    transport: "simulated",
    to: options.to,
    subject: options.subject,
    body: options.body,
    messageId: `sim-${hashString(`${options.to}${options.subject}`)}`,
  };
}

export function simulateSlackPosted(options: {
  channel: string;
  message: string;
}): NodePayload {
  return {
    posted: true,
    transport: "simulated",
    channel: options.channel,
    text: options.message,
    ts: `${Math.floor(Date.now() / 1000)}.000100`,
  };
}

export function simulateSheetRowAppended(options: {
  spreadsheet: string;
  row: Record<string, JsonValue>;
  rowIndex: number;
}): NodePayload {
  return {
    appended: true,
    transport: "simulated",
    spreadsheet: options.spreadsheet,
    rowIndex: options.rowIndex,
    row: options.row,
  };
}

/** Small stable string hash — used for fake ids so they are reproducible. */
export function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
