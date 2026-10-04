// Top options bar model (plan2 Fase E).
//
// Decision matrix: every ToolId maps to exactly one TopBarKind.
// The kind decides which live controls the bar shows, nothing decorative.
//
//   paint         -> color, size, hardness, strength, flow, spacing,
//                    jitter, smoothing, angle, roundness, blend
//   retouch       -> size, hardness, strength
//   eraser        -> size, hardness, strength, photo-safe note, clear button
//   clone         -> size, strength, aligned toggle, sample mode,
//                    source indicator, clear source button
//   select-marquee-> mode buttons (new/add/subtract/intersect),
//                    feather, expand, quick action buttons
//   select-auto   -> mode buttons, tolerance, feather
//   select-click  -> one-click action info, feather where relevant
//   crop          -> ratio pills, overlay pills, apply/cancel, straighten angle
//   crop-overlay  -> overlay pills, jumps back to crop
//   shape         -> fill, stroke, stroke width, sides, flip H/V
//   text          -> font, size, bold, italic, color, tracking, leading
//   pen           -> size, color
//   gradient      -> mode pills, fill target, reverse, dither
//   fill          -> color, tolerance, contiguous toggle, motif picker
//   measure       -> unit, clear pins
//   navigate      -> zoom readout, fit, 100 percent, rotate, reset
//   move          -> position info, center action for align-center
//   eyedropper    -> sample mode, current color
//   click         -> one-click action info plus a relevant toggle or button
//
// TOOL_HINT is a total Record<ToolId, string>: adding a ToolId without a
// hint is a compile error, so no tool can ever fall back to a wrong hint.

import type { ToolId } from "../stores/useEditorStore";
import { dispatchKindOf } from "./toolPresets";

export type TopBarKind =
  | "paint"
  | "retouch"
  | "eraser"
  | "clone"
  | "select-marquee"
  | "select-auto"
  | "select-click"
  | "crop"
  | "crop-overlay"
  | "shape"
  | "text"
  | "pen"
  | "gradient"
  | "fill"
  | "measure"
  | "navigate"
  | "move"
  | "eyedropper"
  | "click";

const PAINT_EXTRA = new Set<string>([
  "dry-flat", "dry-round", "wet-glaze", "wet-palette", "oil-fan", "oil-filbert",
  "water-bloom", "water-salt", "gouache-flat", "gouache-velvet", "acrylic-bristle",
  "air-soft", "air-texture", "pencil-2b", "pencil-6b", "charcoal-vine", "chalk-oil",
  "crayon-wax", "pastel-hard", "ink-brush", "ink-nib", "liner-fine", "marker-chisel",
  "neon-tube", "glow-soft", "glitter-fine", "glitter-chunk", "smoke-thin", "smoke-bill",
  "fur-short",
]);

const ERASER_ALL = new Set<string>([
  "eraser", "background-eraser", "magic-eraser", "eraser-hard", "eraser-soft", "eraser-block",
]);

const CLONE_ALL = new Set<string>([
  "clone", "clone-mirror", "clone-rotate", "clone-soft", "pattern-stamp",
  "pattern-dots", "texture-stamp", "pattern-fill", "healing-brush", "patch",
]);

const MARQUEE_ALL = new Set<string>([
  "select-rect", "select-ellipse", "select-rounded", "select-square", "select-circle",
  "select-stadium", "select-crosshair", "select-lasso", "select-polygon",
  "magnetic-lasso", "lasso-straight", "single-row", "single-column",
  "object-select", "quick-select",
]);

const SELECT_AUTO_ALL = new Set<string>([
  "wand", "wand-plus", "wand-minus", "wand-flood", "color-range", "select-subject",
  "sky-select", "background-select", "focus-select", "range-skin", "range-sky", "range-greens",
]);

const SELECT_CLICK_ALL = new Set<string>([
  "select-grow", "select-shrink", "select-feather", "select-border", "select-last",
  "select-inverse-click", "select-feather-2", "select-feather-4", "select-feather-12",
  "select-grow-2", "select-grow-8", "select-border-4", "select-border-12",
]);

const CROP_OVERLAY_ALL = new Set<string>([
  "crop-thirds", "crop-diagonal", "crop-triangle-guide", "crop-golden-spiral", "crop-center-dot",
]);

const MEASURE_ALL = new Set<string>([
  "ruler", "measure-angle", "measure-area", "protractor", "ruler-triple", "measure-dpi",
  "color-sampler", "sampler-avg", "sampler-3x3", "sampler-11x11", "note", "note-color",
  "count", "count-auto", "guide-mid", "guide-thirds", "guide-clear-one", "guide-clear",
  "grid-toggle", "grid-pixel", "snap-toggle",
]);

const NAVIGATE_ALL = new Set<string>([
  "hand", "pan", "rotate-view", "rotate-reset", "rotate-15", "zoom", "zoom-fit",
  "zoom-100", "zoom-200", "zoom-400", "zoom-50", "zoom-800", "zoom-marquee",
]);

const MOVE_ALL = new Set<string>([
  "move", "move-auto", "transform-free", "align-center", "path-select", "direct-select", "artboard", "select-cursor",
]);

const FILL_ALL = new Set<string>([
  "fill", "fill-solid", "fill-clear", "fill-foreground", "fill-background",
  "fill-pattern-new", "fill-content-click", "fill-history-click",
  "fill-transparent-protect", "bucket-contiguous", "bucket-global",
]);

const GRADIENT_ALL = new Set<string>([
  "gradient", "gradient-radial", "gradient-diamond", "gradient-conic",
  "gradient-diamond-soft", "gradient-reflected", "gradient-noise", "gradient-fg-transparent",
]);

const PEN_ALL = new Set<string>([
  "pen", "curvature-pen", "line", "pen-free", "line-arrow",
  "pen-thin", "pen-medium", "pen-bold", "pen-dashed", "pen-arrow-both", "pen-glow",
  "pen-anchor", "pen-delete-anchor", "pen-convert",
]);

