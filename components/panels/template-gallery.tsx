"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, LayoutTemplate, Sparkles } from "lucide-react";
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
import { TEMPLATES, type Template } from "@/lib/templates";
import { useWorkflowStore } from "@/store/workflowStore";
import { useRunStore } from "@/store/runStore";

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

        <div className="-mr-2 grid max-h-[52vh] gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
          {TEMPLATES.map((template, index) => (
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
