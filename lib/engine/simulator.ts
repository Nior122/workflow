/**
 * Deterministic stand-ins for the third-party services.
 *
 * No network calls happen anywhere in this project. Every "integration" returns
 * canned data built from the inputs it was given, so a flow produces the same
 * result every run given the same RNG — which is what makes the engine testable
 * and the demo reproducible.
 */

import type { JsonValue, NodePayload } from "@/types/json";
import type { HttpMethod } from "@/types/nodes";

const AI_REPLIES = [
  "Thanks for reaching out — I've read through your note and I think we can help. Could we book 20 minutes this week to walk through your current setup?",
  "Appreciate the detail here. Based on what you've described, the quickest win would be automating the first step and reviewing the output for a week before going further.",
  "Good news: this is a problem we see often and it has a straightforward fix. I'll send over a short outline of the approach and a couple of examples.",
  "Thanks for the context. I'd suggest starting small — one workflow, one metric — and expanding once the numbers look right. Happy to sketch that out.",
] as const;

const AI_CLASSIFICATIONS = ["billing", "technical", "sales", "account"] as const;

/**
 * Pick a canned AI reply.
 *
 * `random` is injected, and temperature biases how far from the first entry we
 * reach, so the knob visibly changes output without making tests unpredictable.
 */
export function simulateAiReply(options: {
  prompt: string;
  temperature: number;
  random: () => number;
  systemPrompt: string;
}): { text: string; tokensIn: number; tokensOut: number; classification?: string } {
  const { prompt, temperature, random, systemPrompt } = options;

  const classifying = /classif|categoris|categoriz|label|triage|route/i.test(
    `${systemPrompt} ${prompt}`,
  );

  if (classifying) {
    const classification = AI_CLASSIFICATIONS[Math.floor(random() * AI_CLASSIFICATIONS.length)];
    return {
      text: classification,
      tokensIn: Math.ceil(prompt.length / 4),
      tokensOut: 1,
      classification,
    };
  }

  // Higher temperature reaches further into the list.
  const reach = Math.max(1, Math.round(AI_REPLIES.length * Math.min(1, temperature + 0.25)));
  const index = Math.floor(random() * reach) % AI_REPLIES.length;
  const text = AI_REPLIES[index];

  return {
    text,
    tokensIn: Math.ceil(prompt.length / 4),
    tokensOut: Math.ceil(text.length / 4),
  };
}

const HTTP_STATUSES: Record<HttpMethod, number> = {
  GET: 200,
  POST: 201,
  PUT: 200,
  PATCH: 200,
  DELETE: 204,
};

/**
 * Mock HTTP response.
 *
 * Shaped like a real paginated API so downstream Transform and Filter nodes have
 * something realistic to work with, and the URL influences the payload so
 * different requests do not return identical data.
 */
export function simulateHttpResponse(options: {
  method: HttpMethod;
  url: string;
  random: () => number;
}): { status: number; body: NodePayload } {
  const { method, url, random } = options;
  const status = HTTP_STATUSES[method];

  if (method === "DELETE") {
    return { status, body: { deleted: true, url } };
  }

  const overdue = /invoice|overdue|payment/i.test(url);

  if (overdue) {
    return {
      status,
      body: {
        data: [
          { id: "inv-1042", customer: "Hopper Ltd", amount: 2400, daysOverdue: 18 },
          { id: "inv-1043", customer: "Turing Co", amount: 890, daysOverdue: 4 },
          { id: "inv-1051", customer: "Lovelace Lab", amount: 5120, daysOverdue: 41 },
        ],
        page: 1,
        total: 3,
      },
    };
  }

  const id = Math.floor(random() * 9000) + 1000;
  return {
    status,
    body: {
      data: { id, ok: true, requestedUrl: url },
      meta: { latencyMs: 120 + Math.floor(random() * 200) },
    },
  };
}

/** Echo of what an email node "sent". */
export function simulateEmailSent(options: {
  to: string;
  subject: string;
  body: string;
}): NodePayload {
  return {
    delivered: true,
    transport: "simulated",
    to: options.to,
    subject: options.subject,
    body: options.body,
    messageId: `sim-${hashString(`${options.to}${options.subject}`)}`,
  };
}

export function simulateSlackPosted(options: {
  channel: string;
  message: string;
}): NodePayload {
  return {
    posted: true,
    transport: "simulated",
    channel: options.channel,
    text: options.message,
    ts: `${Math.floor(Date.now() / 1000)}.000100`,
  };
}

export function simulateSheetRowAppended(options: {
  spreadsheet: string;
  row: Record<string, JsonValue>;
  rowIndex: number;
}): NodePayload {
  return {
    appended: true,
    transport: "simulated",
    spreadsheet: options.spreadsheet,
    rowIndex: options.rowIndex,
    row: options.row,
  };
}

/** Small stable string hash — used for fake ids so they are reproducible. */
export function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
