/**
 * Showcase templates.
 *
 * Eight flows that each exercise a different slice of the 144-node library —
 * AI Agents with wired sub-nodes, RAG pipelines, Switch routing, per-item loops,
 * payment reconciliation, DevOps alerting and recruiting triage.
 *
 * They are deliberately kept in their own module: `lib/templates/index.ts` owns the
 * gallery contract, this file owns the showcase content.
 */

import { buildEdge, buildNode, buildSubNodeEdge, type BuiltGraph } from "@/lib/graph-builder";
import type { Template } from "./types";

/** One AI Agent plus the models, memory and tools wired into its bottom ports. */
const supportAgent: Template = {
  id: "ai-support-agent",
  name: "AI support agent with tools",
  description:
    "A chat message lands on an AI Agent wired to an OpenAI chat model, window-buffer memory, web search and a read-only Postgres tool. The reply is classified, gated by a human approval step, then returned to the chat.",
  category: "AI",
  tags: ["ai", "agent", "support"],
  nodeCount: 10,
  build: () => ({
    nodes: [
      buildNode("sa-chat", "trigger.chatMessage", {
        sessionId: "sess-support-42",
        sampleMessage:
          "Our invoice #INV-2094 was charged twice this morning — can you check and refund one?",
      }),
      buildNode("sa-agent", "action.aiAgent", {
        goal: "Resolve the customer request in {{chatInput}} for session {{sessionId}}. Verify account state with the Postgres tool before recommending a refund, and cite the policy you applied.",
        systemPrompt:
          "You are a careful support agent. Never guess account state: look it up, then answer in two short paragraphs.",
        maxSteps: 4,
        model: "gpt-4o",
      }),
      buildNode(
        "sa-model",
        "aiModel.openai",
        { modelName: "gpt-4o", temperature: 0.2 },
        { label: "GPT-4o (answer model)" },
      ),
      buildNode(
        "sa-memory",
        "aiMemory.windowBuffer",
        { sessionKey: "{{sessionId}}", windowSize: 10 },
        { label: "Chat memory (10 turns)" },
      ),
      buildNode(
        "sa-tool-search",
        "aiTool.webSearch",
        { maxResults: 4 },
        { label: "Web search (policy changes)" },
      ),
      buildNode(
        "sa-tool-sql",
        "aiTool.postgres",
        { schemaScope: "public (read-only)" },
        { label: "Postgres (read-only)" },
      ),
      buildNode("sa-classify", "ai.textClassifier", {
        inputText: "{{text}}",
        labels: "refund, billing, technical, general",
      }),
      buildNode("sa-approval", "logic.waitForApproval", {
        summary: "Send this drafted support reply? {{text}}",
        approverRole: "Support Lead",
        requireInteractiveClick: true,
      }),
      buildNode("sa-respond", "output.respondToWebhook", {
        statusCode: 200,
        responseBody: '{"reply": "{{text}}", "category": "{{category}}"}',
      }),
      buildNode("sa-note", "logic.stickyNote", {
        content:
          "Sub-nodes only connect to an AI Agent's bottom ports. Tool edges pulse in the canvas while the agent is reasoning.",
        color: "emerald",
      }),
    ],
    edges: [
      buildEdge("sa-chat", "sa-agent"),
      buildSubNodeEdge("sa-model", "sa-agent", "ai_model"),
      buildSubNodeEdge("sa-memory", "sa-agent", "ai_memory"),
      buildSubNodeEdge("sa-tool-search", "sa-agent", "ai_tool"),
      buildSubNodeEdge("sa-tool-sql", "sa-agent", "ai_tool"),
      buildEdge("sa-agent", "sa-classify"),
      buildEdge("sa-classify", "sa-approval"),
      buildEdge("sa-approval", "sa-respond"),
    ],
  }),
};

