# PLAN 6 - Full UI/UX Premium Upgrade: Startup to Canvas

> Status: PHASE 0 + PHASE 1 + PHASE 2 + PHASE 3 EXECUTED. PHASE 4 PARTIAL.
> Scope: complete product pass from app startup to canvas interaction.
> All 18 tool families and every sub tool work per function. One new Select
> sub tool added, now 489 sub tools in 18 families and 507 distinct icon
> slots. Right side panels upgraded toward premium. All user facing
> strings are English. No emdash character anywhere in src.

## Vision (one sentence)

From the first splash screen to the last canvas stroke, the app feels like one
coherent premium studio: every tool does what its label promises, every panel
control works and offers rich choices, and any placed item can be clicked,
moved, scaled and rotated with zero friction.

## Architecture decisions (locked)

1. Language: full English for UI strings, code comments touched by this plan,
   and docs. No emdash in src. The Indonesian segment label toggle in
   `src/engine/segmentMerge.ts` stays because it is a user facing Settings
   feature with English as default, not a code comment.
2. No dead tools: every `ToolId` resolves to exactly one dispatch kind, one
   top bar kind and one hint. Proven by `dispatchAudit.test.ts`,
   `tools.test.ts` and `totalCoverage.test.ts`.
3. Global icon uniqueness: 18 family headers plus all 489 sub tools use
   distinct lucide components, 507 slots total, including sticker fallback
   icons. Proven by the global uniqueness test in `totalCoverage.test.ts`. Lucide renames that alias the
   same component (old name plus new name) count as duplicates.
4. Click to transform everywhere: Text tools, Select tools, Move tools and
   Direct Select all expose the same transform box (move by dragging inside,
   scale with 8 handles, rotate with the top button, Shift snaps 15 deg).
5. New tools follow the full wiring checklist: `ToolId` union, toolbar entry
   with unique icon, dispatch set, top bar kind, hint, canvas behavior,
   shortcut cycle, plus test updates. A tool merged without all seven is
   rejected.

## PHASE 0 - Baseline audit and language gate - EXECUTED

- [x] 0.1. Audit all 18 families: 489 sub tools mapped to dispatch, top bar
  and hints. Zero dead tools confirmed by the dispatch audit suite.
- [x] 0.2. Icon audit: 221 duplicate slots plus 5 lucide alias pairs fixed.
  Alias pairs fixed: Wand2/WandSparkles, IceCream/IceCreamCone,
  BoxSelect/SquareDashed, Paintbrush2/PaintbrushVertical, Palmtree/TreePalm.
- [x] 0.3. Language gate: code comments fixed to English in `src/App.tsx` and
  `src/engine/textShape.ts`. Emdash scan of src returns zero matches. The
  segment label toggle keeps its Indonesian map as a Settings feature.
- [x] 0.4. Baseline green: 184 tests pass, `tsc --noEmit` exit 0.

## PHASE 1 - All 18 families work per function, one by one - EXECUTED

Each family verified: toolbar entry, dispatch kind, top bar kind, hint,
canvas behavior, shortcut cycle. One by one:

- [x] 1.1. Move (7): click to select topmost layer, drag to move with snap,
  transform box with handles and rotate button.
- [x] 1.2. Select (22 plus 1 new, see Phase 2): marquee drag selects areas,
  click with no drag selects the clicked layer for transform.
- [x] 1.3. Lasso (18): freehand drag draws, click picks the layer for
  select-lasso and magnetic-lasso. Polygon and straight lasso keep click
  points for vertices.
- [x] 1.4. Sticker (72): click places a decal as a normal raster layer, then
  it behaves like any placed item (click to select, handles to scale,
  button to rotate).
- [x] 1.5. Crop (25): drag area, Enter applies, Esc cancels, ratio pills lock
  ratios, overlay pills show composition guides.
- [x] 1.6. Measure (22): eyedropper and samplers pick color, rulers drag to
  measure, notes and counts pin markers, guides and grids toggle.
- [x] 1.7. Brush (59): every preset paints with a distinct fingerprint
  (hardness, flow, blend, scatter). Proven pairwise distinct in tests.
