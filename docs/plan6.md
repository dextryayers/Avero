# PLAN 6 - Full UI/UX Premium Upgrade: Startup to Canvas

> Status: PHASE 0 through PHASE 8 EXECUTED with two honest deferrals:
> WGSL kernels and full row windowing stay OPEN with reasons recorded.
> All user facing strings are English. No emdash character anywhere in src.
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
6. One item per layer: deposit brush strokes open a fresh layer per stroke
   so strokes never fuse and each stays separately selectable, movable and
   resizable. Sampling and tonal tools (color replacement, mixer group,
   erasers, retouch, distort, clone, smudge) stay on the active layer by
   design because they read destination pixels. Undoing a fresh stroke
   removes its layer instead of leaving an empty shell, and redo
   recreates it.

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
- [x] 1.2. Select (23 total, including the new cursor, see Phase 2): marquee drag selects areas,
  click with no drag selects the clicked layer for transform. Crosshair
  draws a true cross (full span bars, thickness scales with size) in both
  commit and drag preview, matching its function and icon.
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
  Deposit presets open a fresh layer per stroke. Sampling presets (color
  replacement, mixer group) stay on layer. Mousemove dabs target the exact
  stroke layer through a ref, never a stale closure.
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
- [x] 3.8. Canvas chrome premium: transform handles are now ringed premium
  circles with halo shadow, rotate button enlarged with glow plus focus
  ring, edge lines carry a soft accent halo, navigator card uses an
  elevated blurred surface with a refined viewport rect and an accessible
  collapse toggle.
- [x] 3.9. Transform exactness: resize is opposite corner anchored in doc
  space so the dragged edge lands under the pointer with zero position
  shift, rotation spins in place with the content center pixel fixed so
  layers never orbit, and scales stay positive so mirrors never appear.
  Flip stays exclusive to the Flip buttons. Proven by 7 new invariant
  tests in `layerBounds.test.ts`.

## PHASE 4 - Right side panels premium upgrade - EXECUTED

The two right panels are `ColorDock` (Colour, Swatch, Stroke, Brush, Color)
and `RightPanel` dual (Layers plus Select, Mask, Adjust, Filter, Memory,
Text, RAW, Batch, Art, Plug, Mock, Hist, Objects). Direction: modern,
premium, elegant, professional, smart, complete.

- [x] 4.1. Audit: all 5 ColorDock tabs render live views. All 15 RightPanel
  tabs render. Layers tab already offers search, kind filter, multi select,
  collapse groups, right click menu, thumbnails and history. No dead tab.
- [x] 4.2. Premium tab bar (both panels): icon plus label tabs with tooltips
  that carry full English descriptions, active state with accent underline
  and panel background, keyboard reachable tablist roles kept. Every tab
  button plus new panel buttons show a visible focus ring.
- [x] 4.3. Layers tab smart pass: result count in search, clear search
  control, reveal active layer control, kind filter options with live
  counts,
  per row lock, visibility, opacity quick control and rename affordance.
  Every control dispatches to the real store, nothing decorative. Reveal
  respects reduced motion. Search text stays session only by design so a
  returning user never faces a stale filter.
- [x] 4.4. Varied choices pass: brush, stroke and swatch views expose full
  option ranges (size, opacity, hardness, flow, spacing, smoothing, blend,
  color) bound to live store values. Adjust and Filter tabs expose the
  complete adjustment and filter sets with working apply and reset. Assets
  grew from 10 to 30 offline procedurals (12 patterns, 14 gradients,
  4 textures) with search, counts and one click paint to a fresh layer.
- [x] 4.5. Empty states: shared `EmptyState` action slot in `ui/atoms.tsx`.
  Layers offers Add layer and Clear search starters. Objects offers Import
  photo. Batch queue offers Add photos. History intentionally has no
  starter because steps record automatically; it explains that instead.
- [x] 4.6. Panel persistence: active tab, kind filter and the Brush plus
  Layer properties collapses persist across reloads via localStorage, same
  pattern as the existing dock tab persistence.
