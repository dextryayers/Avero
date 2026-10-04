# PLAN 7 - Professional Sticker Assets: No Emoji

> Status: ALL PHASES EXECUTED. All strings English. No emdash character
> anywhere.

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
   procedural, zero downloads. Engine plus all 72 frozen specs live in
   `src/engine/stickerArt.ts`, proven by `stickerArt.test.ts`.
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

## PHASE 0 - Audit and quarantine - EXECUTED

- [x] 0.1. Touchpoints verified by grep: 72 `meta(` entries in
  `src/engine/stickers.ts`, `EMOJI_FONT` plus `drawStickerGlyph` as the
  only render path, 6 `glyph` references in `ToolBar.tsx` (grid display),
  4 `glyph` assertions in `stickers.test.ts`. Nothing else touches emoji.
- [x] 0.2. Mapping frozen as code: all 72 legacy ids mapped in
  `STICKER_V2` (`src/engine/stickerArt.ts`) across marks 14, badges 12,
  frames 12, labels 12, nature 10 and fx 12. No id added, removed or
  renamed. Test asserts the id set equals the legacy set exactly.
- [x] 0.3. Baseline green recorded before touching anything: 220 tests
  passed, typecheck exit 0, emdash scan clean.

## PHASE 1 - Vector stamp engine - EXECUTED

- [x] 1.0. Spec format locked: asset space 0 to 100 with 7 ops (dot,
  ring, rect with corner radius, poly, line, burst, destination-out
  cut). `validateStickerArt` enforces finite numbers, on canvas bounds,
  positive sizes and sane counts. Cut enables crescents and ticket
  notches without image masks.
- [x] 1.1. Painter `drawStickerVector` executed: two pass render (white
  halo plus shadow, then brush color), round joins and caps, uniform rim
  on fills and strokes. Same decal read as the legacy painter.
- [x] 1.2. Seeded random executed (`hashSeed` plus `mulberry32`): same
  seed replays the same sequence, so procedural thumbs match placed
  results. Tested deterministic and ranged.
- [x] 1.3. Marks and Arrows (14) authored one by one, each reviewed
  against its lucide fallback icon for meaning match.
- [x] 1.4. Badges and Seals (12) authored one by one, symmetric geometry
  verified (circle seals close cleanly at 360 deg).
- [x] 1.5. Frames and Shapes (12) authored one by one, stroke widths scale
  with size so thin frames never vanish at small sizes.
- [x] 1.6. Labels and Callouts (12) authored one by one, including step
  numbers 1 to 3 as drawn dot counts (no font dependency).
- [x] 1.7. Nature Pro (10) authored one by one, outline style only so they
  recolor cleanly with any brush color.
- [x] 1.8. Contract tests executed (8 tests): 72 ids equal the legacy set,
  category counts frozen, labels clean English with zero emoji, all 60
  stamp specs validate clean, all 12 FX kinds known, validator rejects
  broken specs loudly, detector catches legacy glyphs.

## PHASE 2 - FX overlay assets - EXECUTED

- [x] 2.1. Light and FX (12) painted procedurally in `paintStickerFx`
  (`src/engine/stickerArt.ts`): sunburst rays, lens flare discs, bokeh
  dot field with ring variants, film grain, vignette, diagonal light
  streak, glow orb, sparkle spray, haze band, duotone wash, edge burn,
  soft beam. Burns stay black by design like a lens; everything else
  follows the brush color through a shared hex parser with safe fallback.
- [x] 2.2. Overlays paint with transparency preserved (alpha gradients,
  speckles and rings on a cleared tile), so they grade the content below
  instead of covering it.
- [x] 2.3. Grain and scatter use the seeded random from Phase 1 keyed by
  asset kind, so grid thumbs match placed results at any size (positions
  are size fractions, verified by determinism tests).

## PHASE 3 - Catalog migration, 72 slots one by one - EXECUTED

- [x] 3.1. Rewrote `STICKER_META` from the frozen table: same 72 ids, new
  labels, new English descriptions, vector spec or FX kind per slot.
  The `glyph` field is gone from the interface. No id added, removed
  or renamed.
- [x] 3.2. Kept `STICKER_CATEGORIES`, `STICKER_BY_ID`, `STICKER_IDS`,
  `STICKER_USAGE`, `isStickerTool`, `getSticker` and
  `defaultStickerSize` API identical.
