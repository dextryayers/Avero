import { invoke } from "@tauri-apps/api/core";

// --- 23 operasi penyesuaian ---
export type NativeOp =
  | { op: "gray" }
  | { op: "invert" }
  | { op: "brightness"; amount: number }
  | { op: "contrast"; amount: number }
  | { op: "threshold"; level: number }
  | { op: "desaturate"; amount: number }
  | { op: "exposure"; ev: number }
  | { op: "gamma"; gamma: number }
  | { op: "vibrance"; amount: number }
  | { op: "warmth"; warmth: number }
  | { op: "posterize"; levels: number }
  | { op: "sepia"; amount: number }
  | { op: "colorBalance"; cr: number; mg: number; yb: number }
  | { op: "shadowsHighlights"; shadows: number; highlights: number }
  | { op: "hueShift"; hueDeg: number }
  | { op: "autoLevels" }
  | { op: "autoContrast" }
  | { op: "opacity"; opacity: number }
  | { op: "equalize" }
  | { op: "dither"; width: number; height: number }
  | { op: "noiseMono"; amount: number; seed?: number }
  | { op: "channelSwap"; mode: number }
  | { op: "alphaPremultiply" };

// --- 20 filter studio ---
export type NativeFilterOp =
  | { op: "boxBlur"; radius: number }
  | { op: "sharpen"; amount: number }
  | { op: "unsharp"; amount: number; radius: number }
  | { op: "emboss" }
  | { op: "motionBlur"; radius: number; angle: number }
  | { op: "gaussian"; sigma: number }
  | { op: "median"; radius: number }
  | { op: "sobel" }
  | { op: "vignette"; amount: number }
  | { op: "chroma"; amount: number }
  | { op: "grain"; amount: number; seed?: number }
  | { op: "halftone"; size: number }
  | { op: "tiltShift"; blur: number; focusY: number; focusH: number }
  | { op: "oilPaint"; radius: number; intensity: number }
  | { op: "findEdges" }
  | { op: "pixelate"; size: number }
  | { op: "boxBlurLight"; radius: number }
  | { op: "gaussianLight"; sigma: number }
  | { op: "bilateralLight"; radius: number; sigmaColor: number }
  | { op: "unsharpLight"; amount: number; radius: number }
  | { op: "minimize"; radius: number }
  | { op: "maximize"; radius: number }
  | { op: "swirl"; radius: number; strength: number };

export interface NativeInfo {
  c_engine: string;
  c_version: string;
  cpp_engine: string;
  cpp_version: string;
  rust_version: string;
  languages: string[];
  features: string[];
  ready: boolean;
}

export interface NativeHistogram {
  r: number[]; g: number[]; b: number[]; lum: number[];
  width: number; height: number; total: number;
}

export interface NativeStats {
  mean_r: number; mean_g: number; mean_b: number;
  std_r: number; std_g: number; std_b: number;
  min_r: number; max_r: number; min_g: number; max_g: number; min_b: number; max_b: number;
  pixels: number;
}

export interface BenchmarkResult { ops: string; pixels: number; millis: number; mpix_per_sec: number; }

export interface MemoryBudget {
  width: number; height: number; layers: number;
  bytes_per_layer: number; total_bytes: number; total_mb: number;
  light_saving_mb: number; light_total_mb: number; recommendation: string;
}

export function isTauri(): boolean {
  try { return typeof window !== "undefined" && "__TAURI__" in window; } catch { return false; }
}

export async function nativeInfo(): Promise<NativeInfo> { return invoke<NativeInfo>("cmd_native_info"); }
export async function nativeHistogram(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Promise<NativeHistogram> {
  return invoke<NativeHistogram>("cmd_native_histogram", { rgba: Array.from(rgba), width, height });
}
export async function nativeStats(rgba: Uint8ClampedArray | Uint8Array): Promise<NativeStats> {
  return invoke<NativeStats>("cmd_native_stats", { rgba: Array.from(rgba) });
}
export async function nativeBenchmark(width: number, height: number, iterations?: number): Promise<BenchmarkResult> {
  return invoke<BenchmarkResult>("cmd_native_benchmark", { width, height, iterations });
}
export async function nativeMemoryBudget(width: number, height: number, layers: number): Promise<MemoryBudget> {
  return invoke<MemoryBudget>("cmd_native_memory_budget", { width, height, layers });
}
export async function nativePipeline(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, ops: NativeOp[], filters: NativeFilterOp[]): Promise<Uint8ClampedArray> {
  const out = await invoke<number[] | Uint8Array>("cmd_native_pipeline", { req: { rgba: Array.from(rgba), width, height, ops, filters } });
  const arr = out instanceof Uint8Array ? out : Uint8Array.from(out as number[]);
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.length);
}
export async function nativePipelineLight(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, ops: NativeOp[], filters: NativeFilterOp[]): Promise<Uint8ClampedArray> {
  const out = await invoke<number[] | Uint8Array>("cmd_native_pipeline_light", { req: { rgba: Array.from(rgba), width, height, ops, filters } });
  const arr = out instanceof Uint8Array ? out : Uint8Array.from(out as number[]);
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.length);
}

function clampSize(len: number): boolean { return len > 0 && len % 4 === 0; }

export async function nativeApplyOp(rgba: Uint8ClampedArray | Uint8Array, op: NativeOp): Promise<Uint8ClampedArray> {
  if (!isTauri() || !clampSize(rgba.length)) throw new Error("Pemrosesan tidak tersedia atau buffer tidak valid");
  const out = await invoke<number[] | Uint8Array>("cmd_native_apply_op", { rgba: Array.from(rgba), op });
  const arr = out instanceof Uint8Array ? out : Uint8Array.from(out as number[]);
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.length);
}
export async function nativeApplyFilter(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, op: NativeFilterOp): Promise<Uint8ClampedArray> {
  const need = width * height * 4;
  if (!isTauri() || rgba.length !== need) throw new Error("Filter tidak tersedia atau dimensi tidak cocok");
  const out = await invoke<number[] | Uint8Array>("cmd_native_apply_filter", { rgba: Array.from(rgba), width, height, op });
  const arr = out instanceof Uint8Array ? out : Uint8Array.from(out as number[]);
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.length);
}

export async function nativeProcessCanvas(canvas: HTMLCanvasElement, kind: "op", op: NativeOp): Promise<void>;
export async function nativeProcessCanvas(canvas: HTMLCanvasElement, kind: "filter", op: NativeFilterOp): Promise<void>;
export async function nativeProcessCanvas(canvas: HTMLCanvasElement, kind: "op" | "filter", op: NativeOp | NativeFilterOp): Promise<void> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2d gagal");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let out: Uint8ClampedArray;
  if (kind === "op") out = await nativeApplyOp(id.data, op as NativeOp);
  else out = await nativeApplyFilter(id.data, canvas.width, canvas.height, op as NativeFilterOp);
  ctx.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
}
export async function nativePipelineCanvas(canvas: HTMLCanvasElement, ops: NativeOp[], filters: NativeFilterOp[], light = false): Promise<void> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2d gagal");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = light
    ? await nativePipelineLight(id.data, canvas.width, canvas.height, ops, filters)
    : await nativePipeline(id.data, canvas.width, canvas.height, ops, filters);
  ctx.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
}