// ToolIds referenced by pen/shape/text dispatch sets that do not exist in
// the ToolId union yet (planned Fase C names). Kept as strings so the kind
// map stays total if the union grows. They never match today.
const PEN_PLANNED = new Set<string>(["pen-stroke-thin", "pen-stroke-medium", "pen-stroke-bold"]);

const TEXT_ALL = new Set<string>([
  "text", "text-vertical", "text-outline", "text-glow", "text-shadow", "text-arc",
  "text-3d", "text-neon", "text-gradient", "text-typewriter", "text-blocky",
  "text-condensed", "text-expanded", "text-emboss", "text-engrave", "text-chrome",
  "text-fire", "text-ice", "text-retro",
]);

// Plan4 Fase 20: "frame" drag-creates (dispatch shape) so it gets the live
// shape bar (fill/stroke/width), not the generic click bar.
const CLICK_ALL = new Set<string>([
  "ai-bg-remove", "ai-subject", "ai-upscale", "ai-denoise", "ai-colorize", "ai-sky",
  "slice", "slice-select", "pattern-fill",
]);

export function topBarKindOf(tool: ToolId): TopBarKind {
  const t = tool as string;
  if (PAINT_EXTRA.has(t) || dispatchKindOf(tool) === "paint") {
    if (ERASER_ALL.has(t)) return "eraser";
    if (CLONE_ALL.has(t)) return "clone";
    return "paint";
  }
  if (ERASER_ALL.has(t)) return "eraser";
  if (CLONE_ALL.has(t)) return "clone";
  if (MARQUEE_ALL.has(t)) return "select-marquee";
  if (SELECT_AUTO_ALL.has(t)) return "select-auto";
  if (SELECT_CLICK_ALL.has(t)) return "select-click";
  if (CROP_OVERLAY_ALL.has(t)) return "crop-overlay";
  if (MEASURE_ALL.has(t)) return "measure";
  if (NAVIGATE_ALL.has(t)) return "navigate";
  if (MOVE_ALL.has(t)) return "move";
  if (FILL_ALL.has(t)) return "fill";
  if (GRADIENT_ALL.has(t)) return "gradient";
  if (PEN_ALL.has(t) || PEN_PLANNED.has(t)) return "pen";
  if (TEXT_ALL.has(t)) return "text";
  if (CLICK_ALL.has(t)) return "click";
  const d = dispatchKindOf(tool);
  switch (d) {
    case "paint": return "paint";
    case "retouch": return "retouch";
    case "distort": return "retouch";
    case "clone": return "clone";
    case "crop": return "crop";
    case "selection": return "select-marquee";
    case "shape": return "shape";
    case "text": return "text";
    case "sticker": return "click";
    case "pen": return "pen";
    case "gradient": return "gradient";
    case "fill": return "fill";
    case "measure": return "measure";
    case "zoom": return "navigate";
    case "move": return "move";
    case "eyedropper": return "eyedropper";
    default: return "click";
  }
}

// Pills and pickers shown in the bar. Values map to real store actions.
export const CROP_RATIO_PILLS: { id: ToolId; label: string }[] = [
  { id: "crop", label: "Free" },
  { id: "crop-11", label: "1:1" },
  { id: "crop-32", label: "3:2" },
  { id: "crop-43", label: "4:3" },
  { id: "crop-45", label: "4:5" },
  { id: "crop-55", label: "5:4" },
  { id: "crop-47", label: "4:6" },
  { id: "crop-58", label: "5:7" },
  { id: "crop-169", label: "16:9" },
  { id: "crop-219", label: "21:9" },
  { id: "crop-916", label: "9:16" },
  { id: "crop-golden", label: "Gold" },
  { id: "crop-a4", label: "A4" },
  { id: "crop-letter", label: "Letter" },
];

export const CROP_OVERLAY_PILLS = [
  { id: "crop-thirds", label: "Thirds" },
  { id: "crop-diagonal", label: "Diagonal" },
  { id: "crop-triangle-guide", label: "Triangle" },
  { id: "crop-golden-spiral", label: "Spiral" },
  { id: "crop-center-dot", label: "Center" },
] as const;

export const GRADIENT_MODE_PILLS: { id: ToolId; label: string }[] = [
  { id: "gradient", label: "Linear" },
  { id: "gradient-radial", label: "Radial" },
  { id: "gradient-diamond", label: "Diamond" },
  { id: "gradient-conic", label: "Conic" },
  { id: "gradient-reflected", label: "Mirror" },
  { id: "gradient-noise", label: "Noise" },
];

export const PATTERN_MOTIFS = ["checker", "dots", "stripes", "grid"] as const;
export type PatternMotif = (typeof PATTERN_MOTIFS)[number];

export const BRUSH_BLENDS: { id: GlobalCompositeOperation; label: string }[] = [
  { id: "source-over", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "soft-light", label: "Soft Lt" },
  { id: "hard-light", label: "Hard Lt" },
  { id: "color-dodge", label: "Dodge" },
  { id: "color-burn", label: "Burn" },
  { id: "darken", label: "Darken" },
  { id: "lighten", label: "Lighten" },
  { id: "difference", label: "Diff" },
  { id: "exclusion", label: "Excl" },
  { id: "hue", label: "Hue" },
  { id: "saturation", label: "Sat" },
  { id: "color", label: "Color" },
  { id: "luminosity", label: "Lum" },
  { id: "lighter", label: "Add" },
];

