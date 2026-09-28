import { create } from "zustand";

let lastHistBump = 0;

// Adjustment non-destructive lengkap ala Photoshop
export type AdjustmentType =
  | "brightnessContrast"
  | "levels"
  | "curves"
  | "exposure"
  | "hueSaturation"
  | "vibrance"
  | "colorBalance"
  | "autoContrast"
  | "blackWhite"
  | "invert"
  | "threshold"
  | "posterize"
  | "selectiveColor"
  | "shadowsHighlights"
  | "photoFilter"
  | "channelMixer"
  | "gradientMap"
  | "colorLookup";

export interface AdjustmentEntry {
  id: string;
  type: AdjustmentType;
  name: string;
  enabled: boolean;
  opacity: number; // 0-100
  params: Record<string, number>;
}

// Filter stack lengkap
export type FilterType =
  | "gaussianBlur"
  | "boxBlur"
  | "motionBlur"
  | "sharpen"
  | "unsharpMask"
  | "highPass"
  | "reduceNoise"
  | "noise"
  | "filmGrain"
  | "pixelate"
  | "halftone"
  | "emboss"
  | "findEdges"
  | "oilPaintLite"
  | "tiltShift"
  | "vignette"
  | "chromaticAberration";

export interface FilterEntry {
  id: string;
  type: FilterType;
  name: string;
  enabled: boolean;
  opacity: number;
  params: Record<string, number>;
}

// Phase 3.1: color
export type WorkingSpace = "sRGB" | "AdobeRGB" | "ProPhoto";
export interface ColorState {
  workingSpace: WorkingSpace;
  bitDepth: 8 | 16;
  proofEnabled: boolean;
  proofProfile: "CMYK US Web Coated" | "CMYK FOGRA51";
  gamutWarning: boolean;
}

// Phase 3.2: RAW develop
export interface RawState {
  isRaw: boolean;
  fileName: string | null;
  exposure: number; // -5..5
  temperature: number; // 2000..12000
  tint: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  whites: number;
  blacks: number;
  vibrance: number;
}

export interface SavedSelection {
  id: string;
  name: string;
  time: number;
}

export interface SliceRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}

export interface NotePin {
  id: string;
  x: number;
  y: number;
  text: string;
  color?: string;
}

export interface CountPin {
  id: string;
  x: number;
  y: number;
  n: number;
}

export interface SamplerPin {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface MeasureEntry {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  label: string;
}

export type CropOverlay = "none" | "thirds" | "diagonal" | "triangle" | "spiral" | "center";

export interface PathEntry {
  id: string;
  name: string;
  kind: "pen" | "line" | "curve";
  points: { x: number; y: number }[];
  time: number;
}

interface ProState {
  // selection UI state
  selKind: "none" | "rect" | "ellipse" | "lasso" | "wand";
  selFeather: number;
  selTolerance: number;
  selExpand: number;
  savedSelections: SavedSelection[];
  // slices for export (real, drawable, selectable)
  slices: SliceRect[];
  activeSliceId: string | null;
  // annotations
  notes: NotePin[];
  counts: CountPin[];
  samplers: SamplerPin[];
  measures: MeasureEntry[];

