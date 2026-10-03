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
- **Status:** FIXED in Phase 2 — see below

### P1 — feature broken

**#2 · Typing in a config field floods the undo stack** `[TRACED]`

- **Files:** `store/workflowStore.ts` (`updateNodeData`), `components/panels/inspector.tsx`
- **Symptom:** ⌘/Ctrl+Z feels dead — it walks back one character at a time instead of
  undoing an edit.
- **Root cause:** `updateNodeData` pushes a `past` snapshot on *every* call, and the
  inspector calls it on every keystroke. Ten characters = ten undo steps.
- **Fix (Phase 2):** coalesce rapid `updateNodeData` calls the same way node drags are
  already coalesced — snapshot on the first change of a burst, not every one.
- **Status:** FIXED in Phase 2 — see below

**#3 · A share link permanently shadows your own saved workflow** `[TRACED]`

- **File:** `hooks/use-persistence.ts`
- **Symptom:** open someone's link, then reload — your own work never comes back.
- **Root cause:** the `#flow=` hash is read on every mount and never cleared. The
  `if (shared) { …hydrate…; return; }` branch returns before `loadState()`, so
  localStorage is never consulted again while the hash is in the URL.
- **Fix (Phase 2):** clear the hash once adopted (`history.replaceState`), so the link is
  consumed exactly once.
- **Status:** FIXED in Phase 2 — see below

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
- **Status:** FIXED in Phase 2 — see below

**#5 · The inspector does not open when a node is selected** `[TRACED]`

- **Files:** `components/layout/app-shell.tsx`, `components/layout/mobile-dock.tsx`
- **Symptom:** click a node, nothing happens.
- **Root cause:** selection and panel visibility are unrelated. On the wide tier, if the
  inspector is collapsed to a rail, selecting a node does not expand it. On the compact
  tier, tapping a node only lights a dot on the dock — the sheet never opens.
- **Fix (Phase 2):** open/expand the inspector on selection, guarded so a drag does not
  pop a sheet mid-gesture.
- **Status:** FIXED in Phase 2 — see below

### P2 — visual / overlap

**#6 · MiniMap sits on top of the React Flow attribution** `[PROVEN]`

- **File:** `components/canvas/flow-canvas.tsx`
- **Evidence:** served markup is
  `class="react-flow__panel react-flow__attribution bottom right"` and the MiniMap is
  `position="bottom-right"`. Both are absolutely positioned in the same corner.
- **Fix (Phase 3):** move the MiniMap to `top-right`, or lift the attribution.
- **Status:** FIXED in Phase 3 — see below

**#7 · Connection-error toast collides with the zoom controls** `[TRACED]`

- **Files:** `components/canvas/connection-error-toast.tsx`, `zoom-controls.tsx`
- **Cause:** at a narrow wide-tier width (canvas ≈ 448 px at a 1024 px viewport), the
  centred toast is `min(26rem, 100%-2rem)` ≈ 416 px and the controls sit at
  `bottom-5 left-5`. Same band, overlapping x-range.
- **Status:** FIXED in Phase 3 — see below

**#8 · ~~No rubber-band multi-select~~ — MY AUDIT WAS WRONG, NOT A DEFECT** `[RETRACTED]`

- **File:** `components/canvas/flow-canvas.tsx`
- **What I claimed:** only Shift+click works, because `selectionOnDrag` is unset.
- **What the installed source actually says** (`@xyflow/react@12.12.0`,
  `dist/esm/index.mjs`):
  - line 1491 — `const isSelectionActive = (selectionOnDrag && eventTargetIsContainer) || selectionKeyPressed;`
  - line 2122 — `const isSelecting = selectionKeyPressed || userSelectionActive || _selectionOnDrag;`
  - line 2124 — `panOnDrag: !selectionKeyPressed && panOnDrag`
