"use client";

import { Field, TextArea, TextInput, useFieldId } from "./fields";
import { errorFor, type ConfigFormProps } from "./types";
import { parseJsonObject } from "@/types/json";
import type {
  ManualTriggerConfig,
  ScheduleTriggerConfig,
  WebhookTriggerConfig,
} from "@/types/nodes";

/** Live parse feedback so a broken payload is caught while typing, not at Run. */
function jsonStatus(raw: string): { ok: boolean; detail: string } {
  const result = parseJsonObject(raw);
  if (!result.ok) return { ok: false, detail: result.error };
  const keys = Object.keys(result.value);
  return {
    ok: true,
    detail: keys.length === 0 ? "empty object" : `${keys.length} field${keys.length === 1 ? "" : "s"}`,
  };
}

export function ManualTriggerForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<ManualTriggerConfig>) {
  const id = useFieldId("manual-payload");
  const status = jsonStatus(config.payloadJson);
  const error = errorFor(issues, "payloadJson");

  return (
    <Field
      label="Sample payload"
      htmlFor={id}
      hint="JSON"
      error={error ?? (status.ok ? undefined : status.detail)}
    >
      <TextArea
        id={id}
        mono
        rows={10}
        value={config.payloadJson}
        disabled={disabled}
        invalid={!status.ok || Boolean(error)}
        onChange={(payloadJson) => onChange({ ...config, payloadJson })}
      />
      <p className="font-mono text-[10px] text-muted-foreground">
        {status.ok ? status.detail : "invalid JSON"}
      </p>
    </Field>
  );
}

export function WebhookTriggerForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<WebhookTriggerConfig>) {
  const id = useFieldId("webhook-payload");
  const status = jsonStatus(config.samplePayloadJson);
  const error = errorFor(issues, "samplePayloadJson");

  // Derived and fake by design — there is no backend to receive this.
  const fakeUrl = "https://hook.flowforge.dev/in/a3f9c1e7b2";

  return (
    <div className="space-y-4">
      <Field label="Webhook URL" hint="simulated">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {fakeUrl}
          </code>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No server exists — the sample payload below is what the trigger emits.
        </p>
      </Field>

      <Field
        label="Sample payload"
        htmlFor={id}
        hint="JSON"
        error={error ?? (status.ok ? undefined : status.detail)}
      >
        <TextArea
          id={id}
          mono
          rows={10}
          value={config.samplePayloadJson}
          disabled={disabled}
          invalid={!status.ok || Boolean(error)}
          onChange={(samplePayloadJson) => onChange({ ...config, samplePayloadJson })}
        />
      </Field>
    </div>
  );
}

const TIMEZONES = [
  "Africa/Lagos",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

const CRON_PRESETS = [
  { label: "Every weekday 09:00", value: "0 9 * * 1-5" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every Monday 08:00", value: "0 8 * * 1" },
  { label: "First of month, noon", value: "0 12 1 * *" },
];

export function ScheduleTriggerForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<ScheduleTriggerConfig>) {
  const cronId = useFieldId("schedule-cron");
  const tzId = useFieldId("schedule-tz");

  return (
    <div className="space-y-4">
      <Field
        label="Cron expression"
        htmlFor={cronId}
        hint="5 or 6 fields"
        error={errorFor(issues, "cron")}
      >
        <TextInput
          id={cronId}
          mono
          value={config.cron}
          disabled={disabled}
          placeholder="0 9 * * 1-5"
          invalid={Boolean(errorFor(issues, "cron"))}
          onChange={(cron) => onChange({ ...config, cron })}
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {CRON_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...config, cron: preset.value })}
            className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-40"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Field label="Timezone" htmlFor={tzId} error={errorFor(issues, "timezone")}>
        <select
          id={tzId}
          value={TIMEZONES.includes(config.timezone as (typeof TIMEZONES)[number]) ? config.timezone : TIMEZONES[0]}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, timezone: event.target.value })}
          className="w-full cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace("_", " ")}
            </option>
          ))}
        </select>
      </Field>

      <p className="text-[11px] text-muted-foreground">
        Simulated: the schedule fires once per Run rather than on real time.
      </p>
    </div>
  );
}
