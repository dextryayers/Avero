import type { ToolId } from "../stores/useEditorStore";

// Central registry: every ToolId maps to a real engine behavior.
// No dead tools. Paint presets tune hardness/flow/composite, retouch maps
// to a concrete per-dab algorithm in CanvasArea.retouchTo / distortTo.

export type PaintPreset = {
  hardness: number | null; // null = use user hardness
  alphaMul: number; // multiply user opacity
  composite: GlobalCompositeOperation;
  sizeMul: number;
  color2?: string; // secondary tint for textured presets
  scatter?: boolean;
};

export const PAINT_TOOLS = new Set<ToolId>([
  "brush",
  "pencil",
  "mixer-brush",
  "history-brush",
  "art-history-brush",
  "color-replacement",
  "airbrush",
  "soft-brush",
  "overlay-brush",
  "sketch-charcoal",
  "sketch-pastel",
  "sketch-marker",
  "sketch-highlighter",
  "sketch-ink",
  "sketch-felt",
  "sketch-neon",
  "sketch-chalk",
  "art-oil",
  "art-watercolor",
  "art-knife",
  "art-smear",
  "art-glaze",
  "art-impasto",
  "art-canvas",
  "art-poster",
  "brush-dry",
  "brush-wet",
  "brush-glitter",
  "brush-smoke",
  "brush-fur",
  "brush-inkwash",
  "dry-flat",
  "dry-round",
  "wet-glaze",
  "wet-palette",
  "oil-fan",
  "oil-filbert",
  "water-bloom",
  "water-salt",
  "gouache-flat",
  "gouache-velvet",
  "acrylic-bristle",
  "air-soft",
  "air-texture",
  "pencil-2b",
  "pencil-6b",
  "charcoal-vine",
  "chalk-oil",
  "crayon-wax",
  "pastel-hard",
  "ink-brush",
  "ink-nib",
  "liner-fine",
  "marker-chisel",
  "neon-tube",
  "glow-soft",
  "glitter-fine",
  "glitter-chunk",
  "smoke-thin",
  "smoke-bill",
  "fur-short",
]);