/** Document → chunks → embeddings → vector store → retriever → answer chain. */
const ragKnowledgeBase: Template = {
  id: "rag-knowledge-base",
  name: "RAG knowledge base Q&A",
  description:
    "A form submission kicks off a full retrieval-augmented generation pipeline: load a document, split it into chunks, embed every chunk, upsert into Pinecone, retrieve the closest matches and answer with the Q&A chain.",
  category: "AI",
  tags: ["ai", "rag", "knowledge"],
  nodeCount: 9,
  build: () => ({
    nodes: [
      buildNode("rk-form", "trigger.formSubmission", {
        formTitle: "Ask the handbook",
      }),
      buildNode("rk-load", "ai.documentLoader", {
        sourceType: "pdf",
        sourceUri: "https://docs.flowforge.dev/architecture-handbook.pdf",
      }),
      buildNode("rk-split", "ai.textSplitter", { chunkSize: 800, chunkOverlap: 120 }),
      buildNode("rk-embed", "ai.embeddings", {
        model: "text-embedding-3-small",
        text: "{{content}}",
      }),
      buildNode("rk-upsert", "data.pinecone", {
        operation: "upsert",
        namespace: "kb-docs-v2",
      }),
      buildNode("rk-retrieve", "ai.vectorStoreRetriever", {
        query: "{{notes}}",
        topK: 4,
      }),
      buildNode("rk-answer", "ai.qaChain", {
        question: "{{notes}}",
        context: "{{matches}}",
      }),
      buildNode("rk-email", "output.email", {
        to: "{{fields.email}}",
        subject: "Answer from the FlowForge handbook",
        body: "{{text}}",
      }),
      buildNode("rk-note", "logic.stickyNote", {
        content: "Swap the Document Loader's source type for URL, Notion or Google Drive without touching the rest of the chain.",
        color: "ember",
      }),
    ],
    edges: [
      buildEdge("rk-form", "rk-load"),
      buildEdge("rk-load", "rk-split"),
      buildEdge("rk-split", "rk-embed"),
      buildEdge("rk-embed", "rk-upsert"),
      buildEdge("rk-upsert", "rk-retrieve"),
      buildEdge("rk-retrieve", "rk-answer"),
      buildEdge("rk-answer", "rk-email"),
    ],
  }),
};

/** Switch routing: paid orders fulfil immediately, COD orders wait for approval. */
const orderFulfilment: Template = {
  id: "order-fulfilment-switch",
  name: "Order fulfilment with Switch routing",
  description:
    "A Shopify order is enriched with a Code node, then a Switch sends it down three branches: online payments are logged and confirmed by WhatsApp, cash-on-delivery orders wait for a human approval, and everything else alerts Slack. All branches merge back into one audit trail.",
  category: "Commerce",
  tags: ["ecommerce", "ops", "logic"],
  nodeCount: 10,
  build: () => ({
    nodes: [
      buildNode("of-order", "trigger.shopifyNewOrder", { orderReference: "PSK_ORD_4821" }),
      buildNode("of-enrich", "logic.code", {
        code: "// Flag fulfilment risk before routing\nreturn {\n  ...$input,\n  fulfilmentScore: 92,\n  routedAt: new Date().toISOString(),\n};",
      }),
      buildNode("of-route", "logic.switch", {
        value: "{{paymentReference}}",
        case0: "PSK",
        case1: "COD",
        case2: "BANK",
      }),
      buildNode("of-ledger", "data.googleSheets", {
        operation: "append",
        spreadsheet: "Orders Master 2026",
        columns: [
          { id: "of-c1", key: "Order", value: "{{orderId}}" },
          { id: "of-c2", key: "Customer", value: "{{customer.name}}" },
          { id: "of-c3", key: "Total", value: "{{totalPrice}}" },
        ],
      }),
      buildNode("of-whatsapp", "action.whatsappSend", {
        to: "+2348031234567",
        body: "Hi {{customer.name}} — order {{orderId}} is confirmed and packing now.",
      }),
      buildNode("of-hold", "logic.waitForApproval", {
        summary: "Cash-on-delivery order {{orderId}} for {{totalPrice}} — release it?",
        approverRole: "Ops Manager",
      }),
      buildNode("of-gmail", "action.gmail", {
        to: "{{customer.email}}",
        subject: "Order {{orderId}} approved for dispatch",
        body: "{{text}}",
      }),
      buildNode("of-slack", "action.slackSendMessage", {
        channel: "#order-ops",
        message: "Unrecognised payment reference on {{orderId}} ({{totalPrice}}) — needs manual review.",
      }),
      buildNode("of-merge", "logic.merge", { mode: "waitAll" }),
      buildNode("of-log", "output.log", { label: "Fulfilment audit trail" }),
    ],
    edges: [
      buildEdge("of-order", "of-enrich"),
      buildEdge("of-enrich", "of-route"),
      buildEdge("of-route", "of-ledger", "case_0"),
      buildEdge("of-route", "of-whatsapp", "case_0"),
      buildEdge("of-route", "of-hold", "case_1"),
      buildEdge("of-hold", "of-gmail"),
      buildEdge("of-route", "of-slack", "fallback"),
      buildEdge("of-ledger", "of-merge"),
      buildEdge("of-whatsapp", "of-merge"),
      buildEdge("of-gmail", "of-merge"),
      buildEdge("of-slack", "of-merge"),
      buildEdge("of-merge", "of-log"),
    ],
  }),
};

