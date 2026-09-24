/** Memory manager: pantau heap JS + estimasi Rust, sarankan mode ringan. */

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
  let msg = "RAM aman untuk pipeline penuh.";
  if (totalMB > 900 || perLayer > 64) { rec = "critical"; msg = "Dokumen sangat besar. Pakai Light pipeline tiled 512."; }
  else if (totalMB > 500 || perLayer > 32) { rec = "light"; msg = "Disarankan Light filter untuk hemat RAM."; }
  const s: MemorySnapshot = { heapMB, canvasMB, layersMB: canvasMB, totalMB, lightSavingMB, recommendation: rec, message: msg };
  last = s;
  return s;
}

export function getLastSnapshot(): MemorySnapshot | null { return last; }

export function shouldUseLight(w: number, h: number): boolean {
  const per = (w * h * 4) / 1024 / 1024;
  return per > 32 || w * h > 4096 * 4096;
}

export function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}