- [x] 4.7. Colour premium: hue ring kept, saturation square replaced by a
  modern right facing SV triangle (pure hue apex east, white north west,
  black south west, barycentric math unit tested, centroid locked to the
  widget center with a crisp outline, letter free harmony chips, exact
  edges by unclamped outside test so no bounding box bleed). RGB fields join HSL,
  harmony chips (complement, two analogous, two triadic) paint on click,
  swatches gain 4 curated professional sets (Essentials, Skin tones, Neon,
  Pastel, 32 chips) above user swatches.

## PHASE 5 - Global premium polish - EXECUTED

- [x] 5.1. Type scale lock: all new strings reuse the shared micro scale
  and mono tabular numerals already used in both panels. No ad hoc sizes.
- [x] 5.2. Focus visibility: tab buttons, new panel buttons and empty
  state actions show an accent focus ring, extended across left, top and
  bottom chrome (workspace pills, command palette trigger, rulers chip,
  clone source clear). No keyboard traps introduced;
  flyouts, grids and dialogs keep existing tab order.
- [x] 5.3. Tooltip pass: the 4 text buttons without titles (brush console,
  layer properties, clear history, layer menu items) now carry English
  titles, plus 5 chrome buttons across TitleBar, StatusBar, WorkspaceBar
  and ToolOptionsBar. Icon only buttons across both panels already carried
  titles. No emdash.
- [x] 5.4. Notify voice: new user facing strings kept short and English
  (locked text notice, selection confirmations). Existing notify strings
  verified English with zero emdash.
- [x] 5.5. Motion restraint: no new animation libraries and no new motion
  utilities. Reveal scroll is the only motion added and it switches to
  instant scroll under reduced motion preference.

## PHASE 7 - GPU and CPU acceleration - PARTIAL (detection plus contracts done)

Honest hardware map first. The frontend runs inside a WebView, so only
browser reachable APIs count: WebGPU (D3D12 on Windows, Vulkan on Linux,
Metal on macOS) preferred, WebGL2 (ANGLE or OpenGL) as fallback, tiled CPU
when no GPU exists. CUDA is deliberately out of scope for the editor: it is
NVIDIA only, it has no browser or WebView API, and shipping it would break
the portable offline promise. CUDA may return only as an optional native
Rust lab kernel, never as a frontend dependency.

- [x] 7.1. Detection that never blocks UI: lazy cached backend probe in
  `src/io/gpuBackend.ts` (WebGPU adapter with high performance preference,
  WebGL2 renderer string plus max texture, CPU fallback), device profiles
  in `src/io/hardware.ts` (max, balanced, eco with tile and history caps
  plus rayon thread counts), status reporting in `src/io/gpuCanvas.ts`.
- [x] 7.2. Tile and DPR budgets wired to detection: backend tile 256, 512
  or 1024, DPR caps 2.0, 1.75 and 1.5, history caps 15, 8 and 4, full res
  guards that route large docs to tiled pipelines in `nativeEngine.ts`,
  `projectIo.ts` and `memoryManager.ts`. Compositing stays on drawImage so
  the WebView GPU composites while Rust handles pixel math per tile.
- [x] 7.3. Pooling that removes per frame allocation: pooled composite
  canvas, scratch canvas pool for dab temps, pattern tile cache keyed by
  size, color and kind in `CanvasArea.tsx`.
- [x] 7.4. Rust tiled pipeline with rayon: single IPC per extreme doc,
  internal tile split, 512px tiles, 16MP full invoke ceiling, tested in
  `src-tauri` and `nativeEngine.ts` guards.
- [x] 7.5. WGSL compute roadmap (staged, each stage gated on pixel parity
  tests between CPU and GPU tiles before the next op ports):
  - [x] 7.5.0. Parity harness primitives executed in
    `src/engine/tileParity.ts` plus `tileParity.test.ts` (6 tests): tile
    split and join round trip exactly, edge tiles clamp, max and mean
    channel diff score identical buffers at zero, length mismatches throw
    loudly. Pure buffers, zero GPU, canvas or DOM dependency, so the gate
    runs in plain vitest today and binds WGSL kernels tomorrow.
  - [ ] 7.5.1. Device and pipeline scaffold: reuse `gpuBackend()` discovery,
    one WGSL blur kernel on a 512px tile, readback into canvas, CPU
    fallback when the adapter is missing.
  - [ ] 7.5.2. Port order by win size: box blur, gaussian, levels, then
    adjustments. One op per release, each with a diff threshold test.
  - [ ] 7.5.3. Brush dab path stays CPU (latency beats throughput for
    single dabs); only full layer ops (fill, filter, adjust) go WGSL.
  - [ ] 7.5.4. WebGL2 shader fallback for pre WebGPU drivers, same tile
    protocol, same parity tests.
  - [ ] 7.5.5. Optional desktop only `wgpu` in Rust behind a Tauri command,
    same tile protocol. Rejected for now: binary size plus portability
    cost outweigh a second GPU stack while WebGPU covers all three OSes.
