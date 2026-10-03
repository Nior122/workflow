# FlowForge — Project Notes

> **Living document.** Re-read this file at the start of every phase. Update it at the end of
> every phase (tick the phase, list files, record decisions, list known issues).
>
> Status: **Phase 1 complete.** Awaiting "continue" to start Phase 2.
> Branch `arena/01a102bb-workflow`. All gates green: `tsc --noEmit`, `eslint`, 32 unit tests,
> `next build`, and a live `next dev` server returning 200 on `/` and `/builder`.

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
- [ ] **Phase 6** — Landing page with looping animated demo, polish pass, accessibility pass,
      responsive fallback.
- [ ] **Phase 7** — README (screenshots, architecture, "what I'd build next"), Vercel deploy prep.

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