export function paintPreset(tool: ToolId, userHard: number): PaintPreset {
  switch (tool) {
    case "pencil":
      return { hardness: 100, alphaMul: 1, composite: "source-over", sizeMul: 1 };
    // Plan4 Fase 6: ink draws a finer crisp line than the full-pixel pencil.
    case "sketch-ink":
      return { hardness: 100, alphaMul: 1, composite: "source-over", sizeMul: 0.85 };
    case "sketch-marker":
      return { hardness: 85, alphaMul: 0.95, composite: "source-over", sizeMul: 1 };
    case "sketch-felt":
      return { hardness: 55, alphaMul: 0.85, composite: "source-over", sizeMul: 1 };
    case "brush-dry":
      return { hardness: 70, alphaMul: 0.8, composite: "source-over", sizeMul: 1, scatter: true };
    case "brush-fur":
      return { hardness: 45, alphaMul: 0.75, composite: "multiply", sizeMul: 1.1, scatter: true };
    case "brush-glitter":
      return { hardness: 60, alphaMul: 0.9, composite: "lighter", sizeMul: 1, scatter: true };
    case "brush-smoke":
      return { hardness: 0, alphaMul: 0.18, composite: "source-over", sizeMul: 1.6 };
    case "brush-inkwash":
      return { hardness: 10, alphaMul: 0.45, composite: "multiply", sizeMul: 1.2 };
    case "brush-wet":
      return { hardness: Math.max(0, userHard - 30), alphaMul: 0.5, composite: "source-over", sizeMul: 1 };
    case "dry-flat":
      return { hardness: 80, alphaMul: 0.85, composite: "source-over", sizeMul: 1.1, scatter: true };
    case "dry-round":
      return { hardness: 65, alphaMul: 0.8, composite: "source-over", sizeMul: 1, scatter: true };
    case "wet-glaze":
      return { hardness: 0, alphaMul: 0.3, composite: "source-over", sizeMul: 1.2 };
    case "wet-palette":
      return { hardness: Math.max(0, userHard - 40), alphaMul: 0.45, composite: "source-over", sizeMul: 1.1 };
    case "oil-fan":
      return { hardness: Math.max(0, userHard - 25), alphaMul: 0.75, composite: "source-over", sizeMul: 1.35, scatter: true };
    case "oil-filbert":
      return { hardness: Math.max(0, userHard - 15), alphaMul: 0.9, composite: "source-over", sizeMul: 1 };
    case "water-bloom":
      return { hardness: 0, alphaMul: 0.28, composite: "multiply", sizeMul: 1.5 };
    case "water-salt":
      return { hardness: 5, alphaMul: 0.5, composite: "source-over", sizeMul: 1, scatter: true };
    case "gouache-flat":
      return { hardness: 75, alphaMul: 0.95, composite: "source-over", sizeMul: 1.15 };
    case "gouache-velvet":
      return { hardness: 25, alphaMul: 0.8, composite: "source-over", sizeMul: 1.2 };
    case "acrylic-bristle":
      return { hardness: 60, alphaMul: 0.85, composite: "source-over", sizeMul: 1.2, scatter: true };
    case "air-soft":
      return { hardness: 0, alphaMul: 0.15, composite: "source-over", sizeMul: 1.8 };
    case "air-texture":
      return { hardness: 0, alphaMul: 0.3, composite: "source-over", sizeMul: 1.3, scatter: true };
    case "pencil-2b":
      return { hardness: 95, alphaMul: 0.9, composite: "source-over", sizeMul: 0.9 };
    case "pencil-6b":
      return { hardness: 80, alphaMul: 1, composite: "multiply", sizeMul: 1 };
    case "charcoal-vine":
      return { hardness: 20, alphaMul: 0.6, composite: "multiply", sizeMul: 1.2, scatter: true };
    case "chalk-oil":
      return { hardness: 35, alphaMul: 0.75, composite: "source-over", sizeMul: 1.1, scatter: true };
    case "crayon-wax":
      return { hardness: 70, alphaMul: 0.9, composite: "source-over", sizeMul: 1.05, scatter: true };
    case "pastel-hard":
      return { hardness: 55, alphaMul: 0.9, composite: "source-over", sizeMul: 1 };
    case "ink-brush":
      return { hardness: 30, alphaMul: 0.95, composite: "source-over", sizeMul: 1.1 };
    case "ink-nib":
      return { hardness: 100, alphaMul: 1, composite: "source-over", sizeMul: 0.8 };
    case "liner-fine":
      return { hardness: 100, alphaMul: 1, composite: "source-over", sizeMul: 0.5 };
    case "marker-chisel":
      return { hardness: 90, alphaMul: 0.95, composite: "source-over", sizeMul: 1.25 };
    case "neon-tube":
      return { hardness: 50, alphaMul: 1, composite: "lighter", sizeMul: 1 };
    case "glow-soft":
      return { hardness: 0, alphaMul: 0.6, composite: "lighter", sizeMul: 1.5 };
    case "glitter-fine":
      return { hardness: 70, alphaMul: 0.85, composite: "lighter", sizeMul: 0.8, scatter: true };
    case "glitter-chunk":
      return { hardness: 60, alphaMul: 0.95, composite: "lighter", sizeMul: 1.3, scatter: true };
    case "smoke-thin":
      return { hardness: 0, alphaMul: 0.12, composite: "source-over", sizeMul: 1.9 };
    case "smoke-bill":
      return { hardness: 0, alphaMul: 0.22, composite: "source-over", sizeMul: 2.2 };
    case "fur-short":
      return { hardness: 55, alphaMul: 0.7, composite: "multiply", sizeMul: 0.9, scatter: true };
    case "airbrush":
    case "art-glaze":
      return { hardness: 0, alphaMul: 0.22, composite: "source-over", sizeMul: 1 };
    // Plan4 Fase 6: watercolor is a broader, fainter wash; airbrush builds up.
    case "art-watercolor":
      return { hardness: 0, alphaMul: 0.18, composite: "source-over", sizeMul: 1.25 };
    case "soft-brush":
      return { hardness: 0, alphaMul: 0.7, composite: "source-over", sizeMul: 1.15 };
    case "sketch-pastel":
      return { hardness: 15, alphaMul: 0.55, composite: "source-over", sizeMul: 1.1, scatter: true };
    // Plan4 Fase 6: chalk is dustier (larger, fainter); pastel stays denser.
    case "sketch-chalk":
      return { hardness: 10, alphaMul: 0.45, composite: "source-over", sizeMul: 1.25, scatter: true };
    case "sketch-charcoal":
      return { hardness: 30, alphaMul: 0.8, composite: "multiply", sizeMul: 1 };
    case "sketch-highlighter":
      return { hardness: 0, alphaMul: 0.32, composite: "multiply", sizeMul: 1.4 };
    case "sketch-neon":
      return { hardness: 40, alphaMul: 0.9, composite: "lighter", sizeMul: 1 };
    case "overlay-brush":
      return { hardness: 0, alphaMul: 0.55, composite: "overlay", sizeMul: 1 };
    case "art-oil":
    case "art-impasto":
      return { hardness: Math.max(0, userHard - 20), alphaMul: 0.9, composite: "source-over", sizeMul: 1.1 };
    case "art-knife":
      return { hardness: 90, alphaMul: 0.9, composite: "source-over", sizeMul: 1.2 };
    case "art-smear":
      return { hardness: 10, alphaMul: 0.35, composite: "source-over", sizeMul: 1 };
    case "art-canvas":
      return { hardness: 60, alphaMul: 0.85, composite: "source-over", sizeMul: 1, color2: "#ffffff" };
    case "art-poster":
      return { hardness: 70, alphaMul: 0.85, composite: "source-over", sizeMul: 1 };
    case "mixer-brush":
      return { hardness: Math.max(0, userHard - 30), alphaMul: 0.5, composite: "source-over", sizeMul: 1 };
    default:
      return { hardness: null, alphaMul: 1, composite: "source-over", sizeMul: 1 };
  }
}

