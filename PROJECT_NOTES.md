# FlowForge — Project Notes

> **Living document.** Re-read this file at the start of every phase. Update it at the end of
> every phase (tick the phase, list files, record decisions, list known issues).
>
> Status: **COMPLETE.** Build phases 1–9 and QA phases 1–5 are all done. The QA summary is
> **`REPORT.md`**; the issue-by-issue audit log with root causes and evidence is
> **`FIXES.md`**.
> Branch `arena/01a1052c-workflow`. Final gate, from a clean `.next`: `tsc --noEmit` 0,
> `eslint` 0/0, **267 unit tests / 16 files**, `npm run check:contrast` 26/26 (worst
> 4.64:1), `next build` (3 static routes), `GET /` and `GET /builder` both 200.
> **No browser exists in this sandbox**, so nothing has been visually verified and the
> Phase 5 screenshots could not be taken — see `REPORT.md` §2.
> The QA audit itself lives in **`FIXES.md`** — that is the current source of truth for
> known issues. Sections 1–11 below describe the build; issue numbers there predate the
> audit and do not correspond to `FIXES.md`.

---

## 1. Project goal

FlowForge is a visual workflow builder — a miniature Make.com / n8n. Users drag nodes onto an
infinite canvas, wire them together, press **Run**, and watch data travel through the graph via
animated edges and live per-node statuses, with a run console that exposes the exact JSON
input/output of every step.

It is a flagship portfolio piece, so two things are weighted equally:

- **Engineering quality** — the execution engine is a pure, unit-tested TypeScript module with
  zero React/DOM imports, cleanly separated from the rendering layer.
- **Visual polish** — dark-first theme, one distinctive accent, animated edges with travelling
  particles, and perceptible node state transitions.

**All integrations are simulated.** No API keys, no real network calls to third parties, no real
emails. Every "integration" returns deterministic canned data from a local simulator module.

**Persistence is localStorage only.** No backend, no database.

---

## 2. Tech stack

Locked by the client; do not substitute without asking.

| Layer            | Choice                        | Version verified 2026-10-03 (`npm view`) |
| ---------------- | ----------------------------- | ---------------------------------------- |
| Framework        | Next.js (App Router) + React  | `next@16.3.8` / `react@19.3.0`           |
| Language         | TypeScript, `strict: true`    | **`5.9.3`** — see the note below         |
| Styling          | Tailwind CSS                  | `tailwindcss@4.3.3` (v4, CSS-first)      |
| Canvas           | `@xyflow/react` (React Flow)  | `12.12.0` (peers: React `>=17`)          |
| State            | Zustand                       | `5.0.15`                                 |
| Animation        | Framer Motion                 | `14.0.0` (peers: React `^18 \|\| ^19`)   |
| Icons            | `lucide-react`                | `1.51.0`                                 |
| UI primitives    | shadcn/ui (Radix-based)       | CLI-validated for Tailwind v4 + React 19 |
| Persistence      | `localStorage`                | —                                        |
| Engine tests     | Vitest                        | `5.0.3`                                  |
| Share-link codec | `lz-string`                   | `1.5.0`                                  |

Package manager: **npm** (`npm@10.9.8`, Node `v22.22.3`). `pnpm` is not installed in this sandbox.

#### Why TypeScript is pinned to 5.9.3 and not `latest` (7.0.2)

`npm view typescript dist-tags` returns `latest: 7.0.2` — the native-port major release. It is
**not** used here, for one verified reason:

```
$ npm view @typescript-eslint/parser dist-tags.latest peerDependencies
{ eslint: '^8.57.0 || ^9.0.0 || ^10.0.0', typescript: '>=4.8.4 <6.1.0' }
```

The upper bound `<6.1.0` excludes TypeScript 7, so installing it would leave the lint toolchain
with an unmet peer dependency — and `next lint` output is part of the Phase 1 "no errors" gate.
`5.9.3` is the newest release that satisfies that range. `next@16.3.8` does not itself depend on
`typescript`, so this pin is ours to make and does not constrain the framework.

Revisit at Phase 7 (deploy prep) once `@typescript-eslint` widens its peer range.

### Additional dependencies (approved 2026-10-03)

1. **Vitest 5.0.3** — required by the "engine with unit tests" requirement. Engine tests run in a
   plain Node environment (no jsdom) precisely because the engine has no DOM dependency.
2. **`lz-string`** (~4 KB) — compresses the workflow JSON in the share-link URL hash. Raw base64
   JSON of a 20-node flow exceeds practical URL limits.
3. **Dagre / ELK for auto-layout** — *declined.* A hand-rolled layered (Sugiyama-lite) layout in
   `/lib/layout.ts` instead: pure TS, deterministic, unit-testable, zero dependencies.

---

## 3. Folder structure

Reflects the repository as it actually stands after Phase 5, not the original plan.
Deviations from the Phase 0 sketch are listed after the tree.

```
workflow/
├── app/
│   ├── layout.tsx                 # RootLayout: fonts, ThemeProvider, metadata
│   ├── page.tsx                   # "/" landing page
│   ├── globals.css                # Tailwind v4 @theme tokens, accent, glow, ff-shake
│   └── builder/page.tsx           # "/builder" the full app
├── components/
│   ├── canvas/                    # flow-canvas, canvas-context (dnd bridge),
│   │                              #   zoom-controls (+auto-layout), empty-canvas
│   ├── edges/                     # animated-flow-edge (travelling particles)
│   ├── nodes/
│   │   ├── base-node.tsx          #   shared chrome: header, icon, ports, status badge
│   │   ├── flow-node.tsx          #   createNodeComponent(type) -> one component per type
│   │   ├── registry.tsx           #   UI-side registry: icon, accent, ACCENTS palette
│   │   └── forms/                 #   trigger-forms, action-forms, output-forms, fields
│   ├── panels/                    # palette, inspector, run-console, run-history,
│   │                              #   bottom-panel, speed-control, template-gallery,
│   │                              #   workflow-menu
│   ├── layout/                    # app-shell, top-bar, theme-provider, theme-toggle,
│   │                              #   mobile-notice
│   └── ui/                        # hand-written shadcn: button, tooltip, dialog
├── lib/
│   ├── engine/                    # PURE TS — no React, no DOM, no 'use client'
│   │   ├── types.ts               #   engine-owned types (payloads, events, step logs)
│   │   ├── registry.ts            #   node-type metadata: ports, defaults, latency, execute
│   │   ├── graph.ts               #   cycle detection, topological waves, reachability
│   │   ├── validator.ts           #   pre-run validation -> ValidationIssue[]
│   │   ├── variables.ts           #   {{dot.path}} resolution + template rendering
│   │   ├── executor.ts            #   wave scheduler, status transitions, event emitter
│   │   ├── simulator.ts           #   canned AI / HTTP / email / slack / sheets responses
│   │   ├── node-defs/             #   triggers.ts, actions.ts, outputs.ts
│   │   └── __tests__/             #   helpers, graph, validator, variables, executor, registry
│   ├── layout.ts                  # auto-layout (columns from analyzeGraph waves)
│   ├── graph-builder.ts           # buildNode / buildEdge / cloneGraph — deterministic ids
│   ├── templates/                 # the 4 built-in flows (factories, not constants)
│   ├── utils.ts                   # cn()
│   ├── utils/                     # share.ts (lz encode/decode), storage.ts (localStorage)
│   └── __tests__/                 # layout, templates
├── store/
│   ├── workflowStore.ts           # nodes, edges, viewport, CRUD, undo/redo, multi-workflow
│   ├── runStore.ts                # run status, per-node status, step logs, history (last 10)
│   ├── uiStore.ts                 # panels, speed, isRunning, hydration status
│   └── __tests__/
├── hooks/
│   ├── use-keyboard-shortcuts.ts  # undo, redo, duplicate, run
│   ├── use-run-workflow.ts        # run/cancel + pushRun into history
│   ├── use-live-validation.ts     # debounced graph validation -> data.validation
│   ├── use-persistence.ts         # hydrate + auto-save + share-link adoption
│   ├── use-canvas-actions.ts      # add-at-centre
│   └── use-media-query.ts         # useSyncExternalStore over matchMedia
├── types/                         # json, nodes, edges, workflow, run, validation, index
├── config/                        # constants.ts, theme.ts
└── PROJECT_NOTES.md
```

**Deviations from the Phase 0 sketch** (permitted: "adjust if you have a good reason")

1. **No `lib/engine/executors/` directory.** `execute` lives on `NodeTypeDef` in
   `node-defs/*.ts`, so a node's shape and its behaviour stay in one file and the executor
   only ever needs the registry.
2. **No `lib/engine/index.ts` barrel.** Direct imports make the pure boundary greppable —
   `grep -rn "from "react"" lib/engine` returning nothing is the test that the rule holds.
3. **No `app/not-found.tsx`.** Next's built-in 404 is sufficient for a two-page app.
4. **`useAutoSave` + share-link adoption merged into `use-persistence.ts`.** They are one
   lifecycle: read once on mount, write on change. Splitting them would race.
5. **No `useDragAndDrop` hook.** The palette-to-canvas bridge lives in
   `components/canvas/canvas-context.tsx`, because it needs the React Flow instance, which
   is only available below `<ReactFlowProvider>`.
