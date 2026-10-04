/**
 * Built-in template gallery.
 *
 * Each template is a factory, not a constant, so instantiating one twice yields
 * independent node objects rather than shared references.
 */

import { buildEdge, buildNode } from "@/lib/graph-builder";
import { SHOWCASE_TEMPLATES } from "./showcase";
import { sortTags, type Template } from "./types";

export { filterTemplates, sortTags, type Template } from "./types";

const LEAD_PAYLOAD = JSON.stringify(
  {
    lead: { name: "Grace Hopper", company: "Compilers Inc", email: "grace@example.com" },
    budget: 850,
    message: "We need help automating our monthly reporting.",
  },
  null,
  2,
);

/** a) Lead capture — webhook in, filter on budget, AI drafts a reply, email + Slack. */
const leadCapture: Template = {
  id: "lead-capture",
  name: "Lead capture",
  description:
    "A webhook receives a lead, a filter keeps only budgets over 500, an AI node drafts the reply, then it goes out by email and posts to Slack.",
  category: "Sales",
  tags: ["sales", "ai", "email"],
  nodeCount: 5,
  build: () => ({
    nodes: [
      buildNode("lead-webhook", "trigger.webhook", { samplePayloadJson: LEAD_PAYLOAD }),
      buildNode("lead-filter", "action.condition", {
        left: "{{budget}}",
        operator: "gt",
        right: "500",
      }),
      buildNode("lead-reply", "action.aiPrompt", {
        systemPrompt: "You write warm, concise B2B sales replies.",
        promptTemplate:
          "Write a reply to {{lead.name}} at {{lead.company}} about: {{message}}",
        model: "ff-pro",
        temperature: 0.6,
      }),
      buildNode("lead-email", "output.email", {
        to: "{{lead.email}}",
        subject: "Thanks for reaching out, {{lead.name}}",
        body: "{{text}}",
      }),
      buildNode("lead-slack", "output.slack", {
        channel: "#new-leads",
        message: "Hot lead: *{{lead.name}}* ({{lead.company}}) — budget {{budget}}",
      }),
    ],
    edges: [
      buildEdge("lead-webhook", "lead-filter"),
      buildEdge("lead-filter", "lead-reply", "true"),
      buildEdge("lead-reply", "lead-email"),
      buildEdge("lead-reply", "lead-slack"),
    ],
  }),
};

/** b) Content repurposing — manual start, AI draft, format, log. */
const contentRepurposing: Template = {
  id: "content-repurposing",
  name: "Content repurposing",
  description:
    "Start it yourself with a topic, let the AI draft a post, format it into a platform-ready string, and print the result to the console.",
  category: "Content",
  tags: ["content", "ai"],
  nodeCount: 4,
  build: () => ({
    nodes: [
      buildNode("cr-trigger", "trigger.manual", {
        payloadJson: JSON.stringify(
          { topic: "Why workflow diagrams beat status meetings", audience: "engineering leads" },
          null,
          2,
        ),
      }),
      buildNode("cr-draft", "action.aiPrompt", {
        systemPrompt: "You write punchy social posts for technical audiences.",
        promptTemplate:
          "Write a short post about {{topic}} for {{audience}}. No hashtags.",
        model: "ff-pro",
        temperature: 0.8,
      }),
      buildNode("cr-format", "action.textFormatter", {
        template: "📝 {{topic}}\n\n{{text}}\n\n— drafted for {{audience}}",
      }),
      buildNode("cr-log", "output.log", { label: "Ready to paste" }),
    ],
    edges: [
      buildEdge("cr-trigger", "cr-draft"),
      buildEdge("cr-draft", "cr-format"),
      buildEdge("cr-format", "cr-log"),
    ],
  }),
};

