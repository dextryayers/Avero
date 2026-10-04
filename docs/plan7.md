# PLAN 7 - Professional Sticker Assets: No Emoji

> Status: OPEN. Locked direction from owner review: hybrid vector stamps
> plus FX overlays, 6 categories replaced in full, all 72 ToolIds reused,
> colors follow the brush color. No emoji in the catalog, no emoji font in
> the render path. All strings English. No emdash character anywhere.

## Vision (one sentence)

Stickers stop being universal emoji and become professional editing assets:
recolorable vector stamps plus real FX overlays, consistent on every OS,
painted as normal raster layers that transform like everything else.

## Why emoji must go (recorded)

1. OS dependent rendering: the same sticker looks different on Windows,
   macOS and Linux through Segoe UI Emoji, Apple Color Emoji and Noto.
2. Missing glyphs: systems without a color emoji font show tofu boxes.
3. No recolor: emoji bitmaps cannot follow the brush color or the palette.
4. Style clash: chat bubbles against a pro editor aesthetic.

## Locked decisions

1. Hybrid catalog: vector stamps for markers plus procedural FX overlays
   for real editing work (light, grain, vignette). All offline, all
   procedural, zero downloads.
2. Categories replaced in full. Old: Faces, Gestures, Symbols, Animals,
   Food, Nature. New:
   - Marks & Arrows (14): arrow, cursor, crosshair, check, cross, plus,
     minus, star, burst, target, pin, flag, bolt, dot.
   - Badges & Seals (12): circle seal, ribbon, medal, crown outline,
     ticket, shield mini, award star, verified ring, stamp square,
     laurel, key badge, lock badge.
   - Frames & Shapes (12): rounded rect, circle, speech bubble, tag,
     banner, bracket corners, underline flourish, divider line, corner
     ticks, Polaroid frame, tape strip, arrow loop.
   - Light & FX (12): sunburst, lens flare, bokeh dots, film grain,
     vignette, light streak, glow orb, sparkle spray, haze band,
     duotone wash, edge burn, soft beam.
   - Labels & Callouts (12): price tag, sale burst, new badge, step
     numbers 1 to 3, quote marks, caution stripe, ruler ticks, scale
     bar, north arrow, redaction bar, approved stamp.
   - Nature Pro (10): sun disc, moon crescent, cloud outline, wave
     lines, leaf vein, geometric snowflake, mountain ridge, raindrops,
     lightning fork, wind swirls.
3. All 72 ToolIds reused unchanged (`sticker-smile` through
   `sticker-clover` keep their ids). Registry, shortcuts, dispatch,
   top bar and existing tests keep working with zero churn. Old `.avx`
   docs stay intact because placed layers store pixels only.
4. Color follows the brush color at place time, with the signature white
   halo and soft shadow kept so decals read on any background.
5. Hard rule: no emoji glyph in `STICKER_META`, no emoji font stack in
   the render path, enforced by a new no-emoji test that scans the
   catalog plus the engine source for emoji ranges.

## PHASE 0 - Audit and quarantine - OPEN

- [ ] 0.1. List every emoji touchpoint: 72 `glyph` fields in
  `src/engine/stickers.ts`, `EMOJI_FONT` plus `drawStickerGlyph`, the
  `glyph` column in `ToolBar.tsx` StickerGrid, and the glyph assertions
  in `src/engine/stickers.test.ts`.
- [ ] 0.2. Freeze the mapping table old id to new asset (72 rows, section
  Locked decisions item 2). Review it with the owner before painting.
- [ ] 0.3. Baseline green before touching anything: full suite plus
  typecheck plus emdash scan recorded.

## PHASE 1 - Vector stamp engine - OPEN

- [ ] 1.1. New spec on the meta: `vector: { paths, viewBox }` style draw
  instructions in asset space, replacing `glyph`. Resolution independent
  by construction, crisp at any sticker size.