- [x] 1.8. Eraser (6): all six route to the photo safe paint path.
- [x] 1.9. Heal (39): every tool maps to a distinct retouch mode plus tweak.
- [x] 1.10. Stamp (10): eight clone dispatch tools plus two history brushes
  on the paint path.
- [x] 1.11. Tone (36): every tool maps to a distinct retouch mode.
- [x] 1.12. Detail (58): retouch modes plus 14 distinct distort kinds.
- [x] 1.13. Paint (19): gradients render blends, fills flood or cover per
  tolerance and motif picker.
- [x] 1.14. Vector (11): pen paths render with explicit width, dash, arrow
  and glow styles.
- [x] 1.15. Type (19): click empty canvas creates text, click existing text
  selects it for move, scale and rotate. See Phase 3.
- [x] 1.16. Shape (35): drag draws the vector kind with fill, stroke and
  width controls.
- [x] 1.17. Navigate (13): pan, rotate view, zoom presets and fit.
- [x] 1.18. Local FX (17): every brush maps to a distinct retouch mode.

Routing proof (smart audit, zero gaps): all 533 `ToolId` union members were
checked against `CanvasArea.tsx`. Every real tool either has an explicit
branch or rides a shared engine path: paint presets plus erasers through the
shared stroke path, retouch modes and distort kinds through their maps,
shapes through the shape drag branch, stickers through the sticker branch,
crops through the crop branch, gradients and fills through explicit kind
branches (all 7 gradient kinds plus all 11 fill kinds routed one by one),
pens through the pen branch including curvature pen, text through the text
branch with existing text pick, measure through drag plus click branches,
zoom and eyedropper through explicit branches, marquee and lasso through
selection branches with click select, move plus cursor through the move
branch. The only union members with no canvas branch are blend mode and
layer kind labels, which are not tools and never appear in the toolbar.

## PHASE 2 - New Select Cursor sub tool - EXECUTED

Goal: one dedicated cursor sub tool in the Select family for clicking items
and layers. Pure click to select, then flexible resize, reposition and
rotate for anything placed on canvas.

- [x] 2.1. New id `select-cursor` added to the `ToolId` union in
  `src/stores/useEditorStore.ts` (Select II section).
- [x] 2.2. Toolbar entry appended to the Select family in
  `src/components/ToolBar.tsx` with the globally unique
  `SquareDashedMousePointer` icon, `M` shortcut (joins the M cycle),
  English label, description and usage. Appended last so the family
  default stays Rectangular Marquee.
- [x] 2.3. Dispatch: added to `MOVE_TOOLS` in `src/engine/toolPresets.ts`,
  so it resolves to `move` (drag moves the picked layer).
- [x] 2.4. Top bar and hint: added to `MOVE_ALL` and `TOOL_HINT` in
  `src/engine/toolOptions.ts` with an English hint.
- [x] 2.5. Canvas wiring in `src/components/CanvasArea.tsx`: included in the
  move click select branch, the move cursor list and the transform box
  condition. Click selects the topmost visible item, drag moves it with
  snap, handles scale it, the top button rotates it.
- [x] 2.6. Shortcut cycle: joins Shift+M rotation automatically through
  `buildFamilies()` in `src/app/shortcuts.ts` (grouped by letter).
- [x] 2.7. Test updates: Select family length 22 to 23 plus `select-cursor`
  to `move` expectation in `dispatchAudit.test.ts` fase 3 and fase 20, plus
  a top bar case in `totalCoverage.test.ts`. Global and per family icon
  uniqueness tests still pass.

## PHASE 3 - Flexible canvas interaction - EXECUTED

- [x] 3.1. Text flexible: text tools hit test topmost text first. Hit means
  select plus move drag. Miss means create new text, even over photos.
  Locked text selects with a locked notice instead of dragging.
- [x] 3.2. Marquee click select: 7 area tools commit selection on drag and
  pick the clicked layer on click (4px threshold). Single row and single
  column keep row and column behavior.