6. **`PanelResizer` is inside `bottom-panel.tsx`**, not a shared component — it is the only
   resizable surface.
7. **kebab-case filenames throughout** (`base-node.tsx`, not `BaseNode.tsx`), matching the
   Next.js App Router convention the scaffold uses.
8. **`components/landing/` does not exist yet** — it is Phase 6.

**Rule enforced throughout:** nothing under `lib/engine/` may import React, `@xyflow/react`, or
Zustand. The engine receives plain data and returns plain data plus an event stream. This is what
makes it unit-testable in a plain Node environment.

---

## 4. Data model

### 4.1 JSON primitives

```ts
// types/json.ts
export type JsonValue =
  | string | number | boolean | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A node's input or output payload. Always an object at the top level. */
export type NodePayload = { [key: string]: JsonValue };
```

### 4.2 Node types & configs (discriminated union)

```ts
// types/nodes.ts
export type NodeCategory = 'trigger' | 'action' | 'output';

export type NodeType =
  // triggers — no input handle, one output
  | 'trigger.manual' | 'trigger.webhook' | 'trigger.schedule'
  // actions — one input, one or more outputs
  | 'action.aiPrompt' | 'action.httpRequest' | 'action.transform'
  | 'action.condition' | 'action.delay' | 'action.textFormatter'
  // outputs — one input, no output
  | 'output.email' | 'output.slack' | 'output.sheets' | 'output.log';

/* ---- configs, one interface per node type ---- */

export interface ManualTriggerConfig   { payloadJson: string }              // editable sample JSON
export interface WebhookTriggerConfig  { samplePayloadJson: string }        // URL is derived, fake
export interface ScheduleTriggerConfig { cron: string; timezone: string }   // simulated, fires once

export interface AiPromptConfig {
  systemPrompt: string;
  promptTemplate: string;        // supports {{variables}}
  model: 'ff-mini' | 'ff-pro';   // fake model names
  temperature: number;           // 0..1, influences which canned response is picked
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  bodyJson: string;              // unused for GET
}

export interface TransformConfig {
  mode: 'map' | 'merge';         // map = replace payload, merge = spread over input
  fields: KeyValuePair[];        // value may contain {{variables}}
}

export type ConditionOperator = 'equals' | 'notEquals' | 'contains' | 'gt' | 'lt';
export interface ConditionConfig {
  left: string;                  // {{dot.path}} or literal
  operator: ConditionOperator;
  right: string;                 // {{dot.path}} or literal
  caseSensitive: boolean;
}

export interface DelayConfig { seconds: number }        // scaled by execution speed
export interface TextFormatterConfig { template: string }

export interface EmailConfig  { to: string; subject: string; body: string }
export interface SlackConfig  { channel: string; message: string }
export interface SheetsConfig { spreadsheet: string; columns: KeyValuePair[] }
export interface LogConfig    { label: string }

export interface KeyValuePair { id: string; key: string; value: string }

export type NodeConfig =
  | ManualTriggerConfig | WebhookTriggerConfig | ScheduleTriggerConfig
  | AiPromptConfig | HttpRequestConfig | TransformConfig
  | ConditionConfig | DelayConfig | TextFormatterConfig
  | EmailConfig | SlackConfig | SheetsConfig | LogConfig;

export type NodeConfigOf<T extends NodeType> =
  T extends 'trigger.manual'     ? ManualTriggerConfig :
  T extends 'trigger.webhook'    ? WebhookTriggerConfig :
  T extends 'trigger.schedule'   ? ScheduleTriggerConfig :
  T extends 'action.aiPrompt'    ? AiPromptConfig :
  T extends 'action.httpRequest' ? HttpRequestConfig :
  T extends 'action.transform'   ? TransformConfig :
  T extends 'action.condition'   ? ConditionConfig :
  T extends 'action.delay'       ? DelayConfig :
  T extends 'action.textFormatter' ? TextFormatterConfig :
  T extends 'output.email'       ? EmailConfig :
  T extends 'output.slack'       ? SlackConfig :
  T extends 'output.sheets'      ? SheetsConfig :
  T extends 'output.log'         ? LogConfig : never;
```

### 4.3 Nodes & edges (React Flow shape)

```ts
// types/nodes.ts
import type { Node } from '@xyflow/react';

/** Everything the UI + engine need that is not type-specific config. */
export interface FlowNodeData<T extends NodeType = NodeType> {
  label: string;
  config: NodeConfigOf<T>;
  /** Demo switch: force this node to throw, to show error handling. */
  simulateFailure: boolean;
  /** Per-node latency override in ms; clamped to [300, 1200] by the engine. */
  latencyMs?: number;
  /** Populated by the validator; drives the red ring + tooltip on the node. */
  validation?: ValidationIssue[];
}

type FlowNodeOf<T extends NodeType> = Node<FlowNodeData<T>, T>;

/** Discriminated union: node.type narrows node.data.config. */
export type FlowNode = { [T in NodeType]: FlowNodeOf<T> }[NodeType];

// types/edges.ts
import type { Edge } from '@xyflow/react';

/** Condition nodes expose two output handles; everything else uses 'out'. */
export type SourceHandleId = 'out' | 'true' | 'false';
export type TargetHandleId = 'in';

export interface FlowEdgeData {
  /** Set while a payload is in flight on this edge; drives the particle animation. */
  active: boolean;
  /** Renders 'true' / 'false' labels on condition branches. */
  label?: string;
  dimmed?: boolean;
}

export type FlowEdge = Edge<FlowEdgeData, 'animated-flow'>;
```

### 4.4 Workflows & persistence

```ts
// types/workflow.ts
export const WORKFLOW_SCHEMA_VERSION = 1;

export interface Viewport { x: number; y: number; zoom: number }

export interface Workflow {
  id: string;
  name: string;
  schemaVersion: number;         // for forward migrations
  createdAt: number;             // epoch ms
  updatedAt: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  /** Set when the workflow was created from a gallery template. */
  templateId?: string;
}

/** The single object written to localStorage under one key. */
export interface PersistedState {
  schemaVersion: number;
  activeWorkflowId: string;
  workflows: Workflow[];         // named workflows
  runHistory: RunResult[];       // capped at 10, newest first
  settings: AppSettings;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  speed: ExecutionSpeed;
  snapToGrid: boolean;
  showMinimap: boolean;
  gridSize: number;              // 4px spacing grid baseline -> multiples of 4
}
```

### 4.5 Run results & execution events

```ts
// types/run.ts
export type NodeRunStatus =
  | 'idle' | 'queued' | 'running' | 'success' | 'error' | 'skipped';

export type RunStatus =
  | 'idle' | 'validating' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ExecutionSpeed = 0.5 | 1 | 2;

export type EngineErrorCode =
  | 'validation-failed' | 'cycle-detected' | 'missing-trigger'
  | 'node-execution-failed' | 'invalid-payload' | 'template-resolution-failed'
  | 'simulated-failure' | 'aborted' | 'timeout';

export interface RunError { code: EngineErrorCode; message: string; nodeId?: string }

/** One row in the run console; expandable to reveal exact input/output JSON. */
export interface StepLog {
  stepId: string;
  nodeId: string;
  nodeType: NodeType;
  nodeLabel: string;
  status: Exclude<NodeRunStatus, 'idle' | 'queued'>;   // running | success | error | skipped
  startedAt: number;
  endedAt: number;
  durationMs: number;
  input: NodePayload;
  output: NodePayload | null;
  error?: RunError;
  /** Executor-specific extras: branch taken, mock HTTP status, rows written… */
  meta?: { [key: string]: JsonValue };
}

export interface EdgeTransition {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  startedAt: number;
  durationMs: number;
}

export interface RunResult {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  speed: ExecutionSpeed;
  steps: StepLog[];               // sorted by startedAt
  edges: EdgeTransition[];
  error?: RunError;
}

/** Emitted by the executor; consumed by runStore to drive animation. No React in here. */
export type EngineEvent =
  | { kind: 'run:start';    runId: string; at: number }
  | { kind: 'node:queued';  nodeId: string; at: number }
  | { kind: 'node:running'; nodeId: string; at: number }
  | { kind: 'node:success'; nodeId: string; at: number; output: NodePayload; durationMs: number }
  | { kind: 'node:error';   nodeId: string; at: number; error: RunError; durationMs: number }
  | { kind: 'node:skipped'; nodeId: string; at: number; reason: string }
  | { kind: 'edge:active';  edgeId: string; fromNodeId: string; toNodeId: string; at: number; durationMs: number }
  | { kind: 'run:end';      runId: string; at: number; status: RunStatus; durationMs: number };
```

### 4.6 Validation

```ts
// types/validation.ts
export type ValidationCode =
  | 'empty-workflow' | 'missing-trigger' | 'multiple-triggers'
  | 'cycle-detected' | 'unreachable-node' | 'dangling-edge'
  | 'missing-required-config' | 'invalid-config' | 'invalid-json';

export interface ValidationIssue {
  code: ValidationCode;
  level: 'error' | 'warning';
  message: string;
  nodeId?: string;                // attaches the error to a specific node
  edgeId?: string;
  field?: string;                 // e.g. 'config.to'
}

export interface ValidationResult {
  valid: boolean;                 // true when no level:'error' issues
  issues: ValidationIssue[];
  /** Topological execution waves; empty when a cycle was found. */
  waves: string[][];
  /** Node ids reachable from a trigger. */
  reachable: string[];
}
```