/** Per-item loop: summarise, wait and email each overdue invoice. */
const invoiceChase: Template = {
  id: "invoice-chase-loop",
  name: "Invoice chase with per-item loop",
  description:
    "Every weekday morning the flow pulls overdue invoices, splits the array into items, walks them one at a time through an AI summariser, a delay and an email, then aggregates the batch into a single spend report.",
  category: "Finance",
  tags: ["finance", "automation", "logic"],
  nodeCount: 10,
  build: () => ({
    nodes: [
      buildNode("ic-cron", "trigger.schedule", { cron: "0 9 * * 1-5", timezone: "Africa/Lagos" }),
      buildNode("ic-fetch", "action.httpRequest", {
        method: "GET",
        url: "https://api.example.com/v1/invoices?status=overdue",
        headers: [{ id: "ic-hdr", key: "Accept", value: "application/json" }],
      }),
      buildNode("ic-split", "logic.splitOut", { fieldToSplit: "data" }),
      buildNode(
        "ic-loop",
        "logic.loopOverItems",
        { batchSize: 1, activeBranch: "loop" },
        { label: "One invoice at a time" },
      ),
      buildNode("ic-summarise", "ai.summarizer", {
        content: "{{body}}",
        format: "bullets",
      }),
      buildNode("ic-delay", "action.delay", { seconds: 2 }),
      buildNode("ic-email", "action.gmail", {
        to: "{{customer.email}}",
        subject: "Friendly reminder: invoice {{reference}} is overdue",
        body: "{{summary}}",
      }),
      buildNode("ic-aggregate", "logic.aggregate", { outputField: "chasedInvoices" }),
      buildNode("ic-report", "data.googleSheets", {
        operation: "append",
        spreadsheet: "AR Ageing 2026",
        columns: [
          { id: "ic-c1", key: "Run", value: "{{totalItemsProcessed}}" },
          { id: "ic-c2", key: "Batches", value: "{{batchesRun}}" },
        ],
      }),
      buildNode("ic-note", "logic.stickyNote", {
        content: "The Loop node emits on two handles: `loop` per item, `done` once the batch finishes. Edge badges show how many items crossed.",
        color: "amber",
      }),
    ],
    edges: [
      buildEdge("ic-cron", "ic-fetch"),
      buildEdge("ic-fetch", "ic-split"),
      buildEdge("ic-split", "ic-loop"),
      buildEdge("ic-loop", "ic-summarise", "loop"),
      buildEdge("ic-summarise", "ic-delay"),
      buildEdge("ic-delay", "ic-email"),
      buildEdge("ic-loop", "ic-aggregate", "done"),
      buildEdge("ic-aggregate", "ic-report"),
    ],
  }),
};