- We pass `selectionKeyCode="Shift"`, so `selectionKeyPressed` is true whenever Shift is
  held, panning is suspended for that drag, and **Shift+drag already opens a rubber-band
  selection box.** I conflated "Shift+drag" with "Shift+click" and never checked the
  library.
- Separately, line 2121 — `const _selectionOnDrag = selectionOnDrag && panOnDrag !== true;`
  — means turning on `selectionOnDrag` would have been a **no-op** anyway while
  `panOnDrag` is `true`. Unmodified drag-select requires giving up left-drag panning.
  That is a deliberate interaction trade, not a bug, and I did not make it unilaterally.
- **Status:** RETRACTED — no code change. Multi-select works via Shift+drag (and
  Cmd/Ctrl+click to add).

**#9 · z-index is ad hoc** `[TRACED]`

- 10 / 20 / 30 / 40 / 50 spread across 8 files with no single scale. No collision today,
  but nothing prevents the next one.
- **Status:** FIXED in Phase 3 — see below

**#10 · Decision needed — the brief contradicts last turn's instruction**

- Your Phase 3 says *"Show a clear message below 768px that editing needs a larger
  screen."* Last turn you asked for **full editing on mobile**, which is now built
  (bottom sheets, palette/inspector/console all work on a phone), and the read-only
  banner was deleted.
- These cannot both be true. I will not silently pick one. Options:
  (a) keep full mobile editing and drop the 768px message,
  (b) restore the message below 768px and keep sheets from 768–1023px,
  (c) restore full read-only below 768px.
- **Status:** RESOLVED — you said "continue" without picking, so I proceeded with **(a)**,
  the option I recommended and the one that keeps the mobile editing you explicitly asked
  for. No 768px message was added. Say the word to switch to (b) or (c).

### P3 — polish

| # | Issue | File |
| --- | --- | --- |
| # | Issue | Status |
| --- | --- | --- |
| 11 | `settings.theme` written by autosave but never read back | **FIXED** in Phase 4 — `adoptThemeIfUnset()` |
| 12 | `uiStore.consoleOpen` is dead state | **FIXED** in Phase 4 — removed, `PanelId` narrowed |
| 13 | `PROJECT_NOTES.md` header stale | **FIXED** in Phase 3 |
| 14 | Stale `nodeStatuses` survive a workflow switch; ids are reused after `resetNodeIdCounter()` | **FIXED** in Phase 4 — test-first, see below |
| 15 | ~~`beginRun` leaves unreachable nodes with old statuses~~ | **RETRACTED** — my reading was wrong, see below |
| 16 | No empty-state template button | **FIXED** in Phase 4 |
| 17 | Toasts were trapped inside the workflow menu; autosave silent | **FIXED** in Phase 4 |

Plus one new finding, #18, discovered while verifying Phase 4:

| # | Issue | Status |
| --- | --- | --- |
| 18 | **Light theme `success` and `warning` fail WCAG AA** — 3.43:1 and 3.26:1 on `surface-raised`. My earlier note claiming "all 12 pairs ≥ 4.5:1, light min 4.64" was wrong. | **FIXED** in Phase 4 |

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

## Phase 3 — Layout and overlap (P2) — COMPLETE

**Gate after the phase:** `tsc --noEmit` 0 · `eslint` 0/0 · **221 passed / 12 files**
(was 208/11) · `next build` ✓ compiled, 3 static routes · `GET /builder 200`.

### The shell is now one CSS grid

`components/layout/app-shell.tsx` no longer nests flex boxes. Both tiers are a single
grid, and the wide tier is exactly the shape your brief described:

```
row 1   [                 chrome                  ]   auto
row 2   [ palette ][        canvas        ][ inspect ]   minmax(0, 1fr)
row 3   [              run console                 ]   auto
        16rem/2.5rem   minmax(0, 1fr)   20rem/2.5rem
```

Served markup, verified with `curl`:

```
grid-template-columns:16rem minmax(0, 1fr) 20rem;grid-template-rows:auto minmax(0, 1fr) auto
```

