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
  // Jalur A: threshold lebih agresif agar tidak sampai 4GB.
  // Critical >600MB total atau >32MB/layer, light >250MB atau >16MB/layer.
  if (totalMB > 600 || perLayer > 32) { rec = "critical"; msg = "Dokumen sangat besar. Pakai mode ringan per ubin."; }
  else if (totalMB > 250 || perLayer > 16) { rec = "light"; msg = "Disarankan Light filter untuk hemat RAM."; }
  const s: MemorySnapshot = { heapMB, canvasMB, layersMB: canvasMB, totalMB, lightSavingMB, recommendation: rec, message: msg };
  last = s;
  return s;
}

export function getLastSnapshot(): MemorySnapshot | null { return last; }

export function shouldUseLight(w: number, h: number): boolean {
  const per = (w * h * 4) / 1024 / 1024;
  // Jalur A: turunkan dari 32MB -> 16MB, dan dari 4096² -> 2048² (16MP).
  // 1920x1080 ~8MB tetap full (cepat), 4K ~33MB otomatis light (hemat).
  return per > 16 || w * h > 2048 * 2048;
}

export function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}
