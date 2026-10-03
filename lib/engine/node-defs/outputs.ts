/**
 * Output node definitions — one input, no output handle.
 * An output node's own payload is what it "sent", echoed back to the console.
 */

import type { ConfigIssue } from "@/types/validation";
import type { JsonValue } from "@/types/json";
import { defineNode } from "../registry";
import { renderTemplate } from "../variables";
import {
  simulateEmailSent,
  simulateSheetRowAppended,
  simulateSlackPosted,
} from "../simulator";

/** A {{token}} reference is a perfectly good value for these fields. */
function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

function required(field: string, label: string): ConfigIssue {
  return {
    code: "missing-required-config",
    level: "error",
    message: `${label} is required.`,
    field,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailOutput = defineNode<"output.email">({
  type: "output.email",
  category: "output",
  title: "Email",
  description: "Sends an email with variables interpolated. Simulated — nothing is sent.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [],
  defaultConfig: {
    to: "{{lead.email}}",
    subject: "Thanks for reaching out, {{lead.name}}",
    body: "Hi {{lead.name}},\n\nThanks for your message about {{lead.company}}. We'll be in touch within one business day.\n\n— The team",
  },
  latencyMs: 620,
  requiredFields: ["to", "subject"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!isFilled(config.to)) issues.push(required("config.to", "Recipient"));
    else if (!config.to.includes("{{") && !EMAIL_PATTERN.test(config.to.trim())) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: `"${config.to.trim()}" does not look like an email address.`,
        field: "config.to",
      });
    }
    if (!isFilled(config.subject)) issues.push(required("config.subject", "Subject"));
    if (!isFilled(config.body)) issues.push(required("config.body", "Body"));
    return issues;
  },
  execute: async (_input, config, ctx) => {
    const to = renderTemplate(config.to, ctx.scope).text;
    const subject = renderTemplate(config.subject, ctx.scope).text;
    const body = renderTemplate(config.body, ctx.scope).text;

    return {
      payload: simulateEmailSent({ to, subject, body }),
      meta: { recipient: to, subject },
    };
  },
});

export const slackOutput = defineNode<"output.slack">({
  type: "output.slack",
  category: "output",
  title: "Slack Message",
  description: "Posts a message to a channel with variables. Simulated.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [],
  defaultConfig: {
    channel: "#new-leads",
    message: "New lead from *{{lead.company}}*: {{lead.name}} (budget {{budget}})",
  },
  latencyMs: 540,
  requiredFields: ["channel", "message"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!isFilled(config.channel)) issues.push(required("config.channel", "Channel"));
    else if (!config.channel.trim().startsWith("#") && !config.channel.includes("{{")) {
      issues.push({
        code: "invalid-config",
        level: "warning",
        message: "Slack channel names usually start with \"#\".",
        field: "config.channel",
      });
    }
    if (!isFilled(config.message)) issues.push(required("config.message", "Message"));
    return issues;
  },
  execute: async (_input, config, ctx) => {
    const channel = renderTemplate(config.channel, ctx.scope).text;
    const message = renderTemplate(config.message, ctx.scope).text;

    return {
      payload: simulateSlackPosted({ channel, message }),
      meta: { channel },
    };
  },
});

export const sheetsOutput = defineNode<"output.sheets">({
  type: "output.sheets",
  category: "output",
  title: "Google Sheets Row",
  description: "Appends a row using a column mapping. Simulated.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [],
  defaultConfig: {
    spreadsheet: "Leads — 2026",
    columns: [
      { id: "col-name", key: "Name", value: "{{lead.name}}" },
      { id: "col-company", key: "Company", value: "{{lead.company}}" },
      { id: "col-budget", key: "Budget", value: "{{budget}}" },
    ],
  },
  latencyMs: 700,
  requiredFields: ["spreadsheet"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    if (!isFilled(config.spreadsheet)) {
      issues.push(required("config.spreadsheet", "Spreadsheet name"));
    }
    if (config.columns.length === 0) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "Add at least one column mapping.",
        field: "config.columns",
      });
    }
    const blank = config.columns.some((column) => !isFilled(column.key));
    if (blank) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Every column needs a header name.",
        field: "config.columns",
      });
    }
    return issues;
  },
  execute: async (_input, config, ctx) => {
    const row: Record<string, JsonValue> = {};
    for (const column of config.columns) {
      const header = column.key.trim();
      if (header.length === 0) continue;
      row[header] = renderTemplate(column.value, ctx.scope).text;
    }

    // A stable-ish fake row index so repeated runs look plausible.
    const rowIndex = 2 + Math.floor(ctx.random() * 40);

    return {
      payload: simulateSheetRowAppended({
        spreadsheet: config.spreadsheet,
        row,
        rowIndex,
      }),
      meta: { spreadsheet: config.spreadsheet, rowIndex, columns: Object.keys(row).length },
    };
  },
});

export const logOutput = defineNode<"output.log">({
  type: "output.log",
  category: "output",
  title: "Log Output",
  description: "Prints the final payload to the run console.",
  inputs: [{ id: "in", label: "Input" }],
  outputs: [],
  defaultConfig: { label: "Final payload" },
  latencyMs: 350,
  requiredFields: [],
  validateConfig: () => [],
  // Passes the payload through untouched; the console renders it.
  execute: async (input, config) => ({
    payload: input,
    meta: { label: config.label || "Final payload" },
  }),
});