- **The canvas cannot sit under another panel.** It owns row 2 / column 2 outright. The
  panels are siblings in adjacent tracks, not overlapping layers, so there is no z-order
  or negative margin that could put one over the other.
- **`minmax(0, 1fr)`, not `1fr`.** A bare `1fr` has an implicit `auto` minimum, so a long
  label inside the canvas would widen the track and push the inspector off-screen.
- **`min-width: 0` on every grid child**, which is what actually stops a track being
  blown out by its contents.
- **Collapsing a rail animates** via `transition-property: grid-template-columns`
  (confirmed present in the compiled CSS), so it is a smooth resize rather than a jump.

**Two deliberate exceptions to "`overflow: hidden` on grid children"**, both because
following the instruction literally would have hidden something:

1. `ShellHeader` is **not** clipped. The top bar's blocking-error alert is
   `absolute top-full` — it hangs *below* the bar's box — so clipping the header would
   have hidden the one message that tells you why a run was refused. I caught this while
   auditing my own change, not from a test.
2. `BottomPanel` is **not** clipped. Its resize handle sits at `-top-1`; clipping the root
   would have cut off the half that hangs above the panel and broken dragging. Containment
   is applied to the inner wrapper instead.

### #6 · MiniMap on the attribution — FIXED

`components/canvas/flow-canvas.tsx`: MiniMap `position="bottom-right"` → `"top-right"`.

All four canvas corners now have at most one occupant: **top-right** minimap,
**bottom-left** zoom controls, **bottom-right** React Flow attribution (kept and visible,
per their terms — it was *moved around*, never hidden), **top-left** free. The minimap is
already hidden on an empty canvas (`minimapVisible && !isEmpty`), so it can never meet the
empty state.

### #7 · Toast colliding with the zoom controls — FIXED

`components/canvas/connection-error-toast.tsx`: on the wide tier the toast moves from
centred at `bottom-5` to `bottom-16 left-5` — the same column as the zoom controls, one
step above them. Two panels that share a column and differ in row cannot overlap at any
width, which fixes it for 448px and for 1344px alike rather than only at the width I
happened to measure. The compact tier is unchanged.

### #9 · z-index scale — FIXED

One scale, defined in one place: the `@theme` block in `app/globals.css`.

| Token | Value | Used by |
| --- | --- | --- |
| `z-page` | 10 | landing content above its own decorative backgrounds |
| `z-canvas-overlay` | 10 | empty state, zoom controls, node status chips |
| `z-canvas-toast` | 20 | connection-error toast |
| `z-dock` | 30 | top bar, mobile dock, the top bar's error alert |
| `z-menu` | 40 | dropdown content anchored to the chrome |
| `z-overlay` | 50 | dialog, sheet, tooltip |

19 raw `z-10`/`z-20`/`z-30`/`z-40`/`z-50` usages across 12 files were replaced. Verified
afterwards that **zero** raw numeric z-utilities remain outside the scale's own comment:

```
$ grep -rnoP '(?<![\w-])z-[0-9]+(?![\w-])' components app
app/globals.css:97:z-50        # the comment text itself
```

All six utilities confirmed present in the compiled stylesheet with the right values,
e.g. `.z-canvas-toast{z-index:20}`. React Flow's own panels sit at `z-index: 5`, so
`z-canvas-overlay` (10) already clears the minimap and attribution.

### Nodes: width, labels, handles — verified, one small change

- **Width is consistent by construction.** `width: NODE_WIDTH` (240px) is set in exactly
  one place, `components/nodes/base-node.tsx:65`. Grepped every node and form component:
  nothing else sets a width.
- **Labels ellipsise.** The node title already had `truncate`; I added it to the category
  subtitle too. Config summaries are truncated in `flow-node.tsx`.