### 4.7 Node-type registry (split across the pure/UI boundary)

```ts
// lib/engine/registry.ts — PURE. Ports, defaults, latency, executor, config validator.
export interface PortSpec { id: string; label: string }

export interface NodeTypeDef<T extends NodeType = NodeType> {
  type: T;
  category: NodeCategory;
  title: string;
  description: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  defaultConfig: NodeConfigOf<T>;
  latencyMs: number;                                  // 300..1200
  /** Which config fields must be non-empty. Drives 'missing-required-config'. */
  requiredFields: (keyof NodeConfigOf<T>)[];
  validateConfig(config: NodeConfigOf<T>): ValidationIssue[];
  execute(input: NodePayload, config: NodeConfigOf<T>, ctx: StepContext): Promise<NodePayload>;
}

// components/nodes/registry.tsx — UI ONLY. Keyed by NodeType.
export interface NodeUiDef {
  icon: LucideIcon;
  accent: string;                 // CSS color, feeds glow + edge tint
  ConfigForm: ComponentType<{ value: NodeConfig; onChange: (c: NodeConfig) => void }>;
}
```

---

## 5. Key design decisions (locked unless the client objects)

1. **Pure engine boundary.** `lib/engine/*` has no React imports. It takes `FlowNode[]` +
   `FlowEdge[]`, emits `EngineEvent`s through a callback. React subscribes. This is the single
   most important structural decision in the project.
2. **Deterministic tests.** The executor takes an injectable `sleep`, `now`, and `random` so
   latency and canned-response selection are fakeable in Vitest. No timers leak into tests.
3. **Wave scheduling, not a flat topological loop.** Nodes are grouped into topological waves;
   all nodes in a wave run concurrently. This makes branching animate in parallel and makes
   merging natural (a merge node is always in a later wave than its inputs).
4. **Merge semantics.** A node runs when every incoming edge has *settled*. An edge settles with
   data (source succeeded) or without data (source was skipped/errored). If *all* incoming edges
   settle without data, the node is marked `skipped`. Input payload for a merge is a shallow
   merge of the settled upstream outputs, later wins.
