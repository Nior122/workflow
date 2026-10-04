/**
 * Batch B — Messaging, Social & Output Node Definitions (18 nodes).
 *
 * Includes 14 chainable messaging & social actions (`inputs: MAIN_IN`, `outputs: MAIN_OUT`)
 * plus the 4 v1 terminal output nodes (`output.email`, `output.slack`, `output.sheets`,
 * `output.log`) preserved with 100% backwards compatibility.
 */

import type { JsonValue } from "@/types/json";
import type { RegistryNodeDef } from "@/types/registry";
import type { ConfigIssue } from "@/types/validation";
import {
  simulateEmailSent,
  simulateSheetRowAppended,
  simulateSlackPosted,
} from "@/lib/engine/simulator";
import { createSeededFaker } from "../faker-seed";
import { defaultCredentialIdFor } from "../credentials";
import {
  MAIN_IN,
  MAIN_OUT,
  checkUnbalancedExpressions,
  defineRegistryNode,
} from "../helpers";

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

const EMAIL_OR_TOKEN = /^(\S+@\S+\.\S+|.*\{\{.*\}\}.*)$/;

export const emailOutputNode = defineRegistryNode({
  id: "output.email",
  label: "Send Email",
  description: "Composes an email from {{variables}} and logs the simulated delivery.",
  category: "output",
  subcategory: "Email",
  keywords: ["email", "send", "smtp", "mail", "output", "notification"],
  icon: "lucide:Mail",
  accent: "#A8A29E",
  type: "output",
  inputs: MAIN_IN,
  outputs: [],
  latencyMs: 620,
  configSchema: [
    {
      key: "to",
      label: "To",
      type: "expression",
      required: true,
      placeholder: "{{user.email}} or ada@example.com",
    },
    {
      key: "subject",
      label: "Subject",
      type: "expression",
      required: true,
      placeholder: "Welcome to FlowForge, {{user.name}}",
    },
    {
      key: "body",
      label: "Body",
      type: "textarea",
      placeholder: "{{text}}",
    },
  ],
  defaultConfig: {
    to: "{{user.email}}",
    subject: "Welcome to FlowForge, {{user.name}}",
    body: "{{text}}",
  },
  sampleOutput: {
    delivered: true,
    transport: "simulated",
    to: "ada@example.com",
    subject: "Welcome to FlowForge, Ada Lovelace",
    body: "Thanks for reaching out!",
    messageId: "sim-1a92f",
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const to = String(config.to ?? "");
    const subject = String(config.subject ?? "");
    const body = String(config.body ?? "");

    if (!filled(to)) {
      issues.push(missing("config.to", "Recipient"));
    } else if (!EMAIL_OR_TOKEN.test(to.trim())) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Recipient must be an email address or a {{variable}}.",
        field: "config.to",
      });
    }

    if (!filled(subject)) issues.push(missing("config.subject", "Subject"));

    return [
      ...issues,
      ...checkUnbalancedExpressions("to", to),
      ...checkUnbalancedExpressions("subject", subject),
      ...checkUnbalancedExpressions("body", body),
    ];
  },
  simulate: async (_input, config, ctx) => {
    const to = ctx.resolveExpression(String(config.to ?? ""));
    const subject = ctx.resolveExpression(String(config.subject ?? ""));
    const body = ctx.resolveExpression(String(config.body ?? ""));
    const sent = simulateEmailSent({ to, subject, body });
    return {
      output: sent,
      logs: [`Simulated email delivered to ${to} ("${subject}").`],
      meta: { to, subject },
    };
  },
});

