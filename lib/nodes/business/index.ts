/**
 * Batch D — Business and Productivity Node Definitions (16 nodes).
 */

import type { JsonObject } from "@/types/json";
import type { ConfigFieldSchema, RegistryNodeDef } from "@/types/registry";
import { createSeededFaker } from "../faker-seed";
import { defaultCredentialIdFor } from "../credentials";
import { MAIN_IN, MAIN_OUT, defineRegistryNode } from "../helpers";

function makeBusinessAction(spec: {
  id: string;
  label: string;
  description: string;
  subcategory: string;
  keywords: string[];
  icon: string;
  accent: string;
  credentialProvider: string;
  operations: { value: string; label: string }[];
  extraSchema?: ConfigFieldSchema[];
  defaultConfig: JsonObject;
  sampleOutput: JsonObject;
  buildOutput: (
    input: JsonObject,
    config: JsonObject,
    resolve: (template: string) => string,
    faker: ReturnType<typeof createSeededFaker>,
  ) => JsonObject;
}): RegistryNodeDef {
  return defineRegistryNode({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    category: "business",
    subcategory: spec.subcategory,
    keywords: spec.keywords,
    icon: spec.icon,
    accent: spec.accent,
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 540,
    configSchema: [
      {
        key: "credentialId",
        label: "Connected account",
        type: "credential",
        credentialProvider: spec.credentialProvider,
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: spec.operations,
      },
      ...(spec.extraSchema ?? []),
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor(spec.credentialProvider),
      operation: spec.operations[0].value,
      ...spec.defaultConfig,
    },
    sampleOutput: spec.sampleOutput,
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const result = spec.buildOutput(input, config as JsonObject, ctx.resolveExpression, faker);
      const operation = String(config.operation || spec.operations[0].value);
      return {
        output: { ...input, ...result },
        logs: [`${spec.label} (${operation}) completed successfully.`],
        meta: { provider: spec.credentialProvider, operation },
      };
    },
  });
}

