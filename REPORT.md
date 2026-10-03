# FlowForge — QA Report

**Date:** 2026-10-03 · **Branch:** `arena/01a102bb-workflow` · **Commit:** see `git log -1`
**Scope:** five-phase audit-and-fix cycle over the whole app. Full issue-by-issue detail,
root causes and verification evidence live in [`FIXES.md`](./FIXES.md). This is the summary.

---

## 1. Gate — all four checks pass

Run from a clean `.next`:

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors, 0 warnings** |
| Unit tests | `npx vitest run` | **233 passed / 14 files** |
| Build | `npm run build` | **✓ compiled**, `/`, `/_not-found`, `/builder` all static |
| Contrast | `npm run check:contrast` | **26/26 pass**, worst pair **4.64:1** |
| Served | `curl / ` and `curl /builder` | **200** and **200** |

Test count over the cycle: 184 → **233**. Files: 10 → **14**.

---

## 2. Screenshots — not produced, and why

Phase 5 asked for screenshots at 1440px and 1024px with a template loaded and a run in
progress. **I could not take them.** Re-verified this session rather than assumed:

```
$ for b in chromium google-chrome firefox …; do command -v $b; done     # nothing
$ command -v Xvfb                                                       # nothing
$ npx playwright install chromium
Failed to download Chrome for Testing 153.0.8010.12 (playwright chromium v1243),
caused by: Download failure, code=1
$ ls ~/.cache/ms-playwright                                             # only an empty .links/
```

No browser binary, no display server, and the download is blocked. **Every visual claim in
this report is therefore reasoned from markup, CSS and executed arithmetic — never observed
as pixels.** The substitute evidence is in §5.

---

## 3. Broken → fixed

18 findings. **15 fixed, 2 retracted as my own errors, 1 resolved by decision.**

| # | Sev | What was wrong | Outcome |
| --- | --- | --- | --- |
| 1 | **P0** | Cleared validation spread `{}`, which does not delete a key — the error badge stuck forever **and** `setState` fired every 220 ms indefinitely | **Fixed.** Pure `withValidation()` that deletes the key. 8 tests; restoring the bug gives 2 failures |
| 2 | P1 | `updateNodeData` snapshotted undo on every call; the inspector calls it per keystroke, so 5 characters = 5 undo steps | **Fixed.** 700 ms coalescing window. 7 tests; disabling it gives 3 failures |
| 3 | P1 | A share link's `#flow=` hash was never stripped, so it shadowed saved work on every reload | **Fixed.** `withoutShareHash()` + `history.replaceState`. 5 tests |
| 4 | P1 | `readInitialTheme()` read `document` in a `useState` initializer → hydration mismatch for light-theme users | **Fixed.** `useSyncExternalStore` with a server snapshot |
| 5 | P1 | The inspector never opened when a node was selected | **Fixed.** `onNodeClick` → `setPanel("inspector", true)`; fires on click, not drag |
| 6 | P2 | MiniMap `bottom-right` sat exactly on the React Flow attribution | **Fixed.** MiniMap → `top-right`; attribution kept visible |
| 7 | P2 | Connection-error toast overlapped the zoom controls at narrow canvas widths | **Fixed.** Same column, one step above — cannot overlap at any width |
| 9 | P2 | z-index ad hoc: 10/20/30/40/50 across 12 files | **Fixed.** One `@theme` scale, 7 named steps; 19 raw usages replaced |
| 11 | P3 | `settings.theme` written on every autosave, never read | **Fixed.** `adoptThemeIfUnset()` — an imported workflow's theme now applies |
| 12 | P3 | `uiStore.consoleOpen` was dead state | **Fixed.** Removed; `PanelId` narrowed |
| 13 | P3 | `PROJECT_NOTES.md` header stale | **Fixed.** |
| 14 | P3 | Run statuses survived a workflow switch while node ids were recycled, so a node could wear another workflow's status | **Fixed.** `resetStatuses()` wired into switch/delete/hydrate. Test-first: 3 red → 4 green |
| 16 | P3 | No template button in the canvas empty state | **Fixed.** "Browse templates", sharing one gallery dialog via `uiStore` |
| 17 | P3 | Toasts were private to the workflow menu; autosave was silent | **Fixed.** Shared `toastStore` + one viewport; `z-toast` step added |
| 18 | P3 | **Found during Phase 4:** light-theme `success` 3.43:1 and `warning` 3.26:1 — both fail WCAG AA | **Fixed.** Darkened at unchanged hue/saturation → 4.94:1 / 4.93:1 |
| 10 | P2 | Brief said "message below 768px"; you had asked for full mobile editing | **Resolved as (a):** no message, phones keep full editing |

### Retractions — my audit was wrong twice