export const slackOutputNode = defineRegistryNode({
  id: "output.slack",
  label: "Post to Slack",
  description: "Posts a formatted message to a channel. Simulated: no workspace needed.",
  category: "output",
  subcategory: "Messaging",
  keywords: ["slack", "channel", "post", "webhook", "output", "alert"],
  icon: "brand:slack",
  accent: "#8FA79A",
  type: "output",
  inputs: MAIN_IN,
  outputs: [],
  latencyMs: 540,
  configSchema: [
    {
      key: "channel",
      label: "Channel",
      type: "text",
      required: true,
      placeholder: "#new-leads",
    },
    {
      key: "message",
      label: "Message",
      type: "textarea",
      required: true,
      placeholder: "New signup: *{{user.name}}*",
    },
  ],
  defaultConfig: {
    channel: "#new-leads",
    message: "New signup: *{{user.name}}* ({{user.email}}) — {{text}}",
  },
  sampleOutput: {
    posted: true,
    transport: "simulated",
    channel: "#new-leads",
    text: "New signup: *Ada Lovelace* (ada@example.com)",
    ts: "1791104400.000100",
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const channel = String(config.channel ?? "");
    const message = String(config.message ?? "");
    if (!filled(channel)) issues.push(missing("config.channel", "Channel"));
    if (!filled(message)) issues.push(missing("config.message", "Message"));
    return [...issues, ...checkUnbalancedExpressions("message", message)];
  },
  simulate: async (_input, config, ctx) => {
    const rawChannel = ctx.resolveExpression(String(config.channel ?? "")).trim();
    const channel = rawChannel.startsWith("#") ? rawChannel : `#${rawChannel}`;
    const message = ctx.resolveExpression(String(config.message ?? ""));
    const posted = simulateSlackPosted({ channel, message });
    return {
      output: posted,
      logs: [`Posted message to Slack ${channel}.`],
      meta: { channel },
    };
  },
});

export const sheetsOutputNode = defineRegistryNode({
  id: "output.sheets",
  label: "Append Sheet Row",
  description: "Appends a mapped row to a simulated spreadsheet.",
  category: "output",
  subcategory: "Data",
  keywords: ["google", "sheets", "spreadsheet", "row", "append", "output"],
  icon: "brand:googlesheets",
  accent: "#7FA88F",
  type: "output",
  inputs: MAIN_IN,
  outputs: [],
  latencyMs: 680,
  configSchema: [
    {
      key: "spreadsheet",
      label: "Spreadsheet",
      type: "text",
      required: true,
      placeholder: "Leads 2026",
    },
    {
      key: "columns",
      label: "Columns",
      type: "keyValue",
      required: true,
      keyLabel: "Column",
      valueLabel: "Value",
      placeholder: "{{user.name}}",
    },
  ],
  defaultConfig: {
    spreadsheet: "Leads 2026",
    columns: [
      { id: "col-name", key: "Name", value: "{{user.name}}" },
      { id: "col-email", key: "Email", value: "{{user.email}}" },
      { id: "col-note", key: "Summary", value: "{{text}}" },
    ],
  },
  sampleOutput: {
    appended: true,
    transport: "simulated",
    spreadsheet: "Leads 2026",
    rowIndex: 42,
    row: { Name: "Ada Lovelace", Email: "ada@example.com", Summary: "Qualified lead" },
  },
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const spreadsheet = String(config.spreadsheet ?? "");
    const columns = Array.isArray(config.columns)
      ? (config.columns as Array<{ key?: string; value?: string }>)
      : [];
    if (!filled(spreadsheet)) issues.push(missing("config.spreadsheet", "Spreadsheet name"));
    if (columns.length === 0) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "Add at least one column mapping.",
        field: "config.columns",
      });
    } else if (columns.some((col) => !filled(col.key))) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Every column mapping needs a column name.",
        field: "config.columns",
      });
    }
    return issues;
  },
  simulate: async (_input, config, ctx) => {
    const columns = Array.isArray(config.columns)
      ? (config.columns as Array<{ key: string; value: string }>)
      : [];
    const row: Record<string, JsonValue> = {};
    for (const column of columns) {
      row[column.key] = ctx.resolveExpression(String(column.value ?? ""));
    }
    const rowIndex = Math.floor(ctx.random() * 90) + 10;
    const spreadsheet = String(config.spreadsheet ?? "Leads 2026");
    return {
      output: simulateSheetRowAppended({ spreadsheet, row, rowIndex }),
      logs: [`Appended row #${rowIndex} to "${spreadsheet}".`],
      meta: { spreadsheet, rowIndex },
    };
  },
});