export const TEXT_FONTS = [
  // Clean sans
  "Inter",
  "Segoe UI",
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Calibri",
  "Century Gothic",
  "Franklin Gothic Medium",
  "Bahnschrift",
  "Corbel",
  "Candara",
  // Heavy display
  "Arial Black",
  "Impact",
  "Cooper Black",
  "Rockwell",
  "Elephant",
  "Stencil",
  "Showcard Gothic",
  "Broadway",
  // Serif editorial
  "Georgia",
  "Times New Roman",
  "Palatino Linotype",
  "Garamond",
  "Book Antiqua",
  "Cambria",
  "Constantia",
  "Bodoni MT",
  "Perpetua",
  "Lucida Bright",
  // Mono and typewriter
  "Consolas",
  "Courier New",
  "Lucida Console",
  "Cascadia Mono",
  "Cascadia Code",
  // Script and hand
  "Brush Script MT",
  "Segoe Script",
  "Lucida Handwriting",
  "Comic Sans MS",
  "Monotype Corsiva",
  "Palace Script MT",
  "Edwardian Script ITC",
  "French Script MT",
  "Mistral",
  "Papyrus",
  // Fun and blackletter
  "Old English Text MT",
  "Chiller",
  "Jokerman",
  "Curlz MT",
  "Gigi",
  "Harlow Solid",
  // Generic fallbacks
  "monospace",
  "serif",
  "cursive",
  "fantasy",
] as const;

export const MEASURE_UNITS = ["px", "in", "cm"] as const;
export type MeasureUnit = (typeof MEASURE_UNITS)[number];

export const SEL_MODES = ["new", "add", "subtract", "intersect"] as const;
export type SelMode = (typeof SEL_MODES)[number];

export const SAMPLE_MODES = ["all", "current"] as const;
export type SampleMode = (typeof SAMPLE_MODES)[number];

