"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, LayoutTemplate, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { autoLayout } from "@/lib/layout";
import { TEMPLATES, TEMPLATE_TAGS, filterTemplates, type Template } from "@/lib/templates";
import { useWorkflowStore } from "@/store/workflowStore";
import { useRunStore } from "@/store/runStore";
import { TextInput } from "@/components/nodes/forms/fields";

/**
 * Template gallery.
 *
 * Templates are laid out on load rather than shipped with hardcoded coordinates,
 * so the auto-layout algorithm is what positions them — one fewer place to keep in
 * sync when the node chrome changes size.
 */
export function TemplateGallery({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const replaceGraph = useWorkflowStore((state) => state.replaceGraph);
  const createNewWorkflow = useWorkflowStore((state) => state.createNewWorkflow);
  const resetStatuses = useRunStore((state) => state.resetStatuses);
  const [pending, setPending] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => filterTemplates(TEMPLATES, { tag, query }), [tag, query]);

  const apply = (template: Template, asNewWorkflow: boolean) => {
    setPending(template.id);

    // structuredClone is not needed: build() returns a fresh graph each call.
    const graph = template.build();
    // autoLayout moves nodes; edges follow their endpoints automatically.
    const laidOut = autoLayout(graph.nodes, graph.edges);

    if (asNewWorkflow) createNewWorkflow(template.name);
    replaceGraph(laidOut.nodes, graph.edges, template.name);
    resetStatuses();

    setPending(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="size-4 text-accent" aria-hidden />
            Start from a template
          </DialogTitle>
          <DialogDescription>
            Each template is a working flow with realistic sample data. Loading one replaces the
            current canvas, so undo is available if you change your mind.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="Search templates… (name, tag or description)"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter templates by tag">
            <TagChip active={tag === null} onClick={() => setTag(null)} label="All" count={TEMPLATES.length} />
            {TEMPLATE_TAGS.map((entry) => (
              <TagChip
                key={entry}
                active={tag === entry}
                onClick={() => setTag(tag === entry ? null : entry)}
                label={entry}
                count={TEMPLATES.filter((template) => template.tags.includes(entry)).length}
              />
            ))}
          </div>
        </div>

        <div className="-mr-2 grid max-h-[46vh] gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
          {visible.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
              No template matches {tag ? `the “${tag}” tag` : "your search"}
              {query ? ` and “${query}”` : ""}.
            </p>
          )}

          {visible.map((template, index) => (
            <motion.article
              key={template.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className={cn(
                "flex flex-col rounded-lg border border-border bg-surface-raised p-4",
                "transition-colors hover:border-accent/45 active:border-accent/70",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
                <span className="shrink-0 rounded-full border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {template.category}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {template.tags.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setTag(tag === entry ? null : entry)}
                    className={cn(
                      "rounded-full border px-2 py-1 font-mono text-[10px] transition-colors",
                      tag === entry
                        ? "border-accent/60 bg-accent/15 text-accent"
                        : "border-border text-muted-foreground hover:border-accent/45 hover:text-foreground",
                    )}
                  >
                    #{entry}
                  </button>
                ))}
              </div>

              <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                {template.description}
              </p>

              <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                {template.nodeCount} nodes
              </p>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={pending !== null}
                  onClick={() => apply(template, false)}
                >
                  {pending === template.id ? <Sparkles aria-hidden /> : <ArrowRight aria-hidden />}
                  Load
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending !== null}
                  onClick={() => apply(template, true)}
                  aria-label={`Load ${template.name} into a new workflow`}
                >
                  As new
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Filter chip: label plus the number of templates that carry the tag. */
function TagChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] transition-colors",
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-border text-muted-foreground hover:border-accent/45 hover:text-foreground",
      )}
    >
      {label}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}
