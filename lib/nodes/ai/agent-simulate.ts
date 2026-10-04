/**
 * Pure AI Agent simulation with full sub-node support.
 *
 * Shared by the declarative `action.aiAgent` registry definition and the engine's
 * core `action.aiAgent` executor, so a wired-up agent behaves identically whether it
 * is reached through the registry bridge or the legacy engine path.
 *
 * Pure TypeScript: no React, no React Flow, no Zustand.
 */

import type { AgentTool } from "@/types/nodes";
import type { AgentTraceStep } from "@/types/run";
import type { JsonObject, JsonValue } from "@/types/json";
import type { TokenUsageSummary } from "@/types/registry";
import { simulateAgentRun } from "@/lib/engine/simulator";

/** Price per 1K tokens (input / output) used for realistic cost simulation. */
export const MODEL_PRICING_PER_1K: Record<string, { inUsd: number; outUsd: number }> = {
  "gpt-4o": { inUsd: 0.0025, outUsd: 0.01 },
  "gpt-4o-mini": { inUsd: 0.00015, outUsd: 0.0006 },
  "claude-3-5-sonnet": { inUsd: 0.003, outUsd: 0.015 },
  "claude-3-5-haiku": { inUsd: 0.0008, outUsd: 0.004 },
  "gemini-2.0-flash": { inUsd: 0.0001, outUsd: 0.0004 },
  "gemini-1.5-pro": { inUsd: 0.00125, outUsd: 0.005 },
  "openrouter/auto": { inUsd: 0.0015, outUsd: 0.006 },
  "llama-3.3-70b-versatile": { inUsd: 0.00059, outUsd: 0.00079 },
  "mixtral-8x7b-32768": { inUsd: 0.00024, outUsd: 0.00024 },
  "llama3.2:latest": { inUsd: 0, outUsd: 0 },
  "deepseek-r1:14b": { inUsd: 0, outUsd: 0 },
  "ff-pro": { inUsd: 0.002, outUsd: 0.008 },
  "ff-mini": { inUsd: 0.0002, outUsd: 0.0008 },
  "ff-reasoning": { inUsd: 0.004, outUsd: 0.016 },
};

export function computeTokenUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
): TokenUsageSummary {
  const pricing = MODEL_PRICING_PER_1K[model] ?? { inUsd: 0.001, outUsd: 0.004 };
  const totalTokens = promptTokens + completionTokens;
  const estimatedCostUsd = Number(
    (
      (promptTokens / 1000) * pricing.inUsd +
      (completionTokens / 1000) * pricing.outUsd
    ).toFixed(6),
  );
  return { model, promptTokens, completionTokens, totalTokens, estimatedCostUsd };
}

/**
 * Keyword heuristics mapping a connected Tool sub-node to the agent's goal.
 * A tool whose pattern matches the goal or payload is preferred first, which is what
 * makes tool selection look deliberate rather than arbitrary.
 */
export const SUB_TOOL_KEYWORDS: Record<string, RegExp> = {
  "aiTool.calculator": /math|calc|budget|amount|price|score|sum|total|percent|number|\d/i,
  "aiTool.webSearch": /search|web|news|trend|research|latest|google|market|competitor/i,
  "aiTool.wikipedia": /wiki|encyclopedia|history|biography|definition|fact/i,
  "aiTool.httpRequest": /http|api|endpoint|url|status|webhook|service/i,
  "aiTool.code": /code|script|javascript|python|compute|transform|regex/i,
  "aiTool.gmail": /email|gmail|inbox|reply|sender|recipient/i,
  "aiTool.googleSheets": /sheet|row|spreadsheet|ledger|table|csv/i,
  "aiTool.postgres": /sql|database|postgres|customer|order|record|query/i,
  "aiTool.whatsapp": /whatsapp|phone|chat|mobile|message/i,
  "aiTool.telegram": /telegram|bot|channel|alert/i,
  "aiTool.calendar": /calendar|meeting|schedule|slot|appointment|book/i,
  "aiTool.callWorkflow": /workflow|pipeline|subworkflow|enrich/i,
  "aiTool.callAgent": /agent|specialist|delegate|researcher|writer|review/i,
};

export type AgentSubNodeRef = {
  nodeId: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
};

export type AgentSimulationInput = {
  goal: string;
  systemPrompt: string;
  /** Inline fallback model from `config.model` (used when no Chat Model is wired). */
  fallbackModel: string;
  maxSteps: number;
  /** Inline fallback tools (used when no Tool sub-nodes are wired). */
  fallbackTools: readonly AgentTool[];
  input: JsonObject;
  model?: AgentSubNodeRef;
  memory?: AgentSubNodeRef;
  tools: readonly AgentSubNodeRef[];
  random: () => number;
};

export type AgentSimulationOutput = {
  payload: JsonObject;
  trace: AgentTraceStep[];
  logs: string[];
  tokenUsage: TokenUsageSummary;
  meta: JsonObject;
  /** True when the run used the wired sub-node path rather than the inline fallback. */
  usedSubNodes: boolean;
};

