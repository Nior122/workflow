"use client";

import { useMemo, useState } from "react";
import { Braces, Eye } from "lucide-react";
import { getRegistryNode } from "@/lib/nodes";
import { renderTemplate, type VariableScope } from "@/lib/engine/variables";
import { useWorkflowStore } from "@/store/workflowStore";
import type { NodePayload } from "@/types/json";
import { TextArea, TextInput } from "./fields";

export type ExpressionInputProps = {
  id?: string;
  nodeId: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  onChange: (next: string) => void;
};

/**
 * Expression-aware text field.
 *
 * Supports n8n-style `{{ $json.field }}` and `{{ $node["Name"].json.field }}`
 * alongside legacy `{{dot.path}}` tokens, offers autocomplete chips built from the
 * upstream nodes' `sampleOutput`, and shows a live resolved preview.
 */
export function ExpressionInput({
  id,
  nodeId,
  value,
  placeholder,
  multiline = false,
  rows = 3,
  disabled,
  onChange,
}: ExpressionInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const { scope, suggestions } = useMemo(() => {
    const incomingNodeIds = new Set(
      edges.filter((e) => e.target === nodeId).map((e) => e.source),
    );
    const nodesMap: Record<string, NodePayload> = {};
    const nodesByLabel: Record<string, NodePayload> = {};

    let mergedSample: NodePayload = {
      text: "Sample message from upstream",
      email: "ada@example.com",
      from: "+2348031234567",
      amount: 1200,
      category: "billing",
      user: { name: "Ada Lovelace", email: "ada@example.com", plan: "pro" },
    };

    const chips: string[] = [
      "{{ $json.text }}",
      "{{ $json.email }}",
      "{{ $json.user.name }}",
      "{{ $json.text.toUpperCase() }}",
      "{{ Date.now() }}",
    ];

    for (const n of nodes) {
      if (n.id === nodeId) continue;
      const reg = getRegistryNode(n.type);
      const sample = (reg?.sampleOutput ?? {}) as NodePayload;
      nodesMap[n.id] = sample;
      nodesByLabel[n.data.label] = sample;

      if (incomingNodeIds.has(n.id)) {
        mergedSample = { ...mergedSample, ...sample };
        for (const key of Object.keys(sample).slice(0, 3)) {
          chips.unshift(`{{ $json.${key} }}`);
          chips.push(`{{ $node["${n.data.label}"].json.${key} }}`);
        }
      }
    }

    const builtScope: VariableScope = {
      payload: mergedSample,
      nodes: nodesMap,
      nodesByLabel,
      run: {
        id: "preview-run",
        workflowName: "Preview",
        startedAt: 1_760_000_000_000,
        speed: 1,
      },
      now: () => 1_760_000_000_000,
    };

    return { scope: builtScope, suggestions: [...new Set(chips)].slice(0, 8) };
  }, [nodes, edges, nodeId]);

  const hasExpression = value.includes("{{");
  const preview = useMemo(
    () => (hasExpression ? renderTemplate(value, scope) : null),
    [hasExpression, value, scope],
  );

  const insertToken = (token: string) => {
    onChange(value ? `${value} ${token}` : token);
    setShowPicker(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        {multiline ? (
          <TextArea
            id={id}
            rows={rows}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            mono
            onChange={onChange}
          />
        ) : (
          <TextInput
            id={id}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            mono
            onChange={onChange}
          />
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowPicker((v) => !v)}
          title="Insert {{ $json }} or upstream node expression"
          aria-label="Show expression suggestions"
          className="absolute top-2 right-2 rounded border border-border bg-surface-raised px-1.5 py-1 text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Braces className="size-3" aria-hidden />
        </button>
      </div>

      {showPicker && (
        <div className="rounded-md border border-border bg-surface p-2">
          <p className="mb-2 font-mono text-[10px] text-muted-foreground">
            Click to insert an expression:
          </p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => insertToken(chip)}
                className="rounded border border-border bg-surface-raised px-2 py-1 font-mono text-[10px] text-accent transition-colors hover:border-accent"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="flex items-start gap-2 rounded border border-border/70 bg-surface/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <Eye className="mt-0.5 size-3 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-foreground/85">
            {preview.text || "(empty)"}
          </span>
          {preview.unresolved.length > 0 && (
            <span className="shrink-0 text-warning">
              {preview.unresolved.length} unresolved
            </span>
          )}
        </div>
      )}
    </div>
  );
}
