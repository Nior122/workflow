import { Binary, ScrollText, ShieldCheck } from "lucide-react";

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
    body: "Topological wave scheduling in pure TypeScript, isolated from React. Branching, merging, skip propagation and cycle detection — covered by 184 unit tests, not by hope.",
  },
  {
    icon: ScrollText,
    title: "Every payload, inspectable",
    body: "The run console logs each step's exact JSON input and output, and keeps the last ten runs with their status and duration. That is the whole point of a flow tool.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing leaves your browser",
    body: "Every integration is simulated — no API keys, no network calls. Workflows save to localStorage and share as a link that encodes the whole graph.",
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

        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
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
