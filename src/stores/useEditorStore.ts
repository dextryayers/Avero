import { create } from "zustand";
import { effectiveHistoryCap } from "./useSettingsStore";

export type ToolId =
  | "move"
  | "artboard"
  | "select-rect"
  | "select-ellipse"
  | "single-row"
  | "single-column"
  | "select-lasso"
  | "select-polygon"
  | "object-select"
  | "quick-select"
  | "color-range"
  | "select-subject"
  | "wand"
  | "crop"
  | "perspective-crop"
  | "slice"
  | "slice-select"
  | "frame"
  | "eyedropper"
  | "color-sampler"
  | "ruler"
  | "note"
  | "count"
  | "brush"
  | "pencil"
  | "overlay-brush"
  | "color-replacement"
  | "mixer-brush"
  | "airbrush"
  | "soft-brush"
  | "spot-heal"
  | "healing-brush"
  | "patch"
  | "content-move"
  | "content-fill"
  | "red-eye"
  | "clone"
  | "pattern-stamp"
  | "history-brush"
  | "art-history-brush"
  | "eraser"
  | "background-eraser"
  | "magic-eraser"
  | "eraser-hard"
  | "gradient"
  | "gradient-radial"
  | "fill"
  | "blur"
  | "blur-iris"
  | "sharpen"
  | "sharpen-edge"
  | "smudge"
  | "dodge"
  | "burn"
  | "sponge"
  | "vibrance-brush"
  | "liquify"
  | "warp"
  | "noise-reduction"
  | "pen"
  | "curvature-pen"
  | "line"
  | "path-select"
  | "direct-select"
  | "text"
  | "text-vertical"
  | "shape-rect"
  | "shape-ellipse"
  | "triangle-shape"
  | "shape-polygon"
  | "shape-line"
  | "shape-custom"
  | "shape-star"
  | "shape-arrow"
  | "hand"
  | "rotate-view"
  | "zoom"
  | "pan"
  | "exposure-brush"
  | "warmth-brush"
  | "fade-brush"
  | "contrast-brush"
  | "posterize-brush"
  | "threshold-brush"
  | "hue-brush"
  | "invert-brush"
  | "desat-brush"
  | "grain-brush"
  | "pixelate-brush"
  | "vignette-brush"
  // ---- Sketch Pro (paint variants, real brush engine presets) ----
  | "sketch-charcoal"
  | "sketch-pastel"
  | "sketch-marker"
  | "sketch-highlighter"
  | "sketch-ink"
  | "sketch-felt"
  | "sketch-neon"
  | "sketch-chalk"
  // ---- Artistic FX (paint variants) ----
  | "art-oil"
  | "art-watercolor"
  | "art-knife"
  | "art-smear"
  | "art-glaze"
  | "art-impasto"
  | "art-canvas"
  | "art-poster"
  // ---- Distort Pro (real pixel distort) ----
  | "distort-twirl"
  | "distort-twirl-ccw"
  | "distort-pinch"
  | "distort-ripple"
  | "distort-wave"
  | "distort-zigzag"
  | "distort-spherize"
  | "distort-crystal"
  // ---- Light & Color brushes (real local adjust) ----
  | "light-highlights"
  | "light-shadows"
  | "light-temp"
  | "light-tint"
  | "light-clarity"
  | "light-dehaze"
  | "light-saturate"
  | "light-levels"
  // ---- Detail Pro ----
  | "detail-grain-remove"
  | "detail-sharpen-more"
  | "detail-blur-more"
  | "detail-tilt"
  | "detail-lens"
  | "detail-motion"
  // ---- Selection Pro (real selection ops) ----
  | "select-rounded"
  | "magnetic-lasso"
  | "wand-plus"
  | "wand-minus"
  | "select-grow"
  | "select-shrink"
  // ---- Crop Pro (real crop presets) ----
  | "crop-169"
  | "crop-43"
  | "crop-11"
  | "crop-32"
  | "crop-free"
  | "crop-straighten"
  // ---- Vector Pro (real shape render) ----
  | "shape-rounded"
  | "shape-diamond"
  | "shape-heart"
  | "shape-hexagon"
  | "shape-burst"
  | "shape-donut"
  // ---- Type FX (real text layers) ----
  | "text-outline"
  | "text-glow"
  | "text-shadow"
  | "text-arc"
  // ---- Heal Pro (real heal variants) ----
  | "heal-dust"
  | "heal-wrinkle"
  | "heal-blemish"
  | "heal-sky"
  | "heal-skin"
  | "heal-object"
  // ---- Stamp Pro ----
  | "clone-mirror"
  | "clone-rotate"
  | "pattern-fill"
  | "texture-stamp"
  // ---- Navigate Pro (one-click zoom utilities) ----
  | "zoom-fit"
  | "zoom-100"
  | "zoom-200"
  | "zoom-400"
  // ---- Measure Pro ----
  | "measure-angle"
  | "measure-area"
  | "sampler-avg"
  | "snap-toggle"
  // ---- AI Assist (offline real approximations) ----
  | "ai-bg-remove"
  | "ai-subject"
  | "ai-upscale"
  | "ai-denoise"
  | "ai-colorize"
  | "ai-sky"
  // ---- Move Pro 2026 ----
  | "move-auto"
  | "transform-free"
  | "align-center"
  // ---- Select Pro 2026 ----
  | "select-square"
  | "select-feather"
  | "select-border"
  // ---- Lasso Manual 2026 ----
  | "sky-select"
  | "background-select"
  | "focus-select"
  // ---- Crop Pro 2026 ----
  | "crop-219"
  | "crop-45"
  | "crop-916"
  | "crop-golden"
  // ---- Measure Pro 2026 ----
  | "protractor"
  | "guide-clear"
  | "grid-toggle"
  // ---- Brush Atelier 2026 ----
  | "brush-dry"
  | "brush-wet"
  | "brush-glitter"
  | "brush-smoke"
  | "brush-fur"
  | "brush-inkwash"
  // ---- Eraser Pro 2026 ----
  | "eraser-soft"
  | "eraser-block"
  // ---- Heal Pro 2026 ----
  | "heal-freckle"
  | "heal-eye"
  | "heal-teeth"
  // ---- Stamp Pro 2026 ----
  | "clone-soft"
  | "pattern-dots"
  // ---- Tone Pro 2026 ----
  | "dodge-high"
  | "burn-shadow"
  | "sponge-sat"
  | "sponge-desat"
  // ---- Detail Pro 2026 ----
  | "blur-surface"
  | "blur-field"
  | "sharpen-clarity"
  | "denoise-strong"
  // ---- Paint Pro 2026 ----
  | "fill-solid"
  | "fill-clear"
  | "gradient-diamond"
  // ---- Vector Pro 2026 ----
  | "pen-free"
  | "line-arrow"
  // ---- Type FX 2026 ----
  | "text-3d"
  | "text-neon"
  | "text-gradient"
  // ---- Shape Pro 2026 ----
  | "shape-chevron"
  | "shape-moon"
  | "shape-cross"
  | "shape-plus"
  | "shape-trapezoid"
  // ---- Navigate Pro 2026 ----
  | "zoom-50"
  | "zoom-800"
  | "rotate-reset"
  // ---- LocalFX Atelier 2026 (manual) ----
  | "sepia-brush"
  | "bw-brush"
  | "film-fade"
  | "split-tone"
  | "hdr-brush"
  // ---- Brush Atelier II (photo-painting) ----
  | "dry-flat"
  | "dry-round"
  | "wet-glaze"
  | "wet-palette"
  | "oil-fan"
  | "oil-filbert"
  | "water-bloom"
  | "water-salt"
  | "gouache-flat"
  | "gouache-velvet"
  | "acrylic-bristle"
  | "air-soft"
  | "air-texture"
  | "pencil-2b"
  | "pencil-6b"
  | "charcoal-vine"
  | "chalk-oil"
  | "crayon-wax"
  | "pastel-hard"
  | "ink-brush"
  | "ink-nib"
  | "liner-fine"
  | "marker-chisel"
  | "neon-tube"
  | "glow-soft"
  | "glitter-fine"
  | "glitter-chunk"
  | "smoke-thin"
  | "smoke-bill"
  | "fur-short"
  // ---- Heal II (face and product retouch) ----
  | "heal-mole"
  | "heal-acne"
  | "heal-scar-fade"
  | "heal-shine"
  | "heal-pores"
  | "heal-tan-line"
  | "heal-veins"
  | "heal-chapped"
  | "heal-stray-hair"
  | "heal-flyaway"
  | "heal-price-tag"
  | "heal-tourist"
  | "heal-wire"
  | "heal-trash"
  | "heal-reflection"
  | "heal-glare"
  | "heal-shadow-lift"
  | "heal-fog-cut"
  | "heal-grain-match"
  | "heal-texture-copy"
  | "heal-fabric"
  | "heal-glass"
  | "heal-chrome"
  | "heal-rust-spot"
  // ---- Tone II (pro photo grading) ----
  | "dodge-mid"
  | "dodge-detail"
  | "burn-edge"
  | "burn-depth"
  | "sponge-warm"
  | "sponge-cool"
  | "vibrance-skin"
  | "vibrance-foliage"
  | "temp-sunset"
  | "temp-arctic"
  | "tint-cinema"
  | "clarity-skin"
  | "clarity-detail"
  | "dehaze-sky"
  | "dehaze-portrait"
  | "grain-push"
  | "grain-pull"
  | "fade-blacks"
  | "fade-whites"
  | "split-gold"
  // ---- Detail Gallery II ----
  | "blur-tilt-strong"
  | "blur-zoom"
  | "blur-spin"
  | "blur-frosted"
  | "blur-mosaic-soft"
  | "sharpen-halo-fix"
  | "sharpen-print"
  | "sharpen-screen"
  | "clarity-structure"
  | "denoise-luma"
  | "denoise-chroma"
  | "grain-35mm"
  | "grain-120mm"
  | "grain-push2"
  | "lens-swirl"
  | "lens-bubble"
  | "motion-zoom"
  | "motion-spin"
  // ---- Distort II ----
  | "distort-bulge"
  | "distort-dent"
  | "distort-squeeze"
  | "distort-stretch"
  | "distort-swirl-tight"
  | "distort-waves-big"
  | "distort-glass"
  | "distort-heat"
  | "distort-melt"
  | "distort-flag"
  | "distort-ripple-big"
  | "distort-arc-top"
  | "distort-arc-bottom"
  | "distort-perspective"
  // ---- Select II ----
  | "select-circle"
  | "select-stadium"
  | "select-crosshair"
  | "select-last"
  | "select-inverse-click"
  | "select-feather-2"
  | "select-feather-4"
  | "select-feather-12"
  | "select-grow-2"
  | "select-grow-8"
  | "select-border-4"
  | "select-border-12"
  | "select-cursor"
  | "lasso-straight"
  | "wand-flood"
  | "range-skin"
  | "range-sky"
  | "range-greens"
  // ---- Crop II (ratios plus guide overlays) ----
  | "crop-55"
  | "crop-a4"
  | "crop-letter"
  | "crop-47"
  | "crop-58"
  | "crop-thirds"
  | "crop-diagonal"
  | "crop-triangle-guide"
  | "crop-golden-spiral"
  | "crop-center-dot"
  // ---- Paint II ----
  | "gradient-conic"
  | "gradient-diamond-soft"
  | "gradient-reflected"
  | "gradient-noise"
  | "gradient-fg-transparent"
  | "fill-foreground"
  | "fill-background"
  | "fill-pattern-new"
  | "fill-content-click"
  | "fill-history-click"
  | "fill-transparent-protect"
  | "bucket-contiguous"
  | "bucket-global"
  // ---- Vector II ----
  | "pen-thin"
  | "pen-medium"
  | "pen-bold"
  | "pen-dashed"
  | "pen-arrow-both"
  | "pen-glow"
  | "shape-trapezoid-wide"
  | "shape-parallelogram"
  | "shape-pentagon"
  | "shape-octagon"
  | "shape-shield"
  | "shape-badge"
  | "shape-ribbon"
  | "shape-cloud"
  | "shape-speech"
  | "shape-gear"
  | "shape-drop"
  | "shape-leaf"
  | "shape-lightning"
  | "shape-crown"
  | "shape-pin"
  | "shape-ticket"
  // ---- Type II ----
  | "text-typewriter"
  | "text-blocky"
  | "text-condensed"
  | "text-expanded"
  | "text-emboss"
  | "text-engrave"
  | "text-chrome"
  | "text-fire"
  | "text-ice"
  | "text-retro"
  // ---- Measure II ----
  | "ruler-triple"
  | "measure-dpi"
  | "guide-mid"
  | "guide-thirds"
  | "guide-clear-one"
  | "grid-pixel"
  | "note-color"
  | "count-auto"
  | "sampler-3x3"
  | "sampler-11x11"
  | "zoom-marquee"
  | "rotate-15"
  // ---- Sticker Studio (click to place decals, transform like photos) ----
  | "sticker-smile"
  | "sticker-laugh"
  | "sticker-wink"
  | "sticker-cool"
  | "sticker-party-face"
  | "sticker-heart-eyes"
  | "sticker-star-struck"
  | "sticker-sleepy"
  | "sticker-clown"
  | "sticker-robot"
  | "sticker-alien"
  | "sticker-ghost"
  | "sticker-thumbs-up"
  | "sticker-ok-hand"
  | "sticker-peace"
  | "sticker-pray"
  | "sticker-clap"
  | "sticker-wave"
  | "sticker-rock-on"
  | "sticker-love-you"
  | "sticker-red-heart"
  | "sticker-sparkles"
  | "sticker-star"
  | "sticker-fire"
  | "sticker-lightning"
  | "sticker-hundred"
  | "sticker-party-popper"
  | "sticker-balloon"
  | "sticker-crown"
  | "sticker-gem"
  | "sticker-trophy"
  | "sticker-medal"
  | "sticker-rocket"
  | "sticker-gift"
  | "sticker-cat"
  | "sticker-dog"
  | "sticker-fox"
  | "sticker-panda"
  | "sticker-frog"
  | "sticker-monkey"
  | "sticker-lion"
  | "sticker-tiger"
  | "sticker-unicorn"
  | "sticker-chick"
  | "sticker-penguin"
  | "sticker-butterfly"
  | "sticker-ladybug"
  | "sticker-bee"
  | "sticker-pizza"
  | "sticker-burger"
  | "sticker-fries"
  | "sticker-taco"
  | "sticker-sushi"
  | "sticker-donut"
  | "sticker-cupcake"
  | "sticker-ice-cream"
  | "sticker-candy"
  | "sticker-lollipop"
  | "sticker-coffee"
  | "sticker-bubble-tea"
  | "sticker-strawberry"
  | "sticker-watermelon"
  | "sticker-sunflower"
  | "sticker-rose"
  | "sticker-cactus"
  | "sticker-mushroom"
  | "sticker-sun"
  | "sticker-rainbow"
  | "sticker-cloud"
  | "sticker-snowflake"
  | "sticker-ocean-wave"
  | "sticker-clover"
  | "sticker-burst-big"
  | "sticker-seal-double"
  | "sticker-ribbon-split"
  | "sticker-price-circle"
  | "sticker-tag-wide"
  | "sticker-rule-double"
  | "sticker-rule-dotted"
  | "sticker-rule-zigzag"
  | "sticker-arrow-divider"
  | "sticker-corner-flourish"
  | "sticker-photo-corners"
  | "sticker-shield-mini"
  | "sticker-check-seal"
  | "sticker-cross-seal"
  | "sticker-step-four"
  | "sticker-step-five"
  | "sticker-step-six"
  | "sticker-quote-big"
  | "sticker-frame-double"
  | "sticker-rosette"
  | "sticker-divider-dots"
  | "sticker-frame-rings"
  | "sticker-banner-tall"
  | "sticker-sparkle-ring"
  | "sticker-envelope"
  | "sticker-phone"
  | "sticker-clock"
  | "sticker-globe"
  | "sticker-camera"
  | "sticker-music"
  | "sticker-hash"
  | "sticker-share"
  | "sticker-chat-dots"
  | "sticker-play"
  | "sticker-mic"
  | "sticker-qr"
  | "sticker-confetti"
  | "sticker-starfield"
  | "sticker-rainbow-rings"
  | "sticker-dots-fade"
  | "sticker-plus-field"
  | "sticker-grain-fine"
  | "sticker-leak"
  | "sticker-prism"
  | "sticker-checker-fade"
  | "sticker-wave-band"
  | "sticker-ring-burst"
  | "sticker-spotlight";