/** Two agents: a researcher that delegates, and a writer that drafts. */
const multiAgentStudio: Template = {
  id: "multi-agent-content-studio",
  name: "Multi-agent content studio",
  description:
    "A researcher agent (Claude + web search + a nested Call Another Agent tool) hands a brief to a writer agent (GPT-4o + a sub-workflow tool). The draft is illustrated, approved by a human, then published to LinkedIn, X and Notion.",
  category: "Content",
  tags: ["ai", "agent", "content"],
  nodeCount: 14,
  build: () => ({
    nodes: [
      buildNode("ms-start", "trigger.manual", {
        payloadJson:
          '{\n  "topic": "Why pure-TypeScript execution engines keep visual builders testable",\n  "audience": "Staff engineers",\n  "channel": "linkedin"\n}',
      }),
      buildNode(
        "ms-researcher",
        "action.aiAgent",
        {
          goal: "Research {{topic}} for {{audience}}. Delegate factual gaps to the Researcher Agent tool, then return a source-backed brief.",
          systemPrompt:
            "You are a research lead. Every claim needs a source, and you delegate rather than guess.",
          maxSteps: 5,
        },
        { label: "Researcher agent" },
      ),
      buildNode("ms-model-claude", "aiModel.anthropic", {
        modelName: "claude-3-5-sonnet",
        temperature: 0.4,
      }),
      buildNode("ms-tool-search", "aiTool.webSearch", { maxResults: 5 }),
      buildNode("ms-tool-delegate", "aiTool.callAgent", {
        agentName: "Fact Checker Agent",
        specialtyPrompt:
          "Verify each headline claim against the primary source and flag anything unverifiable.",
      }),
      buildNode(
        "ms-writer",
        "action.aiAgent",
        {
          goal: "Turn the research brief in {{text}} into a 180-word post for {{audience}}.",
          systemPrompt: "You write tight, concrete prose. No hype, no hashtags.",
          maxSteps: 3,
        },
        { label: "Writer agent" },
      ),
      buildNode("ms-model-gpt", "aiModel.openai", { modelName: "gpt-4o-mini", temperature: 0.7 }),
      buildNode("ms-tool-workflow", "aiTool.callWorkflow", {
        workflowName: "Brand Voice Guardrails",
      }),
      buildNode("ms-image", "ai.imageGeneration", {
        prompt: "Editorial hero illustration about {{topic}}",
        aspectRatio: "16:9",
      }),
      buildNode("ms-approval", "logic.waitForApproval", {
        summary: "Publish this draft?\n\n{{text}}",
        approverRole: "Content Lead",
      }),
      buildNode("ms-linkedin", "action.linkedinCreatePost", { commentary: "{{text}}" }),
      buildNode("ms-x", "action.xPostTweet", { text: "{{text}}" }),
      buildNode("ms-notion", "data.notion", {
        operation: "createPage",
        database: "Content Calendar",
        title: "Draft: {{topic}}",
      }),
      buildNode("ms-note", "logic.stickyNote", {
        content: "Each agent keeps its own model, memory and tools — wires never cross. Nested delegation shows up as an indented trace in the console.",
        color: "ember",
      }),
    ],
    edges: [
      buildEdge("ms-start", "ms-researcher"),
      buildSubNodeEdge("ms-model-claude", "ms-researcher", "ai_model"),
      buildSubNodeEdge("ms-tool-search", "ms-researcher", "ai_tool"),
      buildSubNodeEdge("ms-tool-delegate", "ms-researcher", "ai_tool"),
      buildEdge("ms-researcher", "ms-writer"),
      buildSubNodeEdge("ms-model-gpt", "ms-writer", "ai_model"),
      buildSubNodeEdge("ms-tool-workflow", "ms-writer", "ai_tool"),
      buildEdge("ms-writer", "ms-image"),
      buildEdge("ms-image", "ms-approval"),
      buildEdge("ms-approval", "ms-linkedin"),
      buildEdge("ms-approval", "ms-x"),
      buildEdge("ms-approval", "ms-notion"),
    ],
  }),
};

