# FlowForge

> **QA report:** [`REPORT.md`](./REPORT.md) — the audit-and-fix summary, what is still
> imperfect, and manual test steps. Issue-by-issue detail in [`FIXES.md`](./FIXES.md).

A visual workflow builder — a miniature Make.com / n8n that runs entirely in your browser.
Drag one of **144 node types / 90+ integrations** onto an infinite canvas, wire them together,
press **Run**, and watch the data travel: edges light up with particles, nodes pulse while they
execute, and every payload lands in a console you can expand to exact JSON.

It is not just triggers and HTTP calls. There is a full **AI Agent** system — bottom ports for a
Chat Model, Memory and any number of Tools, keyword-driven tool selection, nested multi-agent
delegation, a live reasoning trace and simulated token + cost metering — plus Switch routing,
per-item loops, human-approval gates, merge modes and an expression editor.

Every integration is **simulated**. There are no API keys, no backend, and no network calls
to third parties. Workflows persist to `localStorage` and share as a link that encodes the
whole graph.

---

## Screenshots

> **Not in the repo yet — and this is a deliberate omission, not an oversight.**
>
> This project was built in a sandboxed environment with no browser binary available
> (Chromium download is network-blocked, as are `ui.shadcn.com` and Google Fonts), so there
> was no way to capture real screenshots. Rather than commit AI-generated mockups of an app
> that already exists, the capture script ships instead:
>
> ```bash
> npm i -D playwright && npx playwright install chromium
> npm run docs:screenshots      # writes docs/screenshots/*.png against a production build
> ```
>
> It drives a real Chromium against `npm run build && npm start`, loads the Lead capture
> template, runs it, and captures the five views below. Run it once on a machine with a
> browser and the images land in the right place.

Planned captures (paths the script writes to):

| File | Shows |
| --- | --- |
| `docs/screenshots/01-landing.png` | Hero with the looping animated demo |
| `docs/screenshots/02-builder-empty.png` | Empty canvas, palette, inspector |
| `docs/screenshots/03-running.png` | Mid-run: particles on edges, nodes pulsing |
| `docs/screenshots/04-console.png` | Run console expanded to a step's JSON input/output |
| `docs/screenshots/05-templates.png` | The template gallery |

---

## What it does

**Canvas** — infinite pan/zoom, dotted grid, minimap, drag-from-palette *and* keyboard-add,
palette search with pinned favourites, connect via handles, multi-select, Delete to remove,
⌘/Ctrl+D to duplicate, ⌘/Ctrl+Z and ⌘/Ctrl+⇧Z to undo/redo, and an auto-layout button that
arranges the graph left to right.

**144 node types** across six categories, each with its own icon, accent colour, search
keywords, auto-generated config form, sample output and simulator:

| Category | Count | Highlights |
| --- | ---: | --- |
| **Triggers** | 33 | Manual · Webhook · Cron · Chat message · Form submission · Gmail / Outlook · WhatsApp / Telegram / Slack / Discord · Instagram / X / YouTube / LinkedIn / Facebook · Stripe / Paystack / Flutterwave · Shopify / WooCommerce · Sheets / Airtable / Notion / Drive / Calendar / Calendly · GitHub · RSS · Postgres row · Error trigger |
| **Messaging, Social & Outputs** | 18 | WhatsApp · Telegram · Discord · Slack · Gmail · Outlook · Teams · Twilio · X · LinkedIn · Instagram · Facebook Page · YouTube reply · Mailchimp, plus the five output nodes (Email · Slack · Google Sheets · Respond to Webhook · Log) |
| **Data & Storage** | 13 | Postgres · MySQL · MongoDB · Redis · Supabase · Firebase · Airtable · Notion · Google Sheets · Google Drive · Dropbox · AWS S3 · Pinecone |
| **Business & Productivity** | 16 | HubSpot · Salesforce · Stripe · Paystack · Flutterwave · Shopify · WooCommerce · Jira · Asana · Trello · ClickUp · Typeform · Google Docs · Google Calendar · Zoom · Calendly |
| **Logic, Flow Control & Utility** | 27 | IF / Filter · Switch (3 cases + fallback) · Merge · Loop Over Items · Wait for Human Approval · Code (JavaScript) · Date & Time · Aggregate · Sort · Limit · Remove Duplicates · Split Out · Compare Datasets · JSON codec · HTML extract · Markdown → HTML · Crypto hash · Execute Sub-Workflow · No-Op · Stop and Error · Sticky Note |
| **AI** | 37 | AI Agent · Basic LLM Chain · Q&A chain · Summarizer · Classifier · Sentiment · Information Extractor · Output Parser · Embeddings · Document Loader · Text Splitter · Vector Store Retriever · Image Generation · Speech ↔ Text · **6 chat models** (OpenAI · Anthropic · Gemini · OpenRouter · Groq · Ollama) · **3 memories** (Window Buffer · Postgres · Redis) · **13 agent tools** (Calculator · Web Search · Wikipedia · HTTP · Code · Gmail · Sheets · Postgres · WhatsApp · Telegram · Calendar · Call Another Workflow · **Call Another Agent**) |