- **Handles are not covered.** They are the last children of the node, so they paint above
  the accent spine. The status chip (`-bottom-2 -right-2`) and error badge (`-top-2 -right-2`)
  sit in the corners while handles sit mid-edge, so they cannot meet.

### 1024 / 1280 / 1440 / 1920 — tested as code, not eyeballed

I cannot see pixels in this sandbox, so instead of asserting the arithmetic in prose I put
it in shipped code and tested it. New module `components/layout/shell-tracks.ts` exports
`PALETTE_PX`, `INSPECTOR_PX`, `RAIL_PX`, `builderGridColumns()` and `canvasWidthAt()`.
**`app-shell.tsx` imports `builderGridColumns()` and renders its return value**, so the
tests assert against the very string that reaches the DOM — not a copy of it.

`components/layout/__tests__/shell-tracks.test.ts` — 13 tests:

| Viewport | Both rails open | Canvas left |
| --- | --- | --- |
| 1024 | 256 + 320 | **448px** |
| 1280 | 256 + 320 | **704px** |
| 1440 | 256 + 320 | **864px** |
| 1920 | 256 + 320 | **1344px** |

Plus: a 448px canvas still fits a 240px node with ≥80px to spare; collapsing a rail returns
exactly `PALETTE_PX − RAIL_PX`; the canvas track clamps to 0 rather than going negative;
and `minmax(0, 1fr)` is present in every rail combination.

**Negative control:** setting `PALETTE_PX = 300` gives **6 failed | 7 passed**. Restored,
**13 passed**.

### #8 — retracted, see the issues list above

Multi-select already worked; I had misread the library. No code was changed.

### #10 — resolved as option (a)

You said "continue" without choosing, so I went with the option I recommended: **no 768px
message, phones keep full editing via bottom sheets.** Nothing was removed. Trivially
reversible if you want (b) or (c).

### What I could not verify

**No browser is available in this sandbox, so I have not seen any of this rendered.** What
I *did* check mechanically: the grid template string in served HTML, the absence of the
clipping wrapper, every z-index utility and the `grid-template-columns` transition in the
compiled CSS, and the track arithmetic as executed code. The visual result at 1024–1920px
is inferred from that, not observed.

## Phase 4 — UX polish (P3) — COMPLETE

**Gate after the phase:** `tsc --noEmit` 0 · `eslint` 0/0 · **225 passed / 13 files**
(was 221/12) · `npm run check:contrast` **26/26 pass, worst 4.64:1** · `next build` ✓ ·
`GET /builder 200`.

### 4px spacing grid

Measured before changing anything: **106 spacing/position utilities** were off the grid
(`gap-1.5`, `px-2.5`, `py-0.5`, …) across 26 files. All snapped to the nearest 4px step
(`0.5→1`, `1.5→2`, `2.5→3`, `3.5→4`). Zero remain:

```
$ grep -rnoE '\b(p|m|gap|space-x|space-y|inset|top|right|bottom|left|px|py|mx|my|mt|mb|ml|mr|pt|pb|pl|pr)-(0\.5|1\.5|2\.5|3\.5)\b' components app | wc -l
0
```

**38 values were deliberately left alone**: `size-3.5` (28×, the 14px icon size),
`size-2.5`, `size-1.5`, `h-1.5`, `h-0.5`. Those are component *dimensions*, not spacing —
snapping 14px icons to 16px would change the icon system, and `h-0.5` is a 2px hairline
divider. Verified unchanged after the sweep.

### Radius and border

Already consistent, and I verified it rather than assuming: `rounded-md` 38×,
`rounded-full` 23×, `rounded-lg` 11×, `rounded-xl` 4× — every one from the four `--radius-*`
tokens. **No arbitrary `rounded-[Npx]` anywhere.** No change needed.

### hover / focus / active / disabled

- **focus** was already covered globally by `@layer base :focus-visible` in
  `globals.css` (2px ring, 2px offset) — so all 37 interactive elements are covered, not
  just the 5 that mention `focus-visible`. No change needed.
