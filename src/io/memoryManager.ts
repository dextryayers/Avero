/** Memory manager: track JS heap plus Rust estimates, recommend light mode. */

export interface MemorySnapshot {
  heapMB: number | null;
  canvasMB: number;
  layersMB: number;
  totalMB: number;
  lightSavingMB: number;
  recommendation: "full" | "light" | "critical";
  message: string;
}

let last: MemorySnapshot | null = null;

export function estimateCanvasMB(w: number, h: number, layers: number): number {
  return (w * h * 4 * Math.max(1, layers)) / 1024 / 1024;
}

export function snapshotMemory(w: number, h: number, layers: number): MemorySnapshot {
  let heapMB: number | null = null;
  try {
    const perf: any = performance as any;
    if (perf.memory) heapMB = perf.memory.usedJSHeapSize / 1024 / 1024;
  } catch { heapMB = null; }
  const canvasMB = estimateCanvasMB(w, h, layers);
  const perLayer = (w * h * 4) / 1024 / 1024;
  // C++ full tmp = perLayer, light = ~0.06MB + tile (~1MB)
  const lightSavingMB = Math.max(0, perLayer - 1.1);
  const totalMB = canvasMB + (heapMB ?? 0);
  let rec: MemorySnapshot["recommendation"] = "full";
  let msg = "Memory is safe for the full pipeline.";
  if (totalMB > 600 || perLayer > 32) { rec = "critical"; msg = "Very large document. Use tiled light mode."; }
  else if (totalMB > 250 || perLayer > 16) { rec = "light"; msg = "Light filters recommended to save RAM."; }
  const s: MemorySnapshot = { heapMB, canvasMB, layersMB: canvasMB, totalMB, lightSavingMB, recommendation: rec, message: msg };
  last = s;
  return s;
}

export function getLastSnapshot(): MemorySnapshot | null { return last; }

export function shouldUseLight(w: number, h: number): boolean {
  const per = (w * h * 4) / 1024 / 1024;
  // 1920x1080 ~8MB stays full (fast), 4K ~33MB auto light (lean).
  return per > 16 || w * h > 2048 * 2048;
}

export interface SmartBudget {
  mode: "full" | "light" | "critical";
  tile: number;
  historyCap: number;
  totalMB: number;
}

export async function smartBudget(w: number, h: number, layers: number): Promise<SmartBudget> {
  const fallback: SmartBudget = (() => {
    const s = snapshotMemory(w, h, layers);
    return {
      mode: s.recommendation,
      tile: s.recommendation === "full" ? 0 : 512,
      historyCap: s.recommendation === "critical" ? 4 : s.recommendation === "light" ? 8 : 15,
      totalMB: s.totalMB,
    };
  })();
  try {
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      const { invoke } = await import("@tauri-apps/api/core");
      const b = await invoke<{ mode: string; tile: number; history_cap: number; total_mb: number }>(
        "cmd_ram_budget",
        { width: w, height: h, layers },
      );
      const mode = b.mode === "critical" || b.mode === "light" ? b.mode : "full";
      return { mode, tile: b.tile, historyCap: b.history_cap, totalMB: b.total_mb };
    }
  } catch {
    /* fall through to local estimate */
  }
  return fallback;
}

export async function exportPlan(
  w: number,
  h: number,
  scale: number,
): Promise<{ outW: number; outH: number; tiled: boolean; tile: number; estMB: number }> {
  try {
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      const { invoke } = await import("@tauri-apps/api/core");
      const p = await invoke<{ out_w: number; out_h: number; tiled: boolean; tile: number; est_mb: number }>(
        "cmd_export_plan",
        { width: w, height: h, scale },
      );
      return { outW: p.out_w, outH: p.out_h, tiled: p.tiled, tile: p.tile, estMB: p.est_mb };
    }
  } catch {
    /* fall through */
  }
  const s = Math.min(400, Math.max(10, Math.round(scale)));
  const outW = Math.max(1, Math.round((w * s) / 100));
  const outH = Math.max(1, Math.round((h * s) / 100));
  const tiled = outW * outH > 2048 * 2048;
  return { outW, outH, tiled, tile: tiled ? 512 : 0, estMB: (outW * outH * 4) / 1024 / 1024 };
}

export function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}
