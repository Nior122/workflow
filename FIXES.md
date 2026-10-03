# FIXES.md

Audit and fix log for FlowForge. Started **Phase 1: AUDIT** — no code changed yet.

**Evidence caveat, stated up front:** this sandbox has **no browser binary**. Chromium
download is network-blocked, so Playwright cannot run. Everything below marked
`[TRACED]` was verified by reading code or by running the logic standalone in Node;
everything marked `[PROVEN]` has a runnable demonstration. Nothing is marked as
visually confirmed, because I could not look at a rendered pixel.

---

## Phase 1 — Audit (complete)

### 1. Build / lint / typecheck / tests

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | **exit 0**, no errors |
| Lint | `npm run lint` | **exit 0**, 0 errors 0 warnings |
| Tests | `npm test` | **184 passed**, 10 files |
| Build | `npm run build` | ✓ Compiled successfully; `/`, `/_not-found`, `/builder` static |
| Runtime | `next dev` on `0.0.0.0:3000` | `GET / 200`, `GET /builder 200` |

**Browser console errors/warnings: NOT OBSERVED.** I have no browser, so I cannot read
a console. I found one hydration mismatch by code inspection (issue #4) that *would*
produce a console warning, but I have not seen it printed.

### 2. Feature-by-feature status

`[P]` = proven/ran, `[T]` = traced by reading code, `[?]` = could not verify without a browser.

| Feature | Status | Evidence / cause |
| --- | --- | --- |
| React Flow stylesheet imported | **WORKS** `[P]` | `app/globals.css:3` → `@import "@xyflow/react/dist/style.css"` |
| Canvas parent has explicit size | **WORKS** `[T]` | `flow-canvas.tsx` root is `relative h-full w-full`; parent chain `flex min-h-0 flex-1` → `main.min-w-0.flex-1` → `h-dvh` column. Unbroken. |
| `nodeTypes` / `edgeTypes` stable identity | **WORKS** `[T]` | Both are module-level (`nodes/index.ts`, `edges/index.ts`), not built in a component |
| Custom nodes have `<Handle>`s | **WORKS** `[T]` | `base-node.tsx` renders one `target` handle (`in`) when `hasInput`, and one `source` per entry in `def.outputs`; condition nodes get `true`/`false` at 33%/66% |
| Changes wired through the store | **WORKS** `[T]` | `onNodesChange` / `onEdgesChange` / `onConnect` all flow into `workflowStore` |
| Grid background | **WORKS** `[T]` | `<Background variant={Dots}>` |
| Pan / zoom | **WORKS?** `[?]` | Props correct (`minZoom` 0.15, `maxZoom` 2.5, `panOnDrag`, `zoomOnPinch`). Not observed. |
| Minimap renders | **PARTIAL** `[P]` | Renders, but **overlaps the attribution** — issue #6 |
| Zoom controls | **WORKS** `[T]` | Custom component, tier-aware position |
| Drag palette → canvas | **WORKS** `[T]` | `onDragOver` calls `preventDefault()`; `onDrop` reads `NODE_DRAG_TYPE`, validates via `isNodeTypeImplemented`, converts with `screenToFlowPosition`. Not observed in a browser. |
| Click-to-add from palette | **WORKS** `[T]` | Real `<button onClick>` → `addNode` at viewport centre |
| Connect two nodes | **WORKS** `[T]` | `onConnect` validates via `isValidConnectionTarget`, creates edge with `sourceHandle`, sets `true`/`false` label. 14 store tests cover the rules. |
| Delete node | **WORKS** `[T]` | `deleteKeyCode={["Backspace","Delete"]}` + `deleteSelection`; covered by tests |
| Delete edge | **WORKS?** `[?]` | Edges are selectable (`elementsSelectable`), so Delete applies. Not observed. |
| Duplicate (⌘/Ctrl+D) | **WORKS** `[P]` | `duplicateSelection` — 4 passing tests incl. edge re-wiring and undoability |
| Multi-select | **PARTIAL** `[T]` | Shift/Meta/Ctrl+click only. `selectionOnDrag` is unset and `panOnDrag` is true, so **rubber-band box select does not exist** — issue #8 |
| Undo / redo | **BROKEN** `[P]` | Mechanics are correct (25 passing tests) but **config typing floods the stack** — issue #2 |
| Auto-layout | **WORKS** `[P]` | 8 passing tests; reachable from zoom controls and the overflow menu |
| Config forms save to store | **WORKS** `[T]` | Every form's `onChange` → `updateNodeData(node.id, { config })` |
| Inspector opens on node select | **BROKEN** `[T]` | Neither tier opens it on selection — issue #5 |
| Inspector edits update the node | **WORKS** `[T]` | Direct store write, node summary re-renders |
| Validation: cycle / missing trigger / disconnected | **WORKS** `[P]` | 11 validator tests + 15 template tests |
| Validation errors shown on nodes | **BROKEN** `[P]` | They appear, then **never clear** — issue #1 |
| Execution order / statuses | **WORKS** `[P]` | 31 executor tests: waves, branching, merge, skip propagation |
| Filter branches correctly | **WORKS** `[P]` | Covered by executor tests |
| `{{user.name}}` resolution | **WORKS** `[P]` | 27 variables tests |
| Failure simulation | **WORKS** `[P]` | Per-node toggle → executor tests |
| Animated edges | **WORKS?** `[?]` | `animated-flow-edge.tsx` uses inline-path `<animateMotion>`. Markup verified in SSR; playback not observed. |
| Node state animations | **WORKS?** `[?]` | Pulse/check/shake/dim logic present; not observed |
| Run console logs + JSON expand | **WORKS** `[T]` | `RunConsole` + `expandedSteps` / `toggleStep` |
| Run history | **WORKS** `[P]` | Capped at 10, 2 passing tests |
| Speed control | **WORKS** `[T]` | Inline ≥640px, in overflow menu below |
| Templates load | **WORKS** `[P]` | 15 tests: all 4 validate, are acyclic, and run to completion |
| localStorage save/load | **WORKS** `[T]` | Wrapped reads/writes, corrupt-data and quota handling |
| Export / import JSON | **WORKS** `[T]` | Accepts a full workflow or bare `{nodes, edges}` |
| Share link | **PARTIAL** `[T]` | Encode/decode proven (10 tests), but **it shadows your own work on reload** — issue #3 |
| Landing page demo | **WORKS** `[P]` | `curl /` → 3 `<animateMotion>` + 3 `keyPoints`, 5 nodes, 1 spinner at phase 0 |
| Route to `/builder` | **WORKS** `[P]` | 2 `href="/builder"` on the landing page; route returns 200 |
| `"use client"` coverage | **WORKS** `[P]` | Swept every non-test file that uses hooks or `create()`; none missing |

### 3. Your common-causes checklist

| Suspected cause | Found? | Evidence |
| --- | --- | --- |
| React Flow stylesheet not imported | **No** | `globals.css:3` |
| ReactFlow parent has no height/width | **No** | Full chain traced, `h-dvh` at the root |
| Nodes missing `<Handle>` / wrong ids | **No** | `base-node.tsx`; ids come from `def.outputs` and `TARGET_HANDLE_IN` |
| `nodeTypes`/`edgeTypes` inside a component | **No** | Both module-level |
| Zustand state mutated in place | **No** | Every reducer returns new arrays/objects |
| Changes not wired through the handlers | **No** | All three wired to the store |
| Hydration error from localStorage during SSR | **YES — but theme, not workflows** | Issue #4. `usePersistence` correctly reads in an effect; `theme-provider.tsx` reads `document` inside a `useState` initializer |
| Missing `"use client"` | **No** | Swept |
| Z-index conflicts / floating panels with no reserved space | **Partly** | No panel floats over the canvas (dock and console take flex space), but z-index is ad hoc (issue #9) and two canvas overlays collide (#6, #7) |
| Panels outside a flex/grid layout | **No** | Flex column with `min-h-0`/`min-w-0` on the flexible children |

---

## Issues, prioritized

### P0 — app unusable

**#1 · Validation errors never clear, and trigger an infinite re-render loop** `[PROVEN]`

- **File:** `hooks/use-live-validation.ts`
- **Symptom:** fix a cycle or add the missing trigger and the red badge stays on the
  node forever. The canvas also re-renders every 220 ms indefinitely.
- **Root cause:** when a node's issues become empty, the write is
  `data: { ...node.data, ...(issues.length > 0 ? { validation: issues } : {}) }`.
  Spreading `{}` **does not delete** the existing `validation` key, so the stale issues
  survive. On the next pass `sameIssues(previous=[issue], issues=[])` is false again, so
  it writes again — forever. Each write produces a new `nodes` array, so every Zustand
  subscriber re-renders.
- **Proof:** ran the two functions verbatim in Node with a node whose issues had cleared:
  ```
  cycle 1: changed.length=1 -> setState? true
           data.validation after write: [{"code":"no_trigger","message":"Missing trigger"}]
  cycle 2: changed.length=1 -> setState? true
           data.validation after write: [{"code":"no_trigger",...}]
  cycle 3: same
  cycle 4: same
  ```
- **Fix (Phase 2):** delete the key when there are no issues, so the next comparison
  sees `previous === []` and stops.
- **Status:** OPEN

### P1 — feature broken

**#2 · Typing in a config field floods the undo stack** `[TRACED]`

- **Files:** `store/workflowStore.ts` (`updateNodeData`), `components/panels/inspector.tsx`
- **Symptom:** ⌘/Ctrl+Z feels dead — it walks back one character at a time instead of
  undoing an edit.
- **Root cause:** `updateNodeData` pushes a `past` snapshot on *every* call, and the
  inspector calls it on every keystroke. Ten characters = ten undo steps.
- **Fix (Phase 2):** coalesce rapid `updateNodeData` calls the same way node drags are
  already coalesced — snapshot on the first change of a burst, not every one.
- **Status:** OPEN

**#3 · A share link permanently shadows your own saved workflow** `[TRACED]`

- **File:** `hooks/use-persistence.ts`
- **Symptom:** open someone's link, then reload — your own work never comes back.
- **Root cause:** the `#flow=` hash is read on every mount and never cleared. The
  `if (shared) { …hydrate…; return; }` branch returns before `loadState()`, so
  localStorage is never consulted again while the hash is in the URL.
- **Fix (Phase 2):** clear the hash once adopted (`history.replaceState`), so the link is
  consumed exactly once.
- **Status:** OPEN

**#4 · Theme hydration mismatch for light-theme users** `[TRACED]`

- **Files:** `components/layout/theme-provider.tsx`, `components/layout/theme-toggle.tsx`
- **Symptom:** React hydration warning in the console; wrong toggle icon and wrong
  `aria-checked` on first paint until an effect corrects it.
- **Root cause:** `readInitialTheme()` reads `document.documentElement` inside a
  `useState` initializer. Server has no `document` → returns `"dark"` → renders `<Moon>`.
  A client whose inline bootstrap script set `.dark` off returns `"light"` → renders
  `<Sun>`. Different trees.
- **Note:** only reproduces when `flowforge.theme` is `"light"`. The dark default hides it,
  which is why it survived.
- **Fix (Phase 2):** start from the server-safe default and adopt the real value after
  mount, or suppress only the dependent subtree.
- **Status:** OPEN

**#5 · The inspector does not open when a node is selected** `[TRACED]`

- **Files:** `components/layout/app-shell.tsx`, `components/layout/mobile-dock.tsx`
- **Symptom:** click a node, nothing happens.
- **Root cause:** selection and panel visibility are unrelated. On the wide tier, if the
  inspector is collapsed to a rail, selecting a node does not expand it. On the compact
  tier, tapping a node only lights a dot on the dock — the sheet never opens.
- **Fix (Phase 2):** open/expand the inspector on selection, guarded so a drag does not
  pop a sheet mid-gesture.
- **Status:** OPEN

### P2 — visual / overlap

**#6 · MiniMap sits on top of the React Flow attribution** `[PROVEN]`

- **File:** `components/canvas/flow-canvas.tsx`
- **Evidence:** served markup is
  `class="react-flow__panel react-flow__attribution bottom right"` and the MiniMap is
  `position="bottom-right"`. Both are absolutely positioned in the same corner.
- **Fix (Phase 3):** move the MiniMap to `top-right`, or lift the attribution.
- **Status:** OPEN

**#7 · Connection-error toast collides with the zoom controls** `[TRACED]`

- **Files:** `components/canvas/connection-error-toast.tsx`, `zoom-controls.tsx`
- **Cause:** at a narrow wide-tier width (canvas ≈ 448 px at a 1024 px viewport), the
  centred toast is `min(26rem, 100%-2rem)` ≈ 416 px and the controls sit at
  `bottom-5 left-5`. Same band, overlapping x-range.
- **Status:** OPEN

**#8 · No rubber-band multi-select** `[TRACED]`

- **File:** `components/canvas/flow-canvas.tsx`
- **Cause:** `selectionOnDrag` is unset and `panOnDrag` is true, so a drag pans. The
  brief asked for multi-select; only Shift+click works today.
- **Status:** OPEN

**#9 · z-index is ad hoc** `[TRACED]`

- 10 / 20 / 30 / 40 / 50 spread across 8 files with no single scale. No collision today,
  but nothing prevents the next one.
- **Status:** OPEN

**#10 · Decision needed — the brief contradicts last turn's instruction**

- Your Phase 3 says *"Show a clear message below 768px that editing needs a larger
  screen."* Last turn you asked for **full editing on mobile**, which is now built
  (bottom sheets, palette/inspector/console all work on a phone), and the read-only
  banner was deleted.
- These cannot both be true. I will not silently pick one. Options:
  (a) keep full mobile editing and drop the 768px message,
  (b) restore the message below 768px and keep sheets from 768–1023px,
  (c) restore full read-only below 768px.
- **Status:** BLOCKED ON YOUR DECISION

### P3 — polish

| # | Issue | File |
| --- | --- | --- |
| 11 | `settings.theme` is written by autosave but never read back; theme is duplicated across two storage keys | `hooks/use-persistence.ts`, `theme-provider.tsx` |
| 12 | `uiStore.consoleOpen` is dead state — no component reads it | `store/uiStore.ts` |
| 13 | `PROJECT_NOTES.md` header still says "Phase 1 complete. Awaiting continue to start Phase 2" | `PROJECT_NOTES.md` |
| 14 | Stale `nodeStatuses` survive node deletion; ids can be reused after `resetNodeIdCounter()` in `switchWorkflow`/`hydrate`, so a new node can inherit an old status | `store/runStore.ts`, `store/workflowStore.ts` |
| 15 | `beginRun` seeds statuses only for `reachableFromTriggers`, so unreachable nodes keep whatever status they had | `hooks/use-run-workflow.ts` |
| 16 | No empty-state template button on the canvas (your Phase 4 asks for one) | `components/canvas/empty-canvas.tsx` |
| 17 | No toasts for save/import/export — the workflow menu has a local toast, but autosave is silent | `components/panels/workflow-menu.tsx` |

---

## What I could not verify, and why

No browser binary exists in this sandbox (`npx playwright install --with-deps chromium`
fails at the apt stage; the plain Chrome for Testing download is blocked). So these are
**unverified**, not known-good:

- Real pointer drag-and-drop, handle-to-handle connection, box selection
- Pan/zoom/pinch behaviour
- Whether the animated particles and node pulses actually play
- Pixel-level overlap (issues #6 and #7 are inferred from CSS/markup, not seen)
- The browser console — I could not read one

The Phase 5 screenshot script (`npm run docs:screenshots`) exists for exactly this and
will produce the 1440px / 1024px evidence your Phase 5 asks for, once run somewhere with
a browser.

---

## Phase 2 — Fix functionality (P0, P1) — COMPLETE

**Gate after the phase:** `npx tsc --noEmit` exit 0 · `npm run lint` 0 errors 0 warnings ·
`npx vitest run` **208 passed / 11 files** (was 184/10) · `npm run build` ✓ compiled, all
three routes static · `GET / 200`, `GET /builder 200`.

Every fix below was verified by a test that **fails on the old code and passes on the
new**. Where I could not write such a test I say so.

---

### #1 · P0 · Validation errors never cleared + infinite re-render loop — FIXED

- **Files changed:** `hooks/use-live-validation.ts`, `hooks/__tests__/validation-patch.test.ts` (new), `vitest.config.mts`
- **Fix:** extracted the data write into a pure exported `withValidation(node, issues)`
  that **deletes** the `validation` key when there are no issues, instead of spreading
  `{}` and leaving the stale array behind. `sameIssues` is exported too so the
  convergence property is asserted, not assumed.
- **Verification:** 8 new tests. Proven to catch the regression — I temporarily restored
  the buggy write and re-ran:
  ```
  × removes the key entirely when there are none
  × clears a resolved error and then stops writing
  Tests  2 failed | 6 passed (8)
  ```
  Restored the fix: `Tests 8 passed (8)`.
- **Also changed:** `vitest.config.mts` now discovers `hooks/__tests__/**`.
- **Status:** CLOSED

### #2 · P1 · Typing in a config field flooded the undo stack — FIXED

- **Files changed:** `store/workflowStore.ts`, `store/__tests__/workflow-store-history.test.ts`
- **Fix:** `updateNodeData` now coalesces. Consecutive edits to the **same node** and the
  **same data keys** within `EDIT_COALESCE_MS = 700` collapse into one undo step — the
  same idea already used to coalesce a node drag. Editing a different field
  (`simulateFailure` vs `config`), a different node, or the same field after the window
  expires all start a fresh step. `undo`/`redo` clear the window so an edit made straight
  after an undo is itself undoable. `resetEditCoalescing()` is exported for tests.
- **Verification:** 7 new tests using fake timers. Proven to catch the regression —
  forcing `coalesce = false` gives:
  ```
  × collapses a burst of keystrokes into a single undo step
  × undoes a whole typed word in one step
  × collapses rapid rename keystrokes too
  Tests  3 failed | 43 passed (46)
  ```
  Restored: `46 passed`.
- **One correction I made to my own test:** the first version asserted the config equalled
  `{ systemPrompt: "one" }` and failed. The test was wrong, not the code — my helper
  replaced the whole config object where the real form merges
  (`onChange({ ...config, systemPrompt })`). Fixed the helper to match production and the
  assertion to compare against the captured post-undo config.
- **Status:** CLOSED

### #3 · P1 · Share link permanently shadowed your own workflow — FIXED

- **Files changed:** `lib/utils/share.ts`, `hooks/use-persistence.ts`, `lib/utils/__tests__/share.test.ts`
- **Fix:** the link is now **consumed**. After adoption,
  `window.history.replaceState(null, "", withoutShareHash(window.location.href))` strips
  the `#flow=` fragment, so the next reload falls through to `loadState()`.
  `withoutShareHash` is a pure exported function so the stripping is unit-tested.
- **Verification:** 5 new tests, including one asserting the path and query survive and
  one round-trip test proving a consumed URL no longer decodes as a share link.
  `lib/utils` now 15 tests, all passing.
- **Not unit-tested:** the `history.replaceState` call itself — the suite runs in a Node
  environment with no DOM (`jsdom`/`happy-dom` are not installed, and adding one is a
  dependency change I did not make unprompted). The URL computation it depends on *is*
  tested.
- **Status:** CLOSED (DOM call unverified by test)

### #4 · P1 · Theme hydration mismatch — FIXED

- **File changed:** `components/layout/theme-provider.tsx`
- **Fix:** the provider now reads the theme through `useSyncExternalStore` with a
  `getServerSnapshot` that returns the default, instead of reading `document` inside a
  `useState` initializer. React renders the server snapshot during hydration and treats
  the switch to the real value as a store update, which is the sanctioned pattern — and
  the one `useMediaQuery` already uses for exactly this reason. Theme writes go through a
  module-level `writeTheme` that notifies subscribers.
- **Verification:** `tsc` 0, `lint` 0/0, SSR still renders the dark-default toggle
  (`aria-label="Switch to light theme"`). **Not test-proven** — a hydration mismatch can
  only be observed in a real browser console, which this sandbox does not have. This is
  the fix I am least able to demonstrate, and I am flagging it rather than claiming it.
- **Status:** CLOSED (unverified in a browser)

### #5 · P1 · Inspector did not open on node select — FIXED

- **Files changed:** `components/canvas/flow-canvas.tsx`, `components/layout/mobile-dock.tsx`
- **Fix:** `<ReactFlow onNodeClick>` now calls `setPanel("inspector", true)`. `onNodeClick`
  fires for a click but **not** for a drag, which is precisely the distinction needed —
  dragging a node must not throw a panel over the canvas. On the compact tier the
  inspector sheet is now driven by the same `uiStore.inspectorOpen` flag rather than
  dock-local state, so one flag opens the docked panel on desktop and the sheet on a
  phone. The dock's `SheetId` union no longer includes `"inspector"`.
- **Verification:** `tsc` 0, `lint` 0/0, build clean. **Not test-proven** — it is a
  pointer-interaction wiring change and there is no browser here.
- **Status:** CLOSED (unverified in a browser)

---

### Engine test coverage you asked for

You asked for linear flow, branching, cycle detection, variable resolution and failure
handling. I audited rather than assumed, and **all five were already covered** by the
existing 31 executor tests plus 27 dedicated `variables` tests:

| Scenario | Existing coverage |
| --- | --- |
| Linear flow | 7 tests incl. payload passthrough and step ordering |
| Branching | 4 tests: true branch, false branch, skipped-branch status, edge activation |
| Cycle detection | `refuses to run a cyclic flow at all` (+11 validator tests) |
| Variable resolution | `resolves {{variables}} from the upstream payload` + 27 tests |
| Failure handling | 3 tests, incl. invalid trigger JSON and skip-downstream |

I checked for the toggle specifically — `simulateFailure` **is** exercised end-to-end at
`executor.test.ts:248` and `:423`.

I found and filled two **real gaps** instead of re-testing what existed:

1. **Cancel *mid*-run.** Only a pre-aborted signal was tested, which exits before any work.
   New test aborts from inside `sleep` once the run is genuinely underway and asserts the
   status is `cancelled`, that some steps ran, and that the chain did not finish.
2. **Partial failure across parallel branches.** Three new tests: a rigged node errors
   while its sibling succeeds; the overall run is still `failed`; and a failed node
   delivers nothing downstream (successor is `skipped`).

Executor suite: 31 → **35 tests**.

---

### Test count

184 → **208** (+24). Files 10 → 11.

| New tests | Count |
| --- | --- |
| `hooks/__tests__/validation-patch.test.ts` | 8 |
| `store/__tests__/workflow-store-history.test.ts` (coalescing block) | 7 |
| `lib/utils/__tests__/share.test.ts` (`withoutShareHash`) | 5 |
| `lib/engine/__tests__/executor.test.ts` (mid-run cancel, partial failure) | 4 |

### Still open

- **#10 remains blocked on your decision** — the 768px message in your Phase 3 brief vs.
  the full mobile editing you asked for last turn. It is a Phase 3 item, so it does not
  block this phase, but I need it before I start Phase 3.
- #6–#9 (P2 visual/overlap) and #11–#17 (P3) are untouched, as planned.

## Phase 3 — Layout and overlap (P2)

_Not started._

## Phase 4 — UX polish (P3)

_Not started._

## Phase 5 — Verify and show evidence

_Not started._
