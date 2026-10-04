/**
 * Batch F — AI Chains, Agents, Chat Models, Memory & Tools (37 nodes).
 *
 * Includes:
 * - `action.aiAgent` (AI Agent with bottom ports for `ai_model`, `ai_memory`,
 *   `ai_tool`, keyword-driven tool selection, multi-agent nested delegation trace,
 *   and token/cost accounting, while staying 100% compatible with v1 inline config)
 * - `action.aiPrompt` (v1 Basic LLM Chain / AI Prompt)
 * - 13 specialized AI Chains, RAG & Multimodal nodes (`ai.*`)
 * - 6 Chat Model sub-nodes (`aiModel.*`)
 * - 3 Memory sub-nodes (`aiMemory.*`)
 * - 13 Agent Tool sub-nodes (`aiTool.*`)
 */

import type { AgentTool } from "@/types/nodes";
import type { JsonObject } from "@/types/json";
import type { RegistryNodeDef, SimulateContext } from "@/types/registry";
import type { ConfigIssue } from "@/types/validation";
import { simulateAiReply } from "@/lib/engine/simulator";
import {
  AGENT_INPUTS,
  MAIN_IN,
  MAIN_OUT,
  SUB_MEMORY_OUT,
  SUB_MODEL_OUT,
  SUB_TOOL_OUT,
  checkUnbalancedExpressions,
  defineRegistryNode,
} from "../helpers";
import {
  computeTokenUsage,
  simulateAgent,
  type AgentSubNodeRef,
  type AgentSimulationInput,
} from "./agent-simulate";

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

function toAgentSubNodeRef(sub: {
  nodeId: string;
  typeId: string;
  label: string;
  config: JsonObject;
}): AgentSubNodeRef {
  return {
    nodeId: sub.nodeId,
    type: sub.typeId,
    label: sub.label,
    config: sub.config as Record<string, unknown>,
  };
}

/** Normalise loosely-typed config into the pure simulator's input shape. */
function readInput(
  input: JsonObject,
  config: JsonObject,
  ctx: SimulateContext,
  goalTemplate: string,
  systemTemplate: string,
): AgentSimulationInput {
  const subs = ctx.subNodes ?? { tools: [] };
  const rawTools = Array.isArray(config.tools) ? (config.tools as AgentTool[]) : [];
  const fallbackTools = rawTools.length > 0 ? rawTools : (["kbLookup", "calculator"] as AgentTool[]);

  return {
    goal: ctx.resolveExpression(goalTemplate),
    systemPrompt: ctx.resolveExpression(systemTemplate),
    fallbackModel: typeof config.model === "string" ? config.model : "ff-pro",
    maxSteps: Math.max(1, Math.min(6, Math.floor(Number(config.maxSteps ?? 3)))),
    fallbackTools,
    input,
    model: subs.model ? toAgentSubNodeRef(subs.model) : undefined,
    memory: subs.memory ? toAgentSubNodeRef(subs.memory) : undefined,
    tools: subs.tools.map(toAgentSubNodeRef),
    random: ctx.random,
  };
}


export const aiPromptNode = defineRegistryNode({
  id: "action.aiPrompt",
  label: "AI Prompt",
  description: "Sends a templated prompt to a simulated model and returns canned text.",
  category: "ai",
  subcategory: "Chains",
  keywords: ["ai", "prompt", "llm", "chain", "gpt", "claude", "generate", "completion"],
  icon: "lucide:Sparkles",
  accent: "#FF9F43",
  type: "action",
  inputs: MAIN_IN,
  outputs: MAIN_OUT,
  latencyMs: 1100,
  configSchema: [
    {
      key: "model",
      label: "Model",
      type: "select",
      options: [
        { value: "ff-mini", label: "FlowForge Mini · fast" },
        { value: "ff-pro", label: "FlowForge Pro · balanced" },
        { value: "ff-reasoning", label: "FlowForge Reasoning · thorough" },
      ],
    },
    {
      key: "temperature",
      label: "Temperature",
      type: "slider",
      min: 0,
      max: 1,
      step: 0.1,
      hint: "0 deterministic · 1 creative",
    },
    {
      key: "systemPrompt",
      label: "System prompt",
      type: "textarea",
      placeholder: "You are a helpful assistant.",
    },
    {
      key: "promptTemplate",
      label: "Prompt template",
      type: "textarea",
      required: true,
      hint: "supports {{variables}}",
      placeholder: "Summarise {{user.name}}'s request…",
    },
  ],
  defaultConfig: {
    systemPrompt: "You are a concise, friendly assistant.",
    promptTemplate: "Write a short reply to {{user.name}} about their {{source}} signup.",
    model: "ff-pro",
    temperature: 0.7,
  },
  sampleOutput: {
    text: "Hi Ada! Thanks for signing up via landing-page — your Pro workspace is ready.",
    ai: {
      model: "ff-pro",
      tokensIn: 28,
      tokensOut: 34,
    },
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const promptTemplate = String(config.promptTemplate ?? "");
    const temperature = Number(config.temperature ?? 0.7);
    if (!filled(promptTemplate)) {
      issues.push(missing("config.promptTemplate", "Prompt template"));
    }
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 1) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Temperature must be between 0 and 1.",
        field: "config.temperature",
      });
    }
    return [...issues, ...checkUnbalancedExpressions("promptTemplate", promptTemplate)];
  },
  simulate: async (input, config, ctx) => {
    const promptTemplate = String(config.promptTemplate ?? "");
    const systemPrompt = String(config.systemPrompt ?? "");
    const model = String(config.model ?? "ff-pro");
    const temperature = Number(config.temperature ?? 0.7);
    const renderedPrompt = ctx.resolveExpression(promptTemplate);
    const reply = simulateAiReply({
      prompt: renderedPrompt,
      systemPrompt,
      temperature,
      random: ctx.random,
    });
    const tokenUsage = computeTokenUsage(model, reply.tokensIn, reply.tokensOut);
    return {
      output: {
        ...input,
        text: reply.text,
        ai: {
          model,
          tokensIn: reply.tokensIn,
          tokensOut: reply.tokensOut,
          estimatedCostUsd: tokenUsage.estimatedCostUsd,
          ...(reply.classification ? { classification: reply.classification } : {}),
        },
      },
      tokenUsage,
      logs: [
        `AI Prompt (${model}) generated ${reply.tokensOut} tokens ($${tokenUsage.estimatedCostUsd.toFixed(5)}).`,
      ],
      meta: {
        prompt: renderedPrompt,
        model,
        tokensIn: reply.tokensIn,
        tokensOut: reply.tokensOut,
      },
    };
  },
});