The 14 original v1 nodes are still here with unchanged ids and config shapes — they are the same
definitions, now served through the registry, so **workflows saved before the expansion load and
run unchanged.**

### The AI Agent, specifically

An AI Agent has four input ports: the normal `in`, then three **bottom** ports —

- `ai_model` — exactly one Chat Model sub-node (required in practice; falls back to the inline
  model config otherwise)
- `ai_memory` — at most one Memory sub-node
- `ai_tool` — any number of Tool sub-nodes

Illegal connections are refused with a toast that says *why* (`"OpenAI Chat Model is an AI
sub-node and can only connect to an AI Agent node."`). Sub-node edges are dashed, colour-coded
by port kind, and animate while the agent is actually using that tool. The agent picks tools by
keyword ranking against its goal, can delegate to another agent through `aiTool.callAgent`
(which renders as an indented nested trace), and reports token usage and estimated USD cost per
step, per node and per run.

**Execution** — topological wave scheduling, branching and merging, multi-output routing
(Switch, Loop, error branches), n8n-style item arrays with `3 items` badges on each edge, six
node statuses (`idle` / `queued` / `running` / `success` / `error` / `skipped`), simulated
latency of 300–1200 ms per node, a per-node *Simulate failure* toggle, per-node **Continue on
error** and **Retry on fail**, a **Wait for Human Approval** node that genuinely pauses the run
until you click Approve or Reject, and 0.5× / 1× / 2× speed control. Pre-run validation catches
cycles, disconnected nodes, missing triggers and missing required config, and reports each issue
**on the node that caused it**.

**Expressions** — every expression field has an editor with autocomplete and a live preview:
`{{ field }}`, `{{ $json.field }}`, `{{ $node["Slack"].json.text }}`, `{{ $run.id }}` plus
helpers (`$now`, `$today`, `$uuid`, `$random`, `$env`). Unresolved tokens render empty *and* are
listed, so a typo is visible instead of silently blank.

**Templates** — sixteen working flows with realistic sample data, each tagged so the gallery
can be filtered or searched. The original eight: Lead capture, Content repurposing, Invoice
reminder, Support triage, Incident response, Customer onboarding, Daily standup digest, Deal desk
research. The showcases: **AI support agent with tools**, **RAG knowledge base Q&A**, **Order
fulfilment with Switch routing**, **Invoice chase with per-item loop**, **Multi-agent content
studio**, **Payment reconciliation**, **Deploy watchdog**, **Recruiting triage pipeline**.

**Save & share** — autosave, multiple named workflows, JSON import/export, and *Copy share
link* which lz-string-compresses the graph into a `#flow=` URL hash.

---

## Architecture

![Architecture](docs/architecture.svg)

The single most important rule in this codebase:

> **Nothing under `lib/engine/` may import React, `@xyflow/react`, or Zustand.**

The engine takes plain data and returns plain data plus an event stream. That one constraint
is why it is unit-testable in a plain Node environment with no DOM, no fake timers and no
component mounting — and it is verifiable rather than aspirational:

```bash
grep -rnE '^import .*(react|@xyflow|zustand)' lib/engine/   # prints nothing
```

The engine's entire import surface is its own files plus `@/config/constants` and `@/types/*` —
no UI framework, no store, no DOM.

### The node registry

Every node — all 144 — is **data, not a component**. One definition per node lives in
`lib/nodes/<category>/index.ts`:

```ts
{
  id: "trigger.whatsappMessage",
  label: "WhatsApp Message Received",
  description: "Fires when a customer messages your WhatsApp Business number.",
  category: "trigger", subcategory: "Messaging",
  keywords: ["whatsapp", "meta", "message", "chat"],
  icon: "brand:whatsapp",        // a serialisable string, not a React component
  accent: "#25D366",
  type: "trigger",               // trigger | action | output | logic | ai-agent | ai-model | ai-memory | ai-tool
  inputs: [], outputs: [MAIN_OUT],
  configSchema: [ /* fields → the inspector form is generated from this */ ],
  defaultConfig: { /* … */ },
  sampleOutput: { /* … */ },
  simulate: async (input, config, ctx) => ({ output: { … }, logs: [ … ] }),
}
```

From that one object the app derives: the palette entry (with search keywords and category
accordion), the canvas node chrome, the whole inspector form (every field type from `text` to
`keyValue` to `credential`), the credential picker, the pre-run config validation, and the
simulation the engine executes. `lib/nodes/validate-registry.ts` checks the invariants —
duplicate ids, missing labels, unusable schemas, unrenderable icons — at build time and in the
test suite.

The engine still sees the old `AnyNodeTypeDef` interface. `lib/engine/registry.ts` adapts each
registry definition into one, which is why a 144-node library did not require touching the
executor. AI Agents have one extra module, `lib/nodes/ai/agent-simulate.ts`: pure, sub-node
aware, and shared by the registry definition *and* the engine's core agent node so the two
cannot drift.

### How to add a new node in 5 minutes

1. **Append a definition** to the right batch file — say `lib/nodes/messaging/index.ts`:

   ```ts
   defineRegistryNode({
     id: "action.smsSend",
     label: "SMS Send",
     description: "Send a text message through a simulated SMS gateway.",
     category: "messaging",
     subcategory: "SMS",
     keywords: ["sms", "text", "otp"],
     icon: "lucide:MessageSquare",
     accent: "#6366F1",
     type: "action",
     inputs: MAIN_IN,
     outputs: MAIN_OUT,
     configSchema: [
       {
         key: "credentialId",
         label: "Twilio account",
         type: "credential",          // renders the picker + fake "Connect account" dialog
         credentialProvider: "twilio",
       },
       { key: "to", label: "To", type: "expression", required: true },
       { key: "body", label: "Body", type: "textarea", required: true },
     ],
     defaultConfig: {
       credentialId: defaultCredentialIdFor("twilio"),
       to: "{{phone}}",
       body: "Hi {{name}}",
     },
     sampleOutput: { sent: true, to: "+2348035550199", segments: 1 },
     simulate: async (input, config, ctx) => ({
       output: { ...input, sent: true, to: ctx.resolveExpression(String(config.to)) },
       logs: ["SMS queued with the simulated Twilio gateway."],
     }),
   })
   ```

   Field types available: `text` · `textarea` · `expression` · `select` · `multiselect` · `number`
   · `slider` · `boolean` · `keyValue` · `json` · `code` · `credential`.

2. **Add it to the batch's exported array** (e.g. `MESSAGING_NODES`). That is the only wiring —
   the palette, icon resolution, inspector form, validation and engine bridge all pick it up
   from the array.
3. **Run `npm test`.** `registry-144.test.ts` executes every registered node through the real
   engine, so a broken `simulate` fails immediately rather than in the browser. Update
   `NODES_PLAN.md` and the batch count assertion in that test if you added a node to a batch.
4. **Run `npm run gate`** (`tsc` → `lint` → `test` → `check:contrast`).

No component file, no switch statement, no icon map entry — if you find yourself editing
`base-node.tsx` to add a node, something has gone wrong.