export type BlendMode =
  | "normal"
  | "dissolve"
  | "darken"
  | "multiply"
  | "color-burn"
  | "linear-burn"
  | "darker-color"
  | "lighten"
  | "screen"
  | "color-dodge"
  | "linear-dodge"
  | "lighter-color"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "vivid"
  | "linear"
  | "pin"
  | "hard-mix"
  | "difference"
  | "exclusion"
  | "subtract"
  | "divide"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface LayerEffects {
  dropShadow?: { enabled: boolean; color: string; opacity: number; blur: number; dx: number; dy: number };
  outerGlow?: { enabled: boolean; color: string; opacity: number; blur: number };
  innerGlow?: { enabled: boolean; color: string; opacity: number; blur: number };
  stroke?: { enabled: boolean; color: string; width: number; opacity: number };
}

export interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  lockPixels: boolean;
  lockPosition: boolean;
  opacity: number; // 0-100
  fillOpacity: number; // 0-100, Photoshop Fill (pixel only, fx stay full)
  blendMode: BlendMode;
  kind: "raster" | "background" | "text" | "shape" | "group" | "fill";
  clipped?: boolean;
  groupId?: string | null;
  collapsed?: boolean;
  linked?: boolean;
  fx?: LayerEffects;
  fillSpec?: { style: "solid" | "gradient" | "pattern"; color: string; color2: string; motif: string };
}

