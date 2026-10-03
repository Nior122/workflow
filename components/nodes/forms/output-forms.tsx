"use client";

import { Field, KeyValueEditor, TextArea, TextInput, useFieldId } from "./fields";
import { errorFor, type ConfigFormProps } from "./types";
import type { EmailConfig, LogConfig, SheetsConfig, SlackConfig } from "@/types/nodes";

export function EmailForm({ config, onChange, disabled, issues }: ConfigFormProps<EmailConfig>) {
  const toId = useFieldId("email-to");
  const subjectId = useFieldId("email-subject");
  const bodyId = useFieldId("email-body");

  return (
    <div className="space-y-4">
      <Field
        label="To"
        htmlFor={toId}
        hint="literal or {{path}}"
        error={errorFor(issues, "to")}
      >
        <TextInput
          id={toId}
          mono
          value={config.to}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "to"))}
          placeholder="{{lead.email}}"
          onChange={(to) => onChange({ ...config, to })}
        />
      </Field>

      <Field label="Subject" htmlFor={subjectId} error={errorFor(issues, "subject")}>
        <TextInput
          id={subjectId}
          value={config.subject}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "subject"))}
          placeholder="Thanks for reaching out"
          onChange={(subject) => onChange({ ...config, subject })}
        />
      </Field>

      <Field label="Body" htmlFor={bodyId} error={errorFor(issues, "body")}>
        <TextArea
          id={bodyId}
          rows={7}
          value={config.body}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "body"))}
          onChange={(body) => onChange({ ...config, body })}
        />
      </Field>

      <p className="text-[11px] text-muted-foreground">
        Nothing is sent. The composed email appears in the run console instead.
      </p>
    </div>
  );
}

export function SlackForm({ config, onChange, disabled, issues }: ConfigFormProps<SlackConfig>) {
  const channelId = useFieldId("slack-channel");
  const messageId = useFieldId("slack-message");
  const channelIssue =
    errorFor(issues, "channel") ??
    issues?.find((issue) => issue.field === "config.channel" && issue.level === "warning")
      ?.message;

  return (
    <div className="space-y-4">
      <Field label="Channel" htmlFor={channelId} error={channelIssue}>
        <TextInput
          id={channelId}
          mono
          value={config.channel}
          disabled={disabled}
          placeholder="#new-leads"
          onChange={(channel) => onChange({ ...config, channel })}
        />
      </Field>

      <Field label="Message" htmlFor={messageId} error={errorFor(issues, "message")}>
        <TextArea
          id={messageId}
          rows={5}
          value={config.message}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "message"))}
          onChange={(message) => onChange({ ...config, message })}
        />
      </Field>

      <p className="text-[11px] text-muted-foreground">
        Slack markdown (*bold*, _italic_) is preserved in the console output.
      </p>
    </div>
  );
}

export function SheetsForm({ config, onChange, disabled, issues }: ConfigFormProps<SheetsConfig>) {
  const sheetId = useFieldId("sheets-name");

  return (
    <div className="space-y-4">
      <Field label="Spreadsheet" htmlFor={sheetId} error={errorFor(issues, "spreadsheet")}>
        <TextInput
          id={sheetId}
          value={config.spreadsheet}
          disabled={disabled}
          invalid={Boolean(errorFor(issues, "spreadsheet"))}
          placeholder="Leads — 2026"
          onChange={(spreadsheet) => onChange({ ...config, spreadsheet })}
        />
      </Field>

      <Field
        label="Column mapping"
        error={errorFor(issues, "columns")}
        hint="header / value"
      >
        <KeyValueEditor
          rows={config.columns}
          disabled={disabled}
          keyLabel="Column"
          valueLabel="Value"
          valuePlaceholder="{{lead.name}}"
          emptyMessage="No columns mapped — add at least one."
          onChange={(columns) => onChange({ ...config, columns })}
        />
      </Field>

      <p className="text-[11px] text-muted-foreground">
        Appends one row per run. Written to the console, never to a real sheet.
      </p>
    </div>
  );
}

export function LogForm({ config, onChange, disabled }: ConfigFormProps<LogConfig>) {
  const id = useFieldId("log-label");

  return (
    <div className="space-y-4">
      <Field label="Label" htmlFor={id} hint="optional">
        <TextInput
          id={id}
          value={config.label}
          disabled={disabled}
          placeholder="Final payload"
          onChange={(label) => onChange({ ...config, label })}
        />
      </Field>
      <p className="text-[11px] text-muted-foreground">
        Prints whatever arrives on the input to the run console, unchanged.
      </p>
    </div>
  );
}