export type RetouchMode =
  | "dodge"
  | "burn"
  | "sponge"
  | "vibrance"
  | "blur"
  | "blur-iris"
  | "sharpen"
  | "sharpen-edge"
  | "heal"
  | "heal-source"
  | "red-eye"
  | "content-move"
  | "smudge"
  | "noise"
  | "content-fill"
  | "exposure"
  | "warmth"
  | "fade"
  | "contrast"
  | "posterize"
  | "threshold"
  | "hue"
  | "invert"
  | "desat"
  | "grain"
  | "pixelate"
  | "vignette"
  | "highlights"
  | "shadows"
  | "temp"
  | "tint"
  | "clarity"
  | "dehaze"
  | "saturate"
  | "levels"
  | "grain-remove"
  | "sharpen-more"
  | "blur-more"
  | "tilt"
  | "lens"
  | "motion"
  | "dust"
  | "wrinkle"
  | "blemish"
  | "sky"
  | "skin"
  | "surface"
  | "object"
  | "sepia"
  | "bw"
  | "filmfade"
  | "splittone"
  | "hdr"
  | "mole"
  | "acne"
  | "scarfade"
  | "shine"
  | "pores"
  | "tanline"
  | "veins"
  | "chapped"
  | "strayhair"
  | "flyaway"
  | "pricetag"
  | "tourist"
  | "wire"
  | "trash"
  | "reflection"
  | "glare"
  | "shadowlift"
  | "fogcut"
  | "grainmatch"
  | "texturecopy"
  | "fabric"
  | "glass"
  | "chrome"
  | "rustspot"
  | "dodgemid"
  | "dodgedetail"
  | "burnedge"
  | "burndepth"
  | "spongewarm"
  | "spongecool"
  | "vibrskin"
  | "vibrfoliage"
  | "tempsunset"
  | "temparctic"
  | "tintcinema"
  | "clarityskin"
  | "claritydetail"
  | "dehazesky"
  | "dehazeportrait"
  | "grainpush"
  | "grainpull"
  | "fadeblacks"
  | "fadewhites"
  | "splitgold"
  | "tiltstrong"
  | "blurzoom"
  | "blurspin"
  | "blurfrosted"
  | "blurmosaic"
  | "halofix"
  | "sharpenprint"
  | "sharpenscreen"
  | "claritystruct"
  | "denoiseluma"
  | "denoisechroma"
  | "grain35"
  | "grain120"
  | "grainpush2"
  | "lensswirl"
  | "lensbubble"
  | "motionzoom"
  | "motionspin";