/** Resolve a connected Chat Model sub-node's model identifier. */
export function modelNameOf(subNode: AgentSubNodeRef): string {
  const configured = subNode.config.modelName;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }
  return subNode.label;
}

function asJson(value: unknown, fallback: JsonValue = null): JsonValue {
  if (value === undefined) return fallback;
  return value as JsonValue;
}

/**
 * Run an AI Agent, honouring connected Model / Memory / Tool sub-nodes.
 *
 * When any bottom-port sub-node is wired the rich path runs: memory recall is
 * logged, tools are ranked by keyword relevance, invoked tools are recorded by
 * node ID (so the canvas can illuminate their edges), and `aiTool.callAgent`
 * produces a nested sub-agent trace.
 */
export function simulateAgent(options: AgentSimulationInput): AgentSimulationOutput {
  const {
    goal,
    systemPrompt,
    fallbackModel,
    maxSteps,
    fallbackTools,
    input,
    model,
    memory,
    tools,
    random,
  } = options;

  const useSubNodes = Boolean(model || memory || tools.length > 0);

  if (!useSubNodes) {
    const run = simulateAgentRun({
      goal,
      systemPrompt,
      tools: [...fallbackTools],
      maxSteps,
      random,
    });
    const tokenUsage = computeTokenUsage(fallbackModel, run.tokensIn, run.tokensOut);
    return {
      payload: {
        ...input,
        text: run.answer,
        agent: {
          model: fallbackModel,
          answer: run.answer,
          stepsUsed: run.steps.length,
          toolsUsed: run.toolsUsed,
          tokensIn: run.tokensIn,
          tokensOut: run.tokensOut,
          estimatedCostUsd: tokenUsage.estimatedCostUsd,
        },
      },
      trace: run.steps.map((step) => ({
        ...step,
        tool: step.tool,
      })),
      logs: [
        `AI Agent (${fallbackModel}) completed ${run.steps.length} step(s) with tools [${
          run.toolsUsed.join(", ") || "none"
        }].`,
      ],
      tokenUsage,
      meta: {
        goal,
        model: fallbackModel,
        stepsUsed: run.steps.length,
        toolsUsed: run.toolsUsed.join(", ") || "none",
      },
      usedSubNodes: false,
    };
  }

  const activeModel = model ? modelNameOf(model) : fallbackModel;
  const steps: AgentTraceStep[] = [];
  const toolsUsedLabels: string[] = [];
  const logs: string[] = [];

  if (model) logs.push(`Connected Chat Model: ${model.label} (${activeModel}).`);
  if (memory) {
    const windowTurns = Number(memory.config.windowSize ?? memory.config.ttlSeconds ?? 6);
    logs.push(
      `Memory recall [${memory.label}]: loaded ${windowTurns} prior turn(s) for this session.`,
    );
  }

  const goalSummary = `${goal} ${JSON.stringify(input)}`;
  const ranked = [...tools].sort((a, b) => {
    const aScore = SUB_TOOL_KEYWORDS[a.type]?.test(goalSummary) ? 1 : 0;
    const bScore = SUB_TOOL_KEYWORDS[b.type]?.test(goalSummary) ? 1 : 0;
    return bScore - aScore;
  });

  const toolBudget = Math.max(0, Math.min(maxSteps - 1, ranked.length));

  for (let index = 0; index < toolBudget; index += 1) {
    const toolNode = ranked[index];
    const stepNumber = index + 1;
    const durationMs = 130 + stepNumber * 35 + Math.floor(random() * 40);
    toolsUsedLabels.push(toolNode.label);

    let toolInput = JSON.stringify({ query: goal.slice(0, 64) });
    let observation = `Executed ${toolNode.label} (${toolNode.type}) -> returned a verified result.`;
    let nestedTrace: AgentTraceStep[] | undefined;

    switch (toolNode.type) {
      case "aiTool.calculator":
        toolInput = 'eval("score = base_weight * 1.35 + priority_bonus")';
        observation = "Computed composite score: 87.5 / 100 (clears the 70.0 action threshold).";
        break;
      case "aiTool.webSearch":
        toolInput = `search("${goal.slice(0, 48)}")`;
        observation =
          "Found 3 live web sources confirming recent market activity and verified domain signals.";
        break;
      case "aiTool.wikipedia":
        toolInput = `wiki("${goal.slice(0, 40)}")`;
        observation = "Retrieved an encyclopedic summary with 4 verifiable citations.";
        break;
      case "aiTool.httpRequest":
        toolInput = `GET ${String(toolNode.config.baseUrl ?? "https://api.example.com/v1")}/context`;
        observation = "200 OK - tier: enterprise, healthScore: 92, owner: ops-primary.";
        break;
      case "aiTool.code":
        toolInput = "run(code => $input.items.filter(i => i.status === 'active').length)";
        observation = "Sandbox returned 2 active records in 12ms.";
        break;
      case "aiTool.gmail":
        toolInput = `gmail.search("${goal.slice(0, 40)}")`;
        observation = "Located 2 matching threads; draft reply prepared and queued.";
        break;
      case "aiTool.googleSheets":
        toolInput = `sheets.lookup("${String(toolNode.config.spreadsheetName ?? "CRM")}", "${goal.slice(0, 24)}")`;
        observation = "Matched 1 existing row and read 6 supporting columns.";
        break;
      case "aiTool.postgres":
        toolInput =
          "SELECT id, status, plan FROM customers WHERE status = 'active' LIMIT 3;";
        observation =
          "Returned 3 matching rows from Postgres (tier: enterprise, status: active, owner: ops).";
        break;
      case "aiTool.whatsapp":
        toolInput = `whatsapp.send("${goal.slice(0, 32)}")`;
        observation = "WhatsApp reply delivered to the originating thread.";
        break;
      case "aiTool.telegram":
        toolInput = `telegram.send("@flowforge_alerts", "${goal.slice(0, 32)}")`;
        observation = "Telegram alert posted to the operations channel.";
        break;
      case "aiTool.calendar":
        toolInput = `calendar.findSlot("${goal.slice(0, 32)}", durationMinutes=30)`;
        observation = "Found the next free 30-minute slot tomorrow at 10:00 WAT.";
        break;
      case "aiTool.callWorkflow":
        toolInput = `invoke("${String(toolNode.config.workflowName ?? "Sub-Workflow")}")`;
        observation = "Sub-workflow completed and returned an enriched payload.";
        break;
      case "aiTool.callAgent": {
        const specialist = String(
          toolNode.config.agentName ?? toolNode.label ?? "Specialist Sub-Agent",
        );
        toolInput = `delegateTo("${specialist}", "${goal.slice(0, 48)}")`;
        nestedTrace = [
          {
            step: 1,
            thought: `[${specialist}] Reading the delegated objective and loading specialist constraints.`,
            tool: "kbLookup",
            toolInput: `lookup("${specialist.toLowerCase()}:playbook")`,
            observation: `[${specialist}] Retrieved the specialist playbook and 3 domain facts.`,
            durationMs: 110,
          },
          {
            step: 2,
            thought: `[${specialist}] Synthesizing a specialist brief to hand back to the coordinator.`,
            tool: null,
            toolInput: null,
            observation: `[${specialist}] Completed the brief with 96% confidence.`,
            durationMs: 95,
          },
        ];
        observation = `Sub-agent "${specialist}" completed 2 nested steps and returned a specialist brief.`;
        break;
      }
      default:
        break;
    }

    steps.push({
      step: stepNumber,
      thought: `Invoking connected tool "${toolNode.label}" to gather evidence for: ${goal.slice(0, 72)}`,
      tool: "kbLookup",
      toolLabel: toolNode.label,
      subNodeId: toolNode.nodeId,
      toolInput,
      observation,
      durationMs,
      ...(nestedTrace ? { nestedTrace } : {}),
    });

    logs.push(`Step ${stepNumber}: used tool "${toolNode.label}" -> ${observation}`);
  }

  const finalStepNumber = steps.length + 1;
  steps.push({
    step: finalStepNumber,
    thought:
      toolsUsedLabels.length > 0
        ? `Synthesizing observations from ${toolsUsedLabels.join(", ")}${
            memory ? ` with ${memory.label}` : ""
          } using ${activeModel}.`
        : `Synthesizing a direct response with ${activeModel}; no tools were required.`,
    tool: null,
    toolInput: null,
    observation: memory ? `Saved the assistant turn to ${memory.label}.` : null,
    durationMs: 120,
  });

  const answer = `Completed the agent objective via ${activeModel}${
    toolsUsedLabels.length > 0 ? ` using [${toolsUsedLabels.join(", ")}]` : ""
  }. [Goal: ${goal.slice(0, 72)}]`;

  const tokensIn = Math.max(
    24,
    Math.ceil((goal.length + systemPrompt.length + steps.length * 90) / 4),
  );
  const tokensOut = Math.max(18, Math.ceil((answer.length + steps.length * 45) / 4));
  const tokenUsage = computeTokenUsage(activeModel, tokensIn, tokensOut);

  return {
    payload: {
      ...input,
      text: answer,
      agent: {
        model: activeModel,
        memory: memory ? memory.label : null,
        answer,
        stepsUsed: steps.length,
        toolsUsed: toolsUsedLabels,
        tokensIn,
        tokensOut,
        estimatedCostUsd: tokenUsage.estimatedCostUsd,
      },
    },
    trace: steps,
    logs: [
      ...logs,
      `Agent finished in ${steps.length} step(s) (${tokenUsage.totalTokens} tokens · $${tokenUsage.estimatedCostUsd.toFixed(5)}).`,
    ],
    tokenUsage,
    meta: {
      goal,
      model: activeModel,
      stepsUsed: steps.length,
      toolsUsed: toolsUsedLabels.join(", ") || "none",
      memory: asJson(memory?.label ?? null),
    },
    usedSubNodes: true,
  };
}