- [ ] 7.6. CUDA revisit gate: only if a native NVIDIA only lab feature is
  requested, isolated behind a Tauri command, never in the web build.

## PHASE 8 - Lightweight budgets that hold on eco devices - PARTIAL

- [x] 8.1. Budget contracts as pure tested math in
  `src/engine/renderBudget.ts` plus `renderBudget.test.ts` (7 tests):
  tile RAM (512px tile costs exactly 1 MB), document estimate, tile
  threshold at 2048 by 2048, tile grid coverage, DPR clamp with safe
  fallback, tile size policy from texture limits. No DOM, no GPU, zero
  visual risk.
- [x] 8.2. Thresholds already enforced where it matters: tiled flag above
  2048 by 2048 in export and memory planning, 512px tiles in native and
  light pipelines, history caps per device profile.
- [x] 8.3. Profile surface verified executed: the eco, balanced and max
  recommendation with reason lives in the Settings hardware section
  (`scanHardware` plus rescan), while the live budget line lives in the
  status bar (GPU label plus rayon threads plus mode, tile and history
  cap). No duplicate GPU probing was added: the status bar reuses its
  existing probe, the full recommendation stays one click away in
  Settings. Deliberately display only, zero new controls.
- [x] 8.4. Layer row paint cost fix executed: thumbnails repaint on pixel
  revisions only. `LayerThumb` now subscribes to the global revision tick,
  the same signal that refreshes canvas bounds, so thumbs never go stale
  while unrelated panel renders skip the redraw.
- [ ] 8.5. Full row windowing deferred with reason: 200 rows render fine
  as DOM and the paint cost, the real cost, is now bounded by 8.4.
  Windowing would complicate Ctrl+click range, group headers and search
  reveal for no measured jank. Revisit only with a measured slow frame.

## PHASE 6 - Verification - EXECUTED

- [x] 6.1. `npm run test` fully green (220 passed, 26 files, up from 213
  plus 26 with the transform exactness invariants).
- [x] 6.2. `npx tsc --noEmit` exit 0 with `noUnusedLocals` on.
- [x] 6.3. Emdash and endash scan of src plus plan6 returns zero matches.
- [x] 6.4. Interaction coverage executed statically instead of by hand
  waving: all 18 families plus the cursor tool map to a canvas branch
  (explicit or shared engine path, zero zero-coverage tools), all 15
  right panel tabs plus all 5 dock tabs render their views, every tab
  button carries an English guide tooltip.
- [x] 6.5. Icon audit rerun: 507 slots, tracked icon slots unique,
  sticker fallbacks included, lucide alias pairs eliminated, helper
  reports zero dupes.
- [x] 6.6. Budget audit rerun: 4K doc stays tiled, history caps hold per
  profile, no full frame allocation above threshold.

## Acceptance criteria

1. Startup to canvas reads as one premium product with no dead ends.
2. All 18 families plus all sub tools perform their labeled function.
3. The Select Cursor selects any placed item on click and transforms it
   freely (move, scale, rotate).
4. Both right panels look premium and every control works with rich,
   varied, complete choices.
5. English everywhere, zero emdash in src, tests and typecheck green.
6. Acceleration is honest and fast: GPU detected where present with CPU
   tiled fallback, no CUDA dependency in the portable build.
7. Lightweight budgets hold: 4K stays tiled, RAM stays flat, eco devices
   stay smooth.
8. Every new stroke lands on its own layer and undo removes it. Sampling
   tools stay on layer by design.