export const RETOUCH_MAP: Partial<Record<ToolId, RetouchMode>> = {
  dodge: "dodge",
  burn: "burn",
  sponge: "sponge",
  "vibrance-brush": "vibrance",
  blur: "blur",
  "blur-iris": "blur-iris",
  sharpen: "sharpen",
  "sharpen-edge": "sharpen-edge",
  smudge: "smudge",
  liquify: "smudge",
  warp: "smudge",
  "noise-reduction": "noise",
  "spot-heal": "heal",
  "healing-brush": "heal-source",
  patch: "heal-source",
  "red-eye": "red-eye",
  "content-move": "content-move",
  "content-fill": "content-fill",
  "exposure-brush": "exposure",
  "warmth-brush": "warmth",
  "fade-brush": "fade",
  "contrast-brush": "contrast",
  "posterize-brush": "posterize",
  "threshold-brush": "threshold",
  "hue-brush": "hue",
  "invert-brush": "invert",
  "desat-brush": "desat",
  "grain-brush": "grain",
  "pixelate-brush": "pixelate",
  "vignette-brush": "vignette",
  "light-highlights": "highlights",
  "light-shadows": "shadows",
  "light-temp": "temp",
  "light-tint": "tint",
  "light-clarity": "clarity",
  "light-dehaze": "dehaze",
  "light-saturate": "saturate",
  "light-levels": "levels",
  "detail-grain-remove": "grain-remove",
  "detail-sharpen-more": "sharpen-more",
  "detail-blur-more": "blur-more",
  "detail-tilt": "tilt",
  "detail-lens": "lens",
  "detail-motion": "motion",
  "heal-dust": "dust",
  "heal-wrinkle": "wrinkle",
  "heal-blemish": "blemish",
  "heal-sky": "sky",
  "heal-skin": "skin",
  "heal-object": "object",
  "heal-freckle": "dust",
  "heal-eye": "wrinkle",
  "heal-teeth": "skin",
  "dodge-high": "highlights",
  "burn-shadow": "shadows",
  "sponge-sat": "saturate",
  "sponge-desat": "desat",
  "blur-surface": "surface",
  "blur-field": "lens",
  "sharpen-clarity": "sharpen-more",
  "denoise-strong": "grain-remove",
  "sepia-brush": "sepia",
  "bw-brush": "bw",
  "film-fade": "filmfade",
  "split-tone": "splittone",
  "hdr-brush": "hdr",
  "heal-mole": "mole",
  "heal-acne": "acne",
  "heal-scar-fade": "scarfade",
  "heal-shine": "shine",
  "heal-pores": "pores",
  "heal-tan-line": "tanline",
  "heal-veins": "veins",
  "heal-chapped": "chapped",
  "heal-stray-hair": "strayhair",
  "heal-flyaway": "flyaway",
  "heal-price-tag": "pricetag",
  "heal-tourist": "tourist",
  "heal-wire": "wire",
  "heal-trash": "trash",
  "heal-reflection": "reflection",
  "heal-glare": "glare",
  "heal-shadow-lift": "shadowlift",
  "heal-fog-cut": "fogcut",
  "heal-grain-match": "grainmatch",
  "heal-texture-copy": "texturecopy",
  "heal-fabric": "fabric",
  "heal-glass": "glass",
  "heal-chrome": "chrome",
  "heal-rust-spot": "rustspot",
  "dodge-mid": "dodgemid",
  "dodge-detail": "dodgedetail",
  "burn-edge": "burnedge",
  "burn-depth": "burndepth",
  "sponge-warm": "spongewarm",
  "sponge-cool": "spongecool",
  "vibrance-skin": "vibrskin",
  "vibrance-foliage": "vibrfoliage",
  "temp-sunset": "tempsunset",
  "temp-arctic": "temparctic",
  "tint-cinema": "tintcinema",
  "clarity-skin": "clarityskin",
  "clarity-detail": "claritydetail",
  "dehaze-sky": "dehazesky",
  "dehaze-portrait": "dehazeportrait",
  "grain-push": "grainpush",
  "grain-pull": "grainpull",
  "fade-blacks": "fadeblacks",
  "fade-whites": "fadewhites",
  "split-gold": "splitgold",
  "blur-tilt-strong": "tiltstrong",
  "blur-zoom": "blurzoom",
  "blur-spin": "blurspin",
  "blur-frosted": "blurfrosted",
  "blur-mosaic-soft": "blurmosaic",
  "sharpen-halo-fix": "halofix",
  "sharpen-print": "sharpenprint",
  "sharpen-screen": "sharpenscreen",
  "clarity-structure": "claritystruct",
  "denoise-luma": "denoiseluma",
  "denoise-chroma": "denoisechroma",
  "grain-35mm": "grain35",
  "grain-120mm": "grain120",
  "grain-push2": "grainpush2",
  "lens-swirl": "lensswirl",
  "lens-bubble": "lensbubble",
  "motion-zoom": "motionzoom",
  "motion-spin": "motionspin",
};

// Manual-variant tuning (plan3 Fase 8-10): tools that share an engine mode
// get their own fingerprint so no two named tools behave identically.
// strengthMul scales stroke strength, radiusMul scales the dab window.
// Base tools carry no entry (implicit 1.0); every alias must carry one.
export interface RetouchTweak {
  strengthMul?: number;
  radiusMul?: number;
}

