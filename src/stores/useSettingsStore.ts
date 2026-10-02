import { create } from "zustand";

export type PerfMode = "auto" | "eco" | "balanced" | "max";
export type EngineDevice = "auto" | "cpu" | "gpu";

export interface SettingsState {
  perfMode: PerfMode;
  device: EngineDevice;
  tileSize: 256 | 512 | 1024;
  historyCap: number;
  animations: boolean;
  autosaveMin: number;
  appliedAt: number | null;
  // ---- full software control ----
  canvasQuality: "draft" | "balanced" | "best";
  brushSmoothing: number; // 0-100
  defaultBrushSize: number;
  defaultHardness: number;
  showRulersOnStart: boolean;
  showGridOnStart: boolean;
  snapOnStart: boolean;
  themeMode: "dark" | "light";
  autoFitOnOpen: boolean;
  confirmDestructive: boolean;
  maxZoom: number;
  set: (p: Partial<SettingsState>) => void;
  resetAll: () => void;
  applyRecommendation: (r: { mode: string; device: string; tile: number; history_cap: number }) => void;
}

const KEY = "avero-settings-v2";

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("avero-settings-v1");
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<SettingsState>;
    const out: Partial<SettingsState> = {
      perfMode: p.perfMode === "eco" || p.perfMode === "balanced" || p.perfMode === "max" ? p.perfMode : "auto",
      device: p.device === "cpu" || p.device === "gpu" ? p.device : "auto",
      tileSize: p.tileSize === 256 || p.tileSize === 1024 ? p.tileSize : 512,
      historyCap: typeof p.historyCap === "number" ? Math.min(30, Math.max(4, Math.round(p.historyCap))) : 15,
      animations: p.animations !== false,
      autosaveMin: [0, 1, 2, 5].includes(p.autosaveMin ?? 2) ? (p.autosaveMin as number) : 2,
    };
    if (p.canvasQuality === "draft" || p.canvasQuality === "best") out.canvasQuality = p.canvasQuality;
    else out.canvasQuality = "balanced";
    if (typeof p.brushSmoothing === "number") out.brushSmoothing = Math.max(0, Math.min(100, Math.round(p.brushSmoothing)));
    if (typeof p.defaultBrushSize === "number") out.defaultBrushSize = Math.max(1, Math.min(300, Math.round(p.defaultBrushSize)));
    if (typeof p.defaultHardness === "number") out.defaultHardness = Math.max(0, Math.min(100, Math.round(p.defaultHardness)));
    if (typeof p.showRulersOnStart === "boolean") out.showRulersOnStart = p.showRulersOnStart;
    if (typeof p.showGridOnStart === "boolean") out.showGridOnStart = p.showGridOnStart;
    if (typeof p.snapOnStart === "boolean") out.snapOnStart = p.snapOnStart;
    if (p.themeMode === "light" || p.themeMode === "dark") out.themeMode = p.themeMode;
    if (typeof p.autoFitOnOpen === "boolean") out.autoFitOnOpen = p.autoFitOnOpen;
    if (typeof p.confirmDestructive === "boolean") out.confirmDestructive = p.confirmDestructive;
    if (typeof p.maxZoom === "number") out.maxZoom = [400, 800, 1600, 3200].includes(p.maxZoom) ? p.maxZoom : 800;
    return out;
  } catch {
    return {};
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  perfMode: "auto",
  device: "auto",
  tileSize: 512,
  historyCap: 15,
  animations: true,
  autosaveMin: 2,
  appliedAt: null,
  canvasQuality: "balanced",
  brushSmoothing: 35,
  defaultBrushSize: 24,
  defaultHardness: 80,
  showRulersOnStart: true,
  showGridOnStart: false,
  snapOnStart: true,
  themeMode: "dark",
  autoFitOnOpen: true,
  confirmDestructive: true,
  maxZoom: 800,
  ...load(),
  set: (p) => {
    set(p);
    try {
      const s = useSettingsStore.getState();
      localStorage.setItem(
        KEY,
        JSON.stringify({
          perfMode: s.perfMode,
          device: s.device,
          tileSize: s.tileSize,
          historyCap: s.historyCap,
          animations: s.animations,
          autosaveMin: s.autosaveMin,
          canvasQuality: s.canvasQuality,
          brushSmoothing: s.brushSmoothing,
          defaultBrushSize: s.defaultBrushSize,
          defaultHardness: s.defaultHardness,
          showRulersOnStart: s.showRulersOnStart,
          showGridOnStart: s.showGridOnStart,
          snapOnStart: s.snapOnStart,
          themeMode: s.themeMode,
          autoFitOnOpen: s.autoFitOnOpen,
          confirmDestructive: s.confirmDestructive,
          maxZoom: s.maxZoom,
        }),
      );
    } catch {
      /* ignore quota */
    }
    // live-apply view defaults that other stores own.
    // NOTE: dynamic imports here are intentional cycle-breakers. useEditorStore
    // statically imports this module (effectiveHistoryCap), so static imports
    // back would create a module cycle. Called only on settings apply, never hot.
    try {
      const v = p as Partial<SettingsState>;
      if (typeof v.showRulersOnStart === "boolean") {
        import("./useEditorStore").then(({ useEditorStore }) => {
          const cur = useEditorStore.getState().showRulers;
          if (cur !== v.showRulersOnStart) useEditorStore.getState().toggleRulers();
        });
      }
      if (typeof v.showGridOnStart === "boolean" || typeof v.snapOnStart === "boolean") {
        import("./useProStore").then(({ useProStore }) => {
          const pro = useProStore.getState();
          if (typeof v.showGridOnStart === "boolean" && pro.showGrid !== v.showGridOnStart) pro.toggleGrid();
          if (typeof v.snapOnStart === "boolean" && pro.snapEnabled !== v.snapOnStart) pro.toggleSnap();
        });
      }
      if (typeof v.defaultBrushSize === "number" || typeof v.defaultHardness === "number") {
        import("./useEditorStore").then(({ useEditorStore }) => {
          useEditorStore.getState().setBrush({
            size: v.defaultBrushSize,
            hardness: v.defaultHardness,
          });
        });
      }
    } catch {
      /* ignore live apply */
    }
  },
  resetAll: () => {
    const fresh: Partial<SettingsState> = {
      perfMode: "auto",
      device: "auto",
      tileSize: 512,
      historyCap: 15,
      animations: true,
      autosaveMin: 2,
      appliedAt: null,
      canvasQuality: "balanced",
      brushSmoothing: 35,
      defaultBrushSize: 24,
      defaultHardness: 80,
      showRulersOnStart: true,
      showGridOnStart: false,
      snapOnStart: true,
      themeMode: "dark",
      autoFitOnOpen: true,
      confirmDestructive: true,
      maxZoom: 800,
    };
    useSettingsStore.getState().set(fresh);
  },
  applyRecommendation: (r) =>
    useSettingsStore.getState().set({
      tileSize: r.tile === 256 || r.tile === 1024 ? (r.tile as 256 | 1024) : 512,
      historyCap: Math.min(30, Math.max(4, r.history_cap)),
      appliedAt: Date.now(),
    }),
}));

/** Effective tile size after performance mode overrides. */
export function effectiveTile(): 256 | 512 | 1024 {
  const s = useSettingsStore.getState();
  if (s.perfMode === "eco") return 256;
  if (s.perfMode === "max") return 1024;
  return s.tileSize;
}

/** Effective history cap: user setting bounded by document size guard. */
export function effectiveHistoryCap(snapshotPixels: number): number {
  const user = useSettingsStore.getState().historyCap;
  const docCap = snapshotPixels > 8_000_000 ? 8 : 30;
  const mode = useSettingsStore.getState().perfMode;
  const modeCap = mode === "eco" ? 4 : mode === "balanced" ? 8 : 30;
  return Math.max(2, Math.min(user, docCap, modeCap));
}

/** Light pipeline threshold multiplier. Eco and CPU go light sooner, max and GPU later. */
export function lightThresholdScale(): number {
  const s = useSettingsStore.getState();
  if (s.perfMode === "eco" || s.device === "cpu") return 0.5;
  if (s.perfMode === "max" || s.device === "gpu") return 2;
  return 1;
}