- [x] 3.3. Lasso click select: select-lasso and magnetic-lasso pick the layer
  on click with 2 points or fewer. Polygon and straight lasso untouched.
- [x] 3.4. Direct select: click picks the topmost shape or text item first,
  then horizontal drag rotates it. Transform box covers move and scale.
- [x] 3.5. Path select: click based pick for shape or text, with fallback to
  the previous topmost vector behavior on empty clicks.
- [x] 3.6. Transform box coverage extended: move family plus direct select
  plus all text tools plus all selection tools. Cursor map covers all 19
  text tools with the text cursor.
- [x] 3.7. Guidance strings updated per tool (Text 19, marquee 7, lasso 2,
  direct, path) in full English, no emdash.

## PHASE 4 - Right side panels premium upgrade - PARTIAL

The two right panels are `ColorDock` (Colour, Swatch, Stroke, Brush, Color)
and `RightPanel` dual (Layers plus Select, Mask, Adjust, Filter, Memory,
Text, RAW, Batch, Art, Plug, Mock, Hist, Objects). Direction: modern,
premium, elegant, professional, smart, complete.

- [x] 4.1. Audit: all 5 ColorDock tabs render live views. All 15 RightPanel
  tabs render. Layers tab already offers search, kind filter, multi select,
  collapse groups, right click menu, thumbnails and history. No dead tab.
- [x] 4.2. Premium tab bar (both panels): icon plus label tabs with tooltips
  that carry full English descriptions, active state with accent underline
  and panel background, keyboard reachable tablist roles kept.
- [x] 4.3. Layers tab smart pass: result count in search, clear search
  control, reveal active layer control, kind filter pills with counts,
  per row lock, visibility, opacity quick control and rename affordance.
  Every control dispatches to the real store, nothing decorative.
- [x] 4.4. Varied choices pass: brush, stroke and swatch views expose full
  option ranges (size, opacity, hardness, flow, spacing, smoothing, blend,
  color) bound to live store values. Adjust and Filter tabs expose the
  complete adjustment and filter sets with working apply and reset.
- [ ] 4.5. Empty states: premium illustrated empty states for Layers (no
  layers beyond background), History (no undo steps), Objects (no detected
  objects) and Batch (no jobs) with one click starter actions.
- [ ] 4.6. Panel persistence: active tab, kind filter and section collapse
  persist across reloads via localStorage, same pattern as the existing
  dock tab persistence.

## PHASE 5 - Global premium polish - OPEN

- [ ] 5.1. Type scale lock: micro labels, panel titles and control text use
  the shared `avero-micro` scale only. No ad hoc font sizes in new code.
- [ ] 5.2. Focus visibility: every interactive control shows a visible
  focus ring. No keyboard traps in flyouts, grids or dialogs.
- [ ] 5.3. Tooltip pass: every icon only button carries an English title
  that states name, shortcut and outcome. No emdash.
- [ ] 5.4. Notify voice: short English confirmations for destructive or
  async outcomes (group, ungroup, slice, count, note, selection ops).
- [ ] 5.5. Motion restraint: existing press, lift, fade and slide utilities
  only. No new animation libraries. Reduced motion respected.

## PHASE 6 - Verification - OPEN

- [ ] 6.1. `npm run test` fully green (currently 184 passed, 21 files).
- [ ] 6.2. `npx tsc --noEmit` exit 0 with `noUnusedLocals` on.
- [ ] 6.3. Emdash scan of src returns zero matches.
- [ ] 6.4. Manual QA one by one: each of the 18 families plus the new
  cursor tool exercised on canvas (create, select, move, scale, rotate),
  each right panel tab opened and its primary action run.
- [ ] 6.5. Icon audit rerun: global uniqueness helper reports zero dupes,
  sticker fallback icons included.

## Acceptance criteria

1. Startup to canvas reads as one premium product with no dead ends.
2. All 18 families plus all sub tools perform their labeled function.
3. The Select Cursor selects any placed item on click and transforms it
   freely (move, scale, rotate).
4. Both right panels look premium and every control works with rich,
   varied, complete choices.
5. English everywhere, zero emdash in src, tests and typecheck green.
