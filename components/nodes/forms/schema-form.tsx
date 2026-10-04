"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileJson2 } from "lucide-react";
import type { ConfigFieldSchema, RegistryNodeDef } from "@/types/registry";
import type { ValidationIssue } from "@/types/validation";
import { createKeyValuePair, type KeyValuePair } from "@/types/nodes";
import {
  Checkbox,
  Field,
  KeyValueEditor,
  NumberInput,
  Select,
  SliderInput,
  TextArea,
} from "./fields";
import { CredentialPicker } from "./credential-picker";
import { ExpressionInput } from "./expression-input";

export type SchemaNodeFormProps = {
  nodeId: string;
  regNode: RegistryNodeDef;
  config: Record<string, unknown>;
  issues?: ValidationIssue[];
  disabled?: boolean;
  onChange: (patch: Record<string, unknown>) => void;
};

function isFieldVisible(
  field: ConfigFieldSchema,
  config: Record<string, unknown>,
): boolean {
  if (!field.showWhen) return true;
  const actual = config[field.showWhen.key];
  const expected = field.showWhen.equals;
  if (Array.isArray(expected)) return expected.includes(String(actual));
  return actual === expected;
}

/**
 * Auto-generated inspector form for any of the 130 declarative registry nodes.
 *
 * Every control is derived from the node's `configSchema`, so adding a node means
 * writing one definition — no bespoke React form component per integration.
 */
export function SchemaNodeForm({
  nodeId,
  regNode,
  config,
  issues = [],
  disabled,
  onChange,
}: SchemaNodeFormProps) {
  const [showSample, setShowSample] = useState(false);

  const errorFor = (fieldKey: string): string | undefined =>
    issues.find(
      (issue) =>
        issue.level === "error" &&
        (issue.field === `config.${fieldKey}` || issue.field === fieldKey),
    )?.message;

  const renderControl = (field: ConfigFieldSchema) => {
    const htmlId = `schema-${nodeId}-${field.key}`;
    const rawValue = config[field.key] ?? regNode.defaultConfig[field.key];

    switch (field.type) {
      case "credential":
        return (
          <CredentialPicker
            id={htmlId}
            provider={
              field.credentialProvider ??
              regNode.credentialProvider ??
              regNode.subcategory.toLowerCase()
            }
            value={String(rawValue ?? "")}
            disabled={disabled}
            onChange={(credId) => onChange({ [field.key]: credId })}
          />
        );

      case "select":
        return (
          <Select
            id={htmlId}
            value={String(rawValue ?? field.options?.[0]?.value ?? "")}
            options={field.options ?? []}
            disabled={disabled}
            onChange={(val) => onChange({ [field.key]: val })}
          />
        );

      case "multiselect": {
        const selected = Array.isArray(rawValue) ? (rawValue as string[]) : [];
        return (
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((opt) => {
              const active = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      [field.key]: active
                        ? selected.filter((v) => v !== opt.value)
                        : [...selected, opt.value],
                    })
                  }
                  className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors disabled:opacity-40 ${
                    active
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      case "boolean":
        return (
          <Checkbox
            id={htmlId}
            checked={Boolean(rawValue)}
            disabled={disabled}
            label={field.hint || field.label}
            onChange={(checked) => onChange({ [field.key]: checked })}
          />
        );

      case "number":
        return (
          <NumberInput
            id={htmlId}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            suffix={field.suffix}
            disabled={disabled}
            value={Number(rawValue ?? 0)}
            onChange={(val) => onChange({ [field.key]: val })}
          />
        );

      case "slider":
        return (
          <SliderInput
            id={htmlId}
            min={field.min ?? 0}
            max={field.max ?? 1}
            step={field.step ?? 0.1}
            disabled={disabled}
            value={Number(rawValue ?? field.min ?? 0)}
            onChange={(val) => onChange({ [field.key]: val })}
          />
        );

      case "keyValue":
        return (
          <KeyValueEditor
            rows={Array.isArray(rawValue) ? (rawValue as KeyValuePair[]) : []}
            keyLabel={field.keyLabel ?? "Key"}
            valueLabel={field.valueLabel ?? "Value"}
            valuePlaceholder={field.placeholder}
            disabled={disabled}
            emptyMessage={`No ${(field.keyLabel ?? "key").toLowerCase()} yet.`}
            onChange={(rows) => onChange({ [field.key]: rows })}
          />
        );

      case "json":
      case "code":
        return (
          <TextArea
            id={htmlId}
            rows={5}
            value={String(rawValue ?? "")}
            placeholder={field.placeholder}
            disabled={disabled}
            mono
            onChange={(val) => onChange({ [field.key]: val })}
          />
        );

      case "textarea":
        return (
          <ExpressionInput
            id={htmlId}
            nodeId={nodeId}
            multiline
            rows={3}
            value={String(rawValue ?? "")}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(val) => onChange({ [field.key]: val })}
          />
        );

      case "expression":
      case "text":
      default:
        return (
          <ExpressionInput
            id={htmlId}
            nodeId={nodeId}
            value={String(rawValue ?? "")}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(val) => onChange({ [field.key]: val })}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {regNode.configSchema
        .filter((field) => isFieldVisible(field, config))
        .map((field) => (
          <Field
            key={field.key}
            label={field.required ? `${field.label} *` : field.label}
            htmlFor={`schema-${nodeId}-${field.key}`}
            hint={field.hint}
            error={errorFor(field.key)}
          >
            {renderControl(field)}
          </Field>
        ))}

      <div className="rounded-md border border-border bg-surface">
        <button
          type="button"
          onClick={() => setShowSample((v) => !v)}
          aria-expanded={showSample}
          className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <FileJson2 className="size-3.5 text-accent" aria-hidden />
            Sample output payload
          </span>
          {showSample ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
        </button>
        {showSample && (
          <pre className="ff-scroll max-h-48 overflow-auto border-t border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
            {JSON.stringify(regNode.sampleOutput, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

/** Re-export so tests can build rows without importing the fields module directly. */
export { createKeyValuePair };