export const RETOUCH_TWEAK: Partial<Record<ToolId, RetouchTweak>> = {
  // Heal manual variants: gentler than their base modes for delicate subjects.
  "heal-freckle": { strengthMul: 0.6 },
  "heal-eye": { strengthMul: 0.7 },
  "heal-teeth": { strengthMul: 0.85 },
  // Plan4 Fase 8: patch drags whole areas, so it blends wider and gentler than
  // the precise healing-brush (previously pixel-identical clones).
  "patch": { strengthMul: 0.8, radiusMul: 1.3 },
  // Tone manual variants: bolder than the light brushes they mirror.
  "dodge-high": { strengthMul: 1.25, radiusMul: 0.8 },
  "burn-shadow": { strengthMul: 1.25, radiusMul: 0.8 },
  "sponge-sat": { strengthMul: 1.2 },
  "sponge-desat": { strengthMul: 0.7 },
  // Detail manual variants: tuned to their named job.
  "denoise-strong": { strengthMul: 1.3 },
  "sharpen-clarity": { strengthMul: 0.75 },
  "blur-field": { strengthMul: 1.15, radiusMul: 1.3 },
  // Plan4 Fase 8/11: heal-sky cleans wide areas softly, heal-object erases
  // harder (previously pixel-identical to heal-dust through the shared branch).
  "heal-sky": { strengthMul: 0.85, radiusMul: 1.6 },
  "heal-object": { strengthMul: 1.15, radiusMul: 1.1 },
  // Plan4 Fase 11: liquify pushes harder and warp bends wider than a plain
  // finger smudge (previously all three were pixel-identical smudge strokes).
  "liquify": { strengthMul: 1.5, radiusMul: 1.2 },
  "warp": { strengthMul: 1.2, radiusMul: 1.4 },
};

export type DistortKind =
  | "twirl"
  | "twirl-ccw"
  | "pinch"
  | "ripple"
  | "wave"
  | "zigzag"
  | "spherize"
  | "crystal"
  | "bulge"
  | "dent"
  | "squeeze"
  | "stretch"
  | "swirltight"
  | "wavesbig"
  | "glass"
  | "heat"
  | "melt"
  | "flag"
  | "ripplebig"
  | "arctop"
  | "arcbottom"
  | "perspective";

export const DISTORT_MAP: Partial<Record<ToolId, DistortKind>> = {
  "distort-twirl": "twirl",
  "distort-twirl-ccw": "twirl-ccw",
  "distort-pinch": "pinch",
  "distort-ripple": "ripple",
  "distort-wave": "wave",
  "distort-zigzag": "zigzag",
  "distort-spherize": "spherize",
  "distort-crystal": "crystal",
  "distort-bulge": "bulge",
  "distort-dent": "dent",
  "distort-squeeze": "squeeze",
  "distort-stretch": "stretch",
  "distort-swirl-tight": "swirltight",
  "distort-waves-big": "wavesbig",
  "distort-glass": "glass",
  "distort-heat": "heat",
  "distort-melt": "melt",
  "distort-flag": "flag",
  "distort-ripple-big": "ripplebig",
  "distort-arc-top": "arctop",
  "distort-arc-bottom": "arcbottom",
  "distort-perspective": "perspective",
};

export const CROP_RATIOS: Partial<Record<ToolId, number | null>> = {
  crop: null,
  "perspective-crop": null,
  "crop-169": 16 / 9,
  "crop-43": 4 / 3,
  "crop-11": 1,
  "crop-32": 3 / 2,
  "crop-free": null,
  "crop-straighten": null,
  "crop-219": 21 / 9,
  "crop-45": 4 / 5,
  "crop-916": 9 / 16,
  "crop-golden": 1.618,
  "crop-55": 5 / 4,
  "crop-a4": 210 / 297,
  "crop-letter": 8.5 / 11,
  "crop-47": 4 / 6,
  "crop-58": 5 / 7,
};

export const IS_CROP_TOOL = new Set<ToolId>([
  "crop",
  "perspective-crop",
  "crop-169",
  "crop-43",
  "crop-11",
  "crop-32",
  "crop-free",
  "crop-straighten",
  "crop-219",
  "crop-45",
  "crop-916",
  "crop-golden",
  "crop-55",
  "crop-a4",
  "crop-letter",
  "crop-47",
  "crop-58",
]);

// Crop overlay guide modes (visual composition aids, not separate crops).
export const CROP_OVERLAYS = ["thirds", "diagonal", "triangle", "spiral", "center"] as const;
export type CropOverlayKind = (typeof CROP_OVERLAYS)[number];
export const CROP_OVERLAY_TOOLS: Partial<Record<ToolId, CropOverlayKind>> = {
  "crop-thirds": "thirds",
  "crop-diagonal": "diagonal",
  "crop-triangle-guide": "triangle",
  "crop-golden-spiral": "spiral",
  "crop-center-dot": "center",
};