export const aiAgentNode = defineRegistryNode({
  id: "action.aiAgent",
  label: "AI Agent",
  description:
    "Reasons in multi-step thought, tool, and observation loops and records a full trace.",
  category: "ai",
  subcategory: "Agents",
  keywords: [
    "ai",
    "agent",
    "autonomous",
    "tools",
    "reasoning",
    "react",
    "memory",
    "multi-agent",
    "sub-nodes",
  ],
  icon: "lucide:Bot",
  accent: "#FF9F43",
  type: "ai-agent",
  inputs: AGENT_INPUTS,
  outputs: MAIN_OUT,
  latencyMs: 1150,
  configSchema: [
    {
      key: "model",
      label: "Fallback model (overridden by connected Chat Model sub-node)",
      type: "select",
      options: [
        { value: "ff-mini", label: "FlowForge Mini · fast" },
        { value: "ff-pro", label: "FlowForge Pro · balanced" },
        { value: "ff-reasoning", label: "FlowForge Reasoning · thorough" },
      ],
    },
    {
      key: "maxSteps",
      label: "Max reasoning steps",
      type: "slider",
      min: 1,
      max: 6,
      step: 1,
      hint: "1–6 steps",
    },
    {
      key: "tools",
      label: "Built-in fallback tools (or wire Tool sub-nodes below)",
      type: "multiselect",
      options: [
        { value: "webSearch", label: "Web Search" },
        { value: "kbLookup", label: "KB Lookup" },
        { value: "calculator", label: "Calculator" },
        { value: "httpFetch", label: "HTTP Fetch" },
      ],
    },
    {
      key: "systemPrompt",
      label: "System prompt",
      type: "textarea",
      placeholder: "You are an autonomous operations agent…",
    },
    {
      key: "goal",
      label: "Agent goal",
      type: "textarea",
      required: true,
      hint: "supports {{variables}}",
      placeholder: "Investigate {{user.name}}'s request and recommend the next action.",
    },
  ],
  defaultConfig: {
    systemPrompt:
      "You are an autonomous operations agent. Verify facts with tools before answering.",
    goal: "Investigate {{user.name}}'s request from {{source}} and recommend the next action.",
    model: "ff-pro",
    tools: ["kbLookup", "calculator"],
    maxSteps: 3,
  },
  sampleOutput: {
    text: "Verified account context and policy match; routed with priority status.",
    agent: {
      model: "gpt-4o",
      answer: "Verified account context and policy match; routed with priority status.",
      stepsUsed: 3,
      toolsUsed: ["kbLookup", "calculator"],
      tokensIn: 142,
      tokensOut: 68,
    },
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const goal = String(config.goal ?? "");
    const systemPrompt = String(config.systemPrompt ?? "");
    const maxSteps = Number(config.maxSteps ?? 3);

    if (!filled(goal)) {
      issues.push(missing("config.goal", "Agent goal"));
    }
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 6) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Max steps must be a whole number between 1 and 6.",
        field: "config.maxSteps",
      });
    }
    return [
      ...issues,
      ...checkUnbalancedExpressions("goal", goal),
      ...checkUnbalancedExpressions("systemPrompt", systemPrompt),
    ];
  },
  simulate: async (input, config, ctx) => {
    const goalTemplate = String(config.goal ?? "");
    const systemTemplate = String(config.systemPrompt ?? "");

    const run = simulateAgent(
      readInput(input, config as JsonObject, ctx, goalTemplate, systemTemplate),
    );

    return {
      output: run.payload,
      agentTrace: run.trace,
      trace: run.trace,
      tokenUsage: run.tokenUsage,
      logs: run.logs,
      meta: run.meta,
    };
  },
});