- [x] 3.3. Migrated `ToolBar.tsx`: StickerGrid renders live vector
  thumbs in the brush color (small canvas per cell, repainted on color
  change) instead of glyph text. The 72 `STICKER_ICONS` fallbacks stay
  untouched, so global icon uniqueness holds without re-audit.
- [x] 3.4. Migrated `renderStickerToLayer` to the vector and FX painters
  with the active brush color. Unknown ids still return false. The
  caller passes brush color at place time.

## PHASE 4 - Emoji removal - EXECUTED

- [x] 4.1. Deleted `EMOJI_FONT`, `drawStickerGlyph` and every `glyph`
  reference in src during migration (verified zero matches). No dead
  exports left behind.
- [x] 4.2. Updated `stickers.test.ts`: art assertions (stamps validate
  clean, FX entries carry known kinds), new 6 categories with frozen
  counts, emdash scan over label plus description.
- [x] 4.3. No-emoji lock executed: a test scans the sticker engine
  source files for emoji presentation ranges, so emoji can never return
  silently. Catalog strings are scanned per entry in the same suite.

## PHASE 5 - Verification - EXECUTED

- [x] 5.1. `npm run test` fully green (232 passed, 27 files).
- [x] 5.2. `npx tsc --noEmit` exit 0 with `noUnusedLocals` on.
- [x] 5.3. Emdash scan of src plus plan7 returns zero matches.
- [x] 5.4. Grid QA executed headlessly and fixed real geometry: every
  stamp rasterized by an independent structural implementation and
  reviewed as a contact sheet one by one. Coverage, centroid and mirror
  contracts lock all 60 (42 mirror clean, asymmetric marks like Check,
  Quote and Chevron excluded by design). The loop caught and fixed an
  off center Ruler tick row. FX painters are covered by seeded
  determinism plus code review since gradients need a real canvas.
- [x] 5.5. Old `.avx` with emoji sticker layers still opens (pixels only,
  catalog independent, no migration code touched).

## PHASE 6 - Poster expansion, 48 more assets - EXECUTED

Owner amendment: grow from 72 to 120 for poster building. Two new
categories join the catalog, all rules from Phase 0 through 5 still hold
(unique icons verified alias safe, hints for every id, same wiring).

- [x] 6.1. Poster builders (24): Big Burst, Double Seal, Split Ribbon,
  Price Circle, Wide Tag, Double Rule, Dotted Rule, Zigzag Rule, Arrow
  Divider, Corner Flourish, Photo Corners, Mini Shield, Check Seal,
  Cross Seal, Step Four through Six (continuing the dot numeral series),
  Big Quote guillemets, Double Frame, Rosette, Dot Divider, Ring Frame,
  Tall Banner, Sparkle Ring.
- [x] 6.2. Social contact minis (12): Envelope, Phone, Clock, Globe,
  Camera, Music Note, Hash, Share, Chat Dots, Play, Mic, QR Frame.
- [x] 6.3. FX waves two (12): Confetti, Starfield, Rainbow Rings, Dots
  Fade, Plus Field, Fine Grain, Light Leak, Prism, Checker Fade, Wave
  Band, Ring Burst, Spotlight. Seeded determinism kept, so thumbs match
  placed results.
- [x] 6.4. Registry wiring: 48 ToolIds in the union, 48 hints, 48
  STICKER_TOOLS entries, 48 globally unique icons (alias traps like
  PaintbrushVertical and TreePalm excluded by check script), K shortcut
  joins the existing sticker cycle, categories Poster and Social added.
- [x] 6.5. Contact sheet review one by one for all 36 stamps: every
  newcomer reads professional. The loop fixed one sparse Dot Divider
  (dots up to r3.5) and kept Photo Corners out of the mirror gate
  (diagonal float noise, symmetric by design).

## Acceptance criteria

1. Zero emoji glyphs and zero emoji font references in src.
2. All 120 slots filled with professional vector or FX assets in the 8
   categories (marks 14, badges 12, frames 12, labels 12, nature 10,
   fx 24, poster 24, social 12).
3. Every asset recolors with the brush color and places as a normal
   transformable raster layer.
4. Same ToolIds pattern, shortcuts, dispatch and hints keep working.
5. English everywhere, zero emdash in src, tests and typecheck green.
