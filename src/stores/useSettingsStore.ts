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
  set: (p: Partial<SettingsState>) => void;
  applyRecommendation: (r: { mode: string; device: string; tile: number; history_cap: number }) => void;
}

const KEY = "avero-settings-v1";

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<SettingsState>;
    return {
      perfMode: p.perfMode === "eco" || p.perfMode === "balanced" || p.perfMode === "max" ? p.perfMode : "auto",
      device: p.device === "cpu" || p.device === "gpu" ? p.device : "auto",
      tileSize: p.tileSize === 256 || p.tileSize === 1024 ? p.tileSize : 512,
      historyCap: typeof p.historyCap === "number" ? Math.min(30, Math.max(4, Math.round(p.historyCap))) : 15,
      animations: p.animations !== false,
      autosaveMin: [0, 1, 2, 5].includes(p.autosaveMin ?? 2) ? (p.autosaveMin as number) : 2,
    };
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
        }),
      );
    } catch {
      /* ignore quota */
    }
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