/** Payments webhook → normalise → dedupe → filter → verify → branch. */
const paymentReconciliation: Template = {
  id: "payment-reconciliation",
  name: "Payment reconciliation",
  description:
    "A payments webhook is normalised by a Code node, de-duplicated on the provider reference, filtered to settled charges, verified against Paystack, then split: settled rows land in Supabase and Telegram pings the finance desk, while exceptions wait for human approval before hitting the ledger sheet.",
  category: "Finance",
  tags: ["fintech", "data", "logic"],
  nodeCount: 11,
  build: () => ({
    nodes: [
      buildNode("pr-hook", "trigger.webhook", {
        samplePayloadJson:
          '{\n  "event": "charge.success",\n  "reference": "PSK_sim_9948102",\n  "status": "settled",\n  "amount": 850,\n  "customer": { "email": "tola@lagosstore.ng" }\n}',
      }),
      buildNode("pr-normalise", "logic.code", {
        code: "// Normalise provider payloads into one ledger shape\nreturn {\n  ...$input,\n  provider: 'paystack',\n  settled: $input.status === 'settled',\n  amountMinor: Math.round(Number($input.amount || 0) * 100),\n};",
      }),
      buildNode("pr-dedupe", "logic.removeDuplicates", { dedupeKey: "reference" }),
      buildNode("pr-filter", "logic.filter", { field: "settled", equalsValue: "true" }),
      buildNode("pr-verify", "action.paystack", {
        operation: "verify",
        reference: "{{reference}}",
      }),
      buildNode("pr-branch", "action.condition", {
        left: "{{settled}}",
        operator: "equals",
        right: "true",
      }),
      buildNode("pr-supabase", "data.supabase", { table: "ledger_entries", operation: "upsert" }),
      buildNode("pr-telegram", "action.telegramSend", {
        chatId: "@flowforge_finance",
        text: "Settled {{amountMinor}} minor units on {{reference}} — reconciled.",
      }),
      buildNode("pr-approval", "logic.waitForApproval", {
        summary: "Exception on {{reference}} ({{amountMinor}} minor units) — post it anyway?",
        approverRole: "Finance Controller",
      }),
      buildNode("pr-ledger", "data.googleSheets", {
        operation: "append",
        spreadsheet: "Reconciliation Exceptions 2026",
        columns: [
          { id: "pr-c1", key: "Reference", value: "{{reference}}" },
          { id: "pr-c2", key: "Amount (minor)", value: "{{amountMinor}}" },
        ],
      }),
      buildNode("pr-note", "logic.stickyNote", {
        content: "Remove Duplicates keeps the first reference it sees; the Filter node is what stops unsettled charges from reaching the ledger.",
        color: "emerald",
      }),
    ],
    edges: [
      buildEdge("pr-hook", "pr-normalise"),
      buildEdge("pr-normalise", "pr-dedupe"),
      buildEdge("pr-dedupe", "pr-filter"),
      buildEdge("pr-filter", "pr-verify"),
      buildEdge("pr-verify", "pr-branch"),
      buildEdge("pr-branch", "pr-supabase", "true"),
      buildEdge("pr-branch", "pr-telegram", "true"),
      buildEdge("pr-branch", "pr-approval", "false"),
      buildEdge("pr-approval", "pr-ledger"),
    ],
  }),
};

/** CI/CD watchdog with an alert fan-out on the failure branch. */
const deployWatchdog: Template = {
  id: "deploy-watchdog",
  name: "Deploy watchdog",
  description:
    "A GitHub event is checked against the build service, and a condition routes it: green builds post to Slack and pass through a No-Op junction, while failed builds fan out to Discord, a Jira incident and a Trello follow-up card.",
  category: "DevOps",
  tags: ["devops", "alerts", "logic"],
  nodeCount: 9,
  build: () => ({
    nodes: [
      buildNode("dw-github", "trigger.githubEvent", {
        repository: "Nior122/workflow",
        eventType: "push",
      }),
      buildNode("dw-check", "action.httpRequest", {
        method: "GET",
        url: "https://ci.example.com/api/v1/builds/latest",
        headers: [{ id: "dw-hdr", key: "Accept", value: "application/json" }],
      }),
      buildNode("dw-branch", "action.condition", {
        left: "{{event}}",
        operator: "equals",
        right: "push",
        caseSensitive: false,
      }),
      buildNode("dw-slack", "action.slackSendMessage", {
        channel: "#deployments",
        message: "✅ Deploy from {{repository}} passed the watchdog.",
      }),
      buildNode("dw-junction", "logic.noOp", { note: "Single place to add the audit step later" }),
      buildNode("dw-discord", "action.discordSendMessage", {
        channel: "#incidents",
        content: "🚨 Failed deploy on {{repository}} ({{issue.title}}) — triage now.",
      }),
      buildNode("dw-jira", "action.jira", {
        operation: "createIssue",
        projectKey: "ENG",
        summary: "Deploy failure: {{issue.title}}",
      }),
      buildNode("dw-trello", "action.trello", {
        operation: "createCard",
        cardTitle: "Post-mortem: {{issue.title}}",
      }),
      buildNode("dw-note", "logic.stickyNote", {
        content: "No-Op nodes are free: they keep branch fan-in readable instead of drawing four edges into one node.",
        color: "stone",
      }),
    ],
    edges: [
      buildEdge("dw-github", "dw-check"),
      buildEdge("dw-check", "dw-branch"),
      buildEdge("dw-branch", "dw-slack", "true"),
      buildEdge("dw-slack", "dw-junction"),
      buildEdge("dw-branch", "dw-discord", "false"),
      buildEdge("dw-discord", "dw-jira"),
      buildEdge("dw-discord", "dw-trello"),
      buildEdge("dw-jira", "dw-junction"),
      buildEdge("dw-trello", "dw-junction"),
    ],
  }),
};

