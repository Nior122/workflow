/**
 * Built-in template gallery.
 *
 * Each template is a factory, not a constant, so instantiating one twice yields
 * independent node objects rather than shared references.
 */

import { buildEdge, buildNode, type BuiltGraph } from "@/lib/graph-builder";

export type Template = {
  id: string;
  name: string;
  description: string;
  /** Short label shown on the gallery card. */
  category: string;
  nodeCount: number;
  build: () => BuiltGraph;
};

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

export const TEMPLATES: readonly Template[] = [
  leadCapture,
  contentRepurposing,
  invoiceReminder,
  supportTriage,
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