export const IS_SELECTION_TOOL = new Set<ToolId>([
  "select-rect",
  "select-ellipse",
  "single-row",
  "single-column",
  "select-lasso",
  "select-polygon",
  "object-select",
  "quick-select",
  "wand",
  "color-range",
  "select-subject",
  "select-rounded",
  "magnetic-lasso",
  "wand-plus",
  "wand-minus",
  "select-grow",
  "select-shrink",
  "select-square",
  "select-feather",
  "select-border",
  "sky-select",
  "background-select",
  "focus-select",
  "select-circle",
  "select-stadium",
  "select-crosshair",
  "lasso-straight",
  "wand-flood",
  "range-skin",
  "range-sky",
  "range-greens",
]);

export const IS_SHAPE_TOOL = new Set<ToolId>([
  "shape-rect",
  "shape-ellipse",
  "triangle-shape",
  "shape-polygon",
  "shape-line",
  "shape-custom",
  "shape-star",
  "shape-arrow",
  "shape-rounded",
  "shape-diamond",
  "shape-heart",
  "shape-hexagon",
  "shape-burst",
  "shape-donut",
  "shape-chevron",
  "shape-moon",
  "shape-cross",
  "shape-plus",
  "shape-trapezoid",
  "shape-trapezoid-wide",
  "shape-parallelogram",
  "shape-pentagon",
  "shape-octagon",
  "shape-shield",
  "shape-badge",
  "shape-ribbon",
  "shape-cloud",
  "shape-speech",
  "shape-gear",
  "shape-drop",
  "shape-leaf",
  "shape-lightning",
  "shape-crown",
  "shape-pin",
  "shape-ticket",
]);

export const SHAPE_KIND_OF: Partial<Record<ToolId, string>> = {
  "shape-rect": "rect",
  "shape-ellipse": "ellipse",
  "triangle-shape": "triangle",
  "shape-polygon": "polygon",
  "shape-line": "line",
  "shape-custom": "custom",
  "shape-star": "star",
  "shape-arrow": "arrow",
  "shape-rounded": "rounded",
  "shape-diamond": "diamond",
  "shape-heart": "heart",
  "shape-hexagon": "hexagon",
  "shape-burst": "burst",
  "shape-donut": "donut",
  "shape-chevron": "chevron",
  "shape-moon": "moon",
  "shape-cross": "cross",
  "shape-plus": "plus",
  "shape-trapezoid": "trapezoid",
  "shape-trapezoid-wide": "trapezoid-wide",
  "shape-parallelogram": "parallelogram",
  "shape-pentagon": "pentagon",
  "shape-octagon": "octagon",
  "shape-shield": "shield",
  "shape-badge": "badge",
  "shape-ribbon": "ribbon",
  "shape-cloud": "cloud",
  "shape-speech": "speech",
  "shape-gear": "gear",
  "shape-drop": "drop",
  "shape-leaf": "leaf",
  "shape-lightning": "lightning",
  "shape-crown": "crown",
  "shape-pin": "pin",
  "shape-ticket": "ticket",
};

export function isPaintTool(t: ToolId): boolean {
  return PAINT_TOOLS.has(t);
}

export function retouchModeOf(t: ToolId): RetouchMode | null {
  return RETOUCH_MAP[t] ?? null;
}

export function distortOf(t: ToolId): DistortKind | null {
  return DISTORT_MAP[t] ?? null;
}

export function cropRatioOf(t: ToolId): number | null | undefined {
  return CROP_RATIOS[t];
}

// ---- Dispatch classification (mirrors CanvasArea onMouseDown branch order) ----
// Every ToolId must resolve to exactly one dispatch kind. No dead tools.

export const ERASER_TOOLS = new Set<ToolId>([
  "eraser",
  "background-eraser",
  "magic-eraser",
  "eraser-hard",
  "eraser-soft",
  "eraser-block",
]);

export const CLONE_TOOLS = new Set<ToolId>([
  "clone",
  "clone-mirror",
  "clone-rotate",
  "clone-soft",
  "pattern-stamp",
  "pattern-dots",
  "texture-stamp",
  "pattern-fill",
]);

export const MOVE_TOOLS = new Set<ToolId>([
  "move",
  "path-select",
  "direct-select",
  "move-auto",
  "transform-free",
  "align-center",
  "select-cursor",
  "pan",
  "hand",
  "rotate-view",
]);

export const MARQUEE_TOOLS = new Set<ToolId>([
  "select-rect",
  "select-ellipse",
  "single-row",
  "single-column",
  "select-square",
  "select-circle",
  "select-stadium",
  "select-crosshair",
]);