export const logOutputNode = defineRegistryNode({
  id: "output.log",
  label: "Log Output",
  description: "Writes the incoming payload straight to the run console.",
  category: "output",
  subcategory: "Core",
  keywords: ["log", "console", "debug", "inspect", "print", "output"],
  icon: "lucide:Terminal",
  accent: "#8B93A7",
  type: "output",
  inputs: MAIN_IN,
  outputs: [],
  latencyMs: 300,
  configSchema: [
    {
      key: "label",
      label: "Console label",
      type: "text",
      placeholder: "Final payload",
    },
  ],
  defaultConfig: { label: "Final payload" },
  sampleOutput: {
    user: { name: "Ada Lovelace" },
    logged: true,
  },
  validateConfig: () => [],
  simulate: async (input, config) => ({
    output: input,
    logs: [`Logged payload (${String(config.label || "Final payload")}).`],
    meta: { label: String(config.label || "log") },
  }),
});

export const MESSAGING_NODES: readonly RegistryNodeDef[] = [
  // 34. WhatsApp Send Message
  defineRegistryNode({
    id: "action.whatsappSend",
    label: "WhatsApp Send Message",
    description: "Sends a WhatsApp Business text, approved template, or media message.",
    category: "messaging",
    subcategory: "Messaging",
    keywords: ["whatsapp", "wa", "send", "message", "template", "media", "phone"],
    icon: "brand:whatsapp",
    accent: "#25D366",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 520,
    configSchema: [
      {
        key: "credentialId",
        label: "WhatsApp account",
        type: "credential",
        credentialProvider: "whatsapp",
      },
      {
        key: "messageType",
        label: "Message type",
        type: "select",
        options: [
          { value: "text", label: "Text message" },
          { value: "template", label: "Approved template" },
          { value: "media", label: "Media (image / document)" },
        ],
      },
      {
        key: "to",
        label: "Recipient phone",
        type: "expression",
        required: true,
        placeholder: "{{from}} or +2348031234567",
      },
      {
        key: "body",
        label: "Message text",
        type: "textarea",
        required: true,
        placeholder: "Hi {{profileName}}, {{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("whatsapp"),
      messageType: "text",
      to: "{{from}}",
      body: "Hi {{profileName}} — {{text}}",
    },
    sampleOutput: {
      sent: true,
      provider: "whatsapp-cloud-sim",
      messageId: "wamid.HBgNMjM0ODAzOTk4",
      to: "+2348031234567",
      messageType: "text",
      body: "Hi Tunde — your order #ORD-9021 is out for delivery.",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const to = ctx.resolveExpression(String(config.to || "+2348031234567")) || "+2348031234567";
      const body = ctx.resolveExpression(String(config.body || ""));
      const messageType = String(config.messageType || "text");
      const messageId = `wamid.${faker.string.alphanumeric(16)}`;
      return {
        output: {
          ...input,
          sent: true,
          provider: "whatsapp-cloud-sim",
          messageId,
          to,
          messageType,
          body,
        },
        logs: [`WhatsApp ${messageType} message sent to ${to} (${messageId}).`],
        meta: { to, messageType, messageId },
      };
    },
  }),

  // 35. Telegram Send Message / Photo / Document
  defineRegistryNode({
    id: "action.telegramSend",
    label: "Telegram Send Message",
    description: "Sends a text message, photo, or document to a Telegram chat or channel.",
    category: "messaging",
    subcategory: "Messaging",
    keywords: ["telegram", "bot", "send", "photo", "document", "chat"],
    icon: "brand:telegram",
    accent: "#38BDF8",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 480,
    configSchema: [
      {
        key: "credentialId",
        label: "Telegram Bot",
        type: "credential",
        credentialProvider: "telegram",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "sendMessage", label: "Send Text Message" },
          { value: "sendPhoto", label: "Send Photo" },
          { value: "sendDocument", label: "Send Document" },
        ],
      },
      {
        key: "chatId",
        label: "Chat ID / @channel",
        type: "expression",
        required: true,
        placeholder: "{{chatId}} or @flowforge_alerts",
      },
      {
        key: "text",
        label: "Text / Caption",
        type: "textarea",
        required: true,
        placeholder: "Order #{{orderNumber}} verified — {{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("telegram"),
      operation: "sendMessage",
      chatId: "@flowforge_alerts",
      text: "Update: {{text}}",
    },
    sampleOutput: {
      ok: true,
      operation: "sendMessage",
      chatId: "@flowforge_alerts",
      messageId: 4091,
      text: "Order #4821 verified and logged.",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const chatId = ctx.resolveExpression(String(config.chatId || "@flowforge_alerts")) || "@flowforge_alerts";
      const text = ctx.resolveExpression(String(config.text || ""));
      const operation = String(config.operation || "sendMessage");
      const messageId = faker.number.int({ min: 1000, max: 9999 });
      return {
        output: {
          ...input,
          ok: true,
          operation,
          chatId,
          messageId,
          text,
        },
        logs: [`Telegram ${operation} delivered to ${chatId} (msg #${messageId}).`],
        meta: { chatId, operation, messageId },
      };
    },
  }),

  // 36. Gmail (send, reply, label, create draft)
  defineRegistryNode({
    id: "action.gmail",
    label: "Gmail",
    description: "Sends an email, replies to a thread, applies a label, or saves a draft in Gmail.",
    category: "messaging",
    subcategory: "Email",
    keywords: ["gmail", "google", "email", "send", "reply", "draft", "label"],
    icon: "brand:gmail",
    accent: "#EA4335",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "credentialId",
        label: "Gmail account",
        type: "credential",
        credentialProvider: "gmail",
      },
      {
        key: "operation",
        label: "Operation",
        type: "select",
        options: [
          { value: "send", label: "Send Email" },
          { value: "reply", label: "Reply to Thread" },
          { value: "draft", label: "Create Draft" },
          { value: "label", label: "Add Label" },
        ],
      },
      {
        key: "to",
        label: "To",
        type: "expression",
        required: true,
        placeholder: "{{from}} or customer@example.com",
      },
      {
        key: "subject",
        label: "Subject / Label",
        type: "expression",
        required: true,
        placeholder: "Re: {{subject}}",
      },
      {
        key: "body",
        label: "Message body",
        type: "textarea",
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("gmail"),
      operation: "send",
      to: "ops@example.com",
      subject: "FlowForge notification: {{subject}}",
      body: "{{text}}",
    },
    sampleOutput: {
      gmailId: "gm_19248f9a",
      operation: "send",
      to: "ops@example.com",
      subject: "FlowForge notification",
      status: "delivered",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const operation = String(config.operation || "send");
      const to = ctx.resolveExpression(String(config.to || "ops@example.com")) || "ops@example.com";
      const subject = ctx.resolveExpression(String(config.subject || "Notification"));
      const body = ctx.resolveExpression(String(config.body || ""));
      const gmailId = `gm_${faker.string.alphanumeric(10)}`;
      return {
        output: {
          ...input,
          gmailId,
          operation,
          to,
          subject,
          body,
          status: operation === "draft" ? "draft_created" : "delivered",
        },
        logs: [`Gmail (${operation}) completed for ${to} [${gmailId}].`],
        meta: { operation, to, gmailId },
      };
    },
  }),

  // 37. Outlook Send Email
  defineRegistryNode({
    id: "action.outlookSendEmail",
    label: "Outlook Send Email",
    description: "Sends a Microsoft 365 Outlook email with optional CC and importance level.",
    category: "messaging",
    subcategory: "Email",
    keywords: ["outlook", "microsoft", "office365", "email", "send"],
    icon: "brand:outlook",
    accent: "#0078D4",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "credentialId",
        label: "Microsoft 365 account",
        type: "credential",
        credentialProvider: "outlook",
      },
      {
        key: "to",
        label: "To",
        type: "expression",
        required: true,
        placeholder: "stakeholders@contoso.com",
      },
      {
        key: "subject",
        label: "Subject",
        type: "expression",
        required: true,
        placeholder: "Weekly Operations Summary",
      },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("outlook"),
      to: "stakeholders@contoso.com",
      subject: "Weekly Operations Summary",
      body: "{{text}}",
    },
    sampleOutput: {
      outlookMessageId: "AAMkAGVm9912",
      to: "stakeholders@contoso.com",
      subject: "Weekly Operations Summary",
      sent: true,
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const to = ctx.resolveExpression(String(config.to || "stakeholders@contoso.com"));
      const subject = ctx.resolveExpression(String(config.subject || "Summary"));
      const body = ctx.resolveExpression(String(config.body || ""));
      return {
        output: {
          ...input,
          outlookMessageId: `AAMk${faker.string.alphanumeric(10)}`,
          to,
          subject,
          body,
          sent: true,
        },
        logs: [`Outlook email sent to ${to}.`],
        meta: { to, subject },
      };
    },
  }),

  // 38. Slack Send Message
  defineRegistryNode({
    id: "action.slackSendMessage",
    label: "Slack Send Message",
    description: "Posts a message or Block Kit notification to a Slack channel and passes data on.",
    category: "messaging",
    subcategory: "Messaging",
    keywords: ["slack", "message", "channel", "webhook", "chat", "alert"],
    icon: "brand:slack",
    accent: "#E01E5A",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 460,
    configSchema: [
      {
        key: "credentialId",
        label: "Slack workspace",
        type: "credential",
        credentialProvider: "slack",
      },
      {
        key: "channel",
        label: "Channel",
        type: "text",
        required: true,
        placeholder: "#ops-alerts",
      },
      {
        key: "message",
        label: "Message text",
        type: "textarea",
        required: true,
        placeholder: "Alert: {{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("slack"),
      channel: "#ops-alerts",
      message: "Alert: {{text}}",
    },
    sampleOutput: {
      posted: true,
      channel: "#ops-alerts",
      slackTs: "1791104400.000400",
      message: "Alert: Priority ticket escalated.",
    },
    simulate: async (input, config, ctx) => {
      const channel = ctx.resolveExpression(String(config.channel || "#ops-alerts"));
      const message = ctx.resolveExpression(String(config.message || ""));
      return {
        output: {
          ...input,
          posted: true,
          channel,
          message,
          slackTs: `${Math.floor(ctx.now() / 1000)}.000400`,
        },
        logs: [`Slack message posted to ${channel}.`],
        meta: { channel },
      };
    },
  }),

  // 39. Discord Send Message
  defineRegistryNode({
    id: "action.discordSendMessage",
    label: "Discord Send Message",
    description: "Posts a message or embed to a Discord channel via bot or webhook.",
    category: "messaging",
    subcategory: "Messaging",
    keywords: ["discord", "bot", "webhook", "message", "embed", "guild"],
    icon: "brand:discord",
    accent: "#5865F2",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 460,
    configSchema: [
      {
        key: "credentialId",
        label: "Discord guild",
        type: "credential",
        credentialProvider: "discord",
      },
      {
        key: "channel",
        label: "Channel",
        type: "text",
        required: true,
        placeholder: "#deployments",
      },
      {
        key: "content",
        label: "Message content",
        type: "textarea",
        required: true,
        placeholder: "🚀 Deployment complete: {{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("discord"),
      channel: "#deployments",
      content: "🚀 Notification: {{text}}",
    },
    sampleOutput: {
      discordMessageId: "12904810294",
      channel: "#deployments",
      content: "🚀 Notification: Build succeeded.",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const channel = ctx.resolveExpression(String(config.channel || "#deployments"));
      const content = ctx.resolveExpression(String(config.content || ""));
      return {
        output: {
          ...input,
          discordMessageId: faker.string.numeric(11),
          channel,
          content,
        },
        logs: [`Discord message sent to ${channel}.`],
        meta: { channel },
      };
    },
  }),

  // 40. SMS (Twilio)
  defineRegistryNode({
    id: "action.twilioSms",
    label: "SMS (Twilio)",
    description: "Sends a programmable SMS text message via Twilio.",
    category: "messaging",
    subcategory: "Messaging",
    keywords: ["twilio", "sms", "text", "phone", "mobile", "otp"],
    icon: "brand:twilio",
    accent: "#F22F46",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 520,
    configSchema: [
      {
        key: "credentialId",
        label: "Twilio account",
        type: "credential",
        credentialProvider: "twilio",
      },
      {
        key: "to",
        label: "To phone number",
        type: "expression",
        required: true,
        placeholder: "+2348035550199",
      },
      {
        key: "body",
        label: "SMS body",
        type: "textarea",
        required: true,
        placeholder: "FlowForge alert: {{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("twilio"),
      to: "+2348035550199",
      body: "FlowForge alert: {{text}}",
    },
    sampleOutput: {
      sid: "SM894102a9b",
      status: "queued",
      to: "+2348035550199",
      segments: 1,
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const to = ctx.resolveExpression(String(config.to || "+2348035550199"));
      const body = ctx.resolveExpression(String(config.body || ""));
      const sid = `SM${faker.string.alphanumeric(12)}`;
      return {
        output: { ...input, sid, status: "queued", to, body, segments: 1 },
        logs: [`Twilio SMS queued to ${to} (${sid}).`],
        meta: { sid, to },
      };
    },
  }),

  // 41. Facebook Page Post
  defineRegistryNode({
    id: "action.facebookPagePost",
    label: "Facebook Page Post",
    description: "Publishes a status update or link post to a Facebook Page.",
    category: "messaging",
    subcategory: "Social",
    keywords: ["facebook", "meta", "page", "post", "social", "publish"],
    icon: "brand:facebook",
    accent: "#1877F2",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 580,
    configSchema: [
      {
        key: "credentialId",
        label: "Facebook Page",
        type: "credential",
        credentialProvider: "facebook",
      },
      {
        key: "message",
        label: "Post copy",
        type: "textarea",
        required: true,
        placeholder: "{{text}}\n\nRead more: {{link}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("facebook"),
      message: "{{text}}",
    },
    sampleOutput: {
      facebookPostId: "fb_post_99201",
      published: true,
      permalink: "https://facebook.com/flowforge/posts/99201",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const message = ctx.resolveExpression(String(config.message || ""));
      const id = faker.string.numeric(6);
      return {
        output: {
          ...input,
          facebookPostId: `fb_post_${id}`,
          published: true,
          message,
          permalink: `https://facebook.com/flowforge/posts/${id}`,
        },
        logs: [`Published Facebook Page post fb_post_${id}.`],
        meta: { facebookPostId: `fb_post_${id}` },
      };
    },
  }),

  // 42. Instagram Publish Post
  defineRegistryNode({
    id: "action.instagramPublishPost",
    label: "Instagram Publish Post",
    description: "Publishes an image or carousel post with caption to Instagram Business.",
    category: "messaging",
    subcategory: "Social",
    keywords: ["instagram", "ig", "publish", "post", "caption", "social"],
    icon: "brand:instagram",
    accent: "#E1306C",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 640,
    configSchema: [
      {
        key: "credentialId",
        label: "Instagram account",
        type: "credential",
        credentialProvider: "instagram",
      },
      {
        key: "imageUrl",
        label: "Image URL",
        type: "expression",
        required: true,
        placeholder: "https://cdn.flowforge.dev/cards/launch.png",
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        required: true,
        placeholder: "{{text}} #automation #workflows",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("instagram"),
      imageUrl: "https://cdn.flowforge.dev/cards/launch.png",
      caption: "{{text}} #automation",
    },
    sampleOutput: {
      igMediaId: "17982049102",
      published: true,
      shortcode: "C_sim99A",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const caption = ctx.resolveExpression(String(config.caption || ""));
      const imageUrl = ctx.resolveExpression(String(config.imageUrl || ""));
      const igMediaId = faker.string.numeric(11);
      return {
        output: { ...input, igMediaId, published: true, imageUrl, caption },
        logs: [`Published Instagram post (${igMediaId}).`],
        meta: { igMediaId },
      };
    },
  }),

  // 43. X Post Tweet
  defineRegistryNode({
    id: "action.xPostTweet",
    label: "X Post Tweet",
    description: "Publishes a post (tweet) or thread reply on X (Twitter).",
    category: "messaging",
    subcategory: "Social",
    keywords: ["x", "twitter", "tweet", "post", "social", "thread"],
    icon: "brand:x",
    accent: "#A8A29E",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 480,
    configSchema: [
      {
        key: "credentialId",
        label: "X account",
        type: "credential",
        credentialProvider: "x",
      },
      {
        key: "text",
        label: "Post text (max 280 chars)",
        type: "textarea",
        required: true,
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("x"),
      text: "{{text}}",
    },
    sampleOutput: {
      tweetId: "18429988120",
      url: "https://x.com/flowforge_dev/status/18429988120",
      text: "New on the engineering blog: pure TS execution engines.",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const tweetText = ctx.resolveExpression(String(config.text || "")).slice(0, 280);
      const tweetId = faker.string.numeric(11);
      return {
        output: {
          ...input,
          tweetId,
          tweetText,
          url: `https://x.com/flowforge_dev/status/${tweetId}`,
        },
        logs: [`Posted tweet ${tweetId}.`],
        meta: { tweetId },
      };
    },
  }),

  // 44. LinkedIn Create Post
  defineRegistryNode({
    id: "action.linkedinCreatePost",
    label: "LinkedIn Create Post",
    description: "Publishes an article share or update to a LinkedIn profile or company page.",
    category: "messaging",
    subcategory: "Social",
    keywords: ["linkedin", "post", "share", "company", "b2b", "social"],
    icon: "brand:linkedin",
    accent: "#0A66C2",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 540,
    configSchema: [
      {
        key: "credentialId",
        label: "LinkedIn account",
        type: "credential",
        credentialProvider: "linkedin",
      },
      {
        key: "commentary",
        label: "Post commentary",
        type: "textarea",
        required: true,
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("linkedin"),
      commentary: "{{text}}",
    },
    sampleOutput: {
      urn: "urn:li:share:724810294",
      published: true,
      visibility: "PUBLIC",
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const commentary = ctx.resolveExpression(String(config.commentary || ""));
      const urn = `urn:li:share:${faker.string.numeric(9)}`;
      return {
        output: { ...input, urn, commentary, published: true, visibility: "PUBLIC" },
        logs: [`Published LinkedIn share ${urn}.`],
        meta: { urn },
      };
    },
  }),

  // 45. YouTube Reply to Comment
  defineRegistryNode({
    id: "action.youtubeReplyComment",
    label: "YouTube Reply to Comment",
    description: "Posts a public creator reply to a YouTube comment thread.",
    category: "messaging",
    subcategory: "Social",
    keywords: ["youtube", "comment", "reply", "video", "creator"],
    icon: "brand:youtube",
    accent: "#FF0000",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 500,
    configSchema: [
      {
        key: "credentialId",
        label: "YouTube channel",
        type: "credential",
        credentialProvider: "youtube",
      },
      {
        key: "parentCommentId",
        label: "Parent comment ID",
        type: "expression",
        required: true,
        placeholder: "{{commentId}}",
      },
      {
        key: "replyText",
        label: "Reply text",
        type: "textarea",
        required: true,
        placeholder: "Thanks for watching! Here is the link: {{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("youtube"),
      parentCommentId: "{{commentId}}",
      replyText: "Thanks for watching! {{text}}",
    },
    sampleOutput: {
      replyId: "yt_reply_8841",
      parentCommentId: "yt_cmt_7712",
      replied: true,
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const parentCommentId = ctx.resolveExpression(String(config.parentCommentId || "yt_cmt_7712"));
      const replyText = ctx.resolveExpression(String(config.replyText || ""));
      const replyId = `yt_reply_${faker.string.alphanumeric(6)}`;
      return {
        output: { ...input, replyId, parentCommentId, replyText, replied: true },
        logs: [`Replied to YouTube comment ${parentCommentId}.`],
        meta: { replyId, parentCommentId },
      };
    },
  }),

  // 46. Microsoft Teams Message
  defineRegistryNode({
    id: "action.microsoftTeamsMessage",
    label: "Microsoft Teams Message",
    description: "Posts an Adaptive Card or message to a Microsoft Teams channel.",
    category: "messaging",
    subcategory: "Messaging",
    keywords: ["microsoft", "teams", "channel", "chat", "adaptive card", "enterprise"],
    icon: "brand:teams",
    accent: "#505AC9",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 520,
    configSchema: [
      {
        key: "credentialId",
        label: "Teams tenant",
        type: "credential",
        credentialProvider: "teams",
      },
      {
        key: "channelName",
        label: "Team / Channel",
        type: "text",
        required: true,
        placeholder: "Engineering / Incident Response",
      },
      {
        key: "message",
        label: "Message",
        type: "textarea",
        required: true,
        placeholder: "{{text}}",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("teams"),
      channelName: "Engineering / Incident Response",
      message: "{{text}}",
    },
    sampleOutput: {
      teamsMessageId: "1791104400991",
      channelName: "Engineering / Incident Response",
      delivered: true,
    },
    simulate: async (input, config, ctx) => {
      const channelName = String(config.channelName || "Engineering / Incident Response");
      const message = ctx.resolveExpression(String(config.message || ""));
      return {
        output: {
          ...input,
          teamsMessageId: String(ctx.now()),
          channelName,
          message,
          delivered: true,
        },
        logs: [`Posted message to Microsoft Teams (${channelName}).`],
        meta: { channelName },
      };
    },
  }),

  // 47. Mailchimp Add Subscriber
  defineRegistryNode({
    id: "action.mailchimpAddSubscriber",
    label: "Mailchimp Add Subscriber",
    description: "Adds or updates a contact in a Mailchimp audience with tags.",
    category: "messaging",
    subcategory: "Marketing",
    keywords: ["mailchimp", "newsletter", "audience", "subscriber", "marketing", "email"],
    icon: "brand:mailchimp",
    accent: "#FFE01B",
    type: "action",
    inputs: MAIN_IN,
    outputs: MAIN_OUT,
    latencyMs: 560,
    configSchema: [
      {
        key: "credentialId",
        label: "Mailchimp account",
        type: "credential",
        credentialProvider: "mailchimp",
      },
      {
        key: "email",
        label: "Subscriber email",
        type: "expression",
        required: true,
        placeholder: "{{user.email}}",
      },
      {
        key: "tags",
        label: "Tags (comma-separated)",
        type: "text",
        placeholder: "product-updates, pro-tier",
      },
    ],
    defaultConfig: {
      credentialId: defaultCredentialIdFor("mailchimp"),
      email: "{{user.email}}",
      tags: "product-updates, flowforge",
    },
    sampleOutput: {
      subscriberHash: "mc_sub_99481a",
      email: "ada@example.com",
      status: "subscribed",
      tags: ["product-updates", "flowforge"],
    },
    simulate: async (input, config, ctx) => {
      const faker = createSeededFaker(ctx.random);
      const email = ctx.resolveExpression(String(config.email || "ada@example.com")) || "ada@example.com";
      const tags = String(config.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return {
        output: {
          ...input,
          subscriberHash: `mc_${faker.string.alphanumeric(10)}`,
          email,
          status: "subscribed",
          tags,
        },
        logs: [`Subscribed ${email} to Mailchimp audience.`],
        meta: { email, status: "subscribed" },
      };
    },
  }),

  // 48-51. Legacy Output nodes preserved at exact IDs
  emailOutputNode,
  slackOutputNode,
  sheetsOutputNode,
  logOutputNode,
];
