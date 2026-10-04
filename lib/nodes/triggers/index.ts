/**
 * Batch A — Trigger Node Definitions (33 nodes).
 *
 * Every trigger has `inputs: []` and `outputs: MAIN_OUT`.
 * Includes the 3 foundational triggers (`trigger.manual`, `trigger.webhook`,
 * `trigger.schedule`) with 100% backwards-compatible configs and validators, plus
 * 30 platform triggers using `@faker-js/faker` for realistic simulated payloads.
 */

import { parseJsonObject, type JsonObject } from "@/types/json";
import type { ConfigFieldSchema, RegistryNodeDef } from "@/types/registry";
import type { ConfigIssue } from "@/types/validation";
import { createSeededFaker } from "../faker-seed";
import { defaultCredentialIdFor } from "../credentials";
import { MAIN_OUT, defineRegistryNode } from "../helpers";

const DEFAULT_MANUAL_PAYLOAD = JSON.stringify(
  {
    user: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      plan: "pro",
    },
    budget: 1200,
    source: "landing-page",
  },
  null,
  2,
);

const DEFAULT_WEBHOOK_PAYLOAD = JSON.stringify(
  {
    event: "lead.created",
    lead: {
      name: "Grace Hopper",
      company: "Compilers Inc",
      email: "grace@example.com",
    },
    budget: 850,
    message: "We need help automating our monthly reporting.",
  },
  null,
  2,
);

function validateJsonField(raw: unknown, field: string, label: string): ConfigIssue[] {
  const str = typeof raw === "string" ? raw : "";
  const parsed = parseJsonObject(str);
  if (!parsed.ok) {
    return [
      {
        code: "invalid-json",
        level: "error",
        message: `${label}: ${parsed.error}`,
        field,
      },
    ];
  }
  return [];
}

const CRON_FIELD = /^(\*|\d+(-\d+)?(,\d+(-\d+)?)*)(\/\d+)?$/;

function looksLikeCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  return parts.length === 5 && parts.every((part) => CRON_FIELD.test(part));
}

export const manualTriggerNode = defineRegistryNode({
  id: "trigger.manual",
  label: "Manual Trigger",
  description: "Starts the flow when you press Run, emitting an editable JSON payload.",
  category: "trigger",
  subcategory: "Core",
  keywords: ["manual", "start", "run", "button", "json", "test"],
  icon: "lucide:Play",
  accent: "#F5B301",
  type: "trigger",
  inputs: [],
  outputs: MAIN_OUT,
  latencyMs: 320,
  configSchema: [
    {
      key: "payloadJson",
      label: "Sample payload (JSON)",
      type: "json",
      hint: "JSON object",
      placeholder: '{\n  "user": { "name": "Ada" }\n}',
    },
  ],
  defaultConfig: { payloadJson: DEFAULT_MANUAL_PAYLOAD },
  sampleOutput: {
    user: { name: "Ada Lovelace", email: "ada@example.com", plan: "pro" },
    budget: 1200,
    source: "landing-page",
  },
  validateConfig: (config) =>
    validateJsonField(config.payloadJson, "config.payloadJson", "Sample payload"),
  simulate: async (_input, config) => {
    const parsed = parseJsonObject(String(config.payloadJson ?? ""));
    return {
      output: parsed.ok ? parsed.value : {},
      logs: ["Manual trigger emitted sample JSON payload."],
      meta: { trigger: "manual" },
    };
  },
});

export const webhookTriggerNode = defineRegistryNode({
  id: "trigger.webhook",
  label: "Webhook",
  description: "Simulates an inbound HTTP POST with the sample JSON body.",
  category: "trigger",
  subcategory: "Core",
  keywords: ["webhook", "http", "post", "endpoint", "callback", "api"],
  icon: "lucide:Webhook",
  accent: "#E0913D",
  type: "trigger",
  inputs: [],
  outputs: MAIN_OUT,
  latencyMs: 360,
  configSchema: [
    {
      key: "samplePayloadJson",
      label: "Sample webhook body",
      type: "json",
      hint: "JSON object",
      placeholder: '{\n  "event": "lead.created"\n}',
    },
  ],
  defaultConfig: { samplePayloadJson: DEFAULT_WEBHOOK_PAYLOAD },
  sampleOutput: {
    event: "lead.created",
    lead: { name: "Grace Hopper", company: "Compilers Inc", email: "grace@example.com" },
    budget: 850,
    message: "We need help automating our monthly reporting.",
  },
  validateConfig: (config) =>
    validateJsonField(
      config.samplePayloadJson,
      "config.samplePayloadJson",
      "Webhook payload",
    ),
  simulate: async (_input, config, ctx) => {
    const parsed = parseJsonObject(String(config.samplePayloadJson ?? ""));
    return {
      output: parsed.ok ? parsed.value : {},
      logs: [`Inbound POST /hooks/${ctx.nodeId} accepted (200 OK).`],
      meta: {
        trigger: "webhook",
        endpoint: `https://hooks.flowforge.dev/in/${ctx.nodeId}`,
        method: "POST",
      },
    };
  },
});

