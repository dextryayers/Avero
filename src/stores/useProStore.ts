import { create } from "zustand";

// Fase 2.3: Adjustment non-destructive
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
  | "posterize";

export interface AdjustmentEntry {
  id: string;
  type: AdjustmentType;
  name: string;
  enabled: boolean;
  opacity: number; // 0-100
  params: Record<string, number>;
}

// Fase 2.5: Filter stack
export type FilterType =
  | "gaussianBlur"
  | "boxBlur"
  | "motionBlur"
  | "sharpen"
  | "noise"
  | "pixelate"
  | "emboss"
  | "findEdges";

export interface FilterEntry {
  id: string;
  type: FilterType;
  name: string;
  enabled: boolean;
  opacity: number;
  params: Record<string, number>;
}

// Fase 3.1: Color
export type WorkingSpace = "sRGB" | "AdobeRGB" | "ProPhoto";
export interface ColorState {
  workingSpace: WorkingSpace;
  bitDepth: 8 | 16;
  proofEnabled: boolean;
  proofProfile: "CMYK US Web Coated" | "CMYK FOGRA51";
  gamutWarning: boolean;
}

// Fase 3.2: RAW develop
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

interface ProState {
  // selection UI state
  selKind: "none" | "rect" | "ellipse" | "lasso" | "wand";
  selFeather: number;
  selTolerance: number;
  selExpand: number;
  savedSelections: SavedSelection[];

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
      kind: "rect" | "ellipse" | "polygon";
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
  guidesH: number[];
  guidesV: number[];
  showGuides: boolean;
  addGuide: (kind: "h" | "v", pos: number) => void;
  moveGuide: (kind: "h" | "v", index: number, pos: number) => void;
  removeGuide: (kind: "h" | "v", index: number) => void;
  clearGuides: () => void;
  toggleGuides: () => void;
  removeTransform: (layerId: string) => void;

  setSelKind: (k: ProState["selKind"]) => void;
  setSelParams: (p: Partial<Pick<ProState, "selFeather" | "selTolerance" | "selExpand">>) => void;
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
  vibrance: { vibrance: 0 },
  colorBalance: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
  autoContrast: {},
  blackWhite: { reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 },
  invert: {},
  threshold: { level: 128 },
  posterize: { levels: 4 },
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
};

const filterParams: Record<FilterType, Record<string, number>> = {
  gaussianBlur: { radius: 4 },
  boxBlur: { radius: 4 },
  motionBlur: { radius: 8, angle: 0 },
  sharpen: { amount: 60 },
  noise: { amount: 8 },
  pixelate: { size: 8 },
  emboss: { strength: 60 },
  findEdges: { threshold: 24 },
};

const filterNames: Record<FilterType, string> = {
  gaussianBlur: "Gaussian Blur",
  boxBlur: "Box Blur",
  motionBlur: "Motion Blur",
  sharpen: "Sharpen",
  noise: "Noise",
  pixelate: "Pixelate",
  emboss: "Emboss",
  findEdges: "Find Edges",
};

export const useProStore = create<ProState>((set) => ({
  selKind: "rect",
  selFeather: 0,
  selTolerance: 24,
  selExpand: 0,
  savedSelections: [],
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
  guidesH: [],
  guidesV: [],
  showGuides: true,

  setSelKind: (selKind) => set({ selKind }),
  setSelParams: (p) => set(p),
  setGradTo: (gradTo) => set({ gradTo }),
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
  bumpHistogram: () => set((s) => ({ histogramTick: s.histogramTick + 1 })),
}));

export function defaultAdjustmentParams(type: AdjustmentType) {
  return { ...defaultParams[type] };
}
