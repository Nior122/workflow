"use client";

import {
  Checkbox,
  Field,
  KeyValueEditor,
  NumberInput,
  Select,
  SliderInput,
  TextArea,
  TextInput,
  useFieldId,
} from "./fields";
import { errorFor, type ConfigFormProps } from "./types";
import { parseJsonObject } from "@/types/json";
import type {
  AiModel,
  AiPromptConfig,
  ConditionConfig,
  ConditionOperator,
  DelayConfig,
  HttpMethod,
  HttpRequestConfig,
  TextFormatterConfig,
  TransformConfig,
} from "@/types/nodes";

const MODELS: readonly { value: AiModel; label: string }[] = [
  { value: "ff-pro", label: "ff-pro — better reasoning" },
  { value: "ff-mini", label: "ff-mini — faster" },
];

export function AiPromptForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<AiPromptConfig>) {
  const systemId = useFieldId("ai-system");
  const promptId = useFieldId("ai-prompt");
  const modelId = useFieldId("ai-model");
  const tempId = useFieldId("ai-temp");

  return (
    <div className="space-y-4">
      <Field label="System prompt" htmlFor={systemId} hint="optional">
        <TextArea
          id={systemId}
          rows={2}
          value={config.systemPrompt}
          disabled={disabled}
          placeholder="You are a concise assistant."
          onChange={(systemPrompt) => onChange({ ...config, systemPrompt })}
        />
      </Field>

      <Field
        label="Prompt template"
        htmlFor={promptId}
        hint="{{variables}}"
        error={errorFor(issues, "promptTemplate")}
      >
        <TextArea
          id={promptId}
          rows={5}
          value={config.promptTemplate}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "promptTemplate"))}
          placeholder="Write a reply to {{user.name}}…"
          onChange={(promptTemplate) => onChange({ ...config, promptTemplate })}
        />
      </Field>

      <Field label="Model" htmlFor={modelId}>
        <Select
          id={modelId}
          value={config.model}
          options={MODELS}
          disabled={disabled}
          onChange={(model) => onChange({ ...config, model })}
        />
      </Field>

      <Field
        label="Temperature"
        htmlFor={tempId}
        error={errorFor(issues, "temperature")}
        hint="0 = deterministic"
      >
        <SliderInput
          id={tempId}
          value={config.temperature}
          min={0}
          max={1}
          step={0.1}
          disabled={disabled}
          onChange={(temperature) => onChange({ ...config, temperature })}
        />
      </Field>
    </div>
  );
}

const METHODS: readonly { value: HttpMethod; label: string }[] = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

export function HttpRequestForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<HttpRequestConfig>) {
  const methodId = useFieldId("http-method");
  const urlId = useFieldId("http-url");
  const bodyId = useFieldId("http-body");

  const bodyError = errorFor(issues, "bodyJson");
  const bodyParse =
    config.bodyJson.trim().length === 0 ? null : parseJsonObject(config.bodyJson);
  const bodyInvalid = Boolean(bodyError) || (bodyParse !== null && !bodyParse.ok);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <Field label="Method" htmlFor={methodId}>
          <Select
            id={methodId}
            value={config.method}
            options={METHODS}
            disabled={disabled}
            onChange={(method) => onChange({ ...config, method })}
          />
        </Field>

        <Field label="URL" htmlFor={urlId} error={errorFor(issues, "url")}>
          <TextInput
            id={urlId}
            mono
            value={config.url}
            disabled={disabled}
            invalid={Boolean(errorFor(issues, "url"))}
            placeholder="https://api.example.com/v1/…"
            onChange={(url) => onChange({ ...config, url })}
          />
        </Field>
      </div>

      <Field label="Headers" hint="key / value">
        <KeyValueEditor
          rows={config.headers}
          disabled={disabled}
          keyLabel="Header"
          valueLabel="Value"
          valuePlaceholder="application/json"
          emptyMessage="No headers. Most APIs are fine without any."
          onChange={(headers) => onChange({ ...config, headers })}
        />
      </Field>

      {config.method !== "GET" && (
        <Field
          label="Request body"
          htmlFor={bodyId}
          hint="JSON"
          error={bodyError ?? (bodyParse && !bodyParse.ok ? bodyParse.error : undefined)}
        >
          <TextArea
            id={bodyId}
            mono
            rows={5}
            value={config.bodyJson}
            disabled={disabled}
            invalid={bodyInvalid}
            placeholder='{"key": "value"}'
            onChange={(bodyJson) => onChange({ ...config, bodyJson })}
          />
        </Field>
      )}

      <p className="text-[11px] text-muted-foreground">
        No network request is made. The engine returns deterministic mock JSON shaped like a
        real response.
      </p>
    </div>
  );
}