export interface HistoryEntry {
  id: string;
  label: string;
  layerId: string;
  snapshot: ImageData | null;
  maskSnapshot?: ImageData | null;
  // Captured at undo time: the canvas AFTER the stroke, so redo can repaint.
  redoSnapshot?: ImageData | null;
  maskRedoSnapshot?: ImageData | null;
  // One item per layer (plan6): the stroke opened this fresh layer, so undo
  // removes the layer and redo recreates it from the stored spec.
  createdLayerId?: string;
  createdLayer?: { name: string; kind: LayerMeta["kind"]; opacity: number; blendMode: string };
  time: number;
}

interface DocumentState {
  name: string;
  width: number;
  height: number;
  filePath: string | null;
  projectPath: string | null;
  projectFolder: string | null;
  dirty: boolean;
  fileSize: number | null;
}

interface EditorState {
  tool: ToolId;
  brushSize: number;
  brushOpacity: number;
  brushHardness: number;
  brushColor: string;
  bgColor: string;
  brushFlow: number; // 1-100, paint buildup per dab
  brushSpacing: number; // 1-200 percent of size
  brushJitter: number; // 0-100 size/alpha jitter
  brushSmoothing: number; // 0-100 stroke smoothing
  brushAngle: number; // -180-180 nib angle
  brushRound: number; // 1-100 nib roundness
  brushBlend: GlobalCompositeOperation; // brush blend override
  zoom: number; // percent
  panX: number;
  panY: number;
  viewRotate: number; // degrees, non-destructive view only
  showRulers: boolean;
  theme: "dark" | "light";
  layers: LayerMeta[];
  activeLayerId: string | null;
  // Plan4 Fase 19: multi-selection for grouping (Ctrl+click toggle,
  // Shift+click range). Panel-only organization; pixels keep stack order.
  selectedLayerIds: string[];
  collapsedGroups: string[];
  history: HistoryEntry[];
  future: HistoryEntry[];
  doc: DocumentState;
  backendStatus: "checking" | "online" | "web-only";
  backendInfo: string;