  adjustments: AdjustmentEntry[];
  filters: FilterEntry[];
  // mask per layer: layerId -> config
  masks: Record<string, { enabled: boolean; feather: number; density: number; hasMask: boolean }>;
  paintMask: boolean;
  // transform per layer
  transforms: Record<
    string,
    { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
  >;
  color: ColorState;
  raw: RawState;
  textSpecs: Record<
    string,
    {
      text: string;
      fontFamily: string;
      fontSize: number;
      color: string;
      bold: boolean;
      italic: boolean;
      tracking: number;
      leading: number;
    }
  >;
  shapeSpecs: Record<
    string,
    {
      kind:
        | "rect"
        | "ellipse"
        | "polygon"
        | "triangle"
        | "line"
        | "star"
        | "arrow"
        | "custom"
        | "rounded"
        | "diamond"
        | "heart"
        | "hexagon"
        | "burst"
        | "donut"
        | "chevron"
        | "moon"
        | "cross"
        | "plus"
        | "trapezoid"
        | "trapezoid-wide"
        | "parallelogram"
        | "pentagon"
        | "octagon"
        | "shield"
        | "badge"
        | "ribbon"
        | "cloud"
        | "speech"
        | "gear"
        | "drop"
        | "leaf"
        | "lightning"
        | "crown"
        | "pin"
        | "ticket";
      fill: string;
      stroke: string;
      strokeWidth: number;
      sides: number;
      rotation: number;
    }
  >;
  setTextSpec: (layerId: string, spec: ProState["textSpecs"][string]) => void;
  setShapeSpec: (layerId: string, spec: ProState["shapeSpecs"][string]) => void;
  gradTo: "transparent" | "white" | "black";
  setGradTo: (v: ProState["gradTo"]) => void;
  cropOverlay: CropOverlay;
  setCropOverlay: (v: CropOverlay) => void;
  paths: PathEntry[];
  addPath: (p: Omit<PathEntry, "id" | "time">) => string;
  removePath: (id: string) => void;
  clearPaths: () => void;
  customSwatches: string[];
  addSwatch: (color: string) => void;
  removeSwatch: (color: string) => void;
  guidesH: number[];
  guidesV: number[];
  showGuides: boolean;
  showGrid: boolean;
  gridSize: number;
  snapEnabled: boolean;
  addGuide: (kind: "h" | "v", pos: number) => void;
  moveGuide: (kind: "h" | "v", index: number, pos: number) => void;
  removeGuide: (kind: "h" | "v", index: number) => void;
  clearGuides: () => void;
  toggleGuides: () => void;
  toggleGrid: () => void;
  setGridSize: (n: number) => void;
  toggleSnap: () => void;
  removeTransform: (layerId: string) => void;

  setSelKind: (k: ProState["selKind"]) => void;
  setSelParams: (p: Partial<Pick<ProState, "selFeather" | "selTolerance" | "selExpand">>) => void;
  addSlice: (s: Omit<SliceRect, "id">) => string;
  updateSlice: (id: string, p: Partial<SliceRect>) => void;
  removeSlice: (id: string) => void;
  setActiveSlice: (id: string | null) => void;
  clearSlices: () => void;
  addNote: (n: Omit<NotePin, "id">) => string;
  removeNote: (id: string) => void;
  clearNotes: () => void;
  addCount: (c: Omit<CountPin, "id">) => string;
  clearCounts: () => void;
  addSampler: (s: Omit<SamplerPin, "id">) => string;
  removeSampler: (id: string) => void;
  clearSamplers: () => void;
  addMeasure: (m: Omit<MeasureEntry, "id">) => string;
  clearMeasures: () => void;
  addAdjustment: (type: AdjustmentType) => void;
  updateAdjustment: (id: string, p: Partial<AdjustmentEntry>) => void;
  updateAdjustmentParams: (id: string, params: Record<string, number>) => void;
  removeAdjustment: (id: string) => void;
  moveAdjustment: (id: string, dir: 1 | -1) => void;
  addFilter: (type: FilterType) => void;
  updateFilter: (id: string, p: Partial<FilterEntry>) => void;
  updateFilterParams: (id: string, params: Record<string, number>) => void;
  removeFilter: (id: string) => void;
  moveFilter: (id: string, dir: 1 | -1) => void;
  ensureMask: (layerId: string) => void;
  updateMask: (layerId: string, p: Partial<ProState["masks"][string]>) => void;
  removeMaskEntry: (layerId: string) => void;
  setPaintMask: (v: boolean) => void;
  ensureTransform: (layerId: string) => void;
  updateTransform: (layerId: string, p: Partial<ProState["transforms"][string]>) => void;
  setColor: (p: Partial<ColorState>) => void;
  setRaw: (p: Partial<RawState>) => void;
  resetRaw: () => void;
  histogramTick: number;
  bumpHistogram: () => void;
}

let seq = 1000;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

const defaultParams: Record<AdjustmentType, Record<string, number>> = {
  brightnessContrast: { brightness: 0, contrast: 0 },
  levels: { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 },
  curves: { lift: 0, gain: 0 },
  exposure: { exposure: 0, offset: 0, gamma: 1 },
  hueSaturation: { hue: 0, saturation: 0, lightness: 0 },
  vibrance: { vibrance: 0, saturation: 0 },
  colorBalance: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
  autoContrast: {},
  blackWhite: { reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 },
  invert: {},
  threshold: { level: 128 },
  posterize: { levels: 4 },
  selectiveColor: { reds: 0, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 },
  shadowsHighlights: { shadows: 25, highlights: 25 },
  photoFilter: { warmth: 0, density: 25 },
  channelMixer: { red: 100, green: 0, blue: 0 },
  gradientMap: { shadows: 0, highlights: 100 },
  colorLookup: { strength: 50, tone: 0 },
};

const adjNames: Record<AdjustmentType, string> = {
  brightnessContrast: "Brightness/Contrast",
  levels: "Levels",
  curves: "Curves lite",
  exposure: "Exposure",
  hueSaturation: "Hue/Saturation",
  vibrance: "Vibrance",
  colorBalance: "Color Balance",
  autoContrast: "Auto Contrast",
  blackWhite: "Black and White",
  invert: "Invert",
  threshold: "Threshold",
  posterize: "Posterize",
  selectiveColor: "Selective Color",
  shadowsHighlights: "Shadows/Highlights",
  photoFilter: "Photo Filter",
  channelMixer: "Channel Mixer",
  gradientMap: "Gradient Map",
  colorLookup: "Color Lookup",
};

const filterParams: Record<FilterType, Record<string, number>> = {
  gaussianBlur: { radius: 4 },
  boxBlur: { radius: 4 },
  motionBlur: { radius: 8, angle: 0 },
  sharpen: { amount: 60 },
  unsharpMask: { amount: 70, radius: 2 },
  highPass: { radius: 4 },
  reduceNoise: { strength: 40 },
  noise: { amount: 8 },
  filmGrain: { amount: 18, size: 1 },
  pixelate: { size: 8 },
  halftone: { size: 6 },
  emboss: { strength: 60 },
  findEdges: { threshold: 24 },
  oilPaintLite: { radius: 3, intensity: 50 },
  tiltShift: { focus: 50, blur: 8 },
  vignette: { amount: 45, feather: 60 },
  chromaticAberration: { amount: 3 },
};

const filterNames: Record<FilterType, string> = {
  gaussianBlur: "Gaussian Blur",
  boxBlur: "Box Blur",
  motionBlur: "Motion Blur",
  sharpen: "Sharpen",
  unsharpMask: "Unsharp Mask",
  highPass: "High Pass",
  reduceNoise: "Reduce Noise",
  noise: "Noise",
  filmGrain: "Film Grain",
  pixelate: "Pixelate",
  halftone: "Halftone",
  oilPaintLite: "Oil Paint Lite",
  tiltShift: "Tilt Shift",
  vignette: "Vignette",
  chromaticAberration: "Chromatic Aberration",
  emboss: "Emboss",
  findEdges: "Find Edges",
};

export const useProStore = create<ProState>((set) => ({
  selKind: "rect",
  selFeather: 0,
  selTolerance: 24,
  selExpand: 0,
  savedSelections: [],
  slices: [],
  activeSliceId: null,
  notes: [],
  counts: [],
  samplers: [],
  measures: [],
  adjustments: [],
  filters: [],
  masks: {},
  paintMask: false,
  transforms: {},
  color: {
    workingSpace: "sRGB",
    bitDepth: 8,
    proofEnabled: false,
    proofProfile: "CMYK US Web Coated",
    gamutWarning: false,
  },
  raw: {
    isRaw: false,
    fileName: null,
    exposure: 0,
    temperature: 5500,
    tint: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    vibrance: 0,
  },
  textSpecs: {},
  shapeSpecs: {},
  histogramTick: 0,
  gradTo: "transparent",
  cropOverlay: "none",
  paths: [],
  customSwatches: [
    "#c0392b",
    "#e67e22",
    "#f1c40f",
    "#27ae60",
    "#16a085",
    "#2980b9",
    "#8e44ad",
    "#fd79a8",
    "#d35400",
    "#fdcb6e",
    "#00cec9",
    "#6c5ce7",
  ],
  guidesH: [],
  guidesV: [],
  showGuides: true,
  showGrid: false,
  gridSize: 64,
  snapEnabled: true,

  setSelKind: (selKind) => set({ selKind }),
  setSelParams: (p) => set(p),
  setGradTo: (gradTo) => set({ gradTo }),
  setCropOverlay: (cropOverlay) => set({ cropOverlay }),
  addPath: (p) => {
    const id = uid("path");
    set((s) => ({ paths: [...s.paths.slice(-49), { ...p, id, time: Date.now() }] }));
    return id;
  },
  removePath: (id) => set((s) => ({ paths: s.paths.filter((x) => x.id !== id) })),
  clearPaths: () => set({ paths: [] }),
  addSwatch: (color) =>
    set((s) => {
      const c = color.toLowerCase();
      if (s.customSwatches.some((x) => x.toLowerCase() === c)) return s;
      return { customSwatches: [...s.customSwatches.slice(-47), color] };
    }),
  removeSwatch: (color) =>
    set((s) => ({ customSwatches: s.customSwatches.filter((x) => x.toLowerCase() !== color.toLowerCase()) })),
  addSlice: (s) => {
    const id = uid("slice");
    set((st) => ({
      slices: [...st.slices, { ...s, id, name: s.name || `Slice ${st.slices.length + 1}` }],
      activeSliceId: id,
    }));
    return id;
  },
  updateSlice: (id, p) =>
    set((s) => ({ slices: s.slices.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
  removeSlice: (id) =>
    set((s) => ({
      slices: s.slices.filter((x) => x.id !== id),
      activeSliceId: s.activeSliceId === id ? null : s.activeSliceId,
    })),
  setActiveSlice: (activeSliceId) => set({ activeSliceId }),
  clearSlices: () => set({ slices: [], activeSliceId: null }),
  addNote: (n) => {
    const id = uid("note");
    set((s) => ({ notes: [...s.notes.slice(-49), { ...n, id }] }));
    return id;
  },
  removeNote: (id) => set((s) => ({ notes: s.notes.filter((x) => x.id !== id) })),
  clearNotes: () => set({ notes: [] }),
  addCount: (c) => {
    const id = uid("count");
    set((s) => ({ counts: [...s.counts, { ...c, id }] }));
    return id;
  },
  clearCounts: () => set({ counts: [] }),
  addSampler: (s) => {
    const id = uid("samp");
    set((st) => ({ samplers: [...st.samplers.slice(-7), { ...s, id }] }));
    return id;
  },
  removeSampler: (id) => set((s) => ({ samplers: s.samplers.filter((x) => x.id !== id) })),
  clearSamplers: () => set({ samplers: [] }),
  addMeasure: (m) => {
    const id = uid("meas");
    set((s) => ({ measures: [...s.measures.slice(-19), { ...m, id }] }));
    return id;
  },
  clearMeasures: () => set({ measures: [] }),
  addGuide: (kind, pos) =>
    set((s) => ({
      guidesH: kind === "h" ? [...s.guidesH, pos] : s.guidesH,
      guidesV: kind === "v" ? [...s.guidesV, pos] : s.guidesV,
    })),
  moveGuide: (kind, index, pos) =>
    set((s) => ({
      guidesH: kind === "h" ? s.guidesH.map((g, i) => (i === index ? pos : g)) : s.guidesH,
      guidesV: kind === "v" ? s.guidesV.map((g, i) => (i === index ? pos : g)) : s.guidesV,
    })),
  removeGuide: (kind, index) =>
    set((s) => ({
      guidesH: kind === "h" ? s.guidesH.filter((_, i) => i !== index) : s.guidesH,
      guidesV: kind === "v" ? s.guidesV.filter((_, i) => i !== index) : s.guidesV,
    })),
  clearGuides: () => set({ guidesH: [], guidesV: [] }),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setGridSize: (gridSize) => set({ gridSize: Math.max(8, Math.min(512, Math.round(gridSize))) }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  removeTransform: (layerId) =>
    set((s) => {
      const t = { ...s.transforms };
      delete t[layerId];
      return { transforms: t };
    }),

  addAdjustment: (type) =>
    set((s) => ({
      adjustments: [
        ...s.adjustments,
        {
          id: uid("adj"),
          type,
          name: adjNames[type],
          enabled: true,
          opacity: 100,
          params: { ...defaultParams[type] },
        },
      ],
    })),
  updateAdjustment: (id, p) =>
    set((s) => ({ adjustments: s.adjustments.map((a) => (a.id === id ? { ...a, ...p } : a)) })),
  updateAdjustmentParams: (id, params) =>
    set((s) => ({
      adjustments: s.adjustments.map((a) =>
        a.id === id ? { ...a, params: { ...a.params, ...params } } : a,
      ),
    })),
  removeAdjustment: (id) => set((s) => ({ adjustments: s.adjustments.filter((a) => a.id !== id) })),
  moveAdjustment: (id, dir) =>
    set((s) => {
      const idx = s.adjustments.findIndex((a) => a.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= s.adjustments.length) return s;
      const arr = [...s.adjustments];
      const [it] = arr.splice(idx, 1);
      arr.splice(to, 0, it);
      return { adjustments: arr };
    }),

  addFilter: (type) =>
    set((s) => ({
      filters: [
        ...s.filters,
        {
          id: uid("flt"),
          type,
          name: filterNames[type],
          enabled: true,
          opacity: 100,
          params: { ...filterParams[type] },
        },
      ],
    })),
  updateFilter: (id, p) =>
    set((s) => ({ filters: s.filters.map((f) => (f.id === id ? { ...f, ...p } : f)) })),
  updateFilterParams: (id, params) =>
    set((s) => ({
      filters: s.filters.map((f) =>
        f.id === id ? { ...f, params: { ...f.params, ...params } } : f,
      ),
    })),
  removeFilter: (id) => set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),
  moveFilter: (id, dir) =>
    set((s) => {
      const idx = s.filters.findIndex((f) => f.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= s.filters.length) return s;
      const arr = [...s.filters];
      const [it] = arr.splice(idx, 1);
      arr.splice(to, 0, it);
      return { filters: arr };
    }),

  ensureMask: (layerId) =>
    set((s) => ({
      masks: {
        ...s.masks,
        [layerId]: s.masks[layerId] ?? { enabled: true, feather: 0, density: 100, hasMask: true },
      },
    })),
  updateMask: (layerId, p) =>
    set((s) => ({
      masks: { ...s.masks, [layerId]: { ...s.masks[layerId], ...p } as ProState["masks"][string] },
    })),
  removeMaskEntry: (layerId) =>
    set((s) => {
      const m = { ...s.masks };
      delete m[layerId];
      return { masks: m };
    }),
  setPaintMask: (v) => set({ paintMask: v }),

  ensureTransform: (layerId) =>
    set((s) => ({
      transforms: {
        ...s.transforms,
        [layerId]: s.transforms[layerId] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      },
    })),
  updateTransform: (layerId, p) =>
    set((s) => ({
      transforms: {
        ...s.transforms,
        [layerId]: { ...s.transforms[layerId], ...p } as ProState["transforms"][string],
      },
    })),

  setColor: (p) => set((s) => ({ color: { ...s.color, ...p } })),
  setRaw: (p) => set((s) => ({ raw: { ...s.raw, ...p } })),
  resetRaw: () =>
    set((s) => ({
      raw: {
        ...s.raw,
        exposure: 0,
        temperature: 5500,
        tint: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        vibrance: 0,
      },
    })),
  setTextSpec: (layerId, spec) => set((s) => ({ textSpecs: { ...s.textSpecs, [layerId]: spec } })),
  setShapeSpec: (layerId, spec) =>
    set((s) => ({ shapeSpecs: { ...s.shapeSpecs, [layerId]: spec } })),
  // Throttled to max 1 tick per 400ms: Histogram does a 256px downscale +
  // getImageData per tick, and brush strokes fire dozens of bumps per second.
  bumpHistogram: () => {
    const now = Date.now();
    if (now - lastHistBump < 400) return;
    lastHistBump = now;
    set((s) => ({ histogramTick: s.histogramTick + 1 }));
  },
}));

export function defaultAdjustmentParams(type: AdjustmentType) {
  return { ...defaultParams[type] };
}
