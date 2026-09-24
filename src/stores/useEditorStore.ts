import { create } from "zustand";

export type ToolId =
  | "move"
  | "select-rect"
  | "select-ellipse"
  | "select-lasso"
  | "wand"
  | "brush"
  | "spot-heal"
  | "clone"
  | "blur"
  | "sharpen"
  | "smudge"
  | "dodge"
  | "burn"
  | "sponge"
  | "eraser"
  | "gradient"
  | "fill"
  | "eyedropper"
  | "text"
  | "shape-rect"
  | "shape-ellipse"
  | "shape-polygon"
  | "pen"
  | "line"
  | "crop"
  | "zoom"
  | "pan";

export type BlendMode =
  "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "difference";

export interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0-100
  blendMode: BlendMode;
  kind: "raster" | "background" | "text" | "shape";
  clipped?: boolean;
}

export interface HistoryEntry {
  id: string;
  label: string;
  layerId: string;
  snapshot: ImageData | null;
  maskSnapshot?: ImageData | null;
  time: number;
}

interface DocumentState {
  name: string;
  width: number;
  height: number;
  filePath: string | null;
  dirty: boolean;
  fileSize: number | null;
}

interface EditorState {
  tool: ToolId;
  brushSize: number;
  brushOpacity: number;
  brushHardness: number;
  brushColor: string;
  zoom: number; // percent
  panX: number;
  panY: number;
  showRulers: boolean;
  theme: "dark" | "light";
  layers: LayerMeta[];
  activeLayerId: string | null;
  history: HistoryEntry[];
  future: HistoryEntry[];
  doc: DocumentState;
  backendStatus: "checking" | "online" | "web-only";
  backendInfo: string;

  setTool: (t: ToolId) => void;
  setBrush: (
    p: Partial<{ size: number; opacity: number; hardness: number; color: string }>,
  ) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggleRulers: () => void;
  setBackend: (s: EditorState["backendStatus"], info: string) => void;
  newDocument: (name: string, w: number, h: number) => void;
  openDocument: (
    name: string,
    w: number,
    h: number,
    filePath: string | null,
    fileSize: number | null,
  ) => void;
  markClean: () => void;
  markDirty: () => void;
  setDocSize: (w: number, h: number) => void;
  addLayer: (l: LayerMeta) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, p: Partial<LayerMeta>) => void;
  setActiveLayer: (id: string) => void;
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

const defaultLayer = (): LayerMeta => ({
  id: uid("layer"),
  name: "Layer 1",
  visible: true,
  locked: false,
  opacity: 100,
  blendMode: "normal",
  kind: "raster",
});

export const useEditorStore = create<EditorState>((set, get) => ({
  tool: "brush",
  brushSize: 24,
  brushOpacity: 100,
  brushHardness: 80,
  brushColor: "#0a84ff",
  zoom: 100,
  panX: 0,
  panY: 0,
  showRulers: true,
  theme: "dark",
  layers: [defaultLayer()],
  activeLayerId: null,
  history: [],
  future: [],
  doc: {
    name: "Untitled",
    width: 1920,
    height: 1080,
    filePath: null,
    dirty: false,
    fileSize: null,
  },
  backendStatus: "checking",
  backendInfo: "Menghubungkan ke Rust engine...",

  setTool: (tool) => set({ tool }),
  setBrush: (p) =>
    set((s) => ({
      brushSize: p.size ?? s.brushSize,
      brushOpacity: p.opacity ?? s.brushOpacity,
      brushHardness: p.hardness ?? s.brushHardness,
      brushColor: p.color ?? s.brushColor,
    })),
  setZoom: (zoom) => set({ zoom: Math.min(3200, Math.max(10, Math.round(zoom))) }),
  setPan: (panX, panY) => set({ panX, panY }),
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  setBackend: (backendStatus, backendInfo) => set({ backendStatus, backendInfo }),

  newDocument: (name, width, height) => {
    const l = defaultLayer();
    l.name = "Background";
    set({
      doc: { name, width, height, filePath: null, dirty: false, fileSize: null },
      layers: [l],
      activeLayerId: l.id,
      history: [],
      future: [],
      zoom: 100,
      panX: 0,
      panY: 0,
    });
  },

  openDocument: (name, w, h, filePath, fileSize) => {
    const l = defaultLayer();
    l.name = "Layer 1";
    set({
      doc: { name, width: w, height: h, filePath, dirty: false, fileSize },
      layers: [l],
      activeLayerId: l.id,
      history: [],
      future: [],
      zoom: 100,
      panX: 0,
      panY: 0,
    });
  },

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
      return { layers, activeLayerId, doc: { ...s.doc, dirty: true } };
    }),
  updateLayer: (id, p) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...p } : l)),
      doc: { ...s.doc, dirty: true },
    })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
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
    set((s) => ({
      history: [...s.history.slice(-49), { ...e, id: uid("h"), time: Date.now() }],
      future: [],
    })),
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
    opacity: 100,
    blendMode: "normal",
    kind: "raster",
  };
}