| # | I claimed | Reality |
| --- | --- | --- |
| 8 | No rubber-band multi-select | `@xyflow/react` line 1491 enables the selection box whenever `selectionKeyCode` is held. **Shift+drag already worked.** `selectionOnDrag` is also inert while `panOnDrag === true`, so the "fix" would have been a no-op |
| 15 | `beginRun` leaves unreachable nodes with stale statuses | `beginRun` **replaces the whole record** and `useNodeStatus` is `?? "idle"`. Unreachable nodes already render idle |

Both from the same cause: reasoning from the call site without reading the implementation.
No code was changed for either.

---

## 4. Still imperfect

Being explicit, since you cannot see the screen:

**Unverified visually — everything.**
No browser means no confirmation of any layout, animation, or responsive behaviour. Highest
risk: the **106 spacing changes** (each ±2px, applied mechanically, unverifiable here) and
the grid shell at the four required widths.

**Known limitations, deliberate:**
- **Autosave toast is throttled to one per 15s.** It fires ~600ms after every edit pause;
  unthrottled it would be constant noise. Failed saves raise immediately. Change it if you
  disagree.
- **A disabled Run button shows no tooltip** (Radix doesn't fire pointer events on disabled
  triggers). The explanatory text is in the tooltip, so an empty canvas gives no hint.
- **Mobile sheets are a fixed `60dvh`** with no drag-to-resize; the desktop console *is*
  resizable.
- **The compact tier has no minimap** (`minimapVisible={false}`).
- **No CI workflow** — the gate is run by hand.
- **Not deployed to Vercel** (`vercel.json` is ready).
- **5 `npm audit` high findings left alone deliberately** — `audit fix --force` downgrades
  `eslint-config-next` to 14.x, which breaks Next 16.
- **No DOM test environment**, so fixes #3, #4 and #5 have no unit test. Adding `jsdom` is a
  dependency change I did not make unasked.

---

## 5. Evidence that stands in for the screenshots

`components/layout/__tests__/layout-contract.test.ts` — 8 tests that read the **real shipped
source** and assert the structural invariants overlap-freedom depends on. Verified to catch
regressions: re-introducing a raw `z-50` and moving the MiniMap back to `bottom-right`
produces **2 failures**; restored, **8 pass**.

Canvas corner occupancy (the actual overlap risk):

| Corner | Occupant |
| --- | --- |
| top-left | — |
| top-right | MiniMap (wide tier only; hidden on an empty canvas) |
| bottom-left | Zoom controls, with the connection toast stacked **above** them |
| bottom-right | React Flow attribution (kept, per their terms) |

Grid geometry at the widths you asked about, from `shell-tracks.test.ts` (13 tests,
negative-controlled — a wrong track width gives 6 failures):

| Viewport | Palette | Inspector | Canvas |
| --- | --- | --- | --- |
| 1024 | 256 | 320 | **448** |
| 1280 | 256 | 320 | **704** |
| 1440 | 256 | 320 | **864** |
| 1920 | 256 | 320 | **1344** |

Served HTML confirms the shell renders as
`grid-template-columns:16rem minmax(0, 1fr) 20rem; grid-template-rows:auto minmax(0, 1fr) auto`.

---

## 6. Manual test steps

Run `npm install && npm run dev`, then open `http://localhost:3000/builder`.

**Canvas and layout**
1. Load a template from the toolbar. At 1440px and 1024px, confirm no panel covers the
   canvas and the minimap does not touch the "React Flow" attribution in the bottom-right.
2. Collapse the palette and the inspector. The canvas should resize smoothly, not jump.
3. Drag the console's top edge. It should resize between 140 and 560px.

**Editing**
4. Drag a node from the palette onto the canvas. Pull from its right handle to another
   node's left handle.
5. Select a node — the inspector should open on its own.
6. Type 5 characters into a config field, then press Cmd/Ctrl+Z **once**. The whole word
   should revert, not one character.
7. Hold Shift and drag on empty canvas — a rubber-band selection box should appear.
8. Break the flow (delete the trigger). A red badge appears on the offending node; fix it
   and the badge must **disappear** and stop pulsing. This was the P0.

**Running**
9. Press Run. Watch statuses, particles, and the console. Toggle a node's
   "Simulate failure" and re-run — that branch should error while a parallel branch succeeds.
10. Switch to another workflow and back. No node should show a status from the previous run.

**Persistence**
11. Copy a share link, open it in a private window, then reload. The second load should show
    your own saved work, not the shared one again — and the URL should have no `#flow=`.
12. Toggle to the light theme and reload. No console hydration warning, and the icon should
    be correct on first paint.
13. Toggle light/dark and check the green "success" and amber "warning" text is readable.

**Mobile**
14. At 390px wide, confirm all four dock actions open sheets and that you can build a
    complete flow without a desktop.