/** c) Invoice reminder — schedule, fetch overdue invoices, filter, email. */
const invoiceReminder: Template = {
  id: "invoice-reminder",
  name: "Invoice reminder",
  description:
    "A schedule fires, an HTTP node fetches overdue invoices from a mock API, a filter keeps the ones over 30 days, and an email goes out.",
  category: "Finance",
  tags: ["finance", "automation"],
  nodeCount: 4,
  build: () => ({
    nodes: [
      buildNode("inv-schedule", "trigger.schedule", {
        cron: "0 9 * * 1-5",
        timezone: "Africa/Lagos",
      }),
      buildNode("inv-fetch", "action.httpRequest", {
        method: "GET",
        url: "https://api.example.com/v1/invoices?status=overdue",
        headers: [{ id: "inv-hdr", key: "Accept", value: "application/json" }],
        bodyJson: "",
      }),
      buildNode("inv-filter", "action.condition", {
        left: "{{data.0.daysOverdue}}",
        operator: "gt",
        right: "30",
      }),
      buildNode("inv-email", "output.email", {
        to: "billing@example.com",
        subject: "Reminder: invoice {{data.0.id}} is {{data.0.daysOverdue}} days overdue",
        body: "Hi {{data.0.customer}},\n\nInvoice {{data.0.id}} for {{data.0.amount}} is now {{data.0.daysOverdue}} days overdue.\n\nPlease arrange payment at your earliest convenience.",
      }),
    ],
    edges: [
      buildEdge("inv-schedule", "inv-fetch"),
      buildEdge("inv-fetch", "inv-filter"),
      buildEdge("inv-filter", "inv-email", "true"),
    ],
  }),
};

/** d) Support triage — webhook, classify with AI, route by category. */
const supportTriage: Template = {
  id: "support-triage",
  name: "Support triage",
  description:
    "An inbound ticket is classified by the AI node, then routed: billing tickets go to Slack, everything else is logged to a sheet for review.",
  category: "Support",
  tags: ["support", "ai", "agent"],
  nodeCount: 5,
  build: () => ({
    nodes: [
      buildNode("st-webhook", "trigger.webhook", {
        samplePayloadJson: JSON.stringify(
          {
            ticket: { id: "TCK-4417", from: "ada@example.com", subject: "Double charged" },
            body: "I was charged twice for the same invoice this month.",
          },
          null,
          2,
        ),
      }),
      buildNode("st-classify", "action.aiPrompt", {
        systemPrompt: "You classify support tickets into exactly one category.",
        promptTemplate: "Classify this ticket into billing, technical, sales or account: {{body}}",
        model: "ff-mini",
        temperature: 0.2,
      }),
      buildNode("st-route", "action.condition", {
        left: "{{ai.classification}}",
        operator: "equals",
        right: "billing",
      }),
      buildNode("st-slack", "output.slack", {
        channel: "#billing-alerts",
        message: "Billing ticket {{ticket.id}} from {{ticket.from}}: {{ticket.subject}}",
      }),
      buildNode("st-sheet", "output.sheets", {
        spreadsheet: "Support triage",
        columns: [
          { id: "st-col-1", key: "Ticket", value: "{{ticket.id}}" },
          { id: "st-col-2", key: "Subject", value: "{{ticket.subject}}" },
          { id: "st-col-3", key: "Category", value: "{{ai.classification}}" },
        ],
      }),
    ],
    edges: [
      buildEdge("st-webhook", "st-classify"),
      buildEdge("st-classify", "st-route"),
      buildEdge("st-route", "st-slack", "true"),
      buildEdge("st-route", "st-sheet", "false"),
    ],
  }),
};

