"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  ChevronRight,
  Coins,
  Cpu,
  GitBranch,
  Hash,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRunStore } from "@/store/runStore";
import { useUiStore } from "@/store/uiStore";
import type { AgentTraceStep } from "@/types/run";

/**
 * AI Agent Reasoning Trace drawer.
 *
 * Slides in from the right when the user clicks the `Trace` affordance on an AI
 * Agent node (or the inspector banner). Renders every thought → tool → observation
 * step with per-step latency, nested sub-agent traces from `aiTool.callAgent`, and
 * the run's aggregated token/cost accounting.
 */
export function AgentTraceDrawer() {
  const nodeId = useUiStore((state) => state.agentTraceNodeId);
  const setAgentTraceNodeId = useUiStore((state) => state.setAgentTraceNodeId);
  const steps = useRunStore((state) => state.steps);

  const step = useMemo(
    () => (nodeId ? steps.find((entry) => entry.nodeId === nodeId) : undefined),
    [nodeId, steps],
  );

  const agentPayload = step?.output?.agent as
    | {
        model?: string;
        memory?: string | null;
        stepsUsed?: number;
        toolsUsed?: string[];
        tokensIn?: number;
        tokensOut?: number;
        estimatedCostUsd?: number;
      }
    | undefined;

  const trace: AgentTraceStep[] = step?.trace ?? [];

  return (
    <AnimatePresence>
      {nodeId && (
        <motion.aside
          key="agent-trace"
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
          aria-label="AI Agent reasoning trace"
          className="absolute top-0 right-0 z-menu flex h-full w-[26rem] max-w-[92vw] flex-col border-l border-border bg-surface shadow-2xl"
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-md border border-accent/40 bg-accent/15 text-accent"
            >
              <BrainCircuit className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-foreground">
                Agent reasoning trace
              </h2>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {step?.nodeLabel ?? "AI Agent"} · {nodeId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAgentTraceNodeId(null)}
              aria-label="Close reasoning trace"
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </header>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border px-4 py-3">
            <MetricTile
              icon={<Cpu className="size-3" aria-hidden />}
              label="Model"
              value={agentPayload?.model ?? "—"}
            />
            <MetricTile
              icon={<GitBranch className="size-3" aria-hidden />}
              label="Steps"
              value={String(agentPayload?.stepsUsed ?? trace.length)}
            />
            <MetricTile
              icon={<Wrench className="size-3" aria-hidden />}
              label="Tools used"
              value={String(agentPayload?.toolsUsed?.length ?? 0)}
            />
            <MetricTile
              icon={<Coins className="size-3" aria-hidden />}
              label="Cost"
              value={
                step?.tokenUsage
                  ? `$${step.tokenUsage.estimatedCostUsd.toFixed(5)}`
                  : agentPayload?.estimatedCostUsd !== undefined
                    ? `$${agentPayload.estimatedCostUsd.toFixed(5)}`
                    : "—"
              }
            />
            <MetricTile
              icon={<Hash className="size-3" aria-hidden />}
              label="Tokens in"
              value={String(step?.tokenUsage?.promptTokens ?? agentPayload?.tokensIn ?? 0)}
            />
            <MetricTile
              icon={<Hash className="size-3" aria-hidden />}
              label="Tokens out"
              value={String(
                step?.tokenUsage?.completionTokens ?? agentPayload?.tokensOut ?? 0,
              )}
            />
          </div>

          {agentPayload?.memory && (
            <p className="shrink-0 border-b border-border px-4 py-2 font-mono text-[11px] text-teal-400">
              Memory: {agentPayload.memory}
            </p>
          )}

          <div className="ff-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {trace.length === 0 ? (
              <p className="py-8 text-center text-xs leading-relaxed text-muted-foreground">
                Run the workflow to record this agent&apos;s thought, tool, and observation
                steps.
              </p>
            ) : (
              <ol className="space-y-3">
                {trace.map((entry, index) => (
                  <li
                    key={`${entry.step}-${index}`}
                    className="rounded-md border border-border bg-surface-raised p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-accent">
                        Step {entry.step}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {entry.durationMs}ms
                      </span>
                    </div>

                    <p className="mt-2 text-[12px] leading-relaxed text-foreground/90">
                      {entry.thought}
                    </p>

                    {entry.toolLabel && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-400">
                        <Wrench className="size-2.5" aria-hidden />
                        {entry.toolLabel}
                        {entry.subNodeId ? ` · ${entry.subNodeId}` : ""}
                      </p>
                    )}

                    {entry.toolInput && (
                      <pre className="mt-2 overflow-x-auto rounded border border-border bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                        {entry.toolInput}
                      </pre>
                    )}

                    {entry.observation && (
                      <p className="mt-2 flex gap-2 text-[11px] leading-relaxed text-emerald-400">
                        <ChevronRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span>{entry.observation}</span>
                      </p>
                    )}

                    {entry.nestedTrace && entry.nestedTrace.length > 0 && (
                      <div className="mt-3 rounded-md border border-dashed border-border bg-background/50 p-2">
                        <p className="mb-2 font-mono text-[10px] font-semibold tracking-wide text-teal-400 uppercase">
                          Nested sub-agent trace
                        </p>
                        <ol className="space-y-2">
                          {entry.nestedTrace.map((nested, nestedIndex) => (
                            <li key={`${nested.step}-${nestedIndex}`} className="pl-2">
                              <p className="font-mono text-[10px] text-muted-foreground">
                                Sub-step {nested.step} · {nested.durationMs}ms
                              </p>
                              <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">
                                {nested.thought}
                              </p>
                              {nested.toolInput && (
                                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                  {nested.toolInput}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function MetricTile({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface-raised px-2 py-1.5",
        className,
      )}
    >
      <p className="flex items-center gap-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-[11px] text-foreground">{value}</p>
    </div>
  );
}