- **active was the real gap**: only the `default` Button variant had one. Added to all six
  variants, to the shared `hover:bg-surface-raised hover:text-foreground` pattern (11
  sites → `active:bg-border`), to the mobile dock (touch has no hover, so this is the only
  press feedback a phone gets), and to 10 individually-targeted controls.
- **disabled** was already handled at each site (`disabled:opacity-40/50`,
  `disabled:pointer-events-none`); verified, not changed.

### #18 · light-theme contrast — a finding I had previously gotten wrong

I built `scripts/check-contrast.mjs` (now `npm run check:contrast`) which parses the HSL
tokens out of `globals.css` and computes WCAG ratios. It found two genuine failures in the
light theme:

| Pair | Before | After |
| --- | --- | --- |
| `success` on `surface-raised` | **3.43:1** FAIL | 4.94:1 |
| `warning` on `surface-raised` | **3.26:1** FAIL | 4.93:1 |

Fixed by dropping lightness 37%→30% and 38%→30% at **unchanged hue and saturation**, so the
colours read the same, just darker. Dark theme was already clean (worst 5.00:1).

**Two bugs in my own checker, both caught before I trusted its output:**
1. It reported identical numbers for both themes. `css.indexOf(".dark")` was matching
   `@custom-variant dark (&:is(.dark *))` earlier in the file, so the "dark" run was
   silently measuring `:root`. Fixed by searching for `".dark {"`.
2. Every ratio was `NaN` — `Number("9%")` is `NaN`. Switched to `parseFloat`.

If I had believed the first run I would have reported "both themes pass, worst 3.26:1" —
plausible-looking and completely wrong.

**This corrects, but does not contradict, the earlier note.** `PROJECT_NOTES.md` §Phase 6
claimed "all 12 pairs ≥ 4.5:1 in both themes". Those 12 were the *accent and foreground*
pairs, and every one of them does pass. The check simply never included `success` and
`warning` — so the claim was true about what it measured and wrong to generalise from it.
The new script covers 13 pairs per theme (26 total) and is checked in, so the next colour
change gets measured rather than remembered.

### #14 · run state leaked between workflows — FIXED (test-first)

`switchWorkflow`, `deleteWorkflow` and `hydrate` all call `resetNodeIdCounter()`, so the
next workflow's nodes legitimately reuse ids like `node-1` — but nothing cleared
`nodeStatuses`. A node that had never run could show a previous workflow's status.

Written red first: **3 failed | 1 passed** (`expected 'queued' to be undefined`,
`expected 'running' to be 'idle'`). The one that passed asserts run *history* survives,
because history is session-wide and must not be cleared. After wiring the already-existing
`resetStatuses()` into those three actions: **4 passed**.

`tsc` also caught two errors in my own test — I had invented a `RunResult` shape
(`runId`, `status: "success"`) instead of reading `types/run.ts`. Real shape is
`{ id, endedAt, edges, status: "completed", … }`.

### #15 · RETRACTED — another wrong finding

I claimed `beginRun` seeds only `reachableFromTriggers`, leaving unreachable nodes with
stale statuses. Wrong: `beginRun` **replaces the whole record**
(`nodeStatuses: Object.fromEntries(...)`), and `useNodeStatus` is
`state.nodeStatuses[nodeId] ?? "idle"` — so an unseeded node has no entry and renders idle,
which is correct. No code changed. **That is the second finding I have had to retract**; in
both cases I reasoned from the call site without reading the implementation.

### #11 / #12 · theme duplication and dead state — FIXED

- `adoptThemeIfUnset(theme)` in `theme-provider.tsx`, called on hydration. It only acts when
  `flowforge.theme` is absent, i.e. the browser has never expressed a preference — so an
  imported workflow can carry a theme without ever overriding a deliberate user choice.
- `consoleOpen` deleted from `uiStore` (grep confirmed nothing outside the store read it)
  and `PanelId` narrowed to `"palette" | "inspector"`.