/** e) Incident response — webhook alert, severity filter, AI Agent diagnosis, Slack + log. */
const incidentResponse: Template = {
  id: "incident-response",
  name: "Incident response",
  description:
    "An alert webhook checks error-rate thresholds; high-error incidents trigger an AI Agent that consults runbooks and live metrics before paging Slack.",
  category: "DevOps",
  tags: ["devops", "alerts", "agent"],
  nodeCount: 5,
  build: () => ({
    nodes: [
      buildNode("inc-webhook", "trigger.webhook", {
        samplePayloadJson: JSON.stringify(
          {
            service: "checkout-api",
            region: "eu-west-1",
            errorRate: 14.2,
            symptom: "502 gateway timeouts spiking on payment confirmation",
          },
          null,
          2,
        ),
      }),
      buildNode("inc-filter", "action.condition", {
        left: "{{errorRate}}",
        operator: "gt",
        right: "5",
      }),
      buildNode("inc-agent", "action.aiAgent", {
        systemPrompt: "You are an on-call SRE incident commander.",
        goal: "Diagnose {{service}} in {{region}} ({{errorRate}}% errors: {{symptom}}) and propose a remediation plan.",
        model: "ff-pro",
        tools: ["kbLookup", "httpFetch", "calculator"],
        maxSteps: 4,
      }),
      buildNode("inc-slack", "output.slack", {
        channel: "#incidents",
        message: "🚨 *{{service}}* ({{region}}) — {{text}}",
      }),
      buildNode("inc-log", "output.log", { label: "Sub-threshold alert log" }),
    ],
    edges: [
      buildEdge("inc-webhook", "inc-filter"),
      buildEdge("inc-filter", "inc-agent", "true"),
      buildEdge("inc-agent", "inc-slack"),
      buildEdge("inc-filter", "inc-log", "false"),
    ],
  }),
};

/** f) Customer onboarding — manual start, enrich fields, short delay, AI welcome email. */
const customerOnboarding: Template = {
  id: "customer-onboarding",
  name: "Customer onboarding",
  description:
    "Maps a new signup into onboarding metadata, waits a beat, drafts a tailored welcome note with AI, and sends the onboarding email.",
  category: "Growth",
  tags: ["customer-success", "automation"],
  nodeCount: 5,
  build: () => ({
    nodes: [
      buildNode("ob-trigger", "trigger.manual", {
        payloadJson: JSON.stringify(
          {
            user: { name: "Katherine Johnson", email: "katherine@orbital.example", plan: "pro" },
            company: "Orbital Mechanics",
          },
          null,
          2,
        ),
      }),
      buildNode("ob-transform", "action.transform", {
        mode: "merge",
        fields: [
          { id: "ob-f1", key: "welcomeTrack", value: "{{user.plan}}-fast-start" },
          { id: "ob-f2", key: "csmEmail", value: "onboarding@flowforge.dev" },
        ],
      }),
      buildNode("ob-delay", "action.delay", { seconds: 1 }),
      buildNode("ob-draft", "action.aiPrompt", {
        systemPrompt: "You write warm, practical onboarding emails for engineering teams.",
        promptTemplate:
          "Welcome {{user.name}} at {{company}} to the {{welcomeTrack}} track and introduce {{csmEmail}}.",
        model: "ff-pro",
        temperature: 0.5,
      }),
      buildNode("ob-email", "output.email", {
        to: "{{user.email}}",
        subject: "Welcome to FlowForge, {{user.name}}",
        body: "{{text}}",
      }),
    ],
    edges: [
      buildEdge("ob-trigger", "ob-transform"),
      buildEdge("ob-transform", "ob-delay"),
      buildEdge("ob-delay", "ob-draft"),
      buildEdge("ob-draft", "ob-email"),
    ],
  }),
};