export const scheduleTriggerNode = defineRegistryNode({
  id: "trigger.schedule",
  label: "Schedule (Cron)",
  description: "Fires on a cron schedule. In simulation it fires once when you press Run.",
  category: "trigger",
  subcategory: "Core",
  keywords: ["schedule", "cron", "timer", "interval", "recurring", "daily"],
  icon: "lucide:CalendarClock",
  accent: "#C9A227",
  type: "trigger",
  inputs: [],
  outputs: MAIN_OUT,
  latencyMs: 300,
  configSchema: [
    {
      key: "cron",
      label: "Cron expression",
      type: "text",
      required: true,
      hint: "min hr day mon dow",
      placeholder: "0 9 * * 1-5",
    },
    {
      key: "timezone",
      label: "Timezone",
      type: "select",
      options: [
        { value: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
        { value: "UTC", label: "UTC" },
        { value: "Europe/London", label: "Europe/London" },
        { value: "America/New_York", label: "America/New_York" },
        { value: "Asia/Tokyo", label: "Asia/Tokyo" },
      ],
    },
  ],
  defaultConfig: {
    cron: "0 9 * * 1-5",
    timezone: "Africa/Lagos",
  },
  sampleOutput: {
    scheduledAt: "2026-10-04T09:00:00.000Z",
    cron: "0 9 * * 1-5",
    timezone: "Africa/Lagos",
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const cron = String(config.cron ?? "");
    const timezone = String(config.timezone ?? "");
    if (!cron.trim()) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "Cron expression is required.",
        field: "config.cron",
      });
    } else if (!looksLikeCron(cron)) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: 'Cron expression must have 5 space-separated fields (e.g. "0 9 * * 1-5").',
        field: "config.cron",
      });
    }
    if (!timezone.trim()) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "Timezone is required.",
        field: "config.timezone",
      });
    }
    return issues;
  },
  simulate: async (_input, config, ctx) => ({
    output: {
      scheduledAt: new Date(ctx.now()).toISOString(),
      cron: String(config.cron ?? "0 9 * * 1-5"),
      timezone: String(config.timezone ?? "UTC"),
    },
    logs: [`Cron "${String(config.cron)}" fired in ${String(config.timezone)}.`],
    meta: {
      trigger: "schedule",
      cron: String(config.cron ?? ""),
      timezone: String(config.timezone ?? ""),
    },
  }),
});

/** Helper to define realistic platform triggers concisely without duplicate boilerplate. */
function makePlatformTrigger(spec: {
  id: string;
  label: string;
  description: string;
  subcategory: string;
  keywords: string[];
  icon: string;
  accent?: string;
  credentialProvider?: string;
  extraSchema?: ConfigFieldSchema[];
  defaultConfig: JsonObject;
  sampleOutput: JsonObject;
  buildOutput: (
    config: JsonObject,
    faker: ReturnType<typeof createSeededFaker>,
    nowIso: string,
  ) => JsonObject;
}): RegistryNodeDef {
  const schema: ConfigFieldSchema[] = [
    ...(spec.credentialProvider
      ? [
          {
            key: "credentialId",
            label: "Connected account",
            type: "credential" as const,
            credentialProvider: spec.credentialProvider,
          },
        ]
      : []),
    ...(spec.extraSchema ?? []),
  ];

  const defaultConfig: JsonObject = {
    ...(spec.credentialProvider
      ? { credentialId: defaultCredentialIdFor(spec.credentialProvider) }
      : {}),
    ...spec.defaultConfig,
  };

  return defineRegistryNode({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    category: "trigger",
    subcategory: spec.subcategory,
    keywords: spec.keywords,
    icon: spec.icon,
    accent: spec.accent ?? "#E59934",
    type: "trigger",
    inputs: [],
    outputs: MAIN_OUT,
    latencyMs: 360,
    configSchema: schema,
    defaultConfig,
    sampleOutput: spec.sampleOutput,
    simulate: async (_input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const nowIso = new Date(ctx.now()).toISOString();
      const output = spec.buildOutput(config as JsonObject, faker, nowIso);
      return {
        output,
        logs: [`${spec.label} triggered at ${nowIso}.`],
        meta: { trigger: spec.id, receivedAt: nowIso },
      };
    },
  });
}