### Execution model

1. `graph.ts` runs Kahn's algorithm over the graph to produce **waves** — topological
   generations. If any node is left over, the graph has a cycle and validation fails before a
   single node runs.
2. `executor.ts` advances wave by wave. A node runs when **every** incoming edge has settled;
   it **skips** when all settled without carrying data. An errored node delivers nothing
   downstream, so its successors skip rather than receive a partial payload.
3. `variables.ts` resolves `{{dot.path}}` with a precedence chain: bare dot-notation →
   `$payload.` → `$node.<id>.` → `$run.`. Unresolved tokens render empty *and* are collected,
   so a typo is visible instead of silently blank.
4. Everything time- or random-dependent is injected as `sleep` / `now` / `random` on
   `StepContext`. Tests pass a fake clock that advances on `sleep`, so an entire run —
   latency included — completes **synchronously**.

### State

Three Zustand stores, split so that toggling a panel never re-renders the graph:
`workflowStore` (nodes, edges, undo/redo, named workflows), `runStore` (statuses, step logs,
history), `uiStore` (panels, speed, hydration). Undo snapshots exclude the viewport — panning
is not an edit — and coalesce a whole drag into one step.

---

## Project structure

```
app/            landing page + /builder
components/     canvas · nodes · edges · panels · layout · ui
lib/
  engine/       PURE — graph, validator, variables, executor, simulator, node-defs
  nodes/        the 144-node registry (triggers · messaging · data · business · logic · ai)
  templates/    the 16 built-in flows
  layout.ts     auto-layout (columns come from analyzeGraph waves)
  utils/        share.ts (lz-string), storage.ts (localStorage)
store/          workflowStore · runStore · uiStore
hooks/          run, validation, persistence, shortcuts, media query
types/          discriminated-union node configs, edges, workflows, run results
```

Full annotated tree in [`PROJECT_NOTES.md`](PROJECT_NOTES.md).

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (fully static — no server runtime needed) |
| `npm start` | Serve the production build |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run gate` | Everything CI runs: typecheck → lint → tests → contrast → build |
| `npm run docs:screenshots` | Capture the README screenshots (needs Playwright, see above) |
| `npm run check:contrast` | WCAG AA check for both themes |

---

## Deploying to Vercel

Both routes prerender as static content, so there is no server runtime, no environment
variables and no database. [`vercel.json`](vercel.json) sets the framework, install and build
commands, and Node is pinned to 22 via `engines` and `.nvmrc`.

**`main` is the deployable branch.** All the work — the 144-node library, the AI Agent
sub-node system, the engine upgrades and the 16 templates — is merged there, so a plain
Git import with default settings deploys correctly.

### Option A — Git import (recommended, no CLI)

1. <https://vercel.com/new> → **Import** the `Nior122/workflow` repository.
2. Leave the defaults: framework **Next.js**, production branch **`main`**, install
   `npm ci`, build `npm run build` (the last two come from `vercel.json`).
3. **Deploy.** Every later push to `main` redeploys production; pull requests get their own
   preview URL.

### Option B — CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel            # preview
vercel --prod     # production
```

### What Vercel runs

| Step | Command | Notes |
| --- | --- | --- |
| Install | `npm ci` | `package-lock.json` is committed; Node 22 from `.nvmrc` + `engines` |
| Build | `npm run build` | `next build` — no env vars, no secrets, no database |
| Output | `.next` | `/`, `/_not-found` and `/builder` all prerender as static |

**Notes for the deployment**

- `vercel.json` adds `X-Content-Type-Options`, `X-Frame-Options: DENY` and a
  `Referrer-Policy` header to every route. The last one matters because *Copy share link*
  puts an lz-string-compressed graph in the URL hash.
- `next.config.ts` marks `/` and `/builder` with `Cache-Control: public, max-age=0,
  must-revalidate` and inlines the built CSS into the document (see
  `PROJECT_NOTES.md` → "inlined CSS"). Content-hashed `/_next/static/*` files keep
  Vercel's immutable caching, which is where the bytes are.