  setTool: (t: ToolId) => void;
  setBrush: (
    p: Partial<{
      size: number;
      opacity: number;
      hardness: number;
      color: string;
      flow: number;
      spacing: number;
      jitter: number;
      smoothing: number;
      angle: number;
      round: number;
      blend: GlobalCompositeOperation;
    }>,
  ) => void;
  setBgColor: (c: string) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  setViewRotate: (deg: number) => void;
  toggleRulers: () => void;
  setBackend: (s: EditorState["backendStatus"], info: string) => void;
  newDocument: (name: string, w: number, h: number, projectFolder?: string | null) => void;
  openDocument: (
    name: string,
    w: number,
    h: number,
    filePath: string | null,
    fileSize: number | null,
    projectFolder?: string | null,
  ) => void;
  setProjectLocation: (p: { projectPath?: string | null; projectFolder?: string | null }) => void;
  markClean: () => void;
  markDirty: () => void;
  setDocSize: (w: number, h: number) => void;
  addLayer: (l: LayerMeta) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, p: Partial<LayerMeta>) => void;
  setActiveLayer: (id: string) => void;
  setLayerSelection: (ids: string[]) => void;
  toggleLayerSelect: (id: string) => void;
  selectLayerRange: (anchorId: string, toId: string) => void;
  clearLayerSelection: () => void;
  toggleGroupCollapse: (groupId: string) => void;
  moveLayer: (id: string, dir: 1 | -1) => void;
  pushHistory: (e: Omit<HistoryEntry, "id" | "time">) => void;
  undoMeta: () => HistoryEntry | null;
  redoMeta: () => HistoryEntry | null;
  clearHistory: () => void;
}

