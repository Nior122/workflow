import Link from "next/link";
import { ArrowRight, Cable, Flame, MousePointerClick, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/constants";

const STEPS = [
  {
    icon: MousePointerClick,
    title: "Drop your nodes",
    body: "Drag triggers, actions and outputs from the palette onto an infinite canvas — or focus an item and press Enter.",
  },
  {
    icon: Cable,
    title: "Wire them together",
    body: "Pull from a node's output handle to the next node's input. Filters branch into true and false paths that can merge again.",
  },
  {
    icon: Terminal,
    title: "Run and inspect",
    body: "Press Run and watch data travel the edges. Every step logs its exact JSON input and output in the console below.",
  },
] as const;

/**
 * Landing page.
 *
 * Phase 1 ships the hero and the entry point; Phase 6 adds the looping animated
 * demo and the feature highlights. Kept short on purpose — the builder is the product.
 */
export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Ember wash behind the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, hsl(var(--accent-hot)), hsl(var(--accent)) 45%, transparent 70%)",
        }}
      />

      <header className="relative z-10 flex h-16 items-center justify-between px-6">
        <span className="flex items-center gap-2">
          <span className="bg-gradient-ember grid size-8 place-items-center rounded-md text-accent-contrast">
            <Flame className="size-4" aria-hidden strokeWidth={2.4} />
          </span>
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
        </span>

        <Button asChild variant="ghost" size="sm">
          <Link href="/builder">Open the builder</Link>
        </Button>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] tracking-wide text-accent uppercase">
          visual workflow builder
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Build a flow. Press run.{" "}
          <span className="text-gradient-ember">Watch the data move.</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          Drag triggers, actions and outputs onto an infinite canvas, wire them
          together, and step through every payload in a live console. Every
          integration is simulated — no API keys, nothing leaves your browser.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/builder">
              Open the builder
              <ArrowRight aria-hidden />
            </Link>
          </Button>

          <Button asChild variant="secondary" size="lg">
            <a href="#how-it-works">How it works</a>
          </Button>
        </div>

        <p className="mt-6 font-mono text-[11px] text-muted-foreground">
          runs entirely client-side · state saved to localStorage
        </p>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="relative z-10 scroll-mt-8 border-t border-border px-6 py-16"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="how-it-works-heading"
            className="text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            Three steps from blank canvas to running flow
          </h2>

          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li
                key={title}
                className="rounded-lg border border-border bg-surface-raised p-5 transition-colors hover:border-accent/40"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-md border border-accent/30 bg-accent/10 text-accent">
                    <Icon className="size-4" aria-hidden strokeWidth={2.2} />
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>

                <h3 className="mt-3.5 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-9 text-center">
            <Button asChild>
              <Link href="/builder">
                Try it in the builder
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border px-6 py-5 text-center text-xs text-muted-foreground">
        Built with Next.js, React Flow and Zustand. All integrations simulated.
      </footer>
    </main>
  );
}