- Vercel's default **Deployment Protection** can make a fresh project's URLs require a
  login. If a preview link 401s for someone, turn it off under
  *Settings → Deployment Protection*.

**Verified before shipping:** `npm ci` → `next build` from a clean `.next` compiles and
prerenders `/`, `/_not-found` and `/builder` as static; `next start` then serves `/` and
`/builder` with 200 and unknown paths with 404; `x-powered-by` is absent
(`poweredByHeader: false`).

---

## Testing

**305 tests across 17 files.** They cover logic, not pixels — which is exactly what the pure
engine boundary buys you.

| File | Tests | Covers |
| --- | --- | --- |
| `lib/__tests__/templates.test.ts` | 56 | all 16 templates validate, are acyclic, run to completion, emit agent traces, carry tags, filter by tag/search, and wire sub-node ports correctly |
| `lib/engine/__tests__/executor.test.ts` | 37 | wave scheduling, branching, merge semantics, skip propagation, failure simulation, mid-run cancellation, partial branch failure, AI Agent reasoning trace |
| `lib/engine/__tests__/registry.test.ts` | 37 | node construction, handle rules, config defaults, AI Agent validation |
| `store/__tests__/workflow-store-history.test.ts` | 32 | undo/redo, edit coalescing, duplicate, multi-workflow, run history |
| `lib/nodes/__tests__/registry-144.test.ts` | 9 | the 144-node count and clean validation, keyword search, *executes every node*, sub-node handle rules, Switch routing, continue-on-error + retry, expressions |
| `lib/engine/__tests__/variables.test.ts` | 27 | `{{dot.path}}` resolution and precedence |
| `lib/utils/__tests__/share.test.ts` | 15 | lz-string round-trip, corruption, schema rejection, hash stripping |
| `store/__tests__/workflow-store.test.ts` | 14 | connection rules, delete, rename |
| `components/layout/__tests__/shell-tracks.test.ts` | 13 | builder grid track widths and canvas space at 1024/1280/1440/1920 |
| `lib/engine/__tests__/validator.test.ts` | 11 | cycles, missing triggers, unreachable nodes |
| `lib/engine/__tests__/graph.test.ts` | 10 | topological waves, reachability |
| `components/layout/__tests__/theme-provider.test.ts` | 9 | the pre-paint theme bootstrap and `adoptThemeIfUnset`, in a real jsdom |
| `components/layout/__tests__/layout-contract.test.ts` | 8 | single z-index scale, canvas corner occupancy, grid child constraints |
| `lib/__tests__/layout.test.ts` | 9 | column ordering, determinism, cyclic-graph safety, and a 61-node layout that stays overlap-free under 50 ms |
| `hooks/__tests__/validation-patch.test.ts` | 8 | the validation patch converges instead of looping |
| `components/panels/__tests__/palette-filter.test.ts` | 6 | palette search matching and pinned favourite node types |
| `store/__tests__/run-state-isolation.test.ts` | 4 | run state does not leak between workflows |

**Six of these are negative-controlled** — the fix was deliberately reverted, the tests
confirmed to fail, then the fix restored: `validation-patch` (2 failures), the coalescing
block in `workflow-store-history` (3), `shell-tracks` (6), `run-state-isolation` (3),
`layout-contract` (2) and `theme-provider` (2). A green suite proves nothing about a bug it
cannot catch.

There is also `npm run check:contrast`, which parses the HSL tokens out of `globals.css` and
asserts 13 foreground/background pairs per theme clear WCAG AA.

---

## Design system

One accent — **ember orange** — never blue or purple. `#FF6B35 → #FFA23A` in dark mode
(the default), `#C2410C → #B45309` in light mode.

Those light values are not arbitrary. `.text-gradient-ember` clips the gradient *as text* and
the primary button paints a label over it, so both stops are load-bearing foreground. The
original light accents measured **3.68:1** and **2.63:1** against the background — a genuine
WCAG AA failure — so they were darkened until **all twelve foreground/background pairs clear
4.5:1 in both themes**.