- [ ] 1.2. Painter `drawStickerVector(g, spec, color, sizePx)`: strokes
  and fills with the brush color, then the standard white halo and soft
  shadow. Same decal read as today, professional content.
- [ ] 1.3. Marks & Arrows (14) drawn one by one, each reviewed against
  its lucide fallback icon for meaning match.
- [ ] 1.4. Badges & Seals (12) drawn one by one, symmetric geometry
  verified (circle seals close cleanly at 360 deg).
- [ ] 1.5. Frames & Shapes (12) drawn one by one, stroke widths scale
  with size so thin frames never vanish at small sizes.
- [ ] 1.6. Labels & Callouts (12) drawn one by one, including step
  numbers 1 to 3 as drawn numerals (no font dependency).
- [ ] 1.7. Nature Pro (10) drawn one by one, outline style only so they
  recolor cleanly with any brush color.

## PHASE 2 - FX overlay assets - OPEN

- [ ] 2.1. Light & FX (12) painted procedurally like `paintAsset`:
  sunburst rays, lens flare discs, bokeh dot field, film grain,
  vignette, light streak, glow orb, sparkle spray, haze band, duotone
  wash, edge burn, soft beam.
- [ ] 2.2. Overlays paint at document size with transparency preserved,
  so they grade the content below instead of covering it.
- [ ] 2.3. Grain uses a seeded random so the grid thumb matches the
  placed result.

## PHASE 3 - Catalog migration, 72 slots one by one - OPEN

- [ ] 3.1. Rewrite `STICKER_META` in category order, same 72 ids, new
  labels, new English descriptions, vector spec per slot. No id added,
  none removed, none renamed.
- [ ] 3.2. Keep `STICKER_CATEGORIES`, `STICKER_BY_ID`, `STICKER_IDS`,
  `STICKER_USAGE`, `isStickerTool`, `getSticker` and
  `defaultStickerSize` API identical. Only `glyph` leaves the interface.
- [ ] 3.3. Migrate `ToolBar.tsx`: StickerGrid renders vector thumbs
  (small canvas per cell, like `AssetThumb`) instead of glyph text.
  The 72 `STICKER_ICONS` fallbacks stay untouched, so global icon
  uniqueness holds without re-audit.
- [ ] 3.4. Migrate `renderStickerToLayer` to the vector painter with the
  active brush color. Unknown ids still return false.

## PHASE 4 - Emoji removal - OPEN

- [ ] 4.1. Delete `EMOJI_FONT`, `drawStickerGlyph` and every `glyph`
  reference in src. No dead exports left behind.
- [ ] 4.2. Update `stickers.test.ts`: glyph assertions become vector
  spec assertions (non empty paths, valid viewBox, sane bounds).
- [ ] 4.3. New no-emoji test: fails if any catalog string or any line in
  the sticker engine matches emoji presentation ranges. This is the
  lock that keeps emoji out forever.

## PHASE 5 - Verification - OPEN

- [ ] 5.1. `npm run test` fully green.
- [ ] 5.2. `npx tsc --noEmit` exit 0 with `noUnusedLocals` on.
- [ ] 5.3. Emdash scan of src plus plan7 returns zero matches.
- [ ] 5.4. Grid QA one by one: all 72 cells render a recognizable vector
  thumb, all 72 place correctly, recolor follows the brush, halo reads
  on dark and light photos, transform box moves, scales and rotates
  placed assets.
- [ ] 5.5. Old `.avx` with emoji sticker layers still opens (pixels only,
  catalog independent).

## Acceptance criteria

1. Zero emoji glyphs and zero emoji font references in src.
2. All 72 slots filled with professional vector or FX assets in the 6
   new categories.
3. Every asset recolors with the brush color and places as a normal
   transformable raster layer.
4. Same 72 ToolIds, shortcuts, dispatch and hints keep working.
5. English everywhere, zero emdash in src, tests and typecheck green.