const TRANSFORM_MODES: readonly { value: TransformConfig["mode"]; label: string }[] = [
  { value: "map", label: "Map — replace the payload" },
  { value: "merge", label: "Merge — spread over the input" },
];

export function TransformForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<TransformConfig>) {
  const modeId = useFieldId("transform-mode");

  return (
    <div className="space-y-4">
      <Field label="Mode" htmlFor={modeId}>
        <Select
          id={modeId}
          value={config.mode}
          options={TRANSFORM_MODES}
          disabled={disabled}
          onChange={(mode) => onChange({ ...config, mode })}
        />
      </Field>

      <Field
        label="Field mapping"
        error={errorFor(issues, "fields")}
        hint="values support {{variables}}"
      >
        <KeyValueEditor
          rows={config.fields}
          disabled={disabled}
          keyLabel="Output key"
          valueLabel="Value"
          valuePlaceholder="{{user.name}}"
          emptyMessage="No mappings yet — add one to shape the payload."
          onChange={(fields) => onChange({ ...config, fields })}
        />
      </Field>
    </div>
  );
}

const OPERATORS: readonly { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

export function ConditionForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<ConditionConfig>) {
  const leftId = useFieldId("cond-left");
  const opId = useFieldId("cond-op");
  const rightId = useFieldId("cond-right");
  const caseId = useFieldId("cond-case");

  const isTextual = config.operator === "equals" || config.operator === "contains";

  return (
    <div className="space-y-4">
      <Field
        label="Left operand"
        htmlFor={leftId}
        hint="literal or {{path}}"
        error={errorFor(issues, "left")}
      >
        <TextInput
          id={leftId}
          mono
          value={config.left}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "left"))}
          placeholder="{{budget}}"
          onChange={(left) => onChange({ ...config, left })}
        />
      </Field>

      <Field label="Operator" htmlFor={opId}>
        <Select
          id={opId}
          value={config.operator}
          options={OPERATORS}
          disabled={disabled}
          onChange={(operator) => onChange({ ...config, operator })}
        />
      </Field>

      <Field
        label="Right operand"
        htmlFor={rightId}
        hint={config.operator === "gt" || config.operator === "lt" ? "number" : "literal or {{path}}"}
        error={errorFor(issues, "right")}
      >
        <TextInput
          id={rightId}
          mono
          value={config.right}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "right"))}
          placeholder="500"
          onChange={(right) => onChange({ ...config, right })}
        />
      </Field>

      {isTextual && (
        <Checkbox
          id={caseId}
          checked={config.caseSensitive}
          disabled={disabled}
          label="Case sensitive comparison"
          onChange={(caseSensitive) => onChange({ ...config, caseSensitive })}
        />
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">
          matches → <span className="font-mono">true</span> handle
        </p>
        <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-error">
          else → <span className="font-mono">false</span> handle
        </p>
      </div>
    </div>
  );
}

export function DelayForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<DelayConfig>) {
  const id = useFieldId("delay-seconds");

  return (
    <div className="space-y-3">
      <Field
        label="Wait for"
        htmlFor={id}
        error={errorFor(issues, "seconds")}
        hint="simulation shortens this"
      >
        <NumberInput
          id={id}
          value={config.seconds}
          min={1}
          max={300}
          suffix="sec"
          disabled={disabled}
          onChange={(seconds) => onChange({ ...config, seconds })}
        />
      </Field>
      <p className="text-[11px] text-muted-foreground">
        Scaled by the execution speed control, so 2s at 2× runs in about 1s.
      </p>
    </div>
  );
}

export function TextFormatterForm({
  config,
  onChange,
  disabled,
  issues,
}: ConfigFormProps<TextFormatterConfig>) {
  const id = useFieldId("fmt-template");
  const tokens = [...config.template.matchAll(/\{\{\s*([\w.[\]]+)\s*\}\}/g)].map(
    (match) => match[1],
  );

  return (
    <div className="space-y-3">
      <Field
        label="Template"
        htmlFor={id}
        hint="{{variables}}"
        error={errorFor(issues, "template")}
      >
        <TextArea
          id={id}
          rows={5}
          value={config.template}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "template"))}
          placeholder="Lead: {{user.name}} — {{budget}}"
          onChange={(template) => onChange({ ...config, template })}
        />
      </Field>

      {tokens.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Referenced variables
          </p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(tokens)].map((token) => (
              <code
                key={token}
                className="rounded border border-accent/25 bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent"
              >
                {token}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