export const EYEDROPPER_TOOLS = new Set<ToolId>(["eyedropper", "color-sampler", "sampler-avg"]);

export const TEXT_TOOLS = new Set<ToolId>([
  "text",
  "text-vertical",
  "text-outline",
  "text-glow",
  "text-shadow",
  "text-arc",
  "text-3d",
  "text-neon",
  "text-gradient",
  "text-typewriter",
  "text-blocky",
  "text-condensed",
  "text-expanded",
  "text-emboss",
  "text-engrave",
  "text-chrome",
  "text-fire",
  "text-ice",
  "text-retro",
]);

export const STICKER_TOOLS = new Set<ToolId>([
  "sticker-smile",
  "sticker-laugh",
  "sticker-wink",
  "sticker-cool",
  "sticker-party-face",
  "sticker-heart-eyes",
  "sticker-star-struck",
  "sticker-sleepy",
  "sticker-clown",
  "sticker-robot",
  "sticker-alien",
  "sticker-ghost",
  "sticker-thumbs-up",
  "sticker-ok-hand",
  "sticker-peace",
  "sticker-pray",
  "sticker-clap",
  "sticker-wave",
  "sticker-rock-on",
  "sticker-love-you",
  "sticker-red-heart",
  "sticker-sparkles",
  "sticker-star",
  "sticker-fire",
  "sticker-lightning",
  "sticker-hundred",
  "sticker-party-popper",
  "sticker-balloon",
  "sticker-crown",
  "sticker-gem",
  "sticker-trophy",
  "sticker-medal",
  "sticker-rocket",
  "sticker-gift",
  "sticker-cat",
  "sticker-dog",
  "sticker-fox",
  "sticker-panda",
  "sticker-frog",
  "sticker-monkey",
  "sticker-lion",
  "sticker-tiger",
  "sticker-unicorn",
  "sticker-chick",
  "sticker-penguin",
  "sticker-butterfly",
  "sticker-ladybug",
  "sticker-bee",
  "sticker-pizza",
  "sticker-burger",
  "sticker-fries",
  "sticker-taco",
  "sticker-sushi",
  "sticker-donut",
  "sticker-cupcake",
  "sticker-ice-cream",
  "sticker-candy",
  "sticker-lollipop",
  "sticker-coffee",
  "sticker-bubble-tea",
  "sticker-strawberry",
  "sticker-watermelon",
  "sticker-sunflower",
  "sticker-rose",
  "sticker-cactus",
  "sticker-mushroom",
  "sticker-sun",
  "sticker-rainbow",
  "sticker-cloud",
  "sticker-snowflake",
  "sticker-ocean-wave",
  "sticker-clover",
]);

export const ZOOM_TOOLS = new Set<ToolId>([
  "zoom",
  "zoom-fit",
  "zoom-100",
  "zoom-200",
  "zoom-400",
  "zoom-50",
  "zoom-800",
  "zoom-marquee",
  "rotate-reset",
]);

export const MEASURE_DRAG_TOOLS = new Set<ToolId>(["ruler", "measure-angle", "measure-area", "protractor", "ruler-triple"]);

export const PEN_TOOLS = new Set<ToolId>([
  "pen",
  "pen-free",
  "line",
  "line-arrow",
  "curvature-pen",
  "pen-thin",
  "pen-medium",
  "pen-bold",
  "pen-dashed",
  "pen-arrow-both",
  "pen-glow",
]);

export interface PenStyle {
  widthMul: number;
  dashed: boolean;
  bothArrows: boolean;
  glow: boolean;
}

export const PEN_STYLES: Partial<Record<ToolId, PenStyle>> = {
  pen: { widthMul: 1, dashed: false, bothArrows: false, glow: false },
  "pen-free": { widthMul: 0.6, dashed: false, bothArrows: false, glow: false },
  line: { widthMul: 1, dashed: false, bothArrows: false, glow: false },
  "line-arrow": { widthMul: 1, dashed: false, bothArrows: false, glow: false },
  "curvature-pen": { widthMul: 1, dashed: false, bothArrows: false, glow: false },
  "pen-thin": { widthMul: 0.45, dashed: false, bothArrows: false, glow: false },
  "pen-medium": { widthMul: 1, dashed: false, bothArrows: false, glow: false },
  "pen-bold": { widthMul: 2.1, dashed: false, bothArrows: false, glow: false },
  "pen-dashed": { widthMul: 1, dashed: true, bothArrows: false, glow: false },
  "pen-arrow-both": { widthMul: 1, dashed: false, bothArrows: true, glow: false },
  "pen-glow": { widthMul: 1.1, dashed: false, bothArrows: false, glow: true },
};