export const AI_NODES: readonly RegistryNodeDef[] = [
  // 108. AI Agent
  aiAgentNode,

  // 109. Basic LLM Chain / AI Prompt
  aiPromptNode,

  // 110. Text Classifier
  defineRegistryNode({
    id: "ai.textClassifier",
    label: "Text Classifier",
    description: "Classifies incoming text into one of your configured labels with confidence scores.",
    category: "ai",
    subcategory: "Chains",
    keywords: ["ai", "classify", "classifier", "category", "intent", "triage", "label"],
    icon: "lucide:Tags",
    accent: "#FF9F43",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 680,
    configSchema: [
      {
        key: "inputText",
        label: "Text to classify",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
      {
        key: "labels",
        label: "Candidate labels (comma-separated)",
        type: "text",
        required: true,
        placeholder: "billing, technical, sales, general",
      },
    ],
    defaultConfig: {
      inputText: "{{text}}",
      labels: "billing, technical, sales, general",
    },
    sampleOutput: {
      category: "billing",
      confidence: 0.94,
    },
    simulate: async (input, config, ctx) => {
      const text = ctx.resolveExpression(String(config.inputText || "")).toLowerCase();
      const rawLabels = String(config.labels || "billing, technical, sales, general")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      let category = rawLabels[0] ?? "general";
      if (/invoice|refund|charge|billing|payment|price/.test(text)) category = "billing";
      else if (/bug|error|crash|api|login|technical/.test(text)) category = "technical";
      else if (/demo|enterprise|quote|pricing|upgrade|sales/.test(text)) category = "sales";

      const tokenUsage = computeTokenUsage("gpt-4o-mini", 64, 18);
      return {
        output: {
          ...input,
          category,
          classification: category,
          confidence: 0.94,
        },
        tokenUsage,
        logs: [`Classified text as "${category}" (confidence 0.94).`],
        meta: { category, confidence: 0.94 },
      };
    },
  }),

  // 111. Sentiment Analysis
  defineRegistryNode({
    id: "ai.sentimentAnalysis",
    label: "Sentiment Analysis",
    description: "Scores text sentiment (positive, neutral, negative) and emotional urgency.",
    category: "ai",
    subcategory: "Chains",
    keywords: ["ai", "sentiment", "emotion", "tone", "positive", "negative", "nps"],
    icon: "lucide:SmilePlus",
    accent: "#FF9F43",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 620,
    configSchema: [
      {
        key: "text",
        label: "Text to analyze",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: { text: "{{text}}" },
    sampleOutput: {
      sentiment: "positive",
      sentimentScore: 0.88,
      urgency: "medium",
    },
    simulate: async (input, config, ctx) => {
      const text = ctx.resolveExpression(String(config.text || "")).toLowerCase();
      const isNegative = /angry|broken|refund|cancel|terrible|urgent|fail/.test(text);
      const sentiment = isNegative ? "negative" : "positive";
      const sentimentScore = isNegative ? -0.78 : 0.88;
      const urgency = isNegative ? "high" : "low";
      const tokenUsage = computeTokenUsage("gpt-4o-mini", 52, 16);
      return {
        output: {
          ...input,
          sentiment,
          sentimentScore,
          urgency,
        },
        tokenUsage,
        logs: [`Detected ${sentiment} sentiment (${sentimentScore}, urgency: ${urgency}).`],
        meta: { sentiment, sentimentScore, urgency },
      };
    },
  }),

  // 112. Information Extractor
  defineRegistryNode({
    id: "ai.informationExtractor",
    label: "Information Extractor",
    description: "Extracts structured JSON fields (entities, dates, amounts) from unstructured text.",
    category: "ai",
    subcategory: "Chains",
    keywords: ["ai", "extract", "structured", "json", "entities", "ner", "schema"],
    icon: "lucide:ScanText",
    accent: "#FF9F43",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 760,
    configSchema: [
      {
        key: "text",
        label: "Source text",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
      {
        key: "schemaFields",
        label: "Fields to extract (comma-separated)",
        type: "text",
        required: true,
        placeholder: "companyName, contactEmail, dealSize, timeline",
      },
    ],
    defaultConfig: {
      text: "{{text}}",
      schemaFields: "companyName, contactEmail, dealSize, timeline",
    },
    sampleOutput: {
      extracted: {
        companyName: "Lovelace Labs",
        contactEmail: "ada@example.com",
        dealSize: 12000,
        timeline: "Q4 2026",
      },
    },
    simulate: async (input, config, ctx) => {
      const fields = String(config.schemaFields || "companyName, contactEmail")
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      const tokenUsage = computeTokenUsage("gpt-4o", 110, 48);
      return {
        output: {
          ...input,
          extracted: {
            companyName: ctx.faker.company.name(),
            contactEmail: ctx.faker.internet.email().toLowerCase(),
            dealSize: 12000,
            timeline: "Q4 2026",
            fieldsExtracted: fields,
          },
        },
        tokenUsage,
        logs: [`Extracted ${fields.length} structured field(s) from text.`],
      };
    },
  }),

  // 113. Summarizer
  defineRegistryNode({
    id: "ai.summarizer",
    label: "Summarizer",
    description: "Condenses long documents, transcripts, or email threads into executive bullets.",
    category: "ai",
    subcategory: "Chains",
    keywords: ["ai", "summarize", "summary", "tldr", "digest", "condense", "bullets"],
    icon: "lucide:FileSpreadsheet",
    accent: "#FF9F43",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 780,
    configSchema: [
      {
        key: "content",
        label: "Content to summarize",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
      {
        key: "format",
        label: "Output style",
        type: "select",
        options: [
          { value: "bullets", label: "3 Executive Bullet Points" },
          { value: "paragraph", label: "Concise Paragraph" },
          { value: "tweet", label: "One-Line TL;DR" },
        ],
      },
    ],
    defaultConfig: {
      content: "{{text}}",
      format: "bullets",
    },
    sampleOutput: {
      summary:
        "• Verified customer request and scope\n• Identified priority SLA tier\n• Prepared next action items",
    },
    simulate: async (input, config, ctx) => {
      const src = ctx.resolveExpression(String(config.content || ""));
      const summary = `• Key takeaway from "${src.slice(0, 48) || "input payload"}"\n• Priority action verified\n• Ready for downstream distribution`;
      const tokenUsage = computeTokenUsage("gpt-4o-mini", 180, 52);
      return {
        output: {
          ...input,
          summary,
          text: summary,
        },
        tokenUsage,
        logs: [`Summarized input in "${String(config.format || "bullets")}" format.`],
      };
    },
  }),

  // 114. Question and Answer Chain
  defineRegistryNode({
    id: "ai.qaChain",
    label: "Question & Answer Chain",
    description: "Answers questions grounded on retrieved knowledge-base context with citations.",
    category: "ai",
    subcategory: "Chains",
    keywords: ["ai", "qa", "question", "answer", "rag", "citations", "knowledge"],
    icon: "lucide:HelpCircle",
    accent: "#FF9F43",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 820,
    configSchema: [
      {
        key: "question",
        label: "Question",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
      {
        key: "context",
        label: "Grounding context",
        type: "expression",
        placeholder: "{{matches}}",
      },
    ],
    defaultConfig: {
      question: "{{text}}",
      context: "{{matches}}",
    },
    sampleOutput: {
      answer: "Pro workspaces include 90+ integrations, AI Agent sub-nodes, and instant refunds within 30 days.",
      citations: ["kb-doc-101", "kb-doc-204"],
    },
    simulate: async (input, config, ctx) => {
      const question = ctx.resolveExpression(String(config.question || ""));
      const answer = `Grounded answer for "${question.slice(0, 60)}": Pro workspaces include 90+ nodes, AI Agents, and SLA support.`;
      const tokenUsage = computeTokenUsage("gpt-4o", 240, 68);
      return {
        output: {
          ...input,
          answer,
          text: answer,
          citations: ["kb-doc-101", "kb-doc-204"],
        },
        tokenUsage,
        logs: [`Answered question with 2 grounding citations.`],
      };
    },
  }),

  // 115. Embeddings
  defineRegistryNode({
    id: "ai.embeddings",
    label: "Embeddings",
    description: "Generates dense vector embeddings for text chunks using OpenAI or Cohere models.",
    category: "ai",
    subcategory: "RAG & Vectors",
    keywords: ["ai", "embeddings", "vector", "openai", "text-embedding-3-small", "rag"],
    icon: "lucide:Binary",
    accent: "#10B981",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 520,
    configSchema: [
      {
        key: "model",
        label: "Embedding model",
        type: "select",
        options: [
          { value: "text-embedding-3-small", label: "text-embedding-3-small (1536d)" },
          { value: "text-embedding-3-large", label: "text-embedding-3-large (3072d)" },
        ],
      },
      {
        key: "text",
        label: "Text to embed",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      model: "text-embedding-3-small",
      text: "{{text}}",
    },
    sampleOutput: {
      embeddingModel: "text-embedding-3-small",
      dimensions: 1536,
      vectorPreview: [0.0214, -0.0418, 0.0891, 0.0127],
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        embeddingModel: String(config.model || "text-embedding-3-small"),
        dimensions: 1536,
        vectorPreview: [0.0214, -0.0418, 0.0891, 0.0127],
      },
      logs: [`Generated 1536-d embedding vector via ${String(config.model || "text-embedding-3-small")}.`],
    }),
  }),

  // 116. Document Loader
  defineRegistryNode({
    id: "ai.documentLoader",
    label: "Document Loader",
    description: "Loads and extracts clean text and metadata from PDFs, web pages, or Markdown files.",
    category: "ai",
    subcategory: "RAG & Vectors",
    keywords: ["ai", "document", "loader", "pdf", "markdown", "rag", "ingest"],
    icon: "lucide:FileInput",
    accent: "#10B981",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 540,
    configSchema: [
      {
        key: "sourceType",
        label: "Document source",
        type: "select",
        options: [
          { value: "pdf", label: "PDF Document" },
          { value: "url", label: "Web URL" },
          { value: "markdown", label: "Markdown / Text" },
        ],
      },
      {
        key: "sourceUri",
        label: "Source URI / filename",
        type: "expression",
        required: true,
        placeholder: "{{fileName}} or https://docs.flowforge.dev/handbook.pdf",
      },
    ],
    defaultConfig: {
      sourceType: "pdf",
      sourceUri: "https://docs.flowforge.dev/architecture-handbook.pdf",
    },
    sampleOutput: {
      documentTitle: "FlowForge Architecture Handbook",
      pageCount: 14,
      extractedText: "FlowForge executes DAG workflows and AI Agents with deterministic traces.",
    },
    simulate: async (input, config, ctx) => {
      const uri = ctx.resolveExpression(String(config.sourceUri || "handbook.pdf"));
      return {
        output: {
          ...input,
          documentUri: uri,
          documentTitle: "FlowForge Architecture Handbook",
          pageCount: 14,
          text: "FlowForge executes DAG workflows and AI Agents with deterministic traces.",
        },
        logs: [`Loaded document from "${uri}" (14 pages).`],
      };
    },
  }),

  // 117. Text Splitter
  defineRegistryNode({
    id: "ai.textSplitter",
    label: "Text Splitter",
    description: "Splits documents into overlapping token/character chunks ready for vector indexing.",
    category: "ai",
    subcategory: "RAG & Vectors",
    keywords: ["ai", "splitter", "chunk", "recursive", "tokens", "rag"],
    icon: "lucide:ScissorsLineDashed",
    accent: "#10B981",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 420,
    configSchema: [
      {
        key: "chunkSize",
        label: "Chunk size (chars)",
        type: "number",
        min: 100,
        max: 4000,
      },
      {
        key: "chunkOverlap",
        label: "Chunk overlap (chars)",
        type: "number",
        min: 0,
        max: 500,
      },
    ],
    defaultConfig: {
      chunkSize: 800,
      chunkOverlap: 120,
    },
    sampleOutput: {
      chunkCount: 4,
      chunks: [
        "Chunk 1: Executive overview & system architecture.",
        "Chunk 2: Declarative 140+ node registry and schema forms.",
      ],
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        chunkSize: Number(config.chunkSize ?? 800),
        chunkCount: 4,
        chunks: [
          "Chunk 1: Executive overview & system architecture.",
          "Chunk 2: Declarative 140+ node registry and schema forms.",
          "Chunk 3: AI Agent bottom sub-node ports (Model, Memory, Tools).",
          "Chunk 4: Deterministic simulation and expression engine.",
        ],
      },
      logs: [`Split document into 4 chunks (size ${Number(config.chunkSize ?? 800)}).`],
    }),
  }),

  // 118. Vector Store Retriever
  defineRegistryNode({
    id: "ai.vectorStoreRetriever",
    label: "Vector Store Retriever",
    description: "Retrieves top-K semantically similar passages from a vector index for RAG.",
    category: "ai",
    subcategory: "RAG & Vectors",
    keywords: ["ai", "vector", "retriever", "rag", "search", "semantic", "pinecone"],
    icon: "lucide:DatabaseZap",
    accent: "#10B981",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "query",
        label: "Search query",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
      {
        key: "topK",
        label: "Top K passages",
        type: "number",
        min: 1,
        max: 20,
      },
    ],
    defaultConfig: {
      query: "{{text}}",
      topK: 3,
    },
    sampleOutput: {
      retrievedPassages: [
        { id: "doc-101", score: 0.94, text: "Enterprise SLA guarantees < 15m response times." },
        { id: "doc-205", score: 0.89, text: "Billing upgrades prorate automatically on Stripe/Paystack." },
      ],
    },
    simulate: async (input, config, ctx) => {
      const q = ctx.resolveExpression(String(config.query || ""));
      return {
        output: {
          ...input,
          query: q,
          retrievedPassages: [
            { id: "doc-101", score: 0.94, text: "Enterprise SLA guarantees < 15m response times." },
            { id: "doc-205", score: 0.89, text: "Billing upgrades prorate automatically on Stripe/Paystack." },
          ],
        },
        logs: [`Retrieved top ${Number(config.topK ?? 3)} vector passages for "${q.slice(0, 40)}".`],
      };
    },
  }),

  // 119. Image Generation
  defineRegistryNode({
    id: "ai.imageGeneration",
    label: "Image Generation",
    description: "Generates an illustration or social graphic from a text prompt (simulated URL).",
    category: "ai",
    subcategory: "Multimodal",
    keywords: ["ai", "image", "dalle", "flux", "generate", "picture", "art"],
    icon: "lucide:ImagePlus",
    accent: "#EC4899",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 920,
    configSchema: [
      {
        key: "prompt",
        label: "Image prompt",
        type: "expression",
        required: true,
        placeholder: "Editorial illustration for {{topic}}",
      },
      {
        key: "aspectRatio",
        label: "Aspect ratio",
        type: "select",
        options: [
          { value: "1:1", label: "1:1 Square" },
          { value: "16:9", label: "16:9 Landscape" },
          { value: "9:16", label: "9:16 Vertical" },
        ],
      },
    ],
    defaultConfig: {
      prompt: "Warm editorial vector hero graphic for {{text}}",
      aspectRatio: "16:9",
    },
    sampleOutput: {
      imageUrl: "https://cdn.flowforge.dev/generated/hero-16x9.png",
      aspectRatio: "16:9",
    },
    simulate: async (input, config, ctx) => {
      const prompt = ctx.resolveExpression(String(config.prompt || ""));
      const imageUrl = `https://cdn.flowforge.dev/generated/img-${ctx.faker.string.alphanumeric(8).toLowerCase()}.png`;
      return {
        output: {
          ...input,
          imageUrl,
          imagePrompt: prompt,
          aspectRatio: String(config.aspectRatio || "16:9"),
        },
        logs: [`Generated image (${String(config.aspectRatio || "16:9")}) -> ${imageUrl}.`],
      };
    },
  }),

  // 120. Speech to Text
  defineRegistryNode({
    id: "ai.speechToText",
    label: "Speech to Text (Whisper)",
    description: "Transcribes voice notes or audio files into timestamped text.",
    category: "ai",
    subcategory: "Multimodal",
    keywords: ["ai", "speech", "whisper", "audio", "transcribe", "voice", "stt"],
    icon: "lucide:Mic",
    accent: "#EC4899",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 740,
    configSchema: [
      {
        key: "audioUrl",
        label: "Audio URL / field",
        type: "expression",
        required: true,
        placeholder: "{{audioUrl}}",
      },
      {
        key: "language",
        label: "Language hint",
        type: "text",
        placeholder: "en",
      },
    ],
    defaultConfig: {
      audioUrl: "https://cdn.flowforge.dev/voice/note-01.ogg",
      language: "en",
    },
    sampleOutput: {
      transcript: "Hi team, please send over the updated Q4 enterprise invoice and schedule a quick review call.",
      durationSeconds: 18.4,
    },
    simulate: async (input, config, ctx) => {
      const audioUrl = ctx.resolveExpression(String(config.audioUrl || ""));
      const transcript =
        "Hi team, please send over the updated Q4 enterprise invoice and schedule a quick review call.";
      return {
        output: {
          ...input,
          audioUrl,
          transcript,
          text: transcript,
          durationSeconds: 18.4,
        },
        logs: [`Transcribed audio "${audioUrl}" (18.4s).`],
      };
    },
  }),

  // 121. Text to Speech
  defineRegistryNode({
    id: "ai.textToSpeech",
    label: "Text to Speech",
    description: "Synthesizes natural spoken audio from text and returns an audio URL.",
    category: "ai",
    subcategory: "Multimodal",
    keywords: ["ai", "tts", "voice", "audio", "speech", "elevenlabs", "narrate"],
    icon: "lucide:Volume2",
    accent: "#EC4899",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 720,
    configSchema: [
      {
        key: "text",
        label: "Text to speak",
        type: "expression",
        required: true,
        placeholder: "{{text}}",
      },
      {
        key: "voice",
        label: "Voice preset",
        type: "select",
        options: [
          { value: "nova", label: "Nova (Warm Conversational)" },
          { value: "onyx", label: "Onyx (Deep Broadcast)" },
          { value: "sol", label: "Sol (Crisp Narrator)" },
        ],
      },
    ],
    defaultConfig: {
      text: "{{text}}",
      voice: "nova",
    },
    sampleOutput: {
      synthesizedAudioUrl: "https://cdn.flowforge.dev/tts/nova-clip.mp3",
      voice: "nova",
    },
    simulate: async (input, config, ctx) => {
      const voice = String(config.voice || "nova");
      const synthesizedAudioUrl = `https://cdn.flowforge.dev/tts/${voice}-${ctx.faker.string.alphanumeric(6).toLowerCase()}.mp3`;
      return {
        output: {
          ...input,
          synthesizedAudioUrl,
          voice,
        },
        logs: [`Synthesized speech with voice "${voice}" -> ${synthesizedAudioUrl}.`],
      };
    },
  }),

  // 122. Output Parser (Structured JSON)
  defineRegistryNode({
    id: "ai.outputParser",
    label: "Structured Output Parser",
    description: "Validates and coerces LLM completions into a strict JSON schema.",
    category: "ai",
    subcategory: "Parsers",
    keywords: ["ai", "parser", "json", "schema", "structured", "validate"],
    icon: "lucide:FileJson2",
    accent: "#FF9F43",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 360,
    configSchema: [
      {
        key: "schemaJson",
        label: "Target JSON example",
        type: "json",
        placeholder: '{"priority": "high", "approved": true}',
      },
    ],
    defaultConfig: {
      schemaJson: '{"priority": "high", "approved": true}',
    },
    sampleOutput: {
      parsedOutput: {
        priority: "high",
        approved: true,
      },
    },
    simulate: async (input) => ({
      output: {
        ...input,
        parsedOutput: {
          priority: "high",
          approved: true,
        },
      },
      logs: ["Validated structured JSON output against schema."],
    }),
  }),

  // =========================================================================
  // 6 Chat Model Sub-Nodes (`type: "ai-model"`, bottom-port providers)
  // =========================================================================

  // 123. OpenAI Chat Model
  defineRegistryNode({
    id: "aiModel.openai",
    label: "OpenAI Chat Model",
    description: "Connects GPT-4o, GPT-4o-mini, or o3-mini to an AI Agent's Model port.",
    category: "ai",
    subcategory: "Chat Models",
    keywords: ["openai", "gpt-4o", "gpt", "model", "llm", "subnode", "agent"],
    icon: "brand:openai",
    accent: "#10A37F",
    type: "ai-model",
    inputs: [],
    outputs: SUB_MODEL_OUT,
    latencyMs: 320,
    credentialProvider: "openai",
    configSchema: [
      {
        key: "credentialId",
        label: "OpenAI API Key",
        type: "credential",
        credentialProvider: "openai",
      },
      {
        key: "modelName",
        label: "Model",
        type: "select",
        options: [
          { value: "gpt-4o", label: "gpt-4o (Flagship Multimodal)" },
          { value: "gpt-4o-mini", label: "gpt-4o-mini (Fast & Low Cost)" },
        ],
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.1,
      },
    ],
    defaultConfig: {
      credentialId: "cred-openai-default",
      modelName: "gpt-4o",
      temperature: 0.3,
    },
    sampleOutput: {
      provider: "openai",
      modelName: "gpt-4o",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        provider: "openai",
        modelName: String(config.modelName || "gpt-4o"),
      },
      logs: [`OpenAI model sub-node ready (${String(config.modelName || "gpt-4o")}).`],
    }),
  }),

  // 124. Anthropic Claude Model
  defineRegistryNode({
    id: "aiModel.anthropic",
    label: "Anthropic Claude Model",
    description: "Connects Claude 3.5 Sonnet or Haiku to an AI Agent's Model port.",
    category: "ai",
    subcategory: "Chat Models",
    keywords: ["anthropic", "claude", "sonnet", "haiku", "model", "llm", "subnode"],
    icon: "brand:anthropic",
    accent: "#D97757",
    type: "ai-model",
    inputs: [],
    outputs: SUB_MODEL_OUT,
    latencyMs: 320,
    credentialProvider: "anthropic",
    configSchema: [
      {
        key: "credentialId",
        label: "Anthropic API Key",
        type: "credential",
        credentialProvider: "anthropic",
      },
      {
        key: "modelName",
        label: "Model",
        type: "select",
        options: [
          { value: "claude-3-5-sonnet", label: "claude-3-5-sonnet" },
          { value: "claude-3-5-haiku", label: "claude-3-5-haiku" },
        ],
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.1,
      },
    ],
    defaultConfig: {
      credentialId: "cred-anthropic-default",
      modelName: "claude-3-5-sonnet",
      temperature: 0.3,
    },
    sampleOutput: {
      provider: "anthropic",
      modelName: "claude-3-5-sonnet",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        provider: "anthropic",
        modelName: String(config.modelName || "claude-3-5-sonnet"),
      },
      logs: [`Anthropic Claude sub-node ready (${String(config.modelName || "claude-3-5-sonnet")}).`],
    }),
  }),

  // 125. Google Gemini Model
  defineRegistryNode({
    id: "aiModel.gemini",
    label: "Google Gemini Model",
    description: "Connects Gemini 2.0 Flash or 1.5 Pro to an AI Agent's Model port.",
    category: "ai",
    subcategory: "Chat Models",
    keywords: ["google", "gemini", "flash", "model", "llm", "subnode"],
    icon: "brand:google",
    accent: "#4285F4",
    type: "ai-model",
    inputs: [],
    outputs: SUB_MODEL_OUT,
    latencyMs: 320,
    credentialProvider: "google",
    configSchema: [
      {
        key: "credentialId",
        label: "Google AI Studio Key",
        type: "credential",
        credentialProvider: "google",
      },
      {
        key: "modelName",
        label: "Model",
        type: "select",
        options: [
          { value: "gemini-2.0-flash", label: "gemini-2.0-flash" },
          { value: "gemini-1.5-pro", label: "gemini-1.5-pro" },
        ],
      },
    ],
    defaultConfig: {
      credentialId: "cred-google-default",
      modelName: "gemini-2.0-flash",
    },
    sampleOutput: {
      provider: "google",
      modelName: "gemini-2.0-flash",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        provider: "google",
        modelName: String(config.modelName || "gemini-2.0-flash"),
      },
      logs: [`Google Gemini sub-node ready (${String(config.modelName || "gemini-2.0-flash")}).`],
    }),
  }),

  // 126. OpenRouter Chat Model
  defineRegistryNode({
    id: "aiModel.openrouter",
    label: "OpenRouter Chat Model",
    description: "Routes agent completions across 200+ hosted models via OpenRouter.",
    category: "ai",
    subcategory: "Chat Models",
    keywords: ["openrouter", "router", "deepseek", "qwen", "mistral", "model", "subnode"],
    icon: "lucide:Network",
    accent: "#6366F1",
    type: "ai-model",
    inputs: [],
    outputs: SUB_MODEL_OUT,
    latencyMs: 320,
    credentialProvider: "openrouter",
    configSchema: [
      {
        key: "credentialId",
        label: "OpenRouter API Key",
        type: "credential",
        credentialProvider: "openrouter",
      },
      {
        key: "modelName",
        label: "Model slug",
        type: "text",
        required: true,
        placeholder: "openrouter/auto",
      },
    ],
    defaultConfig: {
      credentialId: "cred-openrouter-default",
      modelName: "openrouter/auto",
    },
    sampleOutput: {
      provider: "openrouter",
      modelName: "openrouter/auto",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        provider: "openrouter",
        modelName: String(config.modelName || "openrouter/auto"),
      },
      logs: [`OpenRouter sub-node ready (${String(config.modelName || "openrouter/auto")}).`],
    }),
  }),

  // 127. Groq LPU Model
  defineRegistryNode({
    id: "aiModel.groq",
    label: "Groq LPU Model",
    description: "Ultra-low-latency Llama 3.3 70B inference on Groq LPUs for AI Agents.",
    category: "ai",
    subcategory: "Chat Models",
    keywords: ["groq", "lpu", "llama", "fast", "model", "subnode"],
    icon: "brand:groq",
    accent: "#F55036",
    type: "ai-model",
    inputs: [],
    outputs: SUB_MODEL_OUT,
    latencyMs: 300,
    credentialProvider: "groq",
    configSchema: [
      {
        key: "credentialId",
        label: "Groq API Key",
        type: "credential",
        credentialProvider: "groq",
      },
      {
        key: "modelName",
        label: "Model",
        type: "select",
        options: [
          { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
          { value: "mixtral-8x7b-32768", label: "mixtral-8x7b-32768" },
        ],
      },
    ],
    defaultConfig: {
      credentialId: "cred-groq-default",
      modelName: "llama-3.3-70b-versatile",
    },
    sampleOutput: {
      provider: "groq",
      modelName: "llama-3.3-70b-versatile",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        provider: "groq",
        modelName: String(config.modelName || "llama-3.3-70b-versatile"),
      },
      logs: [`Groq LPU sub-node ready (${String(config.modelName || "llama-3.3-70b-versatile")}).`],
    }),
  }),

  // 128. Ollama (Local) Model
  defineRegistryNode({
    id: "aiModel.ollama",
    label: "Ollama (Local) Model",
    description: "Runs local zero-cost open-weights models (Llama 3.2, DeepSeek R1, Qwen 2.5).",
    category: "ai",
    subcategory: "Chat Models",
    keywords: ["ollama", "local", "llama", "deepseek", "qwen", "model", "subnode"],
    icon: "brand:ollama",
    accent: "#94A3B8",
    type: "ai-model",
    inputs: [],
    outputs: SUB_MODEL_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "modelName",
        label: "Local model tag",
        type: "select",
        options: [
          { value: "llama3.2:latest", label: "llama3.2:latest" },
          { value: "deepseek-r1:14b", label: "deepseek-r1:14b" },
          { value: "qwen2.5-coder:7b", label: "qwen2.5-coder:7b" },
        ],
      },
    ],
    defaultConfig: {
      modelName: "llama3.2:latest",
    },
    sampleOutput: {
      provider: "ollama",
      modelName: "llama3.2:latest",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        provider: "ollama",
        modelName: String(config.modelName || "llama3.2:latest"),
      },
      logs: [`Ollama local model sub-node ready (${String(config.modelName || "llama3.2:latest")}).`],
    }),
  }),

  // =========================================================================
  // 3 Memory Sub-Nodes (`type: "ai-memory"`, bottom-port providers)
  // =========================================================================

  // 129. Window Buffer Memory
  defineRegistryNode({
    id: "aiMemory.windowBuffer",
    label: "Window Buffer Memory",
    description: "Keeps a sliding window of the most recent K conversation turns in memory.",
    category: "ai",
    subcategory: "Memory",
    keywords: ["memory", "window", "buffer", "chat", "history", "context", "subnode"],
    icon: "lucide:History",
    accent: "#14B8A6",
    type: "ai-memory",
    inputs: [],
    outputs: SUB_MEMORY_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "sessionKey",
        label: "Session ID expression",
        type: "expression",
        placeholder: "{{chatId}} or {{from}}",
      },
      {
        key: "windowSize",
        label: "Context window turns",
        type: "number",
        min: 1,
        max: 50,
      },
    ],
    defaultConfig: {
      sessionKey: "{{chatId}}",
      windowSize: 8,
    },
    sampleOutput: {
      memoryType: "windowBuffer",
      windowSize: 8,
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        memoryType: "windowBuffer",
        windowSize: Number(config.windowSize ?? 8),
      },
      logs: [`Window Buffer Memory ready (${Number(config.windowSize ?? 8)} turns).`],
    }),
  }),

  // 130. Postgres Chat Memory
  defineRegistryNode({
    id: "aiMemory.postgres",
    label: "Postgres Chat Memory",
    description: "Persists long-term agent conversation history in a Postgres table.",
    category: "ai",
    subcategory: "Memory",
    keywords: ["memory", "postgres", "sql", "persistent", "chat", "history", "subnode"],
    icon: "brand:postgres",
    accent: "#336791",
    type: "ai-memory",
    inputs: [],
    outputs: SUB_MEMORY_OUT,
    latencyMs: 320,
    credentialProvider: "postgres",
    configSchema: [
      {
        key: "credentialId",
        label: "Postgres Connection",
        type: "credential",
        credentialProvider: "postgres",
      },
      {
        key: "tableName",
        label: "History table name",
        type: "text",
        required: true,
        placeholder: "agent_chat_histories",
      },
      {
        key: "windowSize",
        label: "Turns to load",
        type: "number",
        min: 1,
        max: 100,
      },
    ],
    defaultConfig: {
      credentialId: "cred-postgres-default",
      tableName: "agent_chat_histories",
      windowSize: 12,
    },
    sampleOutput: {
      memoryType: "postgres",
      tableName: "agent_chat_histories",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        memoryType: "postgres",
        tableName: String(config.tableName || "agent_chat_histories"),
      },
      logs: [`Postgres Chat Memory ready (table "${String(config.tableName || "agent_chat_histories")}").`],
    }),
  }),

  // 131. Redis Chat Memory
  defineRegistryNode({
    id: "aiMemory.redis",
    label: "Redis Chat Memory",
    description: "Stores low-latency session chat history in Redis with automatic TTL expiry.",
    category: "ai",
    subcategory: "Memory",
    keywords: ["memory", "redis", "cache", "ttl", "session", "chat", "subnode"],
    icon: "brand:redis",
    accent: "#DC382D",
    type: "ai-memory",
    inputs: [],
    outputs: SUB_MEMORY_OUT,
    latencyMs: 300,
    credentialProvider: "redis",
    configSchema: [
      {
        key: "credentialId",
        label: "Redis Connection",
        type: "credential",
        credentialProvider: "redis",
      },
      {
        key: "ttlSeconds",
        label: "Session TTL (seconds)",
        type: "number",
        min: 60,
        max: 604800,
      },
      {
        key: "windowSize",
        label: "Turns to load",
        type: "number",
        min: 1,
        max: 50,
      },
    ],
    defaultConfig: {
      credentialId: "cred-redis-default",
      ttlSeconds: 86400,
      windowSize: 10,
    },
    sampleOutput: {
      memoryType: "redis",
      ttlSeconds: 86400,
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        memoryType: "redis",
        ttlSeconds: Number(config.ttlSeconds ?? 86400),
      },
      logs: [`Redis Chat Memory ready (TTL ${Number(config.ttlSeconds ?? 86400)}s).`],
    }),
  }),

  // =========================================================================
  // 13 Agent Tool Sub-Nodes (`type: "ai-tool"`, bottom-port providers)
  // =========================================================================

  // 132. Calculator Tool
  defineRegistryNode({
    id: "aiTool.calculator",
    label: "Calculator Tool",
    description: "Gives an AI Agent deterministic arithmetic, percentage, and scoring evaluation.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "calculator", "math", "arithmetic", "agent", "subnode"],
    icon: "lucide:Calculator",
    accent: "#F59E0B",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 300,
    configSchema: [
      {
        key: "precision",
        label: "Decimal precision",
        type: "number",
        min: 0,
        max: 8,
      },
    ],
    defaultConfig: { precision: 2 },
    sampleOutput: { tool: "calculator", precision: 2 },
    simulate: async (input) => ({
      output: { ...input, tool: "calculator" },
      logs: ["Calculator Tool sub-node ready."],
    }),
  }),

  // 133. Web Search Tool
  defineRegistryNode({
    id: "aiTool.webSearch",
    label: "Web Search Tool",
    description: "Lets an AI Agent search the live web for facts, news, and company signals.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "web", "search", "tavily", "serp", "google", "agent", "subnode"],
    icon: "lucide:Globe",
    accent: "#38BDF8",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    configSchema: [
      {
        key: "maxResults",
        label: "Max search results",
        type: "number",
        min: 1,
        max: 10,
      },
    ],
    defaultConfig: { maxResults: 4 },
    sampleOutput: { tool: "webSearch", maxResults: 4 },
    simulate: async (input) => ({
      output: { ...input, tool: "webSearch" },
      logs: ["Web Search Tool sub-node ready."],
    }),
  }),

  // 134. Wikipedia Tool
  defineRegistryNode({
    id: "aiTool.wikipedia",
    label: "Wikipedia Tool",
    description: "Lets an AI Agent look up encyclopedic summaries and historical facts.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "wikipedia", "wiki", "encyclopedia", "facts", "agent", "subnode"],
    icon: "lucide:BookOpen",
    accent: "#94A3B8",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "language",
        label: "Wiki language edition",
        type: "text",
        placeholder: "en",
      },
    ],
    defaultConfig: { language: "en" },
    sampleOutput: { tool: "wikipedia", language: "en" },
    simulate: async (input) => ({
      output: { ...input, tool: "wikipedia" },
      logs: ["Wikipedia Tool sub-node ready."],
    }),
  }),

  // 135. HTTP Request Tool
  defineRegistryNode({
    id: "aiTool.httpRequest",
    label: "HTTP Request Tool",
    description: "Allows an AI Agent to call an external REST API endpoint when needed.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "http", "api", "fetch", "rest", "agent", "subnode"],
    icon: "lucide:Webhook",
    accent: "#FF6B35",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    configSchema: [
      {
        key: "baseUrl",
        label: "Allowed API base URL",
        type: "text",
        required: true,
        placeholder: "https://api.example.com/v1",
      },
    ],
    defaultConfig: { baseUrl: "https://api.example.com/v1" },
    sampleOutput: { tool: "httpRequest", baseUrl: "https://api.example.com/v1" },
    simulate: async (input) => ({
      output: { ...input, tool: "httpRequest" },
      logs: ["HTTP Request Tool sub-node ready."],
    }),
  }),

  // 136. Code Execution Tool
  defineRegistryNode({
    id: "aiTool.code",
    label: "Code Execution Tool",
    description: "Provides a sandboxed JS interpreter for the AI Agent to run data calculations.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "code", "sandbox", "interpreter", "js", "agent", "subnode"],
    icon: "lucide:Terminal",
    accent: "#F59E0B",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 320,
    configSchema: [
      {
        key: "runtime",
        label: "Sandbox runtime",
        type: "select",
        options: [
          { value: "javascript", label: "JavaScript (QuickJS)" },
          { value: "python", label: "Python (Pyodide)" },
        ],
      },
    ],
    defaultConfig: { runtime: "javascript" },
    sampleOutput: { tool: "code", runtime: "javascript" },
    simulate: async (input) => ({
      output: { ...input, tool: "code" },
      logs: ["Code Execution Tool sub-node ready."],
    }),
  }),

  // 137. Gmail Tool
  defineRegistryNode({
    id: "aiTool.gmail",
    label: "Gmail Tool",
    description: "Lets an AI Agent search threads, draft replies, or send emails via Gmail.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "gmail", "email", "inbox", "reply", "agent", "subnode"],
    icon: "brand:gmail",
    accent: "#EA4335",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    credentialProvider: "gmail",
    configSchema: [
      {
        key: "credentialId",
        label: "Gmail Account",
        type: "credential",
        credentialProvider: "gmail",
      },
      {
        key: "allowedAction",
        label: "Permitted action",
        type: "select",
        options: [
          { value: "draft", label: "Create Draft Reply" },
          { value: "send", label: "Send Email" },
          { value: "search", label: "Search Inbox" },
        ],
      },
    ],
    defaultConfig: {
      credentialId: "cred-gmail-default",
      allowedAction: "draft",
    },
    sampleOutput: { tool: "gmail", allowedAction: "draft" },
    simulate: async (input) => ({
      output: { ...input, tool: "gmail" },
      logs: ["Gmail Tool sub-node ready."],
    }),
  }),

  // 138. Google Sheets Tool
  defineRegistryNode({
    id: "aiTool.googleSheets",
    label: "Google Sheets Tool",
    description: "Lets an AI Agent look up rows or append records in a Google Sheet.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "sheets", "google", "spreadsheet", "lookup", "agent", "subnode"],
    icon: "brand:googlesheets",
    accent: "#34A853",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    credentialProvider: "google",
    configSchema: [
      {
        key: "spreadsheetName",
        label: "Spreadsheet name",
        type: "text",
        required: true,
        placeholder: "Customer CRM Sheet",
      },
    ],
    defaultConfig: { spreadsheetName: "Customer CRM Sheet" },
    sampleOutput: { tool: "googleSheets", spreadsheetName: "Customer CRM Sheet" },
    simulate: async (input) => ({
      output: { ...input, tool: "googleSheets" },
      logs: ["Google Sheets Tool sub-node ready."],
    }),
  }),

  // 139. Postgres SQL Tool
  defineRegistryNode({
    id: "aiTool.postgres",
    label: "Postgres SQL Tool",
    description: "Lets an AI Agent run read-only SQL queries against Postgres to verify customer data.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "postgres", "sql", "database", "query", "agent", "subnode"],
    icon: "brand:postgres",
    accent: "#336791",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    credentialProvider: "postgres",
    configSchema: [
      {
        key: "credentialId",
        label: "Postgres Connection",
        type: "credential",
        credentialProvider: "postgres",
      },
      {
        key: "schemaScope",
        label: "Allowed schema",
        type: "text",
        placeholder: "public (read-only)",
      },
    ],
    defaultConfig: {
      credentialId: "cred-postgres-default",
      schemaScope: "public (read-only)",
    },
    sampleOutput: { tool: "postgres", schemaScope: "public (read-only)" },
    simulate: async (input) => ({
      output: { ...input, tool: "postgres" },
      logs: ["Postgres SQL Tool sub-node ready."],
    }),
  }),

  // 140. WhatsApp Tool
  defineRegistryNode({
    id: "aiTool.whatsapp",
    label: "WhatsApp Tool",
    description: "Lets an AI Agent send a WhatsApp Business reply or template message.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "whatsapp", "message", "reply", "agent", "subnode"],
    icon: "brand:whatsapp",
    accent: "#25D366",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    credentialProvider: "whatsapp",
    configSchema: [
      {
        key: "credentialId",
        label: "WhatsApp Business Account",
        type: "credential",
        credentialProvider: "whatsapp",
      },
    ],
    defaultConfig: { credentialId: "cred-whatsapp-default" },
    sampleOutput: { tool: "whatsapp" },
    simulate: async (input) => ({
      output: { ...input, tool: "whatsapp" },
      logs: ["WhatsApp Tool sub-node ready."],
    }),
  }),

  // 141. Telegram Tool
  defineRegistryNode({
    id: "aiTool.telegram",
    label: "Telegram Tool",
    description: "Lets an AI Agent post alerts or replies to a Telegram chat.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "telegram", "bot", "message", "agent", "subnode"],
    icon: "brand:telegram",
    accent: "#26A5E4",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    credentialProvider: "telegram",
    configSchema: [
      {
        key: "credentialId",
        label: "Telegram Bot Token",
        type: "credential",
        credentialProvider: "telegram",
      },
    ],
    defaultConfig: { credentialId: "cred-telegram-default" },
    sampleOutput: { tool: "telegram" },
    simulate: async (input) => ({
      output: { ...input, tool: "telegram" },
      logs: ["Telegram Tool sub-node ready."],
    }),
  }),

  // 142. Google Calendar Tool
  defineRegistryNode({
    id: "aiTool.calendar",
    label: "Google Calendar Tool",
    description: "Lets an AI Agent check availability or book a calendar meeting.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "calendar", "google", "meeting", "schedule", "agent", "subnode"],
    icon: "brand:googlecalendar",
    accent: "#4285F4",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 340,
    credentialProvider: "google",
    configSchema: [
      {
        key: "calendarId",
        label: "Calendar ID",
        type: "text",
        placeholder: "primary",
      },
    ],
    defaultConfig: { calendarId: "primary" },
    sampleOutput: { tool: "calendar", calendarId: "primary" },
    simulate: async (input) => ({
      output: { ...input, tool: "calendar" },
      logs: ["Google Calendar Tool sub-node ready."],
    }),
  }),

  // 143. Call Another Workflow Tool
  defineRegistryNode({
    id: "aiTool.callWorkflow",
    label: "Call Another Workflow Tool",
    description: "Lets an AI Agent trigger a modular sub-workflow as a callable tool.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: ["tool", "workflow", "subworkflow", "invoke", "agent", "subnode"],
    icon: "lucide:Workflow",
    accent: "#FFA23A",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 360,
    configSchema: [
      {
        key: "workflowName",
        label: "Target workflow name",
        type: "text",
        required: true,
        placeholder: "Customer Enrichment Sub-Workflow",
      },
    ],
    defaultConfig: { workflowName: "Customer Enrichment Sub-Workflow" },
    sampleOutput: { tool: "callWorkflow", workflowName: "Customer Enrichment Sub-Workflow" },
    simulate: async (input) => ({
      output: { ...input, tool: "callWorkflow" },
      logs: ["Call Another Workflow Tool sub-node ready."],
    }),
  }),

  // 144. Call Another Agent Tool (Multi-Agent Handoff)
  defineRegistryNode({
    id: "aiTool.callAgent",
    label: "Call Another Agent Tool",
    description:
      "Delegates a subtask to a specialist sub-agent and records its nested trace inside the parent agent run.",
    category: "ai",
    subcategory: "Agent Tools",
    keywords: [
      "tool",
      "agent",
      "multi-agent",
      "delegate",
      "handoff",
      "specialist",
      "researcher",
      "writer",
      "subnode",
    ],
    icon: "lucide:Users",
    accent: "#FF9F43",
    type: "ai-tool",
    inputs: [],
    outputs: SUB_TOOL_OUT,
    latencyMs: 420,
    configSchema: [
      {
        key: "agentName",
        label: "Specialist sub-agent name",
        type: "text",
        required: true,
        placeholder: "Researcher Agent",
      },
      {
        key: "specialtyPrompt",
        label: "Specialist instructions",
        type: "textarea",
        placeholder: "Gather factual citations and return a structured brief.",
      },
    ],
    defaultConfig: {
      agentName: "Researcher Agent",
      specialtyPrompt: "Gather factual citations and return a structured brief.",
    },
    sampleOutput: {
      tool: "callAgent",
      agentName: "Researcher Agent",
    },
    simulate: async (input, config) => ({
      output: {
        ...input,
        tool: "callAgent",
        agentName: String(config.agentName || "Researcher Agent"),
      },
      logs: [`Call Another Agent Tool ready (${String(config.agentName || "Researcher Agent")}).`],
    }),
  }),
];