5. **Variable scope.** `{{user.name}}` resolves against the current node's input payload first
   (the spec's requirement), then falls back to reserved roots: `$payload`, `$node.<nodeId>`,
   `$run`. Unresolved tokens render as an empty string and are recorded in `StepLog.meta`.
6. **Latency is a function of the node type**, clamped to 300–1200 ms and divided by the speed
   multiplier (0.5x / 1x / 2x).
7. **Cycles are a validation error, not a feature.** No loop-back or retry nodes in v1.
8. **Undo/redo** is a snapshot stack over `{nodes, edges}` with coalescing: rapid position changes
   from a single drag collapse into one history entry.
9. **One accent color: ember orange `#FF6B35` → `#FFA23A`.** Defined as CSS custom properties in
   `globals.css` (full scale in §7) so the theme toggle is a single attribute swap on `<html>`.
   Success green is deliberately cool (`#2FBF71`) so it never reads as a dimmed ember.
10. **Mobile** gets a genuine read-only canvas (pan/zoom work, editing disabled) plus a banner,
    rather than a degraded list view.

---

## 6. Phase checklist

- [x] **Phase 1** — Project setup, this notes file, layout shell, theme, canvas with
      pan/zoom/grid/minimap/zoom controls, palette, 3 basic node types draggable & connectable.
- [x] **Phase 2** — All 13 node types with config forms, inspector panel, validation errors on nodes.
- [x] **Phase 3** — Execution engine + unit tests, node statuses, run console with JSON inspection.
- [x] **Phase 4** — Animated edges (travelling particles), node state animations, speed control,
      failure simulation.
- [x] **Phase 5** — Templates (4 flows), save/load named workflows, import/export JSON, share link,
      undo/redo, auto-layout.
- [x] **Phase 6** — Landing page with looping animated demo, polish pass, accessibility pass,
      responsive fallback.
- [x] **Phase 7** — README (screenshots, architecture, "what I'd build next"), Vercel deploy prep.

---

## 7. Resolved questions (client answered 2026-10-03)

| # | Question | Decision |
| - | --- | --- |
| 1 | Accent color | **Ember orange `#FF6B35` → `#FFA23A`** gradient. Molten-metal, fits the "Forge" name, glows well on near-black. Status colors (success green / error red) sit cleanly beside it. |
| 2 | Next.js version | **Next 16.3.8** (current stable) + React 19.3.0. Vercel target. |
| 3 | Extra dependencies | **Both approved** — Vitest 5.0.3 for engine unit tests, `lz-string` for compressed share-link hashes. |
| 4 | Merge semantics | **Approved as designed** (§5.4) — run when all incoming edges settle; skip when all settle without data. |

### Color system (derived from the ember decision)

```css
/* Dark theme (default) */
--background:      240 6% 6%;      /* #0E0E11 near-black, not pure black */
--surface:         240 5% 9%;      /* panels */
--surface-raised:  240 5% 12%;     /* cards, nodes */
--border:          240 4% 18%;
--foreground:      40 8% 96%;
--muted-foreground:240 4% 62%;

--accent:          16 100% 60%;    /* #FF6B35 ember */
--accent-hot:      33 100% 61%;    /* #FFA23A — the gradient's hot end, used for glow */

--success:         145 63% 49%;    /* #2FBF71 — deliberately cool so it never reads as ember */
--error:           354 78% 61%;    /* #F2555A */
--warning:         43 96% 56%;     /* #F5B301 */
--skipped:         240 4% 45%;     /* dimmed gray */
```

Per-node accents are tints pulled from each node's category so the canvas stays legible:
triggers lean amber, actions lean ember, outputs lean a warm stone. Exact hex values land in
`config/theme.ts` during Phase 2 when the full node set exists.

## 8. Known risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Sandbox blocks `ui.shadcn.com` and `fonts.googleapis.com`** (TLS, curl exit 35) while allowing `registry.npmjs.org` | shadcn CLI unusable; `next/font/google` fails the build | **Confirmed in Phase 1.** Hand-write `components/ui` to shadcn conventions; use the `geist` npm package (`next/font/local`) instead of Google Fonts. Both already applied |
| TypeScript `latest` is now 7.0.2 while `@typescript-eslint@8.71.0` peers `<6.1.0` | Unmet peer deps, broken `next lint` | Pin `typescript@5.9.3` exactly; documented in §2. Revisit at Phase 7 |
| `braces` DoS advisory via `eslint-config-next` (5 high, dev-only) | Noisy `npm audit`; the only fix downgrades Next 16 linting | Leave as-is; not shipped. Documented in the Phase 1 log |
| Next 16 + React 19 + Tailwind v4 + shadcn is a fast-moving combination | Build breaks mid-project | Pin exact versions in `package.json`; verify `npm run build` at the end of *every* phase |
| `@xyflow/react` v12 renamed several v11 APIs (`nodeTypes` memo, `useReactFlow`, controlled state) | Subtle canvas bugs | Wrap all React Flow interaction in `components/canvas` + hooks; never touch the store from inside a node component |
| Travelling-particle edges need SVG path sampling per frame | Jank on large graphs | Animate via `offset-path`/CSS on a small fixed particle count per active edge, not per-frame JS |
| Share-link URL length | Links silently truncated | `lz-string` + base64url, plus a length warning |
| localStorage quota (~5 MB) with 10 runs of verbose JSON | Save failures | Strip `input`/`output` payloads from *archived* history entries, keep them only for the latest run; wrap writes in try/catch with a user-visible toast |
| Zustand + React Flow double-rendering during drag | Dropped frames | Position updates stay in React Flow's internal store until `onNodesChange` commits; selectors kept narrow |

---

## 9. Phase log

### Phase 0 — Planning (complete)

- Created `PROJECT_NOTES.md`.
- Verified toolchain: Node `v22.22.3`, npm `10.9.8`, network access to the npm registry working.
- Verified current versions of every library in the stack (see §2).
- Caught a version trap: TypeScript `latest` is `7.0.2`, but `@typescript-eslint@8.71.0` peers
  `<6.1.0`. Pinned `typescript@5.9.3` and recorded the reasoning in §2.
- Confirmed shadcn CLI supports Tailwind v4 and React 19.
- Resolved all four blocking questions (§7): ember accent, Next 16.3.8, Vitest + lz-string
  approved, merge semantics approved as designed.
- **No application code written.** Awaiting approval to begin Phase 1.

### Phase 1 — Setup, shell, theme, canvas, palette (COMPLETE)

**Verification (all run, all green):**

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0, 0 problems |
| Unit tests | `npm test` | **32 passed** (2 files: registry 18, workflow store 14) |
| Build | `npm run build` | exit 0; `/`, `/_not-found`, `/builder` all prerendered static |
| Runtime | `next dev` on `0.0.0.0:3000` | `GET / 200`, `GET /builder 200`, server log free of errors/warnings |
| CSS tokens | fetched the served stylesheet | `--font-geist-sans`, `.text-accent{color:hsl(var(--accent))}`, `.bg-gradient-ember`, `.dark` block, `.fade-in-0`/`.zoom-in-95` (tw-animate-css) all present |

**Files created (57 total, excluding `node_modules`)**

- Root: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`,
  `eslint.config.mjs`, `.gitignore`, `vitest.config.mts`, `AGENTS.md`, `CLAUDE.md`
- `app/`: `layout.tsx`, `page.tsx`, `globals.css`, `builder/page.tsx`, `favicon.ico`
- `types/`: `json.ts`, `nodes.ts`, `edges.ts`, `workflow.ts`, `run.ts`, `validation.ts`
- `config/`: `constants.ts`, `theme.ts`
- `lib/`: `utils.ts`, `engine/registry.ts`, `engine/__tests__/registry.test.ts`
- `store/`: `workflowStore.ts`, `uiStore.ts`, `__tests__/workflow-store.test.ts`
- `hooks/`: `use-canvas-actions.ts`, `use-media-query.ts`
- `components/nodes/`: `base-node.tsx`, `registry.tsx`, `manual-trigger-node.tsx`,
  `ai-prompt-node.tsx`, `log-node.tsx`, `index.ts`
- `components/canvas/`: `flow-canvas.tsx`, `zoom-controls.tsx`, `empty-canvas.tsx`,
  `canvas-context.tsx`
- `components/edges/`: `animated-flow-edge.tsx`, `index.ts`
- `components/panels/`: `palette.tsx` (also exports `ConnectionErrorToast`)
- `components/layout/`: `app-shell.tsx`, `top-bar.tsx`, `theme-provider.tsx`,
  `theme-toggle.tsx`, `mobile-notice.tsx`
- `components/ui/`: `button.tsx`, `tooltip.tsx`

Removed: the five unused `public/*.svg` boilerplate files and the empty `public/` dir.

**Decisions made during the phase**

1. **shadcn CLI cannot run in this sandbox.** `ui.shadcn.com` is TLS-blocked
   (`curl` exit 35, HTTP 000) while `registry.npmjs.org` returns 200, so `npx shadcn init`
   fails at the registry fetch. Fallback from §8 applied: `components/ui/button.tsx` and
   `tooltip.tsx` are hand-written to shadcn conventions (CVA variants, `cn()`, Radix
   primitives, `data-slot` attributes). shadcn *is* code-you-own in `components/ui`, so
   this is the same artefact the CLI would emit — the library was not substituted.
2. **`next/font/google` cannot run either.** `fonts.googleapis.com` is TLS-blocked, so the
   scaffold's `Geist`/`Geist_Mono` imports would fail the build. Replaced with the
   **`geist@1.7.2`** npm package, which bundles the WOFF2 files and calls
   `next/font/local`. Same faces, no build-time network.
3. **`@types/node` upgraded `^20` → `22.20.5`.** `vitest@5.0.3` peers
   `@types/node@^22 || >=24`; the scaffold pinned `^20`, producing ERESOLVE. Fixed properly
   rather than with `--legacy-peer-deps`. Runtime is Node `v22.22.3`, so this matches.
4. **Vitest landed in Phase 1, not Phase 3** as originally phased. Build/tsc/lint only prove
   the code compiles; the connection rules and node construction are where Phase 1 bugs
   actually live, so 32 tests now cover them. Engine executor tests still land in Phase 3.
5. **`ConnectionMode` is a value enum in `@xyflow/react@12`**, not a string union
   (`enum ConnectionMode { Strict = "strict"; Loose = "loose" }`). Using the string literal
   is a type error. Recorded here because it is exactly the v11→v12 drift predicted in §8.
6. **`useMediaQuery` uses `useSyncExternalStore`**, not `useEffect` + `setState`. ESLint's
   `react-hooks/set-state-in-effect` rejected the effect version, and it was right: the
   effect renders one wrong frame and cascades. `matchMedia` is an external store.
7. **`createFlowNode` is generic** (`<T extends NodeType>(type: T) => FlowNodeOf<T>`) so
   callers reach type-specific config without casting. One internal cast remains, documented
   at the call site.
8. **`NodeTypeDef` has no `execute` yet.** §4.7 shows it on the interface; it is deferred to
   Phase 3 rather than stubbed, so there are no placeholder executors. Phase 3 adds it to the
   same interface.
9. **React Flow's attribution is kept**, restyled to be unobtrusive rather than
   `display:none`. Hiding it outright is against their free-tier terms — bad look for a
   portfolio repo.
10. **`showMinimap` and `speed` exist in both `uiStore` (live) and `AppSettings`
    (persisted).** Deliberate: Phase 5 hydrates the live store from persisted settings.
11. **Theme bootstrap** is an inline script in `<head>` plus a client `ThemeProvider` that
    adopts whatever class is already on `<html>`, so there is no flash and no hydration
    mismatch (`suppressHydrationWarning` on `<html>`).

**Known issues / deferred**

- Inspector panel, config forms and on-node validation display are Phase 2. Nodes currently
  render a read-only config summary.
- Run button is present but `disabled` with an explanatory tooltip; the engine is Phase 3.
- Undo/redo, duplicate, auto-layout, persistence, templates: Phases 5.
- `npm audit` reports 5 high findings, all one dev-only chain
  (`braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`).
  The only offered fix downgrades `eslint-config-next` to 14.x, which would break Next 16
  linting. **Not shipped to production; left as-is.** Revisit when upstream patches.
- Landing page is hero-only by design; the animated demo and feature highlights are Phase 6.
- **Fixed post-review:** the hero's "How it works" button was a dead anchor — it pointed at
  `#how-it-works` but no element carried that id, so the click silently did nothing. Added the
  real three-step section with `id="how-it-works"` plus `scroll-mt-8`, and gated
  `scroll-behavior: smooth` behind `prefers-reduced-motion: no-preference`.
  Lesson recorded: never ship an in-page anchor without asserting the target exists — verify
  by diffing rendered `href="#..."` values against rendered `id="..."` values.
- No browser-level test of drag-and-drop or handle-to-handle connection. The logic underneath
  both is unit-tested, but the pointer interaction itself is unverified in this sandbox.

### Phase 2 — All 13 node types, config forms, inspector, validation (COMPLETE)

**Files created:** `lib/engine/node-defs/{triggers,actions,outputs}.ts`,
`components/nodes/flow-node.tsx`, `components/nodes/forms/*` (one form per node type),
`components/panels/inspector.tsx`, `components/ui/switch.tsx`.

**Files changed:** `lib/engine/registry.ts` (now pure composition of the three node-def
modules), `components/nodes/base-node.tsx` (validation badges), `components/nodes/index.ts`,
`app/globals.css`.

**Decisions**

1. **Node defs split into `node-defs/{triggers,actions,outputs}.ts`** with `registry.ts`
   composing them. One file per group keeps each under ~250 lines; the registry stays the
   single import site for the rest of the app.
2. **One generic node component** via `createNodeComponent(type)` rather than 13 files.
   `nodeTypes` passed to `<ReactFlow>` must be referentially stable or the canvas remounts
   every render, so a factory over a static record is the only safe shape.
3. **Two validation surfaces, deliberately separate.** Config problems (missing field,
   malformed JSON, unbalanced `{{token}}`) are computed *inside* the node component from its
   own config, so they update on every keystroke with no round trip. Graph problems (cycle,
   no trigger, unreachable) are computed once by `useLiveValidation` and written to
   `data.validation`. Mixing the two would re-render the whole graph on every keystroke.
4. **Native `<select>` with an inlined chevron**, not a Radix select. Fewer moving parts,
   and native selects are already keyboard- and screen-reader-correct.
5. **`{{token}}`-aware validators** with a shared `checkUnbalancedTokens` helper, so every
   template field reports `{{name` without a closing brace rather than failing silently.
6. **The condition node is distinguished by two labelled `true`/`false` handles**, not by
   colour. Colour alone would be invisible to colour-blind users.

**Known issues / deferred:** execution was still absent — Run stayed disabled until Phase 3.

### Phase 3 — Execution engine, tests, run console (COMPLETE)

**Files created:** `lib/engine/{variables,graph,types,simulator,validator,executor}.ts`,
`lib/engine/__tests__/{helpers,variables.test,graph.test,validator.test,executor.test}.ts`,
`store/runStore.ts`, `hooks/{use-run-workflow,use-live-validation}.ts`,
`components/panels/{run-console,run-history,bottom-panel,speed-control}.tsx`.

**Verification at end of phase:** tsc 0 · lint 0/0 · **126 tests passing** · build 3.0 s ·
`GET /builder 200` with all 13 node types and every panel in the served HTML.

**Decisions**

1. **`execute` lives on `NodeTypeDef`**, not in a parallel `executors/` directory. Keeps a
   node's shape and its behaviour in one place and makes the registry the only thing the
   executor needs to know about.
2. **Wave scheduling** via Kahn's algorithm in `analyzeGraph`; waves are sorted so runs are
   reproducible. A node runs once every incoming edge has settled; it skips when all settled
   without data (the merge semantics the client approved).
3. **Injectable `sleep`/`now`/`random` on `StepContext`** with a fake clock, so a full run —
   latency included — completes synchronously under test. This is why the executor needs no
   fake timers. (`sleep` must exist on both `StepContext` and `EngineEffects`; they were
   declared separately and drifted once.)
4. **Variable precedence:** bare dot-notation → `$payload.` → `$node.<id>.` → `$run.`.
   Unresolved tokens render empty *and* are collected, so a typo is visible rather than
   silently blank. `"".split(".")` returns `[""]`, so every path walker special-cases empty.
5. **Numeric operators coerce via `Number()` and NaN is `false`**, not `true` — a filter on a
   missing field must not pass by accident.
6. **Validation gates the run.** A cyclic flow fails with **zero** `node:running` events,
   which the tests assert explicitly.
7. **An errored node delivers nothing downstream**, so successors skip rather than receive a
   partial payload.
8. **`useLiveValidation` is debounced 220 ms**, paused while running, and only patches nodes
   whose issues actually changed.

### Phase 4 — Animated edges, node states, speed control (COMPLETE)

**Files created:** `components/edges/animated-flow-edge.tsx` (rewritten),
`@keyframes ff-shake` in `app/globals.css`.

**Decisions**

1. **Particles use an inline `path` on `<animateMotion>`** rather than `<mpath>` referencing
   an id. Browser-composited with no per-frame JavaScript, and it avoids id collisions when
   the same edge renders twice (e.g. minimap). Three particles at 0 / 0.33 / 0.66 of the
   travel duration.
2. **Node states:** pulse ring + spinner (running), green check badge (success),
   `ff-shake` + error glow (error), `opacity-45` (skipped). The shake keyframes are wrapped in
   `prefers-reduced-motion: no-preference`.
3. **`BottomPanel` is drag-resizable 140–560 px** and collapses to a 40 px strip, with
   arrow-key resizing for keyboard users.

### Phase 5 — Templates, persistence, share links, undo/redo, auto-layout (COMPLETE)

**Verification (all run, all green):**

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0, 0 problems |
| Unit tests | `npm test` | **184 passed** (10 files) — up from 126 |
| Build | `npm run build` | ✓ Compiled successfully in 4.1 s; `/`, `/_not-found`, `/builder` static |
| Runtime | `next dev` on `0.0.0.0:3000` | `GET / 200`, `GET /builder 200` |
| Served HTML | grepped `/builder` | all 13 node types + `Templates`, `Workflow actions`, `Auto-layout`, `Node inspector`, `Run console`, `Execution speed` present |
| Bundle | grepped `.next/static/chunks` | all 4 template names + `Start from a template` present (they are portal-rendered, so absent from SSR HTML by design) |

**Files created:** `lib/layout.ts`, `lib/graph-builder.ts`, `lib/templates/index.ts`,
`lib/utils/{share,storage}.ts`, `lib/utils/__tests__/share.test.ts`,
`lib/__tests__/{layout,templates}.test.ts`, `store/__tests__/workflow-store-history.test.ts`,
`components/panels/{template-gallery,workflow-menu}.tsx`, `components/ui/dialog.tsx`,
`hooks/{use-keyboard-shortcuts,use-persistence}.ts`.

**Files changed:** `store/workflowStore.ts` (rewritten), `store/uiStore.ts` (+`hydration`),
`components/layout/{top-bar,app-shell}.tsx`, `components/canvas/zoom-controls.tsx`,
`hooks/use-run-workflow.ts`, `lib/engine/__tests__/helpers.ts`, `vitest.config.mts`,
`package.json` (+`lz-string@1.5.0`, `@radix-ui/react-dialog@1.1.15`,
`@radix-ui/react-dropdown-menu@2.1.16`).

**Decisions**

1. **`autoLayout` takes its columns straight from `analyzeGraph` waves**, so the visual order
   *is* the execution order. Rows are barycentre-ordered to reduce crossings.
   `COLUMN_GAP 120` / `ROW_GAP 40` / node height estimate 116.
2. **Nodes in no wave keep their position**, so auto-layout on a cyclic graph never destroys
   the user's arrangement. Asserted in `layout.test.ts`.
3. **`autoLayout` returns nodes only** — edges follow their endpoints, so returning edges
   would be a lie about what the function does. Callers keep their own edge array.
4. **`buildNode`/`buildEdge` in `lib/graph-builder.ts`** give templates deterministic ids
   (`e-<src>-<handle>-<tgt>`), so re-loading a template is idempotent. The engine test
   helpers now alias these instead of duplicating the construction logic.
5. **Templates are factories, not constants**, so instantiating twice yields independent
   nodes. Asserted. Templates are laid out on load rather than shipped with hardcoded
   coordinates — one fewer thing to keep in sync when the node chrome changes size.
6. **Share links use `lz-string`'s `compressToEncodedURIComponent`** behind the prefix
   `#flow=`, with a 2000-char soft-limit warning. `decodeShareHash` returns a discriminated
   `{ok}` result and never throws; it rejects `schemaVersion > WORKFLOW_SCHEMA_VERSION`.
   Measured ratio on a realistic workflow: **2983 → 1479 chars (~2×)**, still well under the
   soft limit.
7. **Undo/redo snapshots exclude the viewport** (panning must not be an undoable edit) and
   are capped at `HISTORY_LIMIT = 60`. Drags coalesce via a module-scope `dragging` flag that
   snapshots on the *first* position change with `dragging === true`, so a whole drag is one
   undo step rather than one per frame.
8. **Hydration status lives in `uiStore`, not React state.** ESLint's
   `react-hooks/set-state-in-effect` rejected the `useState` version — correctly, for the
   same reason it rejected `useMediaQuery` in Phase 1. A Zustand store *is* an external
   system, so writing to it from an effect is the intended pattern.
9. **A share link wins over saved state but does not overwrite it** — opening someone's link
   is explicit intent, and silently replacing the user's own work would be worse.
10. **Auto-layout lives in the canvas zoom controls, not only the workflow menu**, because
    §1 lists it as a canvas affordance.
11. **Import accepts either a full exported workflow or a bare `{nodes, edges}` graph**,
    because people hand-edit these files.

**Bugs found by the new tests and fixed**

1. **The store opened in an inconsistent state.** Initial `workflows: []` alongside
   `activeWorkflowId: "default"` — the active id pointed at nothing until hydration ran.
   Now the store starts with the same single workflow `lib/utils/storage` persists, via a
   shared `DEFAULT_WORKFLOW_ID` constant.
2. **`createNewWorkflow` silently discarded the canvas.** It blanked `nodes`/`edges` without
   folding the live graph into the workflow being left, so everything drawn since the last
   switch was lost. `switchWorkflow` already folded; the fold is now extracted into a shared
   `foldActiveInto` helper used by `createNewWorkflow`, `switchWorkflow` and
   `snapshotWorkflows`. This was a genuine data-loss bug, not a test-expectation error.
3. **`buildShareUrl` hardcoded `window.location`**, which threw under `environment: "node"`
   and made the function untestable. `base` is now injectable (defaulting to the current
   page), and `shareUrlLength` accounts for the same prefix so the two agree.

**Known issues / deferred**

- No browser-level test of the dropdown, dialog, or file-picker interactions. The store and
  library layers underneath them are unit-tested; the pointer interactions are not.
- `navigator.clipboard` failures fall back to writing the hash to the URL rather than
  showing a manual copy field.
- Landing page is still Phase 1's hero-only page; the animated demo is Phase 6.
- `npm audit`'s 5 high findings remain (dev-only `braces` chain — see Phase 1).

### Phase 6 — Landing page, accessibility and responsive pass (COMPLETE)

**Verification (all run, all green):**

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0, 0 problems |
| Unit tests | `npm test` | **184 passed** (10 files) |
| Build | `npm run build` | ✓ Compiled successfully; `/`, `/_not-found`, `/builder` static |
| Dead anchors | diffed rendered `href="#…"` against rendered `id="…"` | hrefs `['demo']`, ids include `demo` → **no dead anchors** |
| Served CSS | fetched `/_next/static/chunks/_0zzy_4s._.css` | light `--accent: 17 88% 40%`, `--accent-hot: 26 90% 37%`; dark `16 100% 60%` / `32 100% 61%`; `:focus-visible` ring present |
| Demo markup | grepped served `/` | 3 `<animateMotion>` + 3 `keyPoints`, 5 nodes, 3 particles, 1 spinner at SSR phase 0, console line `▸ trigger.webhook  running…` — matches the phase-0 state exactly |
| Contrast | computed WCAG ratios from the tokens parsed back out of `globals.css` | **all 12 *accent/foreground* pairs ≥ 4.5:1 in both themes** (see below). ⚠️ Superseded in QA Phase 4: this check covered only the accent and foreground pairs. `success` (3.43:1) and `warning` (3.26:1) in the light theme were never measured and both failed AA; they are now 4.94:1 and 4.93:1. Use `npm run check:contrast` (13 pairs × 2 themes). |

**Files created:** `components/landing/{demo-loop,feature-grid}.tsx`.

**Files changed:** `app/page.tsx` (hero + demo + features, dropped the redundant
three-step grid), `app/globals.css` (light-theme accent tokens),
`components/nodes/registry.tsx` (`ACCENTS` now exported).

**Decisions**

1. **The landing demo is hand-built SVG, not a second React Flow instance.** A static SVG
   plus one `setInterval` cannot fight the real canvas for focus or pointer events, and it
   costs nothing to mount. It is `aria-hidden` with a `<figcaption>` text alternative.
2. **Particle timing and node lighting share one 4200 ms clock.** Each `<animateMotion>`
   carries `keyTimes`/`keyPoints` so its particle only travels inside its own slot of the
   cycle and holds still otherwise — that is what makes the flow read as *sequential*
   instead of as a conveyor belt. Verified: 3 animations, 3 keyPoints.
3. **`ACCENTS` is now exported from the node registry** so the demo cannot drift from the
   builder's palette. Hardcoding the hex values would have duplicated them.
4. **The three-step "how it works" grid was removed.** The animated demo now shows the same
   thing better, and the brief says keep the landing short. The secondary CTA moved to
   `#demo`, and the anchor was re-verified rather than assumed (see the Phase 1 lesson).
5. **Reduced motion freezes the demo on its finished frame** and starts no timer, derived
   during render (`reducedMotion ? PHASES - 1 : phase`) rather than via `setState` in an
   effect — the same `react-hooks/set-state-in-effect` rule that shaped `useMediaQuery` and
   `usePersistence`.

**Accessibility findings and fixes**

1. **The light theme failed WCAG AA — fixed.** Measured with the real token values:
   `--accent` #E2521B was **3.68:1** on the background, `--accent-hot` #E8820F was
   **2.63:1**, and the button label #F7F6F4 sat at **3.56:1** on the accent. `.text-gradient-ember`
   clips accent→accent-hot *as text*, so both gradient stops are text, not decoration — the
   h1's ember phrase was the worst offender.
   Replaced with `--accent: 17 88% 40%` (#C2410C) and `--accent-hot: 26 90% 37%` (#B45309).
   Post-fix, all six light pairs and all six dark pairs clear 4.5:1. The dark theme (the
   default) was already compliant and was left alone.
   **Superseded in QA Phase 4:** "all twelve pairs" meant the twelve *accent and foreground*
   pairs, and that was accurate for them — but the check never covered `success` or
   `warning`, and both failed AA in the light theme. Generalising from a partial matrix was
   the actual mistake. `scripts/check-contrast.mjs` now measures 13 pairs per theme and is
   wired to `npm run check:contrast`.
   **Lesson recorded:** `--accent-hot` looks decorative because it mostly feeds gradients and
   glows, but `.text-gradient-ember` and the button gradient make it load-bearing text and
   label background. Audit gradient stops as text.
2. **Keyboard navigation confirmed, not assumed.** Palette items are real `<button>`s with
   `aria-label`, so Enter/Space activate `onClick` → add at viewport centre. Drag is an
   enhancement on top, not the only path.
3. **`:focus-visible` is a global rule** in `@layer base` (2px ring, 2px offset), not scoped
   to a component, so every interactive element inherits it.
4. **Responsive behaviour verified in code:** below `MOBILE_BREAKPOINT_PX` the palette,
   inspector and console unmount, the minimap hides, `MobileNotice` shows, and
   `<FlowCanvas readOnly>` sets `nodesConnectable`/`nodesDraggable`/`elementsSelectable` to
   false and `deleteKeyCode` to null.

**Known issues / deferred**

- On a phone the Run button in the top bar still works and the canvas animates, but the run
  console is unmounted, so there is nowhere to read the output. Within the "read-only view"
  brief, but a mobile console sheet would be the obvious next step.
- No headless-browser run in this sandbox, so console-error freedom and the SMIL animation
  actually playing are asserted from the served markup, not observed in a browser.
- Contrast was computed analytically from the token values; no screenshot diffing.

### Phase 7 — README and Vercel deploy prep (COMPLETE)

**Verification (all run, all green):**

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0, 0 problems |
| Unit tests | `npm test` | **184 passed** (10 files) |
| Build | `npm run build` | ✓ Compiled successfully; `/`, `/_not-found`, `/builder` static |
| Runtime | `next dev` on `0.0.0.0:3000` | `GET / 200`, `GET /builder 200`, `GET /does-not-exist 404` |
| Engine purity (README claim) | `grep -rnE '^import .*(react\|@xyflow\|zustand)' lib/engine/` | **prints nothing**; verified the pattern *does* catch a violation by temporarily injecting `import { useState } from "react"` into `types.ts`, then restoring (`git diff` empty afterwards) |
| Engine import surface | `grep -rho 'from "[^"]*"' lib/engine/**` | only `./…`, `@/config/constants`, `@/types/*` |
| README versions | read back from `package.json` | next 16.3.8, react 19.2.8, ts 5.9.3, xyflow 12.12.0, zustand 5.0.15, framer-motion 14.0.0, lucide 1.51.0, lz-string 1.5.0, vitest 5.0.3 — all match the README |
| README links | file existence | `docs/architecture.svg`, `PROJECT_NOTES.md`, `vercel.json`, `scripts/capture-screenshots.mjs` all present |
| README facts | read from source | filter operators `equals/notEquals/contains/gt/lt` (`types/nodes.ts:83`), six statuses (`types/run.ts:5-11`), 184 tests / 10 files — all match |
| `vercel.json` | `json.load` | valid |
| Screenshot script | `npm run docs:screenshots` | exit 1 with the intended "Playwright is not installed" guidance, no stack trace |

**Files created:** `README.md`, `docs/architecture.svg`, `scripts/capture-screenshots.mjs`,
`vercel.json`.

**Files changed:** `package.json` (+`docs:screenshots` script).

**Decisions**

1. **No screenshots in the repo, and the README says why.** There is no browser binary in
   this sandbox: `npx playwright install --with-deps chromium` failed at the apt stage
   (`Unable to locate package libxrandr2`, `xvfb`, …) and the plain
   `npx playwright install chromium` failed to download Chrome for Testing — the same
   network allowlist that blocks `ui.shadcn.com` and `fonts.googleapis.com`.
   Committing AI-generated mockups of an app that already exists would be worse than an
   honest gap, so the capture script ships instead and the README's screenshot section
   explains the situation and lists the five planned captures.
2. **`scripts/capture-screenshots.mjs` is real, not a stub.** It builds, spawns
   `next start` on port 4310, waits for readiness, loads the Lead capture template through
   the template gallery, clicks Run, and captures five views at `deviceScaleFactor: 2`.
   Selectors target accessible names rather than CSS classes so they survive restyling.
   **Not verified end-to-end** — it cannot be run here. Verified: syntax (`node --check`),
   and the graceful no-Playwright path.
3. **`vercel.json` is minimal on purpose.** Next.js needs no Vercel configuration; the file
   exists to pin `npm ci`, `cleanUrls`, and three security headers
   (`nosniff`, `DENY`, `strict-origin-when-cross-origin`).
4. **The architecture diagram is hand-written SVG**, with every box corresponding to a file
   that exists. Generated image tooling was not used, so it cannot drift into showing
   modules that are not there.
5. **The README's engine-purity grep was corrected.** The first version
   (`grep -rn "from \"react\"\|@xyflow\|zustand"`) matched the comment in
   `lib/engine/registry.ts` that *states* the rule, so it "failed" on clean code. Anchored to
   `^import ` and then tested both directions.

**Known issues / deferred**

- The screenshot script has never run against a real browser. Selectors and the
  `run completed` text match are the most likely things to need adjusting on first use.
- No CI workflow file was added. The gate is reproducible locally
  (`npx tsc --noEmit && npm run lint && npm test && npm run build`) but nothing enforces it.
- Deployment itself was not performed — there is no Vercel project to push to from here.
  The build is verified static and `vercel.json` is valid, but "deploy prep" means
  *ready to deploy*, not *deployed*.

---

## 10. Final state

All seven phases complete. The reproducible gate:

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Last run: **tsc exit 0 · lint 0 errors 0 warnings · 184 tests passing across 10 files ·
build compiled with `/`, `/_not-found` and `/builder` all prerendered static.**

Test growth across the build: 32 (Phase 1) → 47 (Phase 2) → 126 (Phases 3–4) →
159 (Phase 5, before the store tests) → **184 (Phase 5–7)**.

Three real bugs were found by tests written *after* the code they cover, all in Phase 5:
the store's inconsistent initial `workflows: []`, `createNewWorkflow` discarding the live
canvas, and `buildShareUrl` throwing outside a browser. Phase 6's contrast audit found a
fourth that no test could have caught: a WCAG AA failure hiding inside a CSS gradient that
is clipped as text.

### Phase 8 — UI cleanup and true responsive support (COMPLETE)

Client feedback: *"the ui design is not looking clean, and i need it to be working on
desktop or mobile, responsive."* Two decisions taken via `ask_user`: **full editing on
mobile via sheets**, and the **whole design pass** (density, top bar, layout, spacing).

**Verification (all run, all green):**

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0, 0 problems |
| Unit tests | `npm test` | **184 passed** (10 files) |
| Build | `npm run build` | ✓ Compiled successfully; `/`, `/_not-found`, `/builder` static |
| Runtime | `next dev` | `GET / 200`, `GET /builder 200` |
| SSR tier | grepped served `/builder` | renders the **wide** layout (`Node palette`, `Node inspector`, `Run console`, `Collapse`); the mobile dock is absent, as intended |
| Compact tier | grepped `.next/static/chunks` | `Builder tools`, `Execution speed`, `Show node palette`, `Show node inspector`, `Tap Nodes below` all present in the client bundle |
| CSS shipped | fetched served stylesheet | `scrollbar-width: thin`, `::-webkit-scrollbar-thumb`, `.h-13 { height: calc(var(--spacing) * 13) }`, `--glow-strength: .22` (light) |
| Dead code | grepped | no `MOBILE_BREAKPOINT` refs, no `readOnly` refs, no `MobileNotice`, `useMediaQuery` consumed only by `use-viewport-tier` |

**Files created:** `components/ui/sheet.tsx` (Radix bottom sheet),
`components/layout/mobile-dock.tsx`, `hooks/use-viewport-tier.ts`,
`components/canvas/connection-error-toast.tsx`.

**Files changed:** `components/panels/{palette,inspector,bottom-panel}.tsx`,
`components/nodes/base-node.tsx`, `components/layout/{app-shell,top-bar}.tsx`,
`components/canvas/flow-canvas.tsx`, `components/panels/workflow-menu.tsx`,
`app/globals.css`, `config/constants.ts`.

**Removed:** `components/layout/mobile-notice.tsx` — the compact tier is a real editor
now, so a banner explaining that editing is unavailable would be a lie.

**What was actually wrong (diagnosed from the code, since this sandbox has no browser)**

1. **The 1024px cliff.** Below it, palette, inspector and console all unmounted and the
   canvas went read-only. Above it, a docked 256px palette plus 320px inspector left
   **~448px of canvas at exactly 1024px** — the layout was unusable on both sides of its
   own breakpoint.
2. **Eleven controls in a 56px top bar** with no wrapping or hiding, two separate ways to
   open Templates, and Delete/Clear sitting there despite Delete already being on the
   keyboard and in the inspector.
3. **Chrome overload.** Every palette row was a bordered card with its own bordered icon
   tile, a two-line description and a grip icon — thirteen of them stacked. Every node
   carried an accent spine, a bordered icon tile, an UPPERCASE category label *and* two
   corner badges, so the category was stated three times.
4. **Default OS scrollbars** inside a dark UI (no `scrollbar-*` rules at all).

**Decisions**

1. **Two tiers, not three.** A separate tablet band would need its own layout code for a
   size range that is mostly landscape iPads, and those are better served by the overlay
   layout than by three docked panels. Below 1024px everything is a sheet over a
   full-bleed canvas; at or above it panels dock **and collapse to a rail**, which is what
   fixes the 448px squeeze.
2. **The tier query is written as a max-width.** `useMediaQuery`'s `getServerSnapshot`
   returns false, so `min-width: 1024px` would have streamed the *mobile* dock to every
   desktop and flipped it away on hydration. `max-width: 1023px` makes the server guess
   "wide". Verified in the served HTML.
3. **Shared bodies, two shells.** `RunPanelContent` and `InspectorContent` were extracted
   so the docked panels and the mobile sheets render the *same* console and inspector
   instead of two copies that would drift.
4. **Speed control moved into the overflow menu below `sm`** rather than being dropped.
   The inline control is `hidden sm:block` and the menu version is `sm:hidden`, so exactly
   one renders at any width.
5. **Flat palette rows** — hover wash instead of border + glow, borderless tinted icon,
   one-line description, grip removed (drag remains as a progressive enhancement over
   click-to-add). Added a search field, which doubles as the fast path on a phone.
6. **Node chrome reduced** — UPPERCASE category label demoted to a quiet sentence-case
   line, icon tile border dropped, padding tightened.
7. **Theme-aware scrollbars** and glow strength reduced (light 0.28 → 0.22, dark
   0.45 → 0.34).
8. **Touch pan/pinch made explicit** on `<ReactFlow>` (`panOnDrag`, `zoomOnPinch`).
9. **Empty-state copy is tier-aware** — it used to tell phone users to drag from a palette
   that does not exist on their screen.

**Bugs I introduced and caught during this pass**

1. **Tab click collapsed the panel.** Extracting `RunPanelContent` reused
   `onToggleCollapsed` for tab clicks, so selecting a tab on an open panel would *close*
   it. Split into `onExpand` (tab click) and `onToggleCollapsed` (header button).
2. **Unterminated JSX expression** — `id={`palette-${category}`` was missing its closing
   brace after the palette rewrite.
3. **Invented import paths again** (`listNodeDefs`/`AnyNodeTypeDef` from the UI registry
   instead of `lib/engine/registry`). Read the committed file's imports instead of
   guessing.
4. **`useUiStore.getState()` read inside JSX** for `minimapVisible` — non-reactive, so the
   minimap toggle would not re-render. Replaced with a selector.
5. **Dropped `ConnectionErrorToast`** when rewriting the palette. Extracted to
   `components/canvas/connection-error-toast.tsx`, which is where it belonged anyway, and
   made it clear the bottom dock on narrow viewports.
6. **Dead `tabHint` state** in the dock, set to false but never true. Removed.
7. **Stale comment** in `globals.css` still citing the pre-fix light accent `#E2521B`.

**Known issues / deferred**

- **Layout is verified from markup and CSS, not from rendered pixels.** There is no browser
  in this sandbox, so tier switching, sheet animation and the 360px top-bar budget are
  reasoned about and checked structurally, not observed.
- Sheet heights are fixed at `60dvh`; a drag-to-resize handle would be the obvious upgrade.
- Multi-select uses `Shift`/`Meta`, which has no mobile equivalent — box selection by touch
  is not implemented.
- The compact tier has no minimap (screen space), so long flows rely on fit-to-view.


### QA Phase 3 — Builder shell as one CSS grid + single z-index scale (COMPLETE)

**Decision:** the shell is now a single CSS grid in both tiers, not nested flex. Wide tier:
`grid-template-rows: auto minmax(0, 1fr) auto` × `grid-template-columns:
<palette> minmax(0, 1fr) <inspector>`. The canvas owns row 2 / column 2 outright, which is
what makes "canvas never under another panel" structural rather than a z-index convention.

**New file:** `components/layout/shell-tracks.ts` — the track widths and the canvas-width
arithmetic, imported by `app-shell.tsx` and tested by
`components/layout/__tests__/shell-tracks.test.ts` (13 tests). Because the component
renders `builderGridColumns()` directly, the tests assert against the string that reaches
the DOM. Canvas widths: 1024→448px, 1280→704px, 1440→864px, 1920→1344px.

**Z-index is now defined in exactly one place** — the `@theme` block in `app/globals.css`
(`z-page` 10, `z-canvas-overlay` 10, `z-canvas-toast` 20, `z-dock` 30, `z-menu` 40,
`z-overlay` 50). 19 raw numeric z-utilities were replaced across 12 files. Add a layer
there; never hand-write `z-[N]` in a component.

**Two places deliberately do NOT have `overflow: hidden`**, because clipping them would
have hidden something: `ShellHeader` (the top bar's blocking-error alert is `absolute
top-full`, below the bar's box) and `BottomPanel` (its resize handle is at `-top-1`). Both
carry `min-w-0` instead, which is the part that actually protects the grid tracks.

**Retracted finding #8:** rubber-band multi-select already worked via Shift+drag. I had
read `selectionOnDrag` being unset as "no drag-select", but `@xyflow/react` enables the
selection box whenever `selectionKeyCode` is held, and `selectionOnDrag` is inert while
`panOnDrag === true` anyway. No code changed.

**#10 resolved as option (a)** — no 768px message; phones keep full editing.

**Known limitation:** no browser in this sandbox, so the layout is verified from served
markup, compiled CSS and executed track arithmetic — never from pixels. Phase 5 screenshots
remain impossible.


### QA Phase 4 — UX polish (COMPLETE)

**4px spacing grid.** 106 spacing/position utilities were off-grid across 26 files and all
were snapped to the nearest 4px step; zero remain (verified by grep). **38 dimension values
were deliberately left alone** — `size-3.5` (the 14px icon size), `size-2.5`, `size-1.5`,
`h-1.5`, `h-0.5` — because they are component dimensions, not spacing.

**Radius was already consistent:** every `rounded-*` comes from the four `--radius-*`
tokens, with no arbitrary `rounded-[Npx]` anywhere.

**Focus was already global** via `@layer base :focus-visible`, covering all 37 interactive
elements. **`active:` was the genuine gap** — only the `default` Button variant had one.
Added to all six variants plus ~22 other controls, including the mobile dock (touch has no
hover).

**New: `npm run check:contrast`** (`scripts/check-contrast.mjs`) parses the HSL tokens out
of `globals.css` and computes WCAG ratios for 13 pairs × 2 themes. It found two real
light-theme failures — `success` 3.43:1 and `warning` 3.26:1 — fixed by dropping lightness
37%→30% / 38%→30% at unchanged hue and saturation. All 26 pairs now pass, worst 4.64:1.
Two bugs in the checker itself were caught before its output was trusted: `.dark` was
matching `@custom-variant dark (&:is(.dark *))` so both themes measured `:root`, and
`Number("9%")` is `NaN`.

**Fixed:** #11 `adoptThemeIfUnset()` makes an imported workflow's theme apply without ever
overriding a deliberate browser choice · #12 `consoleOpen` deleted, `PanelId` narrowed ·
#14 `resetStatuses()` now called from `switchWorkflow`/`deleteWorkflow`/`hydrate`, proven by
a red-then-green test in `store/__tests__/run-state-isolation.test.ts` · #16 empty-state
"Browse templates" button (`templatesOpen` moved into `uiStore` so one gallery dialog is
shared) · #17 shared `store/toastStore.ts` + `components/ui/toast-viewport.tsx`, with a new
`z-toast: 60` scale step.

**Retracted #15:** `beginRun` replaces the whole `nodeStatuses` record and `useNodeStatus`
defaults to `?? "idle"`, so unreachable nodes already render idle. This is the **second
finding retracted for the same reason** — reasoning from the call site without reading the
implementation. Rule going forward: read the function before calling it a bug.

**Toolbar tooltips** on Templates/Run/Stop, and a new `components/ui/kbd.tsx` rendering
`⌘ ⇧ Z` or `Ctrl Shift Z` via `useSyncExternalStore` (no Mac hydration mismatch). Only
shortcuts that exist in `use-keyboard-shortcuts.ts` are advertised.

**Judgement call to revisit:** autosave fires ~600ms after every edit pause, so its "Saved"
toast is throttled to one per 15s rather than every time. Failed saves raise immediately.

**Test count 221 → 225** (13 files). Files added: `store/toastStore.ts`,
`components/ui/toast-viewport.tsx`, `components/ui/kbd.tsx`,
`components/layout/__tests__/shell-tracks.test.ts` (Phase 3),
`store/__tests__/run-state-isolation.test.ts`, `scripts/check-contrast.mjs`.


### QA Phase 5 — Verify and show evidence (COMPLETE)

Deliverable is **`REPORT.md`**: gate table, the broken→fixed table for all 18 findings
(15 fixed, 2 retracted, 1 resolved by decision), the "still imperfect" list, the substitute
evidence, and 14 manual test steps grouped by area.

**Browser re-verified as unavailable this session** rather than repeated from memory: no
browser binary on `PATH`, no `Xvfb`, `~/.cache/ms-playwright` holds only an empty `.links/`,
and `npx playwright install chromium` fails at the download. Screenshots are impossible.

**New: `components/layout/__tests__/layout-contract.test.ts`** (8 tests) — reads the shipped
source and guards the structural invariants: the z-scale exists with strictly ordered steps,
no raw numeric `z-\d+` remains in any component, the MiniMap is not in the attribution's
corner, the attribution is still visible, the canvas track is `minmax(0, 1fr)`, and the
canvas cell carries `min-w-0 overflow-hidden`. Negative-controlled: a raw `z-50` plus
`position="bottom-right"` gives 2 named failures.

**Test count 225 → 233** (14 files).

**The honest bottom line:** every gate is green and every fix that could be unit-tested is
tested and negative-controlled. Nothing has been looked at. The 106 spacing changes and the
grid shell are the two things most worth a human eye, and `REPORT.md` §6 lists exactly what
to check.


### Post-QA hardening (COMPLETE)

Three items closed from the `REPORT.md` §4 "still imperfect" list:

1. **`.github/workflows/ci.yml`** — typecheck, lint, tests, contrast and build on every push
   and PR. Every script it invokes was verified to exist in `package.json`, and
   `package-lock.json` is present so `npm ci` will work.
2. **The disabled Run button now explains itself.** `disabled` → `aria-disabled` + a guarded
   `onClick`. A disabled button fires no pointer events, so Radix never opened the tooltip —
   backwards, since "add a trigger node" is the one hint an empty canvas needs. It also stays
   in the tab order, so the hint is reachable by keyboard.
3. **`jsdom@25.0.1` (devDependency)** unblocked a real DOM test for QA fix #4.
   `components/layout/__tests__/theme-provider.test.ts` opts in per file with a
   `// @vitest-environment jsdom` docblock, so the global environment stays `node` and the
   "the engine is pure" signal survives. It evaluates the actual `THEME_INIT_SCRIPT` string
   against a real `document`/`localStorage`, including the throwing-localStorage path, and
   asserts `adoptThemeIfUnset` never overrides an existing choice. Negative control: removing
   the guard gives **2 failures**.

**Still untested, deliberately:** #3's `history.replaceState` call and #5's `onNodeClick`
wiring both need a rendered React tree with React Flow mounted — `@testing-library/react`
plus `ResizeObserver` shims, which is more machinery than the two lines it would cover. Both
are one click to verify by hand (`REPORT.md` §6, steps 8 and 11).

**Test count 233 → 242** (15 files).


### 144-Node Library & AI Agent Expansion (COMPLETE)

The builder went from **14 node types to 144** while keeping every architectural invariant:
the engine boundary, the 4px spacing grid, the single z-index scale, and 100% theme contrast.

**What shipped, phase by phase**

1. **Architecture.** One declarative definition per node in `/lib/nodes/<category>/`
   (`triggers/` 33, `messaging/` 18, `data/` 13, `business/` 16, `logic/` 27-ish, `ai/` 37) with
   `id`, `label`, `description`, `category`, `subcategory`, `keywords`, `icon` (a *serialisable
   string* like `"brand:whatsapp"`), `accent`, `kind`, typed `inputs`/`outputs`
   (`main | ai_model | ai_memory | ai_tool`), `configSchema`, `defaultConfig`, `sampleOutput`,
   and a pure `simulate(input, config, ctx)`. `lib/nodes/validate-registry.ts` runs at build
   time *and* in tests: missing keys, duplicate ids, unrenderable icons and unusable schemas
   all fail the suite. Credentials are simulated (`lib/nodes/credentials.ts`) with a picker and
   a fake OAuth "Connect account" dialog.
2. **Palette.** Search across label/description/keywords with a `/` shortcut, collapsible
   category accordions with counts, Recently used + Favourites, and a quick-add popover on
   canvas double-click or a node's `+` handle that auto-connects.
3. **Node library.** Batches A–F (33/18/13/16/27/37). Every node has a working form, a sample
   output, and a simulation that runs — asserted by executing all 144 through the real engine.
4. **AI Agent system.** Bottom sub-node ports (`ai_model` ×1, `ai_memory` ×1, `ai_tool` ×n) with
   compatibility validation and a toast on an illegal drop; compact sub-node chrome; keyword
   ranking for tool selection; a live reasoning trace in the console plus a side drawer;
   animated active tool edges; nested multi-agent delegation via `aiTool.callAgent`; and
   simulated token usage + cost per step and per run.
5. **Engine.** Multiple outputs (Switch `case_0..2` + `fallback`, Loop `loop`/`done`, error
   branches), merge modes, per-item iteration with progress, a pausing human-approval gate,
   sub-workflow execution, per-node "continue on error" and "retry on fail", n8n-style item
   arrays with edge item-count badges, and an expression editor (`{{ $json.x }}`,
   `{{ $node["Name"].json.x }}`, helpers, autocomplete, live preview).
6. **Templates.** 16 total — the original 8 plus 8 showcases (AI support agent with tools, RAG
   knowledge base, Switch order fulfilment, per-item invoice chase, multi-agent content studio,
   payment reconciliation, deploy watchdog, recruiting triage). Every template carries tags and
   the gallery filters by tag (chips) and by free-text search.
7. **Polish.** Landing page reads its own counts from the registry ("144 node types · 90+
   integrations · 16 templates"), the footer carries a brand disclaimer, and the whole gate
   (`tsc`, `lint`, `test`, `check:contrast`, `build`) runs clean.

**Two things worth knowing about the implementation**

- **The bridge, not a rewrite.** The original 14 nodes keep their ids and config shapes; they
  now live in the registry and are adapted back into `AnyNodeTypeDef` by
  `lib/engine/registry.ts`. A workflow saved before this work loads, validates and runs
  unchanged — there is no migration step because there was nothing to migrate.
- **`agent-simulate.ts` is the single source of agent truth.** Pricing, tool-keyword ranking and
  the reasoning loop live in one pure module used by both the declarative `action.aiAgent`
  definition and the engine's core node, so the two paths cannot drift. Token counting therefore
  works identically whether a node is reached through the registry bridge or the legacy path.

**Verification.** `lib/nodes/__tests__/registry-144.test.ts` (9 tests) asserts the 144 count, a
clean registry validation across all entries, keyword search, "every node executes", sub-node
handle rules, an AI Agent run with a nested trace, Switch routing, continue-on-error + retry,
and expression resolution. `lib/__tests__/templates.test.ts` now covers 16 templates ×
(valid → acyclic → runs to completion).

**Caveat, stated plainly:** all 144 nodes are *simulated* — deterministic faker-backed payloads,
no network. A node being "tested" means it executes end to end through the engine and produces
the documented shape; it does **not** mean it has ever talked to the real Slack, Stripe or
WhatsApp API. That is the point of the project, but it should not be mistaken for integration
coverage.