let seq = 0;
function uid(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

// Lightweight path: cap history so RAM stays flat.
// A 1920x1080 snapshot is ~8MB; 50 snapshots = 400MB+ per layer.
// 15 snapshots = ~120MB max, enough for sane undo while staying light.
export const MAX_HISTORY = 15;

const defaultLayer = (): LayerMeta => ({
  id: uid("layer"),
  name: "Layer 1",
  visible: true,
  locked: false,
  lockPixels: false,
  lockPosition: false,
  opacity: 100,
  fillOpacity: 100,
  blendMode: "normal",
  kind: "raster",
});

export const useEditorStore = create<EditorState>((set, get) => ({
  tool: "brush",
  brushSize: 24,
  brushOpacity: 100,
  brushHardness: 80,
  brushColor: "#2f7cf6",
  bgColor: "#ffffff",
  brushFlow: 100,
  brushSpacing: 18,
  brushJitter: 0,
  brushSmoothing: 35,
  brushAngle: 0,
  brushRound: 100,
  brushBlend: "source-over" as GlobalCompositeOperation,
  zoom: 100,
  panX: 0,
  panY: 0,
  viewRotate: 0,
  showRulers: true,
  theme: "dark",
  layers: [defaultLayer()],
  activeLayerId: null,
  selectedLayerIds: [],
  collapsedGroups: [],
  history: [],
  future: [],
  doc: {
    name: "Untitled",
    width: 1920,
    height: 1080,
    filePath: null,
    projectPath: null,
    projectFolder: null,
    dirty: false,
    fileSize: null,
  },
  backendStatus: "checking",
  backendInfo: "",

  setTool: (tool) => set({ tool }),
  setBrush: (p) =>
    set((s) => ({
      brushSize: p.size ?? s.brushSize,
      brushOpacity: p.opacity ?? s.brushOpacity,
      brushHardness: p.hardness ?? s.brushHardness,
      brushColor: p.color ?? s.brushColor,
      brushFlow: p.flow !== undefined ? Math.max(1, Math.min(100, Math.round(p.flow))) : s.brushFlow,
      brushSpacing: p.spacing !== undefined ? Math.max(1, Math.min(200, Math.round(p.spacing))) : s.brushSpacing,
      brushJitter: p.jitter !== undefined ? Math.max(0, Math.min(100, Math.round(p.jitter))) : s.brushJitter,
      brushSmoothing: p.smoothing !== undefined ? Math.max(0, Math.min(100, Math.round(p.smoothing))) : s.brushSmoothing,
      brushAngle: p.angle !== undefined ? Math.max(-180, Math.min(180, Math.round(p.angle))) : s.brushAngle,
      brushRound: p.round !== undefined ? Math.max(1, Math.min(100, Math.round(p.round))) : s.brushRound,
      brushBlend: p.blend ?? s.brushBlend,
    })),
  setBgColor: (bgColor) => set({ bgColor }),
  setZoom: (zoom) => set({ zoom: Math.min(3200, Math.max(10, Math.round(zoom))) }),
  setPan: (panX, panY) => set({ panX, panY }),
  setViewRotate: (viewRotate) =>
    set({ viewRotate: ((Math.round(viewRotate) % 360) + 360) % 360 }),
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  setBackend: (backendStatus, backendInfo) => set({ backendStatus, backendInfo }),

  newDocument: (name, width, height, projectFolder = null) => {
    const l = defaultLayer();
    l.name = "Background";
    // plan3 Fase 0: the fresh-document paper is kind "background" so brush
    // strokes auto-create transparent paint layers and no eraser can ever
    // punch transparency holes into the paper itself.
    l.kind = "background";
    set({
      doc: { name, width, height, filePath: null, projectPath: null, projectFolder, dirty: false, fileSize: null },
      layers: [l],
      activeLayerId: l.id,
      selectedLayerIds: [],
      collapsedGroups: [],
      history: [],
      future: [],
      zoom: 100,
      panX: 0,
      panY: 0,
    });
  },

  openDocument: (name, w, h, filePath, fileSize, projectFolder = null) => {
    const l = defaultLayer();
    l.name = "Layer 1";
    set({
      doc: { name, width: w, height: h, filePath, projectPath: null, projectFolder, dirty: false, fileSize },
      layers: [l],
      activeLayerId: l.id,
      selectedLayerIds: [],
      collapsedGroups: [],
      history: [],
      future: [],
      zoom: 100,
      panX: 0,
      panY: 0,
    });
  },

  setProjectLocation: (p) =>
    set((s) => ({
      doc: {
        ...s.doc,
        projectPath: p.projectPath !== undefined ? p.projectPath : s.doc.projectPath,
        projectFolder: p.projectFolder !== undefined ? p.projectFolder : s.doc.projectFolder,
      },
    })),

  markClean: () => set((s) => ({ doc: { ...s.doc, dirty: false } })),
  markDirty: () => set((s) => ({ doc: { ...s.doc, dirty: true } })),
  setDocSize: (w, h) =>
    set((s) => ({
      doc: {
        ...s.doc,
        width: Math.max(1, Math.min(16384, Math.round(w))),
        height: Math.max(1, Math.min(16384, Math.round(h))),
        dirty: true,
      },
    })),

  addLayer: (l) =>
    set((s) => ({ layers: [...s.layers, l], activeLayerId: l.id, doc: { ...s.doc, dirty: true } })),
  removeLayer: (id) =>
    set((s) => {
      if (s.layers.length <= 1) return s;
      const layers = s.layers.filter((l) => l.id !== id);
      const activeLayerId = s.activeLayerId === id ? layers[layers.length - 1].id : s.activeLayerId;
      return {
        layers,
        activeLayerId,
        selectedLayerIds: s.selectedLayerIds.filter((x) => x !== id),
        doc: { ...s.doc, dirty: true },
      };
    }),
  updateLayer: (id, p) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...p } : l)),
      doc: { ...s.doc, dirty: true },
    })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setLayerSelection: (ids) =>
    set((s) => ({ selectedLayerIds: ids.filter((id) => s.layers.some((l) => l.id === id)) })),
  toggleLayerSelect: (id) =>
    set((s) => ({
      selectedLayerIds: s.selectedLayerIds.includes(id)
        ? s.selectedLayerIds.filter((x) => x !== id)
        : [...s.selectedLayerIds, id],
    })),
  selectLayerRange: (anchorId, toId) =>
    set((s) => {
      const a = s.layers.findIndex((l) => l.id === anchorId);
      const b = s.layers.findIndex((l) => l.id === toId);
      if (a < 0 || b < 0) return s;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      return { selectedLayerIds: s.layers.slice(lo, hi + 1).map((l) => l.id) };
    }),
  clearLayerSelection: () => set({ selectedLayerIds: [] }),
  toggleGroupCollapse: (groupId) =>
    set((s) => ({
      collapsedGroups: s.collapsedGroups.includes(groupId)
        ? s.collapsedGroups.filter((g) => g !== groupId)
        : [...s.collapsedGroups, groupId],
    })),
  moveLayer: (id, dir) =>
    set((s) => {
      const idx = s.layers.findIndex((l) => l.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= s.layers.length) return s;
      const layers = [...s.layers];
      const [item] = layers.splice(idx, 1);
      layers.splice(to, 0, item);
      return { layers, doc: { ...s.doc, dirty: true } };
    }),

  pushHistory: (e) =>
    set((s) => {
      // Adaptive cap: large snapshots (>8MP ~32MB) keep max 8, small keep MAX_HISTORY (15).
      // Prevents multi-GB history on 4K docs while keeping generous undo on HD.
      // The Settings control center can tighten this further for potato PCs.
      const px = e.snapshot ? e.snapshot.width * e.snapshot.height : 0;
      let cap = px > 8_000_000 ? 8 : MAX_HISTORY;
      try {
        cap = Math.min(cap, effectiveHistoryCap(px));
      } catch {
        /* keep adaptive cap */
      }
      return {
        history: [...s.history.slice(-(cap - 1)), { ...e, id: uid("h"), time: Date.now() }],
        future: s.future.slice(-(cap - 1)),
      };
    }),
  undoMeta: () => {
    const s = get();
    if (s.history.length === 0) return null;
    const entry = s.history[s.history.length - 1];
    set({ history: s.history.slice(0, -1), future: [entry, ...s.future] });
    return entry;
  },
  redoMeta: () => {
    const s = get();
    if (s.future.length === 0) return null;
    const [entry, ...rest] = s.future;
    set({ history: [...s.history, entry], future: rest });
    return entry;
  },
  clearHistory: () => set({ history: [], future: [] }),
}));

export function makeLayer(name: string): LayerMeta {
  return {
    id: uid("layer"),
    name,
    visible: true,
    locked: false,
    lockPixels: false,
    lockPosition: false,
    opacity: 100,
    fillOpacity: 100,
    blendMode: "normal",
    kind: "raster",
  };
}