export const TRIGGER_NODES: readonly RegistryNodeDef[] = [
  manualTriggerNode,
  webhookTriggerNode,
  scheduleTriggerNode,

  // 4. Chat Message
  makePlatformTrigger({
    id: "trigger.chatMessage",
    label: "Chat Message",
    description: "Starts the workflow from an embedded chat prompt or conversational widget.",
    subcategory: "Core",
    keywords: ["chat", "message", "conversation", "prompt", "widget", "bot"],
    icon: "lucide:MessageCircle",
    accent: "#F5B301",
    extraSchema: [
      {
        key: "sampleMessage",
        label: "Simulated user message",
        type: "textarea",
        required: true,
        placeholder: "Can you check my order #ORD-4821 and book a follow-up call?",
      },
      {
        key: "sessionId",
        label: "Session ID",
        type: "text",
        required: true,
        placeholder: "sess-demo-01",
      },
    ],
    defaultConfig: {
      sampleMessage: "Can you check my order #ORD-4821 and schedule a callback for tomorrow?",
      sessionId: "sess-demo-01",
    },
    sampleOutput: {
      chatInput: "Can you check my order #ORD-4821 and schedule a callback for tomorrow?",
      sessionId: "sess-demo-01",
      sender: { name: "Amara Okafor", email: "amara@example.com" },
      timestamp: "2026-10-04T09:00:00.000Z",
    },
    buildOutput: (config, faker, nowIso) => ({
      chatInput: String(config.sampleMessage || "Hello, I need help with my account."),
      message: String(config.sampleMessage || "Hello, I need help with my account."),
      sessionId: String(config.sessionId || "sess-demo-01"),
      sender: {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
      },
      timestamp: nowIso,
    }),
  }),

  // 5. Form Submission
  makePlatformTrigger({
    id: "trigger.formSubmission",
    label: "Form Submission",
    description: "Fires when a visitor submits a hosted web form.",
    subcategory: "Core",
    keywords: ["form", "submission", "lead", "survey", "intake", "webform"],
    icon: "lucide:FileSpreadsheet",
    extraSchema: [
      {
        key: "formTitle",
        label: "Form name",
        type: "text",
        required: true,
        placeholder: "Enterprise Demo Request",
      },
    ],
    defaultConfig: { formTitle: "Enterprise Demo Request" },
    sampleOutput: {
      formTitle: "Enterprise Demo Request",
      submissionId: "sub_99412",
      fields: {
        fullName: "Chidi Nwosu",
        email: "chidi@fintech.ng",
        companySize: "50-200",
        notes: "Looking to automate reconciliation workflows.",
      },
    },
    buildOutput: (config, faker, nowIso) => ({
      formTitle: String(config.formTitle || "Enterprise Demo Request"),
      submissionId: `sub_${faker.string.alphanumeric(8)}`,
      submittedAt: nowIso,
      fields: {
        fullName: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        company: faker.company.name(),
        companySize: "50-200",
        notes: "Looking to automate our operations and customer support.",
      },
    }),
  }),

  // 6. WhatsApp Message Received
  makePlatformTrigger({
    id: "trigger.whatsappMessage",
    label: "WhatsApp Message Received",
    description: "Triggers when a new inbound WhatsApp Business message arrives.",
    subcategory: "Messaging",
    keywords: ["whatsapp", "wa", "chat", "inbound", "message", "meta", "phone"],
    icon: "brand:whatsapp",
    accent: "#25D366",
    credentialProvider: "whatsapp",
    extraSchema: [
      {
        key: "sampleText",
        label: "Simulated WhatsApp message",
        type: "textarea",
        required: true,
        placeholder: "Hi! Where is my order #ORD-9021? Can we book a delivery slot?",
      },
      {
        key: "fromPhone",
        label: "Sender phone",
        type: "text",
        required: true,
        placeholder: "+2348031234567",
      },
    ],
    defaultConfig: {
      sampleText: "Hi! Where is my order #ORD-9021? Can we book a delivery slot for Tuesday?",
      fromPhone: "+2348031234567",
    },
    sampleOutput: {
      messageId: "wamid.HBgNMjM0ODAzMTIzNDU2Nw",
      from: "+2348031234567",
      profileName: "Tunde Bakare",
      text: "Hi! Where is my order #ORD-9021? Can we book a delivery slot for Tuesday?",
      timestamp: "2026-10-04T09:00:00.000Z",
    },
    buildOutput: (config, faker, nowIso) => ({
      messageId: `wamid.${faker.string.alphanumeric(18)}`,
      from: String(config.fromPhone || "+2348031234567"),
      profileName: faker.person.fullName(),
      text: String(config.sampleText || "Hello, I need support."),
      message: String(config.sampleText || "Hello, I need support."),
      timestamp: nowIso,
    }),
  }),

  // 7. Telegram Message Received
  makePlatformTrigger({
    id: "trigger.telegramMessage",
    label: "Telegram Message Received",
    description: "Fires when your Telegram Bot receives a message or slash command.",
    subcategory: "Messaging",
    keywords: ["telegram", "bot", "message", "chat", "command"],
    icon: "brand:telegram",
    accent: "#38BDF8",
    credentialProvider: "telegram",
    extraSchema: [
      {
        key: "sampleText",
        label: "Simulated message / command",
        type: "text",
        required: true,
        placeholder: "/research Compare cloud GPU pricing and calculate 24x A100 monthly cost",
      },
    ],
    defaultConfig: {
      sampleText: "/research Compare cloud GPU pricing and calculate 24x A100 monthly cost",
    },
    sampleOutput: {
      updateId: 774102,
      chatId: 9012441,
      username: "nior_dev",
      text: "/research Compare cloud GPU pricing and calculate 24x A100 monthly cost",
    },
    buildOutput: (config, faker, nowIso) => ({
      updateId: faker.number.int({ min: 100000, max: 999999 }),
      chatId: faker.number.int({ min: 1000000, max: 9999999 }),
      username: faker.internet.username().toLowerCase(),
      text: String(config.sampleText || "/start"),
      message: String(config.sampleText || "/start"),
      receivedAt: nowIso,
    }),
  }),

  // 8. Gmail New Email
  makePlatformTrigger({
    id: "trigger.gmailNewEmail",
    label: "Gmail New Email",
    description: "Fires when a new email matching your label or search filter arrives in Gmail.",
    subcategory: "Email",
    keywords: ["gmail", "google", "email", "inbox", "mail", "message"],
    icon: "brand:gmail",
    accent: "#EA4335",
    credentialProvider: "gmail",
    extraSchema: [
      {
        key: "labelFilter",
        label: "Label / query filter",
        type: "text",
        required: true,
        placeholder: "label:INBOX is:unread",
      },
      {
        key: "sampleSubject",
        label: "Simulated subject",
        type: "text",
        required: true,
        placeholder: "Urgent: Invoice #INV-2094 duplicate charge on our enterprise plan",
      },
    ],
    defaultConfig: {
      labelFilter: "label:INBOX is:unread",
      sampleSubject: "Urgent: Invoice #INV-2094 duplicate charge on our enterprise plan",
    },
    sampleOutput: {
      messageId: "msg_19248a9c",
      threadId: "thr_19248a00",
      from: "cfo@acmecorp.com",
      subject: "Urgent: Invoice #INV-2094 duplicate charge on our enterprise plan",
      snippet: "Hi team, we noticed two charges for #INV-2094 this morning. Please refund one.",
      labels: ["INBOX", "UNREAD"],
    },
    buildOutput: (config, faker, nowIso) => ({
      messageId: `msg_${faker.string.alphanumeric(10)}`,
      threadId: `thr_${faker.string.alphanumeric(10)}`,
      from: faker.internet.email().toLowerCase(),
      senderName: faker.person.fullName(),
      subject: String(config.sampleSubject || "New inquiry"),
      body: `Hi team, regarding "${String(config.sampleSubject)}": could you review this and get back to us today?`,
      snippet: `Regarding ${String(config.sampleSubject)}`,
      query: String(config.labelFilter || "label:INBOX"),
      receivedAt: nowIso,
    }),
  }),

  // 9. Outlook New Email
  makePlatformTrigger({
    id: "trigger.outlookNewEmail",
    label: "Outlook New Email",
    description: "Triggers when a new message lands in a Microsoft 365 Outlook folder.",
    subcategory: "Email",
    keywords: ["outlook", "microsoft", "office365", "email", "inbox"],
    icon: "brand:outlook",
    accent: "#0078D4",
    credentialProvider: "outlook",
    extraSchema: [
      {
        key: "folder",
        label: "Folder",
        type: "select",
        options: [
          { value: "Inbox", label: "Inbox" },
          { value: "Support", label: "Support" },
          { value: "Billing", label: "Billing" },
        ],
      },
    ],
    defaultConfig: { folder: "Inbox" },
    sampleOutput: {
      id: "AAMkAGVmMDEz",
      folder: "Inbox",
      from: "procurement@contoso.com",
      subject: "Vendor security questionnaire follow-up",
      bodyPreview: "Attached is the updated SOC2 checklist for Q4.",
    },
    buildOutput: (config, faker, nowIso) => ({
      id: `AAMk${faker.string.alphanumeric(12)}`,
      folder: String(config.folder || "Inbox"),
      from: faker.internet.email().toLowerCase(),
      subject: "Vendor security questionnaire follow-up",
      bodyPreview: "Attached is the updated SOC2 checklist for review.",
      receivedDateTime: nowIso,
    }),
  }),

  // 10. Facebook Page Comment
  makePlatformTrigger({
    id: "trigger.facebookPageComment",
    label: "Facebook Page Comment",
    description: "Fires when a user comments on a Facebook Page post.",
    subcategory: "Social",
    keywords: ["facebook", "meta", "page", "comment", "social"],
    icon: "brand:facebook",
    accent: "#1877F2",
    credentialProvider: "facebook",
    extraSchema: [
      {
        key: "pageId",
        label: "Page ID",
        type: "text",
        required: true,
        placeholder: "flowforge-official",
      },
    ],
    defaultConfig: { pageId: "flowforge-official" },
    sampleOutput: {
      commentId: "fb_cmt_8821",
      postId: "fb_post_401",
      authorName: "Kemi Adeyemi",
      message: "Does this integrate with Paystack and WhatsApp out of the box?",
    },
    buildOutput: (config, faker, nowIso) => ({
      commentId: `fb_cmt_${faker.string.numeric(6)}`,
      postId: `fb_post_${faker.string.numeric(4)}`,
      pageId: String(config.pageId || "flowforge-official"),
      authorName: faker.person.fullName(),
      message: "Does this integrate with Paystack and WhatsApp out of the box?",
      createdAt: nowIso,
    }),
  }),

  // 11. Facebook Lead Form
  makePlatformTrigger({
    id: "trigger.facebookLeadForm",
    label: "Facebook Lead Form",
    description: "Triggers when a prospect submits a Facebook / Meta Lead Ads form.",
    subcategory: "Social",
    keywords: ["facebook", "lead", "ads", "meta", "form", "marketing"],
    icon: "brand:facebook",
    accent: "#1877F2",
    credentialProvider: "facebook",
    extraSchema: [
      {
        key: "formId",
        label: "Lead Form ID",
        type: "text",
        required: true,
        placeholder: "leadgen_q4_enterprise",
      },
    ],
    defaultConfig: { formId: "leadgen_q4_enterprise" },
    sampleOutput: {
      leadgenId: "ld_7749201",
      formId: "leadgen_q4_enterprise",
      lead: {
        name: "Ngozi Eze",
        email: "ngozi@lagosventures.com",
        phone: "+2348095550144",
        company: "Lagos Ventures",
        budget: 2500,
      },
    },
    buildOutput: (config, faker, nowIso) => {
      const name = faker.person.fullName();
      const email = faker.internet.email().toLowerCase();
      const company = faker.company.name();
      return {
        leadgenId: `ld_${faker.string.numeric(7)}`,
        formId: String(config.formId || "leadgen_q4_enterprise"),
        createdAt: nowIso,
        lead: {
          name,
          email,
          phone: "+2348095550144",
          company,
          budget: 2500,
        },
        name,
        email,
        company,
        budget: 2500,
      };
    },
  }),

  // 12. Instagram New Comment
  makePlatformTrigger({
    id: "trigger.instagramNewComment",
    label: "Instagram New Comment",
    description: "Fires when someone comments on an Instagram Business post or Reel.",
    subcategory: "Social",
    keywords: ["instagram", "ig", "comment", "reel", "social"],
    icon: "brand:instagram",
    accent: "#E1306C",
    credentialProvider: "instagram",
    extraSchema: [
      {
        key: "keywordFilter",
        label: "Keyword filter (optional)",
        type: "text",
        placeholder: "DEMO",
      },
    ],
    defaultConfig: { keywordFilter: "DEMO" },
    sampleOutput: {
      commentId: "ig_cmt_55192",
      mediaId: "ig_media_991",
      username: "design_by_tola",
      text: "DEMO — send me the template link please!",
    },
    buildOutput: (config, faker, nowIso) => ({
      commentId: `ig_cmt_${faker.string.numeric(6)}`,
      mediaId: `ig_media_${faker.string.numeric(4)}`,
      username: faker.internet.username().toLowerCase(),
      text: `${String(config.keywordFilter || "DEMO")} — send me the workflow link please!`,
      timestamp: nowIso,
    }),
  }),

  // 13. Instagram New DM
  makePlatformTrigger({
    id: "trigger.instagramNewDm",
    label: "Instagram New DM",
    description: "Fires when your Instagram Business account receives a direct message.",
    subcategory: "Social",
    keywords: ["instagram", "ig", "dm", "direct", "message", "inbox"],
    icon: "brand:instagram",
    accent: "#E1306C",
    credentialProvider: "instagram",
    defaultConfig: {},
    sampleOutput: {
      threadId: "ig_dm_3319",
      senderUsername: "founder_maya",
      text: "Hey! Do you offer annual team plans?",
    },
    buildOutput: (_config, faker, nowIso) => ({
      threadId: `ig_dm_${faker.string.numeric(5)}`,
      senderUsername: faker.internet.username().toLowerCase(),
      text: "Hey! Do you offer annual team plans for 25 seats?",
      receivedAt: nowIso,
    }),
  }),

  // 14. Slack New Message
  makePlatformTrigger({
    id: "trigger.slackNewMessage",
    label: "Slack New Message",
    description: "Fires when a message is posted to a watched Slack channel.",
    subcategory: "Messaging",
    keywords: ["slack", "channel", "message", "chat", "ops"],
    icon: "brand:slack",
    accent: "#E01E5A",
    credentialProvider: "slack",
    extraSchema: [
      {
        key: "channel",
        label: "Channel",
        type: "text",
        required: true,
        placeholder: "#support-escalations",
      },
    ],
    defaultConfig: { channel: "#support-escalations" },
    sampleOutput: {
      channel: "#support-escalations",
      user: "U04912A",
      userName: "devon.sre",
      text: "Customer ACME reported 502s on EU checkout — investigating.",
      ts: "1791104400.000200",
    },
    buildOutput: (config, faker) => ({
      channel: String(config.channel || "#support-escalations"),
      user: `U${faker.string.alphanumeric(6).toUpperCase()}`,
      userName: faker.internet.username().toLowerCase(),
      text: "Customer ACME reported 502s on EU checkout — investigating.",
      ts: `${Math.floor(Date.now() / 1000)}.000200`,
    }),
  }),

  // 15. Discord New Message
  makePlatformTrigger({
    id: "trigger.discordNewMessage",
    label: "Discord New Message",
    description: "Fires when a message is posted in a Discord guild channel.",
    subcategory: "Messaging",
    keywords: ["discord", "guild", "channel", "bot", "message"],
    icon: "brand:discord",
    accent: "#5865F2",
    credentialProvider: "discord",
    extraSchema: [
      {
        key: "channelName",
        label: "Channel name",
        type: "text",
        required: true,
        placeholder: "#help-forum",
      },
    ],
    defaultConfig: { channelName: "#help-forum" },
    sampleOutput: {
      messageId: "disc_119482",
      channelName: "#help-forum",
      author: "pixel_coder",
      content: "How do I connect a Postgres memory node to the AI Agent?",
    },
    buildOutput: (config, faker, nowIso) => ({
      messageId: `disc_${faker.string.numeric(8)}`,
      channelName: String(config.channelName || "#help-forum"),
      author: faker.internet.username().toLowerCase(),
      content: "How do I connect a Postgres memory node to the AI Agent?",
      createdAt: nowIso,
    }),
  }),

  // 16. X (Twitter) New Mention
  makePlatformTrigger({
    id: "trigger.xNewMention",
    label: "X (Twitter) New Mention",
    description: "Fires when your handle is mentioned or tagged in a post on X.",
    subcategory: "Social",
    keywords: ["x", "twitter", "tweet", "mention", "social"],
    icon: "brand:x",
    accent: "#A8A29E",
    credentialProvider: "x",
    extraSchema: [
      {
        key: "handle",
        label: "Watched handle",
        type: "text",
        required: true,
        placeholder: "@flowforge_dev",
      },
    ],
    defaultConfig: { handle: "@flowforge_dev" },
    sampleOutput: {
      tweetId: "18429910482",
      authorHandle: "@sarah_builds",
      text: "Just wired a 12-node AI agent workflow in @flowforge_dev in five minutes!",
    },
    buildOutput: (config, faker, nowIso) => ({
      tweetId: faker.string.numeric(12),
      watchedHandle: String(config.handle || "@flowforge_dev"),
      authorHandle: `@${faker.internet.username().toLowerCase()}`,
      text: `Just wired an automated AI workflow with ${String(config.handle || "@flowforge_dev")}!`,
      createdAt: nowIso,
    }),
  }),

  // 17. YouTube New Comment
  makePlatformTrigger({
    id: "trigger.youtubeNewComment",
    label: "YouTube New Comment",
    description: "Triggers when a viewer leaves a comment on your YouTube channel.",
    subcategory: "Social",
    keywords: ["youtube", "video", "comment", "channel", "creator"],
    icon: "brand:youtube",
    accent: "#FF0000",
    credentialProvider: "youtube",
    extraSchema: [
      {
        key: "videoId",
        label: "Video ID",
        type: "text",
        required: true,
        placeholder: "dQw4w9WgXcQ",
      },
    ],
    defaultConfig: { videoId: "dQw4w9WgXcQ" },
    sampleOutput: {
      commentId: "yt_cmt_7712",
      videoId: "dQw4w9WgXcQ",
      authorDisplayName: "CodeWithEmeka",
      textOriginal: "Awesome breakdown of topological wave scheduling! Can you share the JSON?",
    },
    buildOutput: (config, faker, nowIso) => ({
      commentId: `yt_cmt_${faker.string.alphanumeric(8)}`,
      videoId: String(config.videoId || "dQw4w9WgXcQ"),
      authorDisplayName: faker.internet.username(),
      textOriginal: "Awesome breakdown of topological wave scheduling! Can you share the JSON?",
      publishedAt: nowIso,
    }),
  }),

  // 18. LinkedIn New Message
  makePlatformTrigger({
    id: "trigger.linkedinNewMessage",
    label: "LinkedIn New Message",
    description: "Fires on a new inbound LinkedIn organization page or inbox message.",
    subcategory: "Social",
    keywords: ["linkedin", "b2b", "message", "social", "inmail"],
    icon: "brand:linkedin",
    accent: "#0A66C2",
    credentialProvider: "linkedin",
    defaultConfig: {},
    sampleOutput: {
      conversationId: "li_conv_8412",
      senderName: "David Okonkwo",
      senderHeadline: "VP of Engineering at Horizon Health",
      message: "We'd love to explore an enterprise pilot for our ops team.",
    },
    buildOutput: (_config, faker, nowIso) => ({
      conversationId: `li_conv_${faker.string.numeric(6)}`,
      senderName: faker.person.fullName(),
      senderHeadline: `${faker.person.jobTitle()} at ${faker.company.name()}`,
      message: "We'd love to explore an enterprise pilot for our operations team.",
      receivedAt: nowIso,
    }),
  }),

  // 19. Stripe Payment Received
  makePlatformTrigger({
    id: "trigger.stripePayment",
    label: "Stripe Payment Received",
    description: "Fires on `payment_intent.succeeded` or `checkout.session.completed`.",
    subcategory: "Payments",
    keywords: ["stripe", "payment", "charge", "checkout", "billing", "invoice"],
    icon: "brand:stripe",
    accent: "#F59E0B",
    credentialProvider: "stripe",
    extraSchema: [
      {
        key: "currency",
        label: "Currency",
        type: "select",
        options: [
          { value: "USD", label: "USD ($)" },
          { value: "EUR", label: "EUR (€)" },
          { value: "GBP", label: "GBP (£)" },
        ],
      },
    ],
    defaultConfig: { currency: "USD" },
    sampleOutput: {
      event: "payment_intent.succeeded",
      paymentIntentId: "pi_3Sim99412",
      amount: 14900,
      amountFormatted: "$149.00",
      currency: "USD",
      customer: { email: "billing@acmecorp.com", name: "Acme Corp" },
    },
    buildOutput: (config, faker, nowIso) => ({
      event: "payment_intent.succeeded",
      paymentIntentId: `pi_${faker.string.alphanumeric(12)}`,
      amount: 14900,
      amountFormatted: "$149.00",
      currency: String(config.currency || "USD"),
      customer: {
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
      },
      paidAt: nowIso,
    }),
  }),

  // 20. Paystack Payment Received
  makePlatformTrigger({
    id: "trigger.paystackPayment",
    label: "Paystack Payment Received",
    description: "Triggers on Paystack `charge.success` webhook events.",
    subcategory: "Payments",
    keywords: ["paystack", "payment", "ngn", "nigeria", "africa", "charge"],
    icon: "brand:paystack",
    accent: "#00C3F7",
    credentialProvider: "paystack",
    extraSchema: [
      {
        key: "amountNgn",
        label: "Simulated amount (NGN)",
        type: "number",
        min: 100,
        max: 10000000,
      },
    ],
    defaultConfig: { amountNgn: 85000 },
    sampleOutput: {
      event: "charge.success",
      reference: "PSK_sim_9948102",
      amount: 85000,
      currency: "NGN",
      channel: "card",
      customer: { email: "tola@lagosstore.ng", name: "Tola Balogun" },
    },
    buildOutput: (config, faker, nowIso) => ({
      event: "charge.success",
      reference: `PSK_${faker.string.alphanumeric(10).toUpperCase()}`,
      amount: Number(config.amountNgn ?? 85000),
      currency: "NGN",
      channel: "card",
      customer: {
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
      },
      paidAt: nowIso,
    }),
  }),

  // 21. Flutterwave Payment Received
  makePlatformTrigger({
    id: "trigger.flutterwavePayment",
    label: "Flutterwave Payment Received",
    description: "Fires when a Flutterwave payment completes (`charge.completed`).",
    subcategory: "Payments",
    keywords: ["flutterwave", "rave", "payment", "africa", "charge"],
    icon: "brand:flutterwave",
    accent: "#FB9129",
    credentialProvider: "flutterwave",
    defaultConfig: {},
    sampleOutput: {
      event: "charge.completed",
      txRef: "FLW-TX-489120",
      amount: 120,
      currency: "USD",
      status: "successful",
      customer: { email: "kwame@accra.gh", name: "Kwame Mensah" },
    },
    buildOutput: (_config, faker, nowIso) => ({
      event: "charge.completed",
      txRef: `FLW-TX-${faker.string.numeric(6)}`,
      amount: 120,
      currency: "USD",
      status: "successful",
      customer: {
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
      },
      completedAt: nowIso,
    }),
  }),

  // 22. Shopify New Order
  makePlatformTrigger({
    id: "trigger.shopifyNewOrder",
    label: "Shopify New Order",
    description: "Fires when a customer places a new order in your Shopify store.",
    subcategory: "Commerce",
    keywords: ["shopify", "ecommerce", "order", "store", "checkout", "cart"],
    icon: "brand:shopify",
    accent: "#95BF47",
    credentialProvider: "shopify",
    extraSchema: [
      {
        key: "orderReference",
        label: "Simulated payment reference",
        type: "text",
        required: true,
        placeholder: "PSK_ORD_4821",
      },
    ],
    defaultConfig: { orderReference: "PSK_ORD_4821" },
    sampleOutput: {
      orderId: "ORD-4821",
      orderNumber: 4821,
      paymentReference: "PSK_ORD_4821",
      totalPrice: 185.0,
      currency: "USD",
      customer: { name: "Zainab Bello", email: "zainab@example.com" },
      lineItems: [{ sku: "FF-HOODIE-L", title: "FlowForge Ember Hoodie", quantity: 2 }],
    },
    buildOutput: (config, faker, nowIso) => ({
      orderId: "ORD-4821",
      orderNumber: 4821,
      paymentReference: String(config.orderReference || "PSK_ORD_4821"),
      totalPrice: 185.0,
      currency: "USD",
      customer: {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
      },
      lineItems: [
        { sku: "FF-HOODIE-L", title: "FlowForge Ember Hoodie", quantity: 2, price: 92.5 },
      ],
      createdAt: nowIso,
    }),
  }),

  // 23. WooCommerce New Order
  makePlatformTrigger({
    id: "trigger.woocommerceNewOrder",
    label: "WooCommerce New Order",
    description: "Fires when a new WooCommerce order transitions to processing.",
    subcategory: "Commerce",
    keywords: ["woocommerce", "wordpress", "order", "shop", "ecommerce"],
    icon: "brand:woocommerce",
    accent: "#D97706",
    credentialProvider: "woocommerce",
    defaultConfig: {},
    sampleOutput: {
      orderId: 9042,
      status: "processing",
      total: "94.00",
      currency: "USD",
      billing: { firstName: "Yemi", lastName: "Alade", email: "yemi@example.com" },
    },
    buildOutput: (_config, faker, nowIso) => ({
      orderId: faker.number.int({ min: 5000, max: 9999 }),
      status: "processing",
      total: "94.00",
      currency: "USD",
      billing: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email().toLowerCase(),
      },
      createdAt: nowIso,
    }),
  }),

  // 24. Google Sheets New Row
  makePlatformTrigger({
    id: "trigger.googleSheetsNewRow",
    label: "Google Sheets New Row",
    description: "Fires when a row is appended to a watched Google Sheet tab.",
    subcategory: "Data",
    keywords: ["google", "sheets", "spreadsheet", "row", "csv", "table"],
    icon: "brand:googlesheets",
    accent: "#34A853",
    credentialProvider: "google",
    extraSchema: [
      {
        key: "spreadsheetName",
        label: "Spreadsheet",
        type: "text",
        required: true,
        placeholder: "Inbound Leads 2026",
      },
    ],
    defaultConfig: { spreadsheetName: "Inbound Leads 2026" },
    sampleOutput: {
      spreadsheet: "Inbound Leads 2026",
      rowNumber: 42,
      row: { Name: "Ifeanyi Obi", Email: "ifeanyi@example.com", Tier: "Enterprise" },
    },
    buildOutput: (config, faker) => ({
      spreadsheet: String(config.spreadsheetName || "Inbound Leads 2026"),
      rowNumber: 42,
      row: {
        Name: faker.person.fullName(),
        Email: faker.internet.email().toLowerCase(),
        Tier: "Enterprise",
      },
    }),
  }),

  // 25. Airtable New Record
  makePlatformTrigger({
    id: "trigger.airtableNewRecord",
    label: "Airtable New Record",
    description: "Fires when a record is created in an Airtable base table.",
    subcategory: "Data",
    keywords: ["airtable", "base", "record", "table", "database"],
    icon: "brand:airtable",
    accent: "#FCB400",
    credentialProvider: "airtable",
    extraSchema: [
      {
        key: "tableName",
        label: "Table name",
        type: "text",
        required: true,
        placeholder: "Content Calendar",
      },
    ],
    defaultConfig: { tableName: "Content Calendar" },
    sampleOutput: {
      recordId: "rec9948102a",
      table: "Content Calendar",
      fields: { Title: "Q4 Launch Post", Status: "Ready", Owner: "Maya" },
    },
    buildOutput: (config, faker, nowIso) => ({
      recordId: `rec${faker.string.alphanumeric(10)}`,
      table: String(config.tableName || "Content Calendar"),
      createdTime: nowIso,
      fields: {
        Title: "Q4 Launch Post",
        Status: "Ready",
        Owner: faker.person.firstName(),
      },
    }),
  }),

  // 26. Notion Page Updated
  makePlatformTrigger({
    id: "trigger.notionPageUpdated",
    label: "Notion Page Updated",
    description: "Fires when a page or database item is updated in Notion.",
    subcategory: "Productivity",
    keywords: ["notion", "wiki", "page", "database", "docs"],
    icon: "brand:notion",
    accent: "#A8A29E",
    credentialProvider: "notion",
    extraSchema: [
      {
        key: "databaseName",
        label: "Database / parent page",
        type: "text",
        required: true,
        placeholder: "Engineering RFCs",
      },
    ],
    defaultConfig: { databaseName: "Engineering RFCs" },
    sampleOutput: {
      pageId: "ntn_page_8812",
      database: "Engineering RFCs",
      title: "RFC-019: Event-Driven Agent Memory",
      status: "Approved",
    },
    buildOutput: (config, faker, nowIso) => ({
      pageId: `ntn_page_${faker.string.alphanumeric(8)}`,
      database: String(config.databaseName || "Engineering RFCs"),
      title: "RFC-019: Event-Driven Agent Memory",
      status: "Approved",
      lastEditedTime: nowIso,
    }),
  }),

  // 27. Google Drive New File
  makePlatformTrigger({
    id: "trigger.googleDriveNewFile",
    label: "Google Drive New File",
    description: "Triggers when a new file is uploaded to a watched Google Drive folder.",
    subcategory: "Storage",
    keywords: ["google", "drive", "file", "upload", "folder", "storage"],
    icon: "brand:googledrive",
    accent: "#FBBC04",
    credentialProvider: "google",
    extraSchema: [
      {
        key: "folderPath",
        label: "Folder path",
        type: "text",
        required: true,
        placeholder: "/Shared/Invoices",
      },
    ],
    defaultConfig: { folderPath: "/Shared/Invoices" },
    sampleOutput: {
      fileId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
      name: "invoice-oct-2026.pdf",
      mimeType: "application/pdf",
      folder: "/Shared/Invoices",
      sizeBytes: 248910,
    },
    buildOutput: (config, faker, nowIso) => ({
      fileId: `1BxiMVs0${faker.string.alphanumeric(14)}`,
      name: "invoice-oct-2026.pdf",
      mimeType: "application/pdf",
      folder: String(config.folderPath || "/Shared/Invoices"),
      sizeBytes: 248910,
      createdTime: nowIso,
    }),
  }),

  // 28. Google Calendar Event Starting
  makePlatformTrigger({
    id: "trigger.googleCalendarEventStarting",
    label: "Google Calendar Event Starting",
    description: "Fires N minutes before a scheduled Google Calendar meeting begins.",
    subcategory: "Productivity",
    keywords: ["google", "calendar", "event", "meeting", "reminder"],
    icon: "brand:googlecalendar",
    accent: "#4285F4",
    credentialProvider: "google",
    extraSchema: [
      {
        key: "minutesBefore",
        label: "Minutes before start",
        type: "number",
        min: 1,
        max: 120,
      },
    ],
    defaultConfig: { minutesBefore: 15 },
    sampleOutput: {
      eventId: "cal_evt_9012",
      summary: "Architecture Review — FlowForge v2",
      startsInMinutes: 15,
      meetLink: "https://meet.google.com/sim-flow-forge",
      attendees: ["nior@example.com", "ada@example.com"],
    },
    buildOutput: (config, faker, nowIso) => ({
      eventId: `cal_evt_${faker.string.alphanumeric(8)}`,
      summary: "Architecture Review — FlowForge v2",
      startsInMinutes: Number(config.minutesBefore ?? 15),
      startTime: nowIso,
      meetLink: "https://meet.google.com/sim-flow-forge",
      attendees: ["nior@example.com", faker.internet.email().toLowerCase()],
    }),
  }),

  // 29. Calendly New Booking
  makePlatformTrigger({
    id: "trigger.calendlyNewBooking",
    label: "Calendly New Booking",
    description: "Fires on `invitee.created` when someone books a Calendly slot.",
    subcategory: "Productivity",
    keywords: ["calendly", "booking", "schedule", "meeting", "invitee"],
    icon: "brand:calendly",
    accent: "#006BFF",
    credentialProvider: "calendly",
    defaultConfig: {},
    sampleOutput: {
      bookingUri: "https://api.calendly.com/scheduled_events/sim_102",
      eventType: "30-Min Product Discovery",
      invitee: { name: "Seyi Makinde", email: "seyi@example.com", timezone: "Africa/Lagos" },
    },
    buildOutput: (_config, faker, nowIso) => ({
      bookingUri: `https://api.calendly.com/scheduled_events/sim_${faker.string.numeric(5)}`,
      eventType: "30-Min Product Discovery",
      scheduledAt: nowIso,
      invitee: {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        timezone: "Africa/Lagos",
      },
    }),
  }),

  // 30. GitHub Push or Issue Opened
  makePlatformTrigger({
    id: "trigger.githubEvent",
    label: "GitHub Push or Issue Opened",
    description: "Fires when code is pushed or an issue/PR is opened in a GitHub repository.",
    subcategory: "Developer",
    keywords: ["github", "git", "push", "issue", "pull request", "repo", "webhook"],
    icon: "brand:github",
    accent: "#A8A29E",
    credentialProvider: "github",
    extraSchema: [
      {
        key: "repository",
        label: "Repository",
        type: "text",
        required: true,
        placeholder: "Nior122/workflow",
      },
      {
        key: "eventType",
        label: "Event type",
        type: "select",
        options: [
          { value: "push", label: "Push to branch" },
          { value: "issues.opened", label: "Issue opened" },
          { value: "pull_request.opened", label: "Pull request opened" },
        ],
      },
    ],
    defaultConfig: {
      repository: "Nior122/workflow",
      eventType: "issues.opened",
    },
    sampleOutput: {
      event: "issues.opened",
      repository: "Nior122/workflow",
      sender: "Nior122",
      issue: {
        number: 42,
        title: "Add 90+ nodes and AI Agent sub-node ports",
        labels: ["enhancement", "ai-agent"],
      },
    },
    buildOutput: (config, faker, nowIso) => ({
      event: String(config.eventType || "issues.opened"),
      repository: String(config.repository || "Nior122/workflow"),
      sender: faker.internet.username(),
      timestamp: nowIso,
      issue: {
        number: 42,
        title: "Add 90+ nodes and AI Agent sub-node ports",
        labels: ["enhancement", "ai-agent"],
      },
    }),
  }),

  // 31. RSS Feed Item
  makePlatformTrigger({
    id: "trigger.rssFeedItem",
    label: "RSS Feed Item",
    description: "Polls an RSS / Atom feed and triggers when a new article is published.",
    subcategory: "Content",
    keywords: ["rss", "atom", "feed", "blog", "news", "article"],
    icon: "lucide:Rss",
    accent: "#F97316",
    extraSchema: [
      {
        key: "feedUrl",
        label: "Feed URL",
        type: "text",
        required: true,
        placeholder: "https://engineering.flowforge.dev/rss.xml",
      },
    ],
    defaultConfig: {
      feedUrl: "https://engineering.flowforge.dev/rss.xml",
    },
    sampleOutput: {
      feedUrl: "https://engineering.flowforge.dev/rss.xml",
      title: "How Pure TypeScript Execution Engines Keep Visual Builders Testable",
      link: "https://engineering.flowforge.dev/posts/pure-ts-execution-engine",
      content:
        "Separating topological scheduling from React state lets 140+ nodes run deterministically under test with zero DOM overhead.",
      pubDate: "2026-10-04T08:00:00.000Z",
    },
    buildOutput: (config, _faker, nowIso) => ({
      feedUrl: String(config.feedUrl || "https://engineering.flowforge.dev/rss.xml"),
      title: "How Pure TypeScript Execution Engines Keep Visual Builders Testable",
      link: "https://engineering.flowforge.dev/posts/pure-ts-execution-engine",
      content:
        "Separating topological scheduling from React state lets 140+ nodes run deterministically under test with zero DOM overhead.",
      pubDate: nowIso,
    }),
  }),

  // 32. Postgres Row Inserted
  makePlatformTrigger({
    id: "trigger.postgresRowInserted",
    label: "Postgres Row Inserted",
    description: "Listens on `LISTEN/NOTIFY` or table polling for newly inserted rows.",
    subcategory: "Data",
    keywords: ["postgres", "postgresql", "sql", "database", "row", "insert", "trigger"],
    icon: "brand:postgres",
    accent: "#38BDF8",
    credentialProvider: "postgres",
    extraSchema: [
      {
        key: "table",
        label: "Table name",
        type: "text",
        required: true,
        placeholder: "public.orders",
      },
    ],
    defaultConfig: { table: "public.orders" },
    sampleOutput: {
      schema: "public",
      table: "public.orders",
      operation: "INSERT",
      record: { id: 1084, customer_email: "ada@example.com", total_cents: 49000 },
    },
    buildOutput: (config, faker, nowIso) => ({
      schema: "public",
      table: String(config.table || "public.orders"),
      operation: "INSERT",
      insertedAt: nowIso,
      record: {
        id: faker.number.int({ min: 1000, max: 9999 }),
        customer_email: faker.internet.email().toLowerCase(),
        total_cents: 49000,
      },
    }),
  }),

  // 33. Error Trigger
  makePlatformTrigger({
    id: "trigger.errorTrigger",
    label: "Error Trigger",
    description: "Fires automatically when another workflow fails, passing the failing node details.",
    subcategory: "Core",
    keywords: ["error", "exception", "fail", "alert", "incident", "catch"],
    icon: "lucide:AlertOctagon",
    accent: "#F2555A",
    extraSchema: [
      {
        key: "watchedWorkflow",
        label: "Watched workflow",
        type: "text",
        required: true,
        placeholder: "All production workflows",
      },
    ],
    defaultConfig: { watchedWorkflow: "All production workflows" },
    sampleOutput: {
      watchedWorkflow: "All production workflows",
      failedWorkflowName: "Daily billing sync",
      failedNodeId: "httpRequest-2",
      errorCode: "node-execution-failed",
      errorMessage: "504 Gateway Timeout from upstream billing service",
    },
    buildOutput: (config, _faker, nowIso) => ({
      watchedWorkflow: String(config.watchedWorkflow || "All production workflows"),
      failedWorkflowName: "Daily billing sync",
      failedNodeId: "httpRequest-2",
      errorCode: "node-execution-failed",
      errorMessage: "504 Gateway Timeout from upstream billing service",
      occurredAt: nowIso,
    }),
  }),
];