/** Form → extract → classify → Switch → ATS, calendar, CRM or rejection email. */
const recruitingPipeline: Template = {
  id: "recruiting-pipeline",
  name: "Recruiting triage pipeline",
  description:
    "A careers form submission is parsed into structured fields by an AI extractor, scored by a text classifier, then a Switch routes strong candidates to Airtable and a booked intro call, borderline ones into HubSpot plus an Asana task, and rejections through a human approval before the email goes out.",
  category: "People",
  tags: ["hr", "ai", "business"],
  nodeCount: 11,
  build: () => ({
    nodes: [
      buildNode("rt-form", "trigger.formSubmission", { formTitle: "Senior Engineer Application" }),
      buildNode("rt-extract", "ai.informationExtractor", {
        text: "{{fields.notes}}",
        schemaFields: "yearsExperience, primaryStack, currentCompany, noticePeriod",
      }),
      buildNode("rt-score", "ai.textClassifier", {
        inputText: "{{fields.notes}}",
        labels: "strong, borderline, reject",
      }),
      buildNode("rt-route", "logic.switch", {
        value: "{{category}}",
        case0: "strong",
        case1: "borderline",
        case2: "reject",
      }),
      buildNode("rt-airtable", "data.airtable", {
        operation: "create",
        baseName: "Hiring / Pipeline 2026",
      }),
      buildNode("rt-calendar", "action.googleCalendar", {
        operation: "createEvent",
        summary: "Intro call — {{fields.fullName}} ({{fields.email}})",
      }),
      buildNode("rt-hubspot", "action.hubspot", {
        operation: "createContact",
        email: "{{fields.email}}",
      }),
      buildNode("rt-asana", "action.asana", {
        operation: "createTask",
        taskName: "Review application: {{fields.fullName}}",
      }),
      buildNode("rt-approval", "logic.waitForApproval", {
        summary: "Send the rejection email to {{fields.fullName}}?",
        approverRole: "Talent Partner",
      }),
      buildNode("rt-email", "action.gmail", {
        to: "{{fields.email}}",
        subject: "Your application to FlowForge",
        body: "Thanks for applying, {{fields.fullName}} — we are not moving forward this time.",
      }),
      buildNode("rt-note", "logic.stickyNote", {
        content: "Score thresholds live in the Switch node, so recruiters can retune routing without touching a single connection.",
        color: "amber",
      }),
    ],
    edges: [
      buildEdge("rt-form", "rt-extract"),
      buildEdge("rt-extract", "rt-score"),
      buildEdge("rt-score", "rt-route"),
      buildEdge("rt-route", "rt-airtable", "case_0"),
      buildEdge("rt-route", "rt-calendar", "case_0"),
      buildEdge("rt-route", "rt-hubspot", "case_1"),
      buildEdge("rt-route", "rt-asana", "case_1"),
      buildEdge("rt-route", "rt-approval", "case_2"),
      buildEdge("rt-approval", "rt-email"),
    ],
  }),
};

export const SHOWCASE_TEMPLATES: readonly Template[] = [
  supportAgent,
  ragKnowledgeBase,
  orderFulfilment,
  invoiceChase,
  multiAgentStudio,
  paymentReconciliation,
  deployWatchdog,
  recruitingPipeline,
];

/** Unused-import guard for the graph type: templates build `BuiltGraph` values. */
export type ShowcaseGraph = BuiltGraph;
