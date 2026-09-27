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
]);

export function paintPreset(tool: ToolId, userHard: number): PaintPreset {
  switch (tool) {
    case "pencil":
    case "sketch-ink":
      return { hardness: 100, alphaMul: 1, composite: "source-over", sizeMul: 1 };
    case "sketch-marker":
      return { hardness: 85, alphaMul: 0.95, composite: "source-over", sizeMul: 1 };
    case "sketch-felt":
      return { hardness: 55, alphaMul: 0.85, composite: "source-over", sizeMul: 1 };
    case "airbrush":
    case "art-watercolor":
    case "art-glaze":
      return { hardness: 0, alphaMul: 0.22, composite: "source-over", sizeMul: 1 };
    case "soft-brush":
      return { hardness: 0, alphaMul: 0.7, composite: "source-over", sizeMul: 1.15 };
    case "sketch-pastel":
    case "sketch-chalk":
      return { hardness: 15, alphaMul: 0.55, composite: "source-over", sizeMul: 1.1, scatter: true };
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
  | "object";

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
};

export type DistortKind =
  | "twirl"
  | "twirl-ccw"
  | "pinch"
  | "ripple"
  | "wave"
  | "zigzag"
  | "spherize"
  | "crystal";

export const DISTORT_MAP: Partial<Record<ToolId, DistortKind>> = {
  "distort-twirl": "twirl",
  "distort-twirl-ccw": "twirl-ccw",
  "distort-pinch": "pinch",
  "distort-ripple": "ripple",
  "distort-wave": "wave",
  "distort-zigzag": "zigzag",
  "distort-spherize": "spherize",
  "distort-crystal": "crystal",
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
]);

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