/** g) Daily standup digest — weekday cron, fetch activity via HTTP, format, post to Slack. */
const dailyStandupDigest: Template = {
  id: "daily-standup-digest",
  name: "Daily standup digest",
  description:
    "Fires every weekday morning, fetches the engineering activity summary from a mock API, formats a digest, and posts it to Slack.",
  category: "Ops",
  tags: ["ops", "schedule", "ai"],
  nodeCount: 4,
  build: () => ({
    nodes: [
      buildNode("ds-schedule", "trigger.schedule", {
        cron: "30 8 * * 1-5",
        timezone: "Africa/Lagos",
      }),
      buildNode("ds-fetch", "action.httpRequest", {
        method: "GET",
        url: "https://api.example.com/v1/standup?window=24h",
        headers: [{ id: "ds-hdr", key: "Accept", value: "application/json" }],
        bodyJson: "",
      }),
      buildNode("ds-format", "action.textFormatter", {
        template:
          "☀️ Standup digest — API status {{status}} (ref #{{data.id}}) from {{data.requestedUrl}}",
      }),
      buildNode("ds-slack", "output.slack", {
        channel: "#eng-standup",
        message: "{{text}}",
      }),
    ],
    edges: [
      buildEdge("ds-schedule", "ds-fetch"),
      buildEdge("ds-fetch", "ds-format"),
      buildEdge("ds-format", "ds-slack"),
    ],
  }),
};

/** h) Deal desk research — webhook quote request, AI Agent research, transform, fan out to Sheets + Email. */
const dealDeskResearch: Template = {
  id: "deal-desk-research",
  name: "Deal desk research",
  description:
    "An enterprise quote webhook runs an AI Agent across web search, calculator, and policy lookup, then logs the approval memo to Sheets and emails the rep.",
  category: "Sales",
  tags: ["sales", "ai", "agent"],
  nodeCount: 5,
  build: () => ({
    nodes: [
      buildNode("dd-webhook", "trigger.webhook", {
        samplePayloadJson: JSON.stringify(
          {
            deal: {
              account: "Acme Robotics",
              seats: 120,
              acv: 48000,
              rep: "maya@example.com",
            },
            notes: "Requesting custom SOC2 addendum and annual billing terms.",
          },
          null,
          2,
        ),
      }),
      buildNode("dd-agent", "action.aiAgent", {
        systemPrompt: "You are a deal-desk analyst reviewing enterprise quotes.",
        goal: "Evaluate {{deal.account}} ({{deal.seats}} seats, ${{deal.acv}} ACV): {{notes}}",
        model: "ff-pro",
        tools: ["webSearch", "calculator", "kbLookup"],
        maxSteps: 3,
      }),
      buildNode("dd-transform", "action.transform", {
        mode: "merge",
        fields: [
          {
            id: "dd-f1",
            key: "memo",
            value: "{{deal.account}} ({{deal.seats}} seats, ${{deal.acv}}): {{text}}",
          },
        ],
      }),
      buildNode("dd-sheet", "output.sheets", {
        spreadsheet: "Deal desk approvals",
        columns: [
          { id: "dd-col-1", key: "Account", value: "{{deal.account}}" },
          { id: "dd-col-2", key: "ACV", value: "{{deal.acv}}" },
          { id: "dd-col-3", key: "Memo", value: "{{memo}}" },
        ],
      }),
      buildNode("dd-email", "output.email", {
        to: "{{deal.rep}}",
        subject: "Deal desk review ready: {{deal.account}}",
        body: "{{memo}}",
      }),
    ],
    edges: [
      buildEdge("dd-webhook", "dd-agent"),
      buildEdge("dd-agent", "dd-transform"),
      buildEdge("dd-transform", "dd-sheet"),
      buildEdge("dd-transform", "dd-email"),
    ],
  }),
};

/** The eight original core templates, kept first so the gallery order stays stable. */
export const CORE_TEMPLATES: readonly Template[] = [
  leadCapture,
  contentRepurposing,
  invoiceReminder,
  supportTriage,
  incidentResponse,
  customerOnboarding,
  dailyStandupDigest,
  dealDeskResearch,
];

/** The complete gallery: core templates followed by the 144-node showcase set. */
export const TEMPLATES: readonly Template[] = [...CORE_TEMPLATES, ...SHOWCASE_TEMPLATES];

/** Every distinct tag in the gallery, alphabetically — drives the filter chips. */
export const TEMPLATE_TAGS: readonly string[] = sortTags(
  TEMPLATES.flatMap((template) => template.tags),
);

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
