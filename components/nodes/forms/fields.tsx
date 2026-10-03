"use client";

import { useId, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createKeyValuePair, type KeyValuePair } from "@/types/nodes";

const controlClass =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/60 transition-colors " +
  "hover:border-border focus:border-accent focus:outline-none disabled:opacity-60";

/** Label + control + inline error. Every field in every form goes through this. */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-2 text-xs font-medium text-foreground"
      >
        <span>{label}</span>
        {hint && <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-[11px] leading-snug text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  mono,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  mono?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      className={cn(controlClass, mono && "font-mono text-xs", invalid && "border-error")}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  rows = 4,
  mono,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  rows?: number;
  mono?: boolean;
  invalid?: boolean;
}) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      spellCheck={false}
      className={cn(
        controlClass,
        "resize-y leading-relaxed",
        mono && "font-mono text-xs",
        invalid && "border-error",
      )}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  id,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(controlClass, "cursor-pointer appearance-none pr-7")}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C9CA6' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  id,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          onChange(Number.isNaN(next) ? 0 : next);
        }}
        className={cn(controlClass, "font-mono text-xs tabular-nums", suffix && "pr-12")}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function SliderInput({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  disabled,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--accent))]"
      />
      <span className="w-9 text-right font-mono text-xs text-muted-foreground tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 cursor-pointer rounded border-border accent-[hsl(var(--accent))]"
      />
      {label}
    </label>
  );
}

/**
 * Key-value editor used by HTTP headers, Transform fields and Sheets columns.
 * Rows carry a stable id so React keys survive reordering and edits.
 */
export function KeyValueEditor({
  rows,
  onChange,
  keyLabel,
  valueLabel,
  valuePlaceholder,
  disabled,
  emptyMessage,
}: {
  rows: KeyValuePair[];
  onChange: (rows: KeyValuePair[]) => void;
  keyLabel: string;
  valueLabel: string;
  valuePlaceholder?: string;
  disabled?: boolean;
  emptyMessage: string;
}) {
  const update = (id: string, patch: Partial<KeyValuePair>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1.2fr_auto] gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        <span>{keyLabel}</span>
        <span>{valueLabel}</span>
        <span className="sr-only">Remove</span>
      </div>

      {rows.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground">
          {emptyMessage}
        </p>
      )}

      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-1.5">
          <input
            type="text"
            value={row.key}
            disabled={disabled}
            aria-label={keyLabel}
            placeholder="name"
            onChange={(event) => update(row.id, { key: event.target.value })}
            className={cn(controlClass, "font-mono text-xs")}
          />
          <input
            type="text"
            value={row.value}
            disabled={disabled}
            aria-label={valueLabel}
            placeholder={valuePlaceholder}
            onChange={(event) => update(row.id, { value: event.target.value })}
            className={cn(controlClass, "font-mono text-xs")}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(rows.filter((entry) => entry.id !== row.id))}
            aria-label={`Remove ${row.key || "row"}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-error/15 hover:text-error disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, createKeyValuePair()])}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-40"
      >
        <Plus className="size-3" aria-hidden />
        Add {keyLabel.toLowerCase()}
      </button>
    </div>
  );
}

/** Generates a stable id per field instance so labels wire to their control. */
export function useFieldId(prefix: string): string {
  const reactId = useId();
  return `${prefix}-${reactId}`;
}