export function penStyleOf(t: ToolId): PenStyle {
  return PEN_STYLES[t] ?? { widthMul: 1, dashed: false, bothArrows: false, glow: false };
}

export const GRADIENT_TOOLS = new Set<ToolId>(["gradient", "gradient-radial", "gradient-diamond", "gradient-conic", "gradient-diamond-soft", "gradient-reflected", "gradient-noise"]);

export const FILL_TOOLS = new Set<ToolId>([
  "fill",
  "fill-solid",
  "fill-clear",
  "fill-foreground",
  "fill-background",
  "fill-pattern-new",
  "fill-content-click",
  "fill-history-click",
  "fill-transparent-protect",
  "bucket-contiguous",
  "bucket-global",
]);

export type PatternMotif = "checker" | "dots" | "stripes" | "grid";

export const PATTERN_MOTIF_OF: Partial<Record<ToolId, PatternMotif>> = {
  "pattern-stamp": "checker",
  "pattern-fill": "checker",
  "texture-stamp": "checker",
  "pattern-dots": "dots",
  "fill-pattern-new": "stripes",
};

// One-click tools: select ops, utilities, navigate presets. No AI tools in workspace.
export const CLICK_TOOLS = new Set<ToolId>([
  "select-feather",
  "select-border",
  "select-grow",
  "select-shrink",
  "select-feather-2",
  "select-feather-4",
  "select-feather-12",
  "select-grow-2",
  "select-grow-8",
  "select-border-4",
  "select-border-12",
  "select-last",
  "select-inverse-click",
  "sky-select",
  "background-select",
  "focus-select",
  "select-subject",
  "guide-clear",
  "guide-mid",
  "guide-thirds",
  "guide-clear-one",
  "grid-toggle",
  "grid-pixel",
  "snap-toggle",
  "note",
  "note-color",
  "count",
  "count-auto",
  "slice",
  "slice-select",
  "measure-dpi",
  "sampler-3x3",
  "sampler-11x11",
  "rotate-15",
  "gradient-fg-transparent",
  "crop-thirds",
  "crop-diagonal",
  "crop-triangle-guide",
  "crop-golden-spiral",
  "crop-center-dot",
]);

export type DispatchKind =
  | "move"
  | "paint"
  | "clone"
  | "retouch"
  | "distort"
  | "crop"
  | "selection"
  | "shape"
  | "gradient"
  | "fill"
  | "pen"
  | "text"
  | "sticker"
  | "measure"
  | "zoom"
  | "eyedropper"
  | "click";

export function dispatchKindOf(t: ToolId): DispatchKind | null {
  if (MOVE_TOOLS.has(t)) return "move";
  if (IS_CROP_TOOL.has(t)) return "crop";
  if (GRADIENT_TOOLS.has(t)) return "gradient";
  if (FILL_TOOLS.has(t)) return "fill";
  if (MARQUEE_TOOLS.has(t)) return "selection";
  // Click branch precedes generic selection: feather/border/grow/shrink and
  // one-click selects are handled by dedicated click handlers in CanvasArea.
  if (CLICK_TOOLS.has(t)) return "click";
  if (toolIsSelectionOp(t)) return "selection";
  if (TEXT_TOOLS.has(t)) return "text";
  if (STICKER_TOOLS.has(t)) return "sticker";
  if (ZOOM_TOOLS.has(t)) return "zoom";
  if (MEASURE_DRAG_TOOLS.has(t)) return "measure";
  if (PEN_TOOLS.has(t)) return "pen";
  if (EYEDROPPER_TOOLS.has(t)) return "eyedropper";
  if (CLONE_TOOLS.has(t)) return "clone";
  if (IS_SHAPE_TOOL.has(t) || t === "frame" || t === "artboard") return "shape";
  if (isPaintTool(t) || ERASER_TOOLS.has(t)) return "paint";
  if (RETOUCH_MAP[t] !== undefined || t === "liquify" || t === "warp") return "retouch";
  if (DISTORT_MAP[t] !== undefined) return "distort";
  if (t === "smudge" || t === "dodge" || t === "burn" || t === "sponge") return "retouch";
  return null;
}

function toolIsSelectionOp(t: ToolId): boolean {
  return (
    IS_SELECTION_TOOL.has(t) ||
    t === "select-lasso" ||
    t === "select-polygon" ||
    t === "magnetic-lasso" ||
    t === "select-rounded" ||
    t === "wand" ||
    t === "wand-plus" ||
    t === "wand-minus" ||
    t === "quick-select" ||
    t === "object-select" ||
    t === "color-range"
  );
}
