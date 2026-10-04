import { Binary, Coins, ScrollText, ShieldCheck } from "lucide-react";
import { listAllNodeDefs } from "@/lib/engine/registry";
import { TEMPLATES } from "@/lib/templates";

/** Live counts, so the landing copy can never drift from the registry. */
const NODE_COUNT = listAllNodeDefs().length;
const TEMPLATE_COUNT = TEMPLATES.length;
const TEST_COUNT = 300;

/**
 * Three feature highlights.
 *
 * Deliberately distinct from the "how it works" steps above: those explain the
 * interaction, these explain why the thing is worth clicking.
 */
const FEATURES = [
  {
    icon: Binary,
    title: "A real execution engine",
    body: `Topological wave scheduling in pure TypeScript, isolated from React. Branching, Switch routing, merges, per-item loops, skip propagation and cycle detection — all covered by ${TEST_COUNT}+ unit tests, not by hope.`,
  },
  {
    icon: ScrollText,
    title: "Every payload, inspectable",
    body: "The run console logs each step's exact JSON input and output, renders multi-step AI Agent reasoning traces, counts items per edge, and keeps the last ten runs with their status, duration, tokens and cost.",
  },
  {
    icon: Coins,
    title: "AI Agents you can actually watch",
    body: "Wire a Chat Model, Memory and any number of Tools into an AI Agent's bottom ports. It picks tools by keyword, delegates to other agents, and reports simulated token usage and cost per step.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing leaves your browser",
    body: `All ${NODE_COUNT} node types run as in-browser simulations: no API keys, no accounts, no network calls. Workflows save to localStorage and share as a link that encodes the whole graph.`,
  },
] as const;

export function FeatureGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="relative z-page scroll-mt-8 border-t border-border px-6 py-16"
    >
      <div className="mx-auto max-w-5xl">
        <h2
          id="features-heading"
          className="text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          What is actually under the canvas
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
          {NODE_COUNT} node types · 90+ simulated integrations · {TEMPLATE_COUNT} templates
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-lg border border-border bg-surface-raised p-5 transition-colors hover:border-accent/40"
            >
              <span className="grid size-9 place-items-center rounded-md border border-accent/30 bg-accent/10 text-accent">
                <Icon className="size-4" aria-hidden strokeWidth={2.2} />
              </span>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
