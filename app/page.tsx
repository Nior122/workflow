import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/config/constants";
import { DemoLoop } from "@/components/landing/demo-loop";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { listAllNodeDefs } from "@/lib/engine/registry";
import { TEMPLATES } from "@/lib/templates";

/**
 * Landing page.
 *
 * Kept deliberately short: hero, a looping demo of the real thing, three
 * highlights, and the way in. The builder is the product — this page exists to
 * earn one click.
 *
 * Every in-page anchor below must have a matching `id` in this file. See the
 * Phase 1 note in PROJECT_NOTES.md about the dead `#how-it-works` anchor.
 */
export default function LandingPage() {
  // Read from the registry rather than hardcoding a number that will drift the
  // moment someone adds a node — the copy is the last place to learn about it.
  const nodeCount = listAllNodeDefs().length;
  const templateCount = TEMPLATES.length;

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

      <header className="relative z-page flex h-16 items-center justify-between px-6">
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

      <section className="relative z-page flex flex-col items-center px-6 pt-12 pb-4 text-center sm:pt-16">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] tracking-wide text-accent uppercase">
          visual workflow builder
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Build a flow. Press run.{" "}
          <span className="text-gradient-ember">Watch the data move.</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          Drag 90+ integrations onto an infinite canvas — trigger, action, logic,
          data and AI Agent nodes — wire them together, and step through every
          payload in a live console. Everything is simulated: no API keys, nothing
          leaves your browser.
        </p>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground">
          <li>
            <span className="text-foreground">{nodeCount}</span> node types
          </li>
          <li aria-hidden>·</li>
          <li>
            <span className="text-foreground">90+</span> integrations
          </li>
          <li aria-hidden>·</li>
          <li>
            <span className="text-foreground">{templateCount}</span> templates
          </li>
          <li aria-hidden>·</li>
          <li>
            <span className="text-foreground">100%</span> in-browser
          </li>
        </ul>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/builder">
              Open the builder
              <ArrowRight aria-hidden />
            </Link>
          </Button>

          <Button asChild variant="secondary" size="lg">
            <a href="#demo">See it run</a>
          </Button>
        </div>
      </section>

      <section
        id="demo"
        aria-labelledby="demo-heading"
        className="relative z-page scroll-mt-8 px-6 py-10"
      >
        <div className="mx-auto max-w-4xl">
          <h2 id="demo-heading" className="sr-only">
            A workflow running end to end
          </h2>

          <DemoLoop />

          <p className="mt-4 text-center font-mono text-[11px] text-muted-foreground">
            runs entirely client-side · state saved to localStorage
          </p>
        </div>
      </section>

      <FeatureGrid />

      <footer className="relative z-page mt-auto space-y-2 border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        <p>
          Built with Next.js, React Flow and Zustand. Every integration is
          simulated in the browser — no API keys, no accounts, no network calls.
        </p>
        <p className="mx-auto max-w-2xl leading-relaxed text-[11px] text-muted-foreground/80">
          {APP_NAME} is an independent demo project and is not affiliated with,
          endorsed by, or connected to any of the products it simulates. Product
          names, logos and brands shown in the node library — including Slack,
          WhatsApp, Stripe, Shopify, Google, OpenAI and Anthropic — remain the
          property of their respective owners and are used here only to illustrate
          what a simulated integration would look like.
        </p>
      </footer>
    </main>
  );
}