That audit covered the accent and foreground pairs only. A later pass added `success` and
`warning`, found both failing in light mode (3.43:1 and 3.26:1) and darkened them the same
way. The check is now a script — `npm run check:contrast` measures 13 pairs per theme
straight from the tokens in `globals.css` — so a colour change is measured, not remembered.

Accessibility beyond contrast: a global `:focus-visible` ring, palette items that are real
`<button>`s (drag is an enhancement, not the only path), two labelled `true`/`false` handles
on the filter node rather than colour alone, and `prefers-reduced-motion` handling on the
shake animation and the landing demo.

### Responsive

Two tiers, split at 1024px:

- **Wide** — palette | canvas | inspector, all docked, each collapsing to a thin rail so the
  canvas can take the full width. At 1024px a permanently docked palette and inspector left
  only ~448px of canvas, which is why they collapse rather than merely hide.
- **Compact** — full-bleed canvas with a bottom app bar. Nodes, Inspector and Console each
  open as a bottom sheet over the canvas, so **the builder is fully editable on a phone**,
  not a read-only preview. Touch pans the canvas, two fingers pinch-zoom.

They share one implementation: `RunPanelContent` and `InspectorContent` are the same
components in both shells, so the docked console and the sheet console cannot drift apart.

---

## Tech stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 · `@xyflow/react` 12 · Zustand 5
· Framer Motion 14 · `lucide-react` · `lz-string` · Vitest 5 · hand-written shadcn-style
primitives in `components/ui`.

---

## What I'd build next

1. **Subflows.** Collapse a selection into a single node with a real signature. The engine
   already works on plain graphs, so this is mostly a graph-splicing step plus a nested canvas
   — but it needs a decision about variable scoping across the boundary.
2. **Real integrations behind the same interface.** `NodeTypeDef.execute` already returns a
   discriminated result, so a real HTTP node is a drop-in for `simulator.ts`. The interesting
   work is credential handling and retry/backoff, which the current status model doesn't
   express.
3. **A test runner for workflows.** Given a set of sample payloads, assert the final output —
   essentially a fixture system. The engine's synchronous fake-clock execution makes this
   cheap.
4. **Collaborative editing.** The undo stack is a plain snapshot array, which would need to
   become an operation log (or CRDT) before it survives concurrent edits.
5. **Touch-first editing refinements.** The mobile sheets work, but multi-select relies on
   `Shift`/`Meta` with no touch equivalent, sheets are a fixed 60dvh rather than
   drag-resizable, and the compact tier has no minimap.
6. **Edge-case handling in the executor.** Per-node retry, timeout, and an explicit
   error-handling branch — the thing n8n and Make actually get used for.

## Known limitations

- Pointer interactions (drag-and-drop, handle-to-handle connection, the dropdown and dialog
  menus) are not covered by tests. The logic underneath them is; the interaction itself is
  verified by hand.
- No headless-browser run in CI — no browser is installable in the build sandbox either — so
  console-error freedom is asserted from served markup. One test file does opt into jsdom.
- `npm audit` reports 5 high findings, all one dev-only chain
  (`braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next`). The only offered fix
  downgrades `eslint-config-next` to 14.x, which would break Next 16 linting. Not shipped to
  production; deliberately left.
- Share links have a 2000-character soft limit, after which the UI warns that some apps may
  truncate the URL.
- **Every one of the 144 nodes is a simulation.** "Tested" means it executes end to end through
  the engine and returns the documented payload shape — not that it has ever called the real
  Stripe, Slack or WhatsApp API. Tool selection, token counts and costs are modelled, not
  measured.
- Autosave confirmation is throttled to one toast per 15s, because autosave fires ~600ms
  after every edit pause. Failed saves raise immediately.
- Mobile sheets are a fixed `60dvh` with no drag-to-resize, and the compact tier has no
  minimap.
- Not deployed to production by hand: `vercel.json` is committed and `main` is deployable, so a
  Vercel import of the repository works with default settings (see *Deploying to Vercel*). CI runs
  the full gate on every push via `.github/workflows/ci.yml`.

A fuller list, with what each one would take to close, is in [`REPORT.md`](./REPORT.md) §4.

## Licence

MIT.
