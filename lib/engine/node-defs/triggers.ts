/**
 * Trigger node definitions — no input handle, one output.
 * A trigger's output payload is the seed data for the whole run.
 */

import { LATENCY_MIN_MS } from "@/config/constants";
import { parseJsonObject } from "@/types/json";
import type { ConfigIssue } from "@/types/validation";
import { defineNode } from "../registry";
import { EngineError } from "../types";

/** Shared by both payload-driven triggers: parse the sample JSON or fail loudly. */
function parseTriggerPayload(raw: string, label: string) {
  const parsed = parseJsonObject(raw);
  if (!parsed.ok) {
    throw new EngineError("invalid-payload", `${label}: ${parsed.error}`);
  }
  return parsed.value;
}

function jsonPayloadIssue(field: string, raw: string): ConfigIssue[] {
  const result = parseJsonObject(raw);
  if (result.ok) return [];
  return [
    {
      code: "invalid-json",
      level: "error",
      message: `Payload: ${result.error}`,
      field,
    },
  ];
}

export const manualTrigger = defineNode<"trigger.manual">({
  type: "trigger.manual",
  category: "trigger",
  title: "Manual Trigger",
  description: "Starts the flow when you press Run, with a sample payload you control.",
  inputs: [],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    payloadJson: JSON.stringify(
      {
        user: { name: "Ada Lovelace", email: "ada@example.com", plan: "pro" },
        source: "landing-page",
        budget: 1200,
      },
      null,
      2,
    ),
  },
  latencyMs: LATENCY_MIN_MS,
  requiredFields: [],
  validateConfig: (config) => jsonPayloadIssue("config.payloadJson", config.payloadJson),
  execute: async (_input, config) => ({
    payload: parseTriggerPayload(config.payloadJson, "Sample payload"),
    meta: { trigger: "manual" },
  }),
});

export const webhookTrigger = defineNode<"trigger.webhook">({
  type: "trigger.webhook",
  category: "trigger",
  title: "Webhook Trigger",
  description: "Fires when an external service posts to a generated URL. Simulated.",
  inputs: [],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: {
    samplePayloadJson: JSON.stringify(
      {
        lead: { name: "Grace Hopper", company: "Navy", email: "grace@example.com" },
        budget: 850,
        message: "We need help automating our reporting.",
      },
      null,
      2,
    ),
  },
  latencyMs: 380,
  requiredFields: [],
  validateConfig: (config) =>
    jsonPayloadIssue("config.samplePayloadJson", config.samplePayloadJson),
  execute: async (_input, config) => ({
    payload: parseTriggerPayload(config.samplePayloadJson, "Sample payload"),
    meta: { trigger: "webhook", url: "https://hook.flowforge.dev/in/a3f9c1e7b2" },
  }),
});

/** Accepts 5- or 6-field cron expressions; we only need the shape to be plausible. */
const CRON_PATTERN = /^(\S+\s+){4,5}\S+$/;

export const scheduleTrigger = defineNode<"trigger.schedule">({
  type: "trigger.schedule",
  category: "trigger",
  title: "Schedule Trigger",
  description: "Fires on a cron schedule. Simulated: fires once per Run.",
  inputs: [],
  outputs: [{ id: "out", label: "Output" }],
  defaultConfig: { cron: "0 9 * * 1-5", timezone: "Africa/Lagos" },
  latencyMs: 340,
  requiredFields: ["cron"],
  validateConfig: (config) => {
    const issues: ConfigIssue[] = [];
    const cron = config.cron.trim();

    if (cron.length === 0) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "A cron expression is required.",
        field: "config.cron",
      });
    } else if (!CRON_PATTERN.test(cron)) {
      issues.push({
        code: "invalid-config",
        level: "error",
        message: "Expected 5 or 6 space-separated cron fields, e.g. \"0 9 * * 1-5\".",
        field: "config.cron",
      });
    }

    if (config.timezone.trim().length === 0) {
      issues.push({
        code: "missing-required-config",
        level: "error",
        message: "A timezone is required.",
        field: "config.timezone",
      });
    }

    return issues;
  },
  execute: async (_input, config, ctx) => ({
    payload: {
      cron: config.cron.trim(),
      timezone: config.timezone,
      // Simulated: the schedule fires once, now, rather than on real time.
      firedAt: new Date(ctx.now()).toISOString(),
      simulated: true,
    },
    meta: { trigger: "schedule" },
  }),
});