export const TOOL_HINT: Record<ToolId, string> = {
  // Move
  "move": "Drag layer. Shift snaps, double-click empty fits zoom.",
  "artboard": "Drag to create a new artboard frame.",
  "path-select": "Auto-selects vector layer, drag to move the whole path.",
  "direct-select": "Drag left or right to rotate the active shape.",
  "move-auto": "Click an object to auto-pick its layer, then drag.",
  "transform-free": "Drag to move. Scale and rotate in Transform panel.",
  "align-center": "Click canvas to center the active layer, or press Center Now.",
  // Select marquee
  "select-rect": "Drag to select. Mode buttons add, subtract or intersect.",
  "select-ellipse": "Drag to select. Mode buttons add, subtract or intersect.",
  "single-row": "Click to select a 1px horizontal row.",
  "single-column": "Click to select a 1px vertical column.",
  "select-rounded": "Drag a rounded-rectangle selection.",
  "select-square": "Drag a square selection. Equal sides locked.",
  "select-circle": "Drag a circle selection. Perfect round locked.",
  "select-stadium": "Drag a stadium capsule selection.",
  "select-crosshair": "Drag out from the start point, mirrored both ways.",
  "select-lasso": "Drag freely, release near the start to close.",
  "select-polygon": "Click corner points, double-click to close.",
  "magnetic-lasso": "Drag around edges, snaps to contrast plus expand.",
  "lasso-straight": "Click points with 45 degree snap on Shift.",
  "object-select": "Drag around an object to auto detect it.",
  "quick-select": "Paint over the subject to auto select it.",
  // Select auto
  "wand": "Click similar colors. Tolerance and Feather apply.",
  "wand-plus": "Wand select plus auto-grow 2px.",
  "wand-minus": "Wand select plus auto-shrink 2px.",
  "wand-flood": "Full-region flood select with adaptive tolerance.",
  "color-range": "Click a color to select it everywhere in frame.",
  "select-subject": "One click auto-selects the main subject.",
  "sky-select": "Click to select the sky band, top 62 percent.",
  "background-select": "Click to select background tone from corners.",
  "focus-select": "Click to select the center focus ellipse.",
  "range-skin": "Click skin to select the full skin tone range.",
  "range-sky": "Click sky to select the full blue range.",
  "range-greens": "Click foliage to select the full green range.",
  // Select click actions
  "select-grow": "Click to grow the selection by 4px.",
  "select-shrink": "Click to shrink the selection by 4px.",
  "select-feather": "Click to feather the selection by 6px.",
  "select-border": "Click to smooth and tighten the border.",
  "select-last": "Click to restore the previous selection.",
  "select-inverse-click": "Click to invert the current selection.",
  "select-feather-2": "Click for a quick 2px feather.",
  "select-feather-4": "Click for a quick 4px feather.",
  "select-feather-12": "Click for a soft 12px feather.",
  "select-grow-2": "Click to grow the selection by 2px.",
  "select-grow-8": "Click to grow the selection by 8px.",
  "select-border-4": "Click for a 4px border smooth.",
  "select-border-12": "Click for a 12px border smooth.",
  "select-cursor": "Click any item or layer to select it for move, scale and rotate.",
  // Crop
  "crop": "Drag area. Enter applies, Esc cancels.",
  "perspective-crop": "Drag area, then drag corners for perspective fix.",
  "crop-169": "Crop locked 16:9. Enter applies.",
  "crop-43": "Crop locked 4:3. Enter applies.",
  "crop-11": "Square crop 1:1. Enter applies.",
  "crop-32": "Crop locked 3:2. Enter applies.",
  "crop-free": "Free crop with no lock. Enter applies.",
  "crop-straighten": "Drag a horizon line, the view levels on apply.",
  "crop-219": "Crop locked 21:9 ultrawide. Enter applies.",
  "crop-45": "Crop locked 4:5 portrait. Enter applies.",
  "crop-916": "Crop locked 9:16 story. Enter applies.",
  "crop-golden": "Crop locked to golden ratio 1.618. Enter applies.",
  "crop-55": "Crop locked 5:4 large format. Enter applies.",
  "crop-a4": "Crop locked A4 print ratio. Enter applies.",
  "crop-letter": "Crop locked US Letter ratio. Enter applies.",
  "crop-47": "Crop locked 4:6 passport print. Enter applies.",
  "crop-58": "Crop locked 5:7 photo print. Enter applies.",
  "slice": "Drag a rectangle to define an export slice.",
  "slice-select": "Click a slice to select it, drag to move it.",
  "frame": "Drag to create an image placeholder frame.",
  "crop-thirds": "Overlay rule-of-thirds guides on the crop.",
  "crop-diagonal": "Overlay diagonal guides on the crop.",
  "crop-triangle-guide": "Overlay triangle guides on the crop.",
  "crop-golden-spiral": "Overlay golden spiral on the crop.",
  "crop-center-dot": "Overlay center dot on the crop.",
  // Measure
  "eyedropper": "Click canvas to pick a color into the brush.",
  "color-sampler": "Click the canvas to pin a persistent color readout, max 8.",
  "sampler-avg": "Click for a 5x5 average color pin.",
  "sampler-3x3": "Click for a tight 3x3 color pin.",
  "sampler-11x11": "Click for a wide 11x11 average pin.",
  "ruler": "Drag to measure distance and angle.",
  "measure-angle": "Drag to measure angle from horizontal.",
  "measure-area": "Drag a rectangle for width, height and area.",
  "ruler-triple": "Click three points for a chained A to B to C measure.",
  "measure-dpi": "Click for megapixels plus A4 and Letter print scale.",
  "protractor": "Drag to measure angle with a protractor label.",
  "snap-toggle": "Click canvas to toggle snapping on or off.",
  "note": "Click to pin a text note.",
  "note-color": "Click to pin a color-coded note.",
  "count": "Click to add a numbered count marker.",
  "count-auto": "Click to auto-count bright blobs, max 99.",
  "guide-clear": "Click canvas to clear all guides.",
  "guide-mid": "Click to add center horizontal plus vertical guides.",
  "guide-thirds": "Click to add rule-of-thirds guides.",
  "guide-clear-one": "Click near a guide to remove just that one.",
  "grid-toggle": "Click canvas to toggle the grid on or off.",
  "grid-pixel": "Click for an 8px pixel grid. Zoom 800 percent for 1px cells.",
  // Brush core
  "brush": "Free painting. Flow and Spacing shape each stroke.",
  "pencil": "Hard edge, no anti-alias. Pixel precise.",
  "overlay-brush": "Overlay blend contrast. Lightens lights, darkens darks.",
  "color-replacement": "Replace target hue while keeping luminance.",
  "mixer-brush": "Wet oil-paint color mixing.",
  "airbrush": "Soft spray. Hold to build up tone gradually.",
  "soft-brush": "Extra soft blending brush.",
  "sketch-charcoal": "Grainy charcoal, multiply blend.",
  "sketch-pastel": "Soft pastel with scatter.",
  "sketch-marker": "Flat saturated marker.",
  "sketch-highlighter": "Translucent highlight glaze.",
  "sketch-ink": "Crisp ink line.",
  "sketch-felt": "Soft felt tip.",
  "sketch-neon": "Additive glow stroke.",
  "sketch-chalk": "Dusty chalk scatter.",
  "art-oil": "Thick oil with wet mix.",
  "art-watercolor": "Translucent wash.",
  "art-knife": "Flat knife scrape.",
  "art-smear": "Finger smear.",
  "art-glaze": "Thin glaze.",
  "art-impasto": "Heavy impasto punch.",
  "art-canvas": "Weave texture stamp.",
  "art-poster": "Graphic posterize stroke.",
  "brush-dry": "Dry bristle scatter. Textured manual strokes.",
  "brush-wet": "Wet blend mix. Paint to blend canvas color.",
  "brush-glitter": "Sparkle scatter additive glitter.",
  "brush-smoke": "Extra soft smoke wash, large and soft.",
  "brush-fur": "Fibrous multiply fur texture.",
  "brush-inkwash": "East-ink wash multiply glaze.",
  // Brush atelier II
  "dry-flat": "Flat dry brush with broken bristle edge.",
  "dry-round": "Round dry brush, soft broken center.",
  "wet-glaze": "Wet glaze wash that tints without covering.",
  "wet-palette": "Palette-knife wet blend, mixes as it paints.",
  "oil-fan": "Fan brush for soft blended oil strokes.",
  "oil-filbert": "Filbert oil brush, round tapered strokes.",
  "water-bloom": "Watercolor bloom with backrun edges.",
  "water-salt": "Salt texture watercolor with grain speckle.",
  "gouache-flat": "Flat opaque gouache coverage.",
  "gouache-velvet": "Velvet matte gouache with zero shine.",
  "acrylic-bristle": "Stiff acrylic bristle with visible streaks.",
  "air-soft": "Whisper-soft airbrush for vignettes.",
  "air-texture": "Textured airbrush with fine grain.",
  "pencil-2b": "Classic 2B graphite with mid gray.",
  "pencil-6b": "Dark 6B graphite, near-black soft core.",
  "charcoal-vine": "Thin vine charcoal for sketch lines.",
  "chalk-oil": "Oily chalk with rich waxy cover.",
  "crayon-wax": "Waxy crayon with paper tooth.",
  "pastel-hard": "Hard pastel stick, sharp and dry.",
  "ink-brush": "Loaded ink brush with wet black wash.",
  "ink-nib": "Sharp nib line with pressure taper.",
  "liner-fine": "Ultra-fine liner for details and lashes.",
  "marker-chisel": "Chisel marker with flat calligraphy edge.",
  "neon-tube": "Hot neon tube with white core glow.",
  "glow-soft": "Soft ambient glow halo.",
  "glitter-fine": "Fine cosmetic glitter sparkle.",
  "glitter-chunk": "Chunky craft glitter flakes.",
  "smoke-thin": "Thin wisp of smoke for atmosphere.",
  "smoke-bill": "Thick smoke billow for drama.",
  "fur-short": "Short dense fur stipple.",
  // Eraser
  "eraser": "Erase strokes. Photos stay safe, only paint lifts.",
  "background-eraser": "Erases only background colors near the edge sample.",
  "magic-eraser": "Click a flat area to erase it at once.",
  "eraser-hard": "100 percent hard block eraser for pixel work.",
  "eraser-soft": "Extra soft zero-hardness manual erase.",
  "eraser-block": "Pixel-block hard manual erase.",
  // Heal core
  "spot-heal": "Click or paint over blemishes to blend away.",
  "healing-brush": "Alt-click to set source, then paint for precise healing.",
  "patch": "Drag a source area onto the target to patch.",
  "content-move": "Drag an object, background fills automatically.",
  "content-fill": "Select an area, click to fill with surrounding texture.",
  "red-eye": "Click red eyes to correct.",
  "heal-dust": "Tiny dust spot heal.",
  "heal-wrinkle": "Gentle wrinkle soften.",
  "heal-blemish": "Stronger blemish blend.",
  "heal-sky": "Wide soft sky clean.",
  "heal-skin": "Edge-safe skin smooth.",
  "heal-object": "Content erase for unwanted objects.",
  "heal-freckle": "Tiny freckle dust clean.",
  "heal-eye": "Gentle under-eye soften.",
  "heal-teeth": "Edge-safe whiten smooth.",
  // Heal II
  "heal-mole": "Blend moles and dark spots into skin.",
  "heal-acne": "Calm red acne bumps without plastic skin.",
  "heal-scar-fade": "Fade scar edges over repeated passes.",
  "heal-shine": "Cut oily shine while keeping skin texture.",
  "heal-pores": "Refine visible pores with micro smooth.",
  "heal-tan-line": "Blend tan lines into surrounding tone.",
  "heal-veins": "Soften red eye veins gently.",
  "heal-chapped": "Smooth chapped lips, keep lip line.",
  "heal-stray-hair": "Remove single stray hairs precisely.",
  "heal-flyaway": "Tame flyaway halo around hair.",
  "heal-price-tag": "Erase price tags and stickers from product shots.",
  "heal-tourist": "Remove tourists and passersby from scenes.",
  "heal-wire": "Remove power lines and cables from skies.",
  "heal-trash": "Remove litter and small trash from scenes.",
  "heal-reflection": "Calm harsh reflections on glass and water.",
  "heal-glare": "Cut lens glare hot spots.",
  "heal-shadow-lift": "Lift crushed shadows with soft fill.",
  "heal-fog-cut": "Cut light fog and haze locally.",
  "heal-grain-match": "Match grain between patched areas.",
  "heal-texture-copy": "Copy clean texture over damage.",
  "heal-fabric": "Smooth fabric wrinkles, keep weave.",
  "heal-glass": "Clean glass smudges without streaks.",
  "heal-chrome": "Polish chrome without warping reflections.",
  "heal-rust-spot": "Neutralize rust spots on metal.",
  // Stamp
  "clone": "Alt-click sets source, then paint to clone.",
  "pattern-stamp": "Paint with the active motif picker pattern.",
  "history-brush": "Paint to restore from history state.",
  "art-history-brush": "Paint stylized artistic history strokes.",
  "clone-mirror": "Alt-click source, paint a mirrored copy.",
  "clone-rotate": "Alt-click source, paint a 90 degree rotated copy.",
  "clone-soft": "Alt-click source, paint a soft 60 percent clone.",
  "pattern-fill": "Click a layer to fill it with the repeating motif.",
  "texture-stamp": "Paint grain weave texture.",
  "pattern-dots": "Paint a manual dots pattern.",
  // Tone core
  "dodge": "Paint to lighten with soft buildup.",
  "burn": "Paint to darken with soft buildup.",
  "sponge": "Paint to adjust local saturation.",
  "vibrance-brush": "Smart saturation, protects skin tones.",
  "light-highlights": "Lift only bright tones.",
  "light-shadows": "Open only dark tones.",
  "light-temp": "Warm or cool local white balance.",
  "light-tint": "Green-magenta local tint.",
  "light-clarity": "Midtone local contrast.",
  "light-dehaze": "Cut haze, deepen blacks.",
  "light-saturate": "Boost local saturation.",
  "light-levels": "Stretch local levels.",
  "dodge-high": "Lighten bright tones only.",
  "burn-shadow": "Darken deep tones only.",
  "sponge-sat": "Boost local saturation manually.",
  "sponge-desat": "Mute local saturation manually.",
  // Tone II
  "dodge-mid": "Lift midtones without blowing highlights.",
  "dodge-detail": "Micro lift for fine highlight detail.",
  "burn-edge": "Darken edges for a natural vignette.",
  "burn-depth": "Deepen shadows for extra depth.",
  "sponge-warm": "Push saturation toward warm hues.",
  "sponge-cool": "Push saturation toward cool hues.",
  "vibrance-skin": "Vibrance tuned to protect skin.",
  "vibrance-foliage": "Vibrance tuned for rich foliage.",
  "temp-sunset": "Golden sunset white balance wash.",
  "temp-arctic": "Cold arctic white balance wash.",
  "tint-cinema": "Cinematic green-magenta tint grade.",
  "clarity-skin": "Negative clarity to soften skin gently.",
  "clarity-detail": "Positive clarity for crisp detail.",
  "dehaze-sky": "Dehaze tuned for deep blue skies.",
  "dehaze-portrait": "Gentle dehaze that flatters faces.",
  "grain-push": "Add contrast grain for punch.",
  "grain-pull": "Pull grain back for a clean matte.",
  "fade-blacks": "Lift blacks for a faded film matte.",
  "fade-whites": "Soften whites for a dreamy matte.",
  "split-gold": "Gold and blue split tone grade.",
  // Detail core
  "blur": "Paint to soften with radius blur.",
  "blur-iris": "Strong falloff blur for depth of field.",
  "sharpen": "Paint to sharpen local detail.",
  "sharpen-edge": "Sharpens edges only, protects flat areas.",
  "smudge": "Click to pick color first, then drag.",
  "noise-reduction": "Paint to smooth noise while keeping edges.",
  "liquify": "Drag to push pixels like liquid.",
  "warp": "Drag the grid to bend the area.",
  "distort-twirl": "Twirl clockwise. Paint to spin.",
  "distort-twirl-ccw": "Twirl counter-clockwise.",
  "distort-pinch": "Pull toward the dab center.",
  "distort-ripple": "Sine ripple displacement.",
  "distort-wave": "Horizontal wave shift.",
  "distort-zigzag": "Sharp zigzag offset.",
  "distort-spherize": "Spherical bulge magnify.",
  "distort-crystal": "Faceted crystal blocks.",
  "detail-grain-remove": "Smooth grain preserving edges.",
  "detail-sharpen-more": "Stronger edge sharpen.",
  "detail-blur-more": "Extra strong soften.",
  "detail-tilt": "Miniature tilt blur falloff.",
  "detail-lens": "Creamy circular lens blur.",
  "detail-motion": "Directional motion streak.",
  "blur-surface": "Smooth flat areas, keep edges.",
  "blur-field": "Creamy field falloff for backgrounds.",
  "sharpen-clarity": "Midtone clarity sharpen.",
  "denoise-strong": "Strong grain remove, edges kept.",
  // Detail gallery II
  "blur-tilt-strong": "Strong tilt-shift miniature blur.",
  "blur-zoom": "Radial zoom burst blur.",
  "blur-spin": "Radial spin blur around the dab.",
  "blur-frosted": "Frosted glass blur with glow.",
  "blur-mosaic-soft": "Soft mosaic tile blur.",
  "sharpen-halo-fix": "Sharpen while fixing halo edges.",
  "sharpen-print": "Print-tuned output sharpen.",
  "sharpen-screen": "Screen-tuned crisp sharpen.",
  "clarity-structure": "Structure clarity for architecture.",
  "denoise-luma": "Denoise brightness grain only.",
  "denoise-chroma": "Denoise color blotches only.",
  "grain-35mm": "Classic 35mm film grain.",
  "grain-120mm": "Fine medium-format grain.",
  "grain-push2": "Pushed two-stop heavy grain.",
  "lens-swirl": "Swirly bokeh lens blur.",
  "lens-bubble": "Bubble bokeh ring blur.",
  "motion-zoom": "Zoom streak motion blur.",
  "motion-spin": "Circular spin motion blur.",
  // Distort II
  "distort-bulge": "Paint to bulge pixels outward.",
  "distort-dent": "Paint to dent pixels inward.",
  "distort-squeeze": "Paint to squeeze the area tighter.",
  "distort-stretch": "Paint to stretch the area wider.",
  "distort-swirl-tight": "Paint a tight vortex swirl.",
  "distort-waves-big": "Paint big rolling wave displacement.",
  "distort-glass": "Paint glass refraction wobble.",
  "distort-heat": "Paint heat haze shimmer.",
  "distort-melt": "Paint a downward gravity melt.",
  "distort-flag": "Paint a waving flag fold.",
  "distort-ripple-big": "Paint large pond ripples.",
  "distort-arc-top": "Paint an upward arc bend.",
  "distort-arc-bottom": "Paint a downward arc bend.",
  "distort-perspective": "Paint a perspective lean, refine in Transform.",
  // Paint
  "gradient": "Drag to define a linear blend direction.",
  "gradient-radial": "Drag outward from center for radial fill.",
  "gradient-diamond": "Click for a diagonal diamond blend.",
  "gradient-conic": "Click for an angular sweep blend.",
  "gradient-diamond-soft": "Click for a soft feathered diamond blend.",
  "gradient-reflected": "Drag for a mirrored both-sides blend.",
  "gradient-noise": "Click for a dithered anti-banding blend.",
  "gradient-fg-transparent": "Preset foreground to transparent, then drag.",
  "fill": "Click an area to fill with brush color. Respects selection.",
  "fill-solid": "Click to fill the whole layer solid.",
  "fill-clear": "Click to clear the layer to transparent.",
  "fill-foreground": "Click to fill with the foreground color.",
  "fill-background": "Click to fill with the background color.",
  "fill-pattern-new": "Click to fill with the motif picker pattern.",
  "fill-content-click": "Click once for content-aware fill.",
  "fill-history-click": "Click once to fill from history state.",
  "fill-transparent-protect": "Fill that never touches transparent pixels.",
  "bucket-contiguous": "Flood fill connected pixels only.",
  "bucket-global": "Fill every similar color in the whole layer.",
  // Vector
  "pen": "Drag for a free bezier path.",
  "curvature-pen": "Drag for a smooth S-curve path.",
  "line": "Drag for a straight line. Shift locks 45 degrees.",
  "pen-free": "Drag a freehand thin ink line.",
  "line-arrow": "Drag for a line with an arrow head.",
  "pen-thin": "Thin precise pen line preset.",
  "pen-medium": "Medium pen line preset.",
  "pen-bold": "Bold pen line preset.",
  "pen-dashed": "Dashed pen line for guides and stitches.",
  "pen-arrow-both": "Line with arrow heads on both ends.",
  "pen-glow": "Pen line with a soft glow halo.",
  // Type
  "text": "Click canvas to start typing.",
  "text-vertical": "Click canvas for vertical text flow.",
  "text-outline": "Click for hollow outline text.",
  "text-glow": "Click for soft glow text.",
  "text-shadow": "Click for drop-shadow text.",
  "text-arc": "Click for arched banner text.",
  "text-3d": "Click for extruded 3D stack text.",
  "text-neon": "Click for neon tube glow text.",
  "text-gradient": "Click for diagonal gradient text.",
  "text-typewriter": "Click for monospace typewriter text.",
  "text-blocky": "Click for chunky pixel-block text.",
  "text-condensed": "Click for narrow condensed text.",
  "text-expanded": "Click for wide expanded text.",
  "text-emboss": "Click for embossed relief text.",
  "text-engrave": "Click for engraved inset text.",
  "text-chrome": "Click for metallic chrome text.",
  "text-fire": "Click for burning fire text.",
  "text-ice": "Click for frozen ice text.",
  "text-retro": "Click for double-offset retro text.",
  // Shape
  "shape-rect": "Drag for a rectangle. Shift makes a square.",
  "shape-ellipse": "Drag for an ellipse. Shift makes a circle.",
  "triangle-shape": "Drag for a three-point triangle.",
  "shape-polygon": "Drag for a multi-side polygon.",
  "shape-line": "Drag for a vector line shape.",
  "shape-star": "Drag for a 5-point star.",
  "shape-arrow": "Drag for a block arrow.",
  "shape-custom": "Drag for a decorative custom shape.",
  "shape-rounded": "Drag a rounded rectangle.",
  "shape-diamond": "Drag a four-point diamond.",
  "shape-heart": "Drag a bezier heart.",
  "shape-hexagon": "Drag a six-side hexagon.",
  "shape-burst": "Drag a 12-spike starburst seal.",
  "shape-donut": "Drag a ring with a transparent hole.",
  "shape-chevron": "Drag a bold chevron arrow.",
  "shape-moon": "Drag a crescent moon.",
  "shape-cross": "Drag a rounded cross badge.",
  "shape-plus": "Drag a medical plus sign.",
  "shape-trapezoid": "Drag a perspective trapezoid.",
  "shape-trapezoid-wide": "Drag a wide trapezoid banner.",
  "shape-parallelogram": "Drag a slanted parallelogram.",
  "shape-pentagon": "Drag a five-side pentagon.",
  "shape-octagon": "Drag an eight-side octagon.",
  "shape-shield": "Drag a shield badge.",
  "shape-badge": "Drag a round award badge.",
  "shape-ribbon": "Drag an award ribbon.",
  "shape-cloud": "Drag a fluffy cloud.",
  "shape-speech": "Drag a speech bubble.",
  "shape-gear": "Drag a gear cog.",
  "shape-drop": "Drag a water drop.",
  "shape-leaf": "Drag a leaf.",
  "shape-lightning": "Drag a lightning bolt.",
  "shape-crown": "Drag a crown.",
  "shape-pin": "Drag a map pin.",
  "shape-ticket": "Drag an event ticket.",
  // Navigate
  "hand": "Drag to pan the canvas. Scroll zooms.",
  "pan": "Drag to pan. Alternate pan for stylus.",
  "rotate-view": "Drag left or right to rotate the view.",
  "rotate-reset": "Click canvas to reset view rotation to zero.",
  "rotate-15": "Click to snap the view rotation to 15 degrees.",
  "zoom": "Click to zoom in, Alt-click to zoom out.",
  "zoom-fit": "Click canvas to fit the document on screen.",
  "zoom-100": "Click for 100 percent actual pixels.",
  "zoom-200": "Click for 200 percent detail.",
  "zoom-400": "Click for 400 percent pixel inspection.",
  "zoom-50": "Click for a 50 percent overview.",
  "zoom-800": "Click for 800 percent pixel inspection.",
  "zoom-marquee": "Drag a rectangle to zoom into that area.",
  // Local FX
  "exposure-brush": "Paint to lift local exposure.",
  "warmth-brush": "Paint to warm local color.",
  "fade-brush": "Paint for a soft matte fade.",
  "contrast-brush": "Paint for local midtone contrast.",
  "posterize-brush": "Paint for a four-level graphic tone.",
  "threshold-brush": "Paint for a black and white snap.",
  "hue-brush": "Paint to rotate hue gently.",
  "invert-brush": "Paint for a local invert blend.",
  "desat-brush": "Paint to pull saturation out.",
  "grain-brush": "Paint for fine film grain.",
  "pixelate-brush": "Paint for a local mosaic.",
  "vignette-brush": "Paint to darken dab edges.",
  "sepia-brush": "Paint a warm sepia wash.",
  "bw-brush": "Paint a clean black-white convert.",
  "film-fade": "Paint a lifted film matte.",
  "split-tone": "Paint cool shadows with warm highlights.",
  "hdr-brush": "Paint punchy HDR micro-contrast.",
  // One-click utilities (offline approximations)
  "ai-bg-remove": "One click background lift, offline edge estimate.",
  "ai-subject": "One click subject mask, offline contrast estimate.",
  "ai-upscale": "Double document size with smooth resample.",
  "ai-denoise": "One click smooth denoise pass.",
  "ai-colorize": "One click gentle colorize wash.",
  "ai-sky": "One click sky enhance in the top band.",
  // Sticker Studio
  "sticker-smile": "Click the canvas to place the smile sticker. Resize and rotate with the blue handles.",
  "sticker-laugh": "Click the canvas to place the laugh sticker. Resize and rotate with the blue handles.",
  "sticker-wink": "Click the canvas to place the wink sticker. Resize and rotate with the blue handles.",
  "sticker-cool": "Click the canvas to place the cool sticker. Resize and rotate with the blue handles.",
  "sticker-party-face": "Click the canvas to place the party face sticker. Resize and rotate with the blue handles.",
  "sticker-heart-eyes": "Click the canvas to place the heart eyes sticker. Resize and rotate with the blue handles.",
  "sticker-star-struck": "Click the canvas to place the star struck sticker. Resize and rotate with the blue handles.",
  "sticker-sleepy": "Click the canvas to place the sleepy sticker. Resize and rotate with the blue handles.",
  "sticker-clown": "Click the canvas to place the clown sticker. Resize and rotate with the blue handles.",
  "sticker-robot": "Click the canvas to place the robot sticker. Resize and rotate with the blue handles.",
  "sticker-alien": "Click the canvas to place the alien sticker. Resize and rotate with the blue handles.",
  "sticker-ghost": "Click the canvas to place the ghost sticker. Resize and rotate with the blue handles.",
  "sticker-thumbs-up": "Click the canvas to place the thumbs up sticker. Resize and rotate with the blue handles.",
  "sticker-ok-hand": "Click the canvas to place the ok hand sticker. Resize and rotate with the blue handles.",
  "sticker-peace": "Click the canvas to place the peace sticker. Resize and rotate with the blue handles.",
  "sticker-pray": "Click the canvas to place the pray sticker. Resize and rotate with the blue handles.",
  "sticker-clap": "Click the canvas to place the clap sticker. Resize and rotate with the blue handles.",
  "sticker-wave": "Click the canvas to place the wave sticker. Resize and rotate with the blue handles.",
  "sticker-rock-on": "Click the canvas to place the rock on sticker. Resize and rotate with the blue handles.",
  "sticker-love-you": "Click the canvas to place the love you sticker. Resize and rotate with the blue handles.",
  "sticker-red-heart": "Click the canvas to place the red heart sticker. Resize and rotate with the blue handles.",
  "sticker-sparkles": "Click the canvas to place the sparkles sticker. Resize and rotate with the blue handles.",
  "sticker-star": "Click the canvas to place the star sticker. Resize and rotate with the blue handles.",
  "sticker-fire": "Click the canvas to place the fire sticker. Resize and rotate with the blue handles.",
  "sticker-lightning": "Click the canvas to place the lightning sticker. Resize and rotate with the blue handles.",
  "sticker-hundred": "Click the canvas to place the hundred sticker. Resize and rotate with the blue handles.",
  "sticker-party-popper": "Click the canvas to place the party popper sticker. Resize and rotate with the blue handles.",
  "sticker-balloon": "Click the canvas to place the balloon sticker. Resize and rotate with the blue handles.",
  "sticker-crown": "Click the canvas to place the crown sticker. Resize and rotate with the blue handles.",
  "sticker-gem": "Click the canvas to place the gem sticker. Resize and rotate with the blue handles.",
  "sticker-trophy": "Click the canvas to place the trophy sticker. Resize and rotate with the blue handles.",
  "sticker-medal": "Click the canvas to place the medal sticker. Resize and rotate with the blue handles.",
  "sticker-rocket": "Click the canvas to place the rocket sticker. Resize and rotate with the blue handles.",
  "sticker-gift": "Click the canvas to place the gift sticker. Resize and rotate with the blue handles.",
  "sticker-cat": "Click the canvas to place the cat sticker. Resize and rotate with the blue handles.",
  "sticker-dog": "Click the canvas to place the dog sticker. Resize and rotate with the blue handles.",
  "sticker-fox": "Click the canvas to place the fox sticker. Resize and rotate with the blue handles.",
  "sticker-panda": "Click the canvas to place the panda sticker. Resize and rotate with the blue handles.",
  "sticker-frog": "Click the canvas to place the frog sticker. Resize and rotate with the blue handles.",
  "sticker-monkey": "Click the canvas to place the monkey sticker. Resize and rotate with the blue handles.",
  "sticker-lion": "Click the canvas to place the lion sticker. Resize and rotate with the blue handles.",
  "sticker-tiger": "Click the canvas to place the tiger sticker. Resize and rotate with the blue handles.",
  "sticker-unicorn": "Click the canvas to place the unicorn sticker. Resize and rotate with the blue handles.",
  "sticker-chick": "Click the canvas to place the chick sticker. Resize and rotate with the blue handles.",
  "sticker-penguin": "Click the canvas to place the penguin sticker. Resize and rotate with the blue handles.",
  "sticker-butterfly": "Click the canvas to place the butterfly sticker. Resize and rotate with the blue handles.",
  "sticker-ladybug": "Click the canvas to place the ladybug sticker. Resize and rotate with the blue handles.",
  "sticker-bee": "Click the canvas to place the bee sticker. Resize and rotate with the blue handles.",
  "sticker-pizza": "Click the canvas to place the pizza sticker. Resize and rotate with the blue handles.",
  "sticker-burger": "Click the canvas to place the burger sticker. Resize and rotate with the blue handles.",
  "sticker-fries": "Click the canvas to place the fries sticker. Resize and rotate with the blue handles.",
  "sticker-taco": "Click the canvas to place the taco sticker. Resize and rotate with the blue handles.",
  "sticker-sushi": "Click the canvas to place the sushi sticker. Resize and rotate with the blue handles.",
  "sticker-donut": "Click the canvas to place the donut sticker. Resize and rotate with the blue handles.",
  "sticker-cupcake": "Click the canvas to place the cupcake sticker. Resize and rotate with the blue handles.",
  "sticker-ice-cream": "Click the canvas to place the ice cream sticker. Resize and rotate with the blue handles.",
  "sticker-candy": "Click the canvas to place the candy sticker. Resize and rotate with the blue handles.",
  "sticker-lollipop": "Click the canvas to place the lollipop sticker. Resize and rotate with the blue handles.",
  "sticker-coffee": "Click the canvas to place the coffee sticker. Resize and rotate with the blue handles.",
  "sticker-bubble-tea": "Click the canvas to place the bubble tea sticker. Resize and rotate with the blue handles.",
  "sticker-strawberry": "Click the canvas to place the strawberry sticker. Resize and rotate with the blue handles.",
  "sticker-watermelon": "Click the canvas to place the watermelon sticker. Resize and rotate with the blue handles.",
  "sticker-sunflower": "Click the canvas to place the sunflower sticker. Resize and rotate with the blue handles.",
  "sticker-rose": "Click the canvas to place the rose sticker. Resize and rotate with the blue handles.",
  "sticker-cactus": "Click the canvas to place the cactus sticker. Resize and rotate with the blue handles.",
  "sticker-mushroom": "Click the canvas to place the mushroom sticker. Resize and rotate with the blue handles.",
  "sticker-sun": "Click the canvas to place the sun sticker. Resize and rotate with the blue handles.",
  "sticker-rainbow": "Click the canvas to place the rainbow sticker. Resize and rotate with the blue handles.",
  "sticker-cloud": "Click the canvas to place the cloud sticker. Resize and rotate with the blue handles.",
  "sticker-snowflake": "Click the canvas to place the snowflake sticker. Resize and rotate with the blue handles.",
  "sticker-ocean-wave": "Click the canvas to place the ocean wave sticker. Resize and rotate with the blue handles.",
  "sticker-clover": "Click the canvas to place the lucky clover sticker. Resize and rotate with the blue handles.",
};