### #16 / #17 · empty-state button and a real toast system — FIXED

- New `store/toastStore.ts` + `components/ui/toast-viewport.tsx`, mounted once per tier.
  The workflow menu's private toast is gone; its 8 `flash()` calls now use `pushToast()`.
  New `z-toast: 60` step added to the scale so toasts clear dialogs and sheets.
- Placed **top-right**, not bottom-centre: the bottom of the viewport belongs to the run
  console on desktop and the dock on a phone, and the top bar's own blocking alert already
  owns top-centre.
- Empty state gained a **Browse templates** button that opens the same gallery dialog —
  `templatesOpen` moved into `uiStore` so the canvas and the toolbar share one instance
  instead of mounting two.
- **One judgement call to flag:** autosave fires ~600ms after *every* edit pause, so an
  unthrottled "Saved" toast would be constant noise. It is throttled to one confirmation
  per 15s, and a failed save raises an error toast immediately with no throttle. Say the
  word if you want it every time or never.

### Toolbar tooltips and shortcut hints

- Tooltips on Templates, Run and Stop (the Run tooltip explains *why* it is disabled when
  the canvas is empty).
- New `components/ui/kbd.tsx` renders `⌘ ⇧ Z` on a Mac and `Ctrl Shift Z` elsewhere, using
  `useSyncExternalStore` with a `false` server snapshot — the same pattern that fixed the
  theme hydration bug, so Mac users get no mismatch warning.
- Hints added to the Undo/Redo menu items. Only shortcuts that **actually exist** in
  `use-keyboard-shortcuts.ts` are advertised; I did not invent any.

### What I could not verify

Still no browser. Verified mechanically: the served HTML contains the empty-state button,
the toast viewport, and the toolbar triggers; the compiled CSS contains `z-toast` and all
spacing changes; contrast is computed, not eyeballed; the run-state fix has a red/green
test. **Tooltip and `<kbd>` content do not appear in the SSR HTML** because Radix renders
them in a portal only when open — I verified their wiring in source and that their triggers
render, but I have not seen them open. The 106 spacing changes are 2px-each and I cannot
confirm they look better.

## Phase 5 — Verify and show evidence — COMPLETE

The summary deliverable is **[`REPORT.md`](./REPORT.md)**: gate results, the broken→fixed
table for all 18 findings, the two retractions, what is still imperfect, the substitute
evidence, and manual test steps.

**Gate, from a clean `.next`:** `tsc --noEmit` 0 · `eslint` 0/0 · **233 passed / 14 files** ·
`npm run check:contrast` 26/26 (worst 4.64:1) · `next build` ✓ 3 static routes ·
`GET /` 200 · `GET /builder` 200.

**Screenshots: not produced.** Re-verified this session, not carried over from memory:
no `chromium`/`google-chrome`/`firefox` on `PATH`, no `Xvfb`, `~/.cache/ms-playwright`
contains only an empty `.links/`, and `npx playwright install chromium` fails with
`Failed to download Chrome for Testing 153.0.8010.12 … Download failure, code=1`.

**Substitute evidence:** `components/layout/__tests__/layout-contract.test.ts` — 8 tests
that read the shipped source and assert the invariants overlap-freedom depends on (single
z-scale with a strictly ordered set of steps, no raw numeric z-index in any component, the
MiniMap not parked on the attribution's corner, the attribution still visible, the canvas
track `minmax(0, 1fr)`, the canvas cell `min-w-0 overflow-hidden`).

Negative control: re-introducing `z-50` in `empty-canvas.tsx` and moving the MiniMap back to
`bottom-right` gives **2 failed | 6 passed**, naming both offenders; restored, **8 passed**.
`git status` confirmed clean afterwards.

**These are source checks, not rendered-layout checks.** That distinction is stated in
`REPORT.md` §5 rather than left for the reader to discover.