export const BUSINESS_NODES: readonly RegistryNodeDef[] = [
  // 65. Stripe (create customer, create invoice)
  makeBusinessAction({
    id: "action.stripe",
    label: "Stripe",
    description: "Creates a Stripe customer, generates an invoice, or creates a payment link.",
    subcategory: "Payments",
    keywords: ["stripe", "customer", "invoice", "payment", "billing", "subscription"],
    icon: "brand:stripe",
    accent: "#F59E0B",
    credentialProvider: "stripe",
    operations: [
      { value: "createCustomer", label: "Create Customer" },
      { value: "createInvoice", label: "Create Invoice" },
    ],
    extraSchema: [
      {
        key: "email",
        label: "Customer email",
        type: "expression",
        required: true,
        placeholder: "{{user.email}}",
      },
      {
        key: "amountCents",
        label: "Invoice amount (cents)",
        type: "number",
        min: 100,
      },
    ],
    defaultConfig: { email: "{{user.email}}", amountCents: 49000 },
    sampleOutput: {
      stripeCustomerId: "cus_Sim99481A",
      stripeInvoiceId: "in_Sim99481B",
      email: "ada@example.com",
      amountCents: 49000,
      status: "open",
    },
    buildOutput: (_input, config, resolve, faker) => ({
      stripeCustomerId: `cus_${faker.string.alphanumeric(10)}`,
      stripeInvoiceId: `in_${faker.string.alphanumeric(10)}`,
      email: resolve(String(config.email || "ada@example.com")) || "ada@example.com",
      amountCents: Number(config.amountCents ?? 49000),
      status: "open",
    }),
  }),

  // 66. Paystack (initialize transaction, verify)
  makeBusinessAction({
    id: "action.paystack",
    label: "Paystack",
    description: "Initializes a Paystack checkout transaction or verifies a payment reference.",
    subcategory: "Payments",
    keywords: ["paystack", "payment", "verify", "transaction", "ngn", "nigeria", "africa"],
    icon: "brand:paystack",
    accent: "#00C3F7",
    credentialProvider: "paystack",
    operations: [
      { value: "verify", label: "Verify Transaction" },
      { value: "initialize", label: "Initialize Transaction" },
    ],
    extraSchema: [
      {
        key: "reference",
        label: "Transaction reference",
        type: "expression",
        required: true,
        placeholder: "{{paymentReference}}",
      },
    ],
    defaultConfig: { reference: "{{paymentReference}}" },
    sampleOutput: {
      paystackVerified: true,
      reference: "PSK_ORD_4821",
      gatewayResponse: "Successful",
      amountNgn: 185000,
    },
    buildOutput: (_input, config, resolve, faker) => ({
      paystackVerified: true,
      reference:
        resolve(String(config.reference || "")) ||
        `PSK_${faker.string.alphanumeric(8).toUpperCase()}`,
      gatewayResponse: "Successful",
      amountNgn: 185000,
    }),
  }),

  // 67. Flutterwave
  makeBusinessAction({
    id: "action.flutterwave",
    label: "Flutterwave",
    description: "Verifies a Flutterwave payment or initiates a bank transfer payout.",
    subcategory: "Payments",
    keywords: ["flutterwave", "payment", "transfer", "payout", "africa"],
    icon: "brand:flutterwave",
    accent: "#FB9129",
    credentialProvider: "flutterwave",
    operations: [
      { value: "verifyPayment", label: "Verify Payment" },
      { value: "createTransfer", label: "Create Payout Transfer" },
    ],
    extraSchema: [
      {
        key: "txRef",
        label: "Transaction reference",
        type: "expression",
        required: true,
        placeholder: "{{txRef}}",
      },
    ],
    defaultConfig: { txRef: "FLW-TX-489120" },
    sampleOutput: {
      flwStatus: "successful",
      txRef: "FLW-TX-489120",
      chargedAmount: 120,
    },
    buildOutput: (_input, config, resolve) => ({
      flwStatus: "successful",
      txRef: resolve(String(config.txRef || "FLW-TX-489120")) || "FLW-TX-489120",
      chargedAmount: 120,
    }),
  }),

  // 68. Shopify (update order, create product)
  makeBusinessAction({
    id: "action.shopify",
    label: "Shopify",
    description: "Updates an order's fulfillment/tags or creates a product in Shopify.",
    subcategory: "Commerce",
    keywords: ["shopify", "order", "product", "fulfillment", "ecommerce", "store"],
    icon: "brand:shopify",
    accent: "#95BF47",
    credentialProvider: "shopify",
    operations: [
      { value: "updateOrder", label: "Update Order" },
      { value: "createProduct", label: "Create Product" },
    ],
    extraSchema: [
      {
        key: "orderId",
        label: "Order ID / Product title",
        type: "expression",
        required: true,
        placeholder: "{{orderId}}",
      },
    ],
    defaultConfig: { orderId: "{{orderId}}" },
    sampleOutput: {
      shopifyOrderId: "ORD-4821",
      fulfillmentStatus: "fulfilled",
      tags: ["verified", "flowforge"],
    },
    buildOutput: (_input, config, resolve) => ({
      shopifyOrderId: resolve(String(config.orderId || "ORD-4821")) || "ORD-4821",
      fulfillmentStatus: "fulfilled",
      tags: ["verified", "flowforge"],
    }),
  }),

  // 69. WooCommerce
  makeBusinessAction({
    id: "action.woocommerce",
    label: "WooCommerce",
    description: "Updates a WooCommerce order status or syncs product stock levels.",
    subcategory: "Commerce",
    keywords: ["woocommerce", "wordpress", "order", "stock", "ecommerce"],
    icon: "brand:woocommerce",
    accent: "#D97706",
    credentialProvider: "woocommerce",
    operations: [
      { value: "updateOrderStatus", label: "Update Order Status" },
      { value: "updateStock", label: "Update Stock Quantity" },
    ],
    extraSchema: [
      {
        key: "status",
        label: "Target order status",
        type: "select",
        options: [
          { value: "completed", label: "completed" },
          { value: "processing", label: "processing" },
          { value: "on-hold", label: "on-hold" },
        ],
      },
    ],
    defaultConfig: { status: "completed" },
    sampleOutput: {
      wooOrderId: 9042,
      wooStatus: "completed",
    },
    buildOutput: (_input, config) => ({
      wooOrderId: 9042,
      wooStatus: String(config.status || "completed"),
    }),
  }),

  // 70. HubSpot (create contact, create deal)
  makeBusinessAction({
    id: "action.hubspot",
    label: "HubSpot",
    description: "Creates or updates a Contact or Deal in HubSpot CRM.",
    subcategory: "CRM",
    keywords: ["hubspot", "crm", "contact", "deal", "sales", "pipeline"],
    icon: "brand:hubspot",
    accent: "#FF7A59",
    credentialProvider: "hubspot",
    operations: [
      { value: "createContact", label: "Create / Upsert Contact" },
      { value: "createDeal", label: "Create Deal" },
    ],
    extraSchema: [
      {
        key: "email",
        label: "Contact email / Deal name",
        type: "expression",
        required: true,
        placeholder: "{{lead.email}}",
      },
    ],
    defaultConfig: { email: "{{lead.email}}" },
    sampleOutput: {
      hubspotId: "hs_obj_99412",
      lifecycleStage: "salesqualifiedlead",
    },
    buildOutput: (_input, config, resolve, faker) => ({
      hubspotId: `hs_obj_${faker.string.numeric(6)}`,
      contactOrDeal: resolve(String(config.email || "lead@example.com")),
      lifecycleStage: "salesqualifiedlead",
    }),
  }),

  // 71. Salesforce
  makeBusinessAction({
    id: "action.salesforce",
    label: "Salesforce",
    description: "Creates a Lead, Opportunity, or Case record in Salesforce.",
    subcategory: "CRM",
    keywords: ["salesforce", "sfdc", "crm", "lead", "opportunity", "case"],
    icon: "brand:salesforce",
    accent: "#00A1E0",
    credentialProvider: "salesforce",
    operations: [
      { value: "createLead", label: "Create Lead" },
      { value: "createOpportunity", label: "Create Opportunity" },
    ],
    extraSchema: [
      {
        key: "company",
        label: "Company / Account",
        type: "expression",
        required: true,
        placeholder: "{{lead.company}}",
      },
    ],
    defaultConfig: { company: "Acme Corp" },
    sampleOutput: {
      sfdcId: "00Q8d00000Sim99EAA",
      success: true,
    },
    buildOutput: (_input, config, resolve, faker) => ({
      sfdcId: `00Q8d00000${faker.string.alphanumeric(8)}`,
      company: resolve(String(config.company || "Acme Corp")),
      success: true,
    }),
  }),

  // 72. Trello (create card)
  makeBusinessAction({
    id: "action.trello",
    label: "Trello",
    description: "Creates or moves a card on a Trello board list.",
    subcategory: "Project Mgmt",
    keywords: ["trello", "board", "card", "kanban", "list", "task"],
    icon: "brand:trello",
    accent: "#0079BF",
    credentialProvider: "trello",
    operations: [
      { value: "createCard", label: "Create Card" },
      { value: "moveCard", label: "Move Card" },
    ],
    extraSchema: [
      {
        key: "cardTitle",
        label: "Card title",
        type: "expression",
        required: true,
        placeholder: "Follow up with {{user.name}}",
      },
    ],
    defaultConfig: { cardTitle: "Follow up: {{text}}" },
    sampleOutput: {
      trelloCardId: "trl_88412",
      shortUrl: "https://trello.com/c/sim88412",
    },
    buildOutput: (_input, config, resolve, faker) => {
      const id = faker.string.alphanumeric(8);
      return {
        trelloCardId: `trl_${id}`,
        cardTitle: resolve(String(config.cardTitle || "Task")),
        shortUrl: `https://trello.com/c/${id}`,
      };
    },
  }),

  // 73. Asana
  makeBusinessAction({
    id: "action.asana",
    label: "Asana",
    description: "Creates a task with assignee and due date in an Asana project.",
    subcategory: "Project Mgmt",
    keywords: ["asana", "task", "project", "roadmap", "todo"],
    icon: "brand:asana",
    accent: "#F06A6A",
    credentialProvider: "asana",
    operations: [
      { value: "createTask", label: "Create Task" },
      { value: "completeTask", label: "Complete Task" },
    ],
    extraSchema: [
      {
        key: "taskName",
        label: "Task name",
        type: "expression",
        required: true,
        placeholder: "Ship onboarding flow for {{user.name}}",
      },
    ],
    defaultConfig: { taskName: "Action item: {{text}}" },
    sampleOutput: {
      asanaGid: "1209481029481",
      taskName: "Action item: Review onboarding",
    },
    buildOutput: (_input, config, resolve, faker) => ({
      asanaGid: faker.string.numeric(13),
      taskName: resolve(String(config.taskName || "Action item")),
    }),
  }),

  // 74. Jira
  makeBusinessAction({
    id: "action.jira",
    label: "Jira",
    description: "Creates an issue, bug, or story in Jira Cloud and transitions its status.",
    subcategory: "Project Mgmt",
    keywords: ["jira", "atlassian", "issue", "bug", "ticket", "sprint"],
    icon: "brand:jira",
    accent: "#2684FF",
    credentialProvider: "jira",
    operations: [
      { value: "createIssue", label: "Create Issue" },
      { value: "transitionIssue", label: "Transition Issue" },
    ],
    extraSchema: [
      {
        key: "projectKey",
        label: "Project key",
        type: "text",
        required: true,
        placeholder: "ENG",
      },
      {
        key: "summary",
        label: "Issue summary",
        type: "expression",
        required: true,
        placeholder: "Investigate {{service}} alert",
      },
    ],
    defaultConfig: { projectKey: "ENG", summary: "Track: {{text}}" },
    sampleOutput: {
      jiraKey: "ENG-409",
      issueUrl: "https://flowforge.atlassian.net/browse/ENG-409",
    },
    buildOutput: (_input, config, resolve, faker) => {
      const key = `${String(config.projectKey || "ENG")}-${faker.number.int({ min: 100, max: 999 })}`;
      return {
        jiraKey: key,
        summary: resolve(String(config.summary || "Issue")),
        issueUrl: `https://flowforge.atlassian.net/browse/${key}`,
      };
    },
  }),

  // 75. ClickUp
  makeBusinessAction({
    id: "action.clickup",
    label: "ClickUp",
    description: "Creates or updates a task inside a ClickUp Space List.",
    subcategory: "Project Mgmt",
    keywords: ["clickup", "task", "list", "sprint", "project"],
    icon: "brand:clickup",
    accent: "#F59E0B",
    credentialProvider: "clickup",
    operations: [
      { value: "createTask", label: "Create Task" },
      { value: "updateTask", label: "Update Task" },
    ],
    extraSchema: [
      {
        key: "name",
        label: "Task name",
        type: "expression",
        required: true,
        placeholder: "Review {{text}}",
      },
    ],
    defaultConfig: { name: "Review {{text}}" },
    sampleOutput: {
      clickupTaskId: "cu_86b19a2",
      status: "to do",
    },
    buildOutput: (_input, config, resolve, faker) => ({
      clickupTaskId: `cu_${faker.string.alphanumeric(7)}`,
      name: resolve(String(config.name || "Task")),
      status: "to do",
    }),
  }),

  // 76. Google Calendar (create event)
  makeBusinessAction({
    id: "action.googleCalendar",
    label: "Google Calendar",
    description: "Creates a calendar event with Google Meet link and invites attendees.",
    subcategory: "Scheduling",
    keywords: ["google", "calendar", "event", "meeting", "schedule", "invite"],
    icon: "brand:googlecalendar",
    accent: "#4285F4",
    credentialProvider: "google",
    operations: [
      { value: "createEvent", label: "Create Event" },
      { value: "checkAvailability", label: "Check Free/Busy" },
    ],
    extraSchema: [
      {
        key: "summary",
        label: "Event title",
        type: "expression",
        required: true,
        placeholder: "Customer Call — {{user.name}}",
      },
    ],
    defaultConfig: { summary: "Follow-up Call" },
    sampleOutput: {
      calendarEventId: "gcal_99412",
      hangoutLink: "https://meet.google.com/sim-call-now",
      status: "confirmed",
    },
    buildOutput: (_input, config, resolve, faker) => ({
      calendarEventId: `gcal_${faker.string.alphanumeric(8)}`,
      summary: resolve(String(config.summary || "Follow-up Call")),
      hangoutLink: "https://meet.google.com/sim-call-now",
      status: "confirmed",
    }),
  }),

  // 77. Calendly
  makeBusinessAction({
    id: "action.calendly",
    label: "Calendly",
    description: "Generates a single-use scheduling link or retrieves booking details.",
    subcategory: "Scheduling",
    keywords: ["calendly", "booking", "link", "scheduling", "meeting"],
    icon: "brand:calendly",
    accent: "#006BFF",
    credentialProvider: "calendly",
    operations: [
      { value: "createSchedulingLink", label: "Create Single-Use Link" },
      { value: "cancelEvent", label: "Cancel Event" },
    ],
    extraSchema: [
      {
        key: "eventTypeSlug",
        label: "Event type slug",
        type: "text",
        required: true,
        placeholder: "30min-demo",
      },
    ],
    defaultConfig: { eventTypeSlug: "30min-demo" },
    sampleOutput: {
      bookingUrl: "https://calendly.com/d/sim-882/30min-demo",
    },
    buildOutput: (_input, config, _resolve, faker) => ({
      bookingUrl: `https://calendly.com/d/sim-${faker.string.alphanumeric(5)}/${String(config.eventTypeSlug || "30min-demo")}`,
    }),
  }),

  // 78. Zoom (create meeting)
  makeBusinessAction({
    id: "action.zoom",
    label: "Zoom",
    description: "Creates an instant or scheduled Zoom video meeting and returns the join URL.",
    subcategory: "Video",
    keywords: ["zoom", "video", "meeting", "webinar", "call"],
    icon: "brand:zoom",
    accent: "#2D8CFF",
    credentialProvider: "zoom",
    operations: [
      { value: "createMeeting", label: "Create Meeting" },
      { value: "addRegistrant", label: "Add Webinar Registrant" },
    ],
    extraSchema: [
      {
        key: "topic",
        label: "Meeting topic",
        type: "expression",
        required: true,
        placeholder: "Onboarding Session",
      },
    ],
    defaultConfig: { topic: "Onboarding Session" },
    sampleOutput: {
      zoomMeetingId: 89410294812,
      joinUrl: "https://zoom.us/j/89410294812",
      passcode: "ff2026",
    },
    buildOutput: (_input, config, resolve, faker) => {
      const id = faker.number.int({ min: 80000000000, max: 89999999999 });
      return {
        zoomMeetingId: id,
        topic: resolve(String(config.topic || "Onboarding Session")),
        joinUrl: `https://zoom.us/j/${id}`,
        passcode: "ff2026",
      };
    },
  }),

  // 79. Google Docs
  makeBusinessAction({
    id: "action.googleDocs",
    label: "Google Docs",
    description: "Creates a new Google Doc or appends formatted text to an existing document.",
    subcategory: "Documents",
    keywords: ["google", "docs", "document", "report", "write", "append"],
    icon: "brand:googledocs",
    accent: "#4285F4",
    credentialProvider: "google",
    operations: [
      { value: "createDoc", label: "Create Document" },
      { value: "appendText", label: "Append Text" },
    ],
    extraSchema: [
      {
        key: "title",
        label: "Document title",
        type: "expression",
        required: true,
        placeholder: "Briefing — {{run.workflowName}}",
      },
    ],
    defaultConfig: { title: "Generated Briefing" },
    sampleOutput: {
      documentId: "1DocSim994812A",
      documentUrl: "https://docs.google.com/document/d/1DocSim994812A/edit",
    },
    buildOutput: (_input, config, resolve, faker) => {
      const docId = `1DocSim${faker.string.alphanumeric(8)}`;
      return {
        documentId: docId,
        title: resolve(String(config.title || "Generated Briefing")),
        documentUrl: `https://docs.google.com/document/d/${docId}/edit`,
      };
    },
  }),

  // 80. Typeform
  makeBusinessAction({
    id: "action.typeform",
    label: "Typeform",
    description: "Fetches form responses or updates webhook settings on a Typeform survey.",
    subcategory: "Forms",
    keywords: ["typeform", "survey", "form", "responses", "questionnaire"],
    icon: "brand:typeform",
    accent: "#A8A29E",
    credentialProvider: "typeform",
    operations: [
      { value: "listResponses", label: "List Form Responses" },
      { value: "getForm", label: "Get Form Definition" },
    ],
    extraSchema: [
      {
        key: "formId",
        label: "Form ID",
        type: "text",
        required: true,
        placeholder: "tf_nps_2026",
      },
    ],
    defaultConfig: { formId: "tf_nps_2026" },
    sampleOutput: {
      formId: "tf_nps_2026",
      totalItems: 3,
      averageNps: 9.4,
    },
    buildOutput: (_input, config) => ({
      formId: String(config.formId || "tf_nps_2026"),
      totalItems: 3,
      averageNps: 9.4,
    }),
  }),
];
