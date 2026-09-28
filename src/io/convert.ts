import { invoke } from "@tauri-apps/api/core";

// Pure helpers for the Converter page. Covered by convert.test.ts.

export const INPUT_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tiff",
  "tif",
  "gif",
  "tga",
  "ico",
  "pnm",
  "pbm",
  "pgm",
  "ppm",
  "pam",
  "qoi",
  "psd",
  "dds",
  "exr",
  "hdr",
  "rgbe",
  "ff",
];

export const OUTPUT_FORMATS = [
  "png",
  "jpg",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "tga",
  "ico",
  "pnm",
  "qoi",
  "hdr",
  "ff",
  "exr",
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Format cards for the settings panel: badge + one-line pro guidance. */
export const FORMAT_CARDS: { id: OutputFormat; badge: "LOSSLESS" | "LOSSY"; note: string; desktopOnly: boolean }[] = [
  { id: "png", badge: "LOSSLESS", note: "Graphics and transparency kept", desktopOnly: false },
  { id: "jpg", badge: "LOSSY", note: "Photos, adjustable quality", desktopOnly: false },
  { id: "webp", badge: "LOSSLESS", note: "Modern and compact", desktopOnly: false },
  { id: "gif", badge: "LOSSY", note: "256 colors, universal support", desktopOnly: true },
  { id: "bmp", badge: "LOSSLESS", note: "Uncompressed, very large", desktopOnly: true },
  { id: "tiff", badge: "LOSSLESS", note: "Print and archive", desktopOnly: true },
  { id: "tga", badge: "LOSSLESS", note: "Game and video assets", desktopOnly: true },
  { id: "ico", badge: "LOSSLESS", note: "App icons, auto-sized to 256px", desktopOnly: true },
  { id: "pnm", badge: "LOSSLESS", note: "Simple portable bitmaps", desktopOnly: true },
  { id: "qoi", badge: "LOSSLESS", note: "Fast, simple format", desktopOnly: true },
  { id: "hdr", badge: "LOSSLESS", note: "Radiance HDR float map", desktopOnly: true },
  { id: "ff", badge: "LOSSLESS", note: "Farbfeld 16-bit lossless", desktopOnly: true },
  { id: "exr", badge: "LOSSLESS", note: "OpenEXR film VFX", desktopOnly: true },
];

export const RESIZE_FILTERS = ["lanczos", "catmull", "triangle", "gaussian", "nearest"] as const;

export const EDGE_PRESETS = [640, 1280, 1920, 2560, 3840, 7680] as const;

export function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  if (i < 0) return "";
  return path.slice(i + 1).toLowerCase();
}

export function baseOf(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

export function isInputSupported(path: string): boolean {
  return INPUT_EXTS.includes(extOf(path));
}

/** Opaque outputs (jpg/bmp) flatten transparency onto a matte color. */
export function needsMatte(fmt: string): boolean {
  return fmt === "jpg" || fmt === "bmp";
}

/** Quality slider only affects JPEG (WebP output is lossless). */
export function usesQuality(fmt: string): boolean {
  return fmt === "jpg";
}

export interface NameOptions {
  prefix?: string;
  suffix?: string;
  overwrite?: "overwrite" | "skip" | "rename";
}

/** Build the output file path for one job. */
export function buildOutputPath(
  inputPath: string,
  outDir: string | null,
  target: string,
  opt: NameOptions = {},
): string {
  const ref = outDir && outDir.length > 0 ? outDir : inputPath;
  const sep = ref.includes("\\") && !ref.includes("/") ? "\\" : "/";
  const dir = outDir && outDir.length > 0 ? outDir : parentOf(inputPath);
  const stem = `${opt.prefix ?? ""}${baseOf(inputPath)}${opt.suffix ?? ""}`;
  const file = `${stem}.${target.toLowerCase()}`;
  if (!dir) return file;
  const clean = dir.endsWith("/") || dir.endsWith("\\") ? dir.slice(0, -1) : dir;
  return `${clean}${sep}${file}`;
}

export function parentOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : "";
}

/** Default suffix avoids clobbering the source when the format is unchanged. */
export function defaultSuffix(inputPath: string, target: string): string {
  return extOf(inputPath) === target.toLowerCase() ? "-converted" : "";
}

/** Group items by a derived key (used to run one backend batch per target format). */
export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = groups.get(k);
    if (arr) arr.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/** Effective target clamped to the formats available in this runtime. */
export function effTargetOf(target: string, available: readonly string[]): string {
  return available.includes(target) ? target : "png";
}

export function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export interface ResizeInput {
  mode: string;
  long_edge?: number;
  width?: number;
  height?: number;
  fit?: string;
  percent?: number;
  preset?: number;
}

/** Build a ResizeInput from converter settings (single source of truth for previews). */
export function resizeInputFromSettings(s: {
  resizeMode: string;
  longEdge: number;
  exactW: string;
  exactH: string;
  fit: string;
  percent: string;
  preset: number;
}): ResizeInput {
  return {
    mode: s.resizeMode,
    long_edge: Math.max(16, Math.min(16384, Math.round(s.longEdge) || 1920)),
    width: Math.max(1, Math.min(16384, parseInt(s.exactW) || 1920)),
    height: Math.max(1, Math.min(16384, parseInt(s.exactH) || 1080)),
    fit: s.fit,
    percent: Math.max(1, Math.min(800, parseFloat(s.percent) || 100)),
    preset: s.preset,
  };
}

/** Mirror of the Rust target_size math so the web engine and UI agree. */
export function computeTargetSize(
  srcW: number,
  srcH: number,
  spec: ResizeInput,
  noEnlarge: boolean,
): { w: number; h: number } {
  const sw = Math.max(1, Math.round(srcW));
  const sh = Math.max(1, Math.round(srcH));
  const clamp = (v: number) => Math.max(1, Math.min(16384, Math.round(v)));
  const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  let tw: number;
  let th: number;
  switch (spec.mode) {
    case "long-edge": {
      const edge = clampN(Math.round(spec.long_edge ?? 1920), 16, 16384);
      const s = edge / Math.max(sw, sh);
      tw = clamp(sw * s);
      th = clamp(sh * s);
      break;
    }
    case "exact": {
      const w = clampN(spec.width ?? sw, 1, 16384);
      const h = clampN(spec.height ?? sh, 1, 16384);
      if (spec.fit === "stretch") {
        tw = w;
        th = h;
      } else if (spec.fit === "fill") {
        const s = Math.max(w / sw, h / sh);
        tw = clamp(sw * s);
        th = clamp(sh * s);
      } else {
        const s = Math.min(w / sw, h / sh);
        tw = clamp(sw * s);
        th = clamp(sh * s);
      }
      break;
    }
    case "percent": {
      const p = clampN(spec.percent ?? 100, 1, 800) / 100;
      tw = clamp(sw * p);
      th = clamp(sh * p);
      break;
    }
    case "preset": {
      const edge = clampN(spec.preset ?? 1920, 16, 16384);
      const s = edge / Math.max(sw, sh);
      tw = clamp(sw * s);
      th = clamp(sh * s);
      break;
    }
    default:
      tw = sw;
      th = sh;
  }
  if (noEnlarge) {
    tw = Math.min(tw, sw);
    th = Math.min(th, sh);
  }
  return { w: Math.max(1, tw), h: Math.max(1, th) };
}

// ---------- backend calls ----------

export interface ProbeResult {
  width: number;
  height: number;
  format: string;
  file_size: number;
}

export interface ResizeSpec {
  mode: string;
  long_edge?: number;
  width?: number;
  height?: number;
  fit?: string;
  percent?: number;
  preset?: number;
}

export interface ConvertOptions {
  format: string;
  quality?: number;
  png_best?: boolean;
  matte?: [number, number, number];
  resize?: ResizeSpec;
  filter?: string;
  no_enlarge?: boolean;
}

export interface BatchProgress {
  batch_id: string;
  done: number;
  total: number;
  current: string;
  ok: boolean;
  error: string | null;
}

export interface BatchSummary {
  batch_id: string;
  ok: number;
  failed: number;
  errors: string[];
}

export async function probeImage(path: string): Promise<ProbeResult> {
  // Photoshop files rasterize through the Tauri image backend.
  if (extOf(path) === "psd") {
    const { rustImageInfo } = await import("./tauriIo");
    const info = await rustImageInfo(path);
    return { width: info.width, height: info.height, format: "psd", file_size: info.file_size };
  }
  return invoke<ProbeResult>("cmd_probe_image", { path });
}

export async function thumbFor(path: string): Promise<string | null> {
  try {
    const { rustDecodeToDataUrl } = await import("./tauriIo");
    return await rustDecodeToDataUrl(path, 256);
  } catch {
    return null;
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>("cmd_path_exists", { path });
  } catch {
    return false;
  }
}

export async function runBatch(
  batchId: string,
  jobs: { input: string; output: string }[],
  options: ConvertOptions,
): Promise<BatchSummary> {
  return invoke<BatchSummary>("cmd_convert_batch", {
    batchId,
    jobs,
    options,
  });
}

export async function cancelBatch(batchId: string): Promise<boolean> {
  try {
    return await invoke<boolean>("cmd_convert_cancel", { batchId });
  } catch {
    return false;
  }
}

export async function revealInFolder(path: string): Promise<void> {
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function browseImages(): Promise<string[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    multiple: true,
    title: "Add images to convert",
    filters: [{ name: "Images", extensions: [...INPUT_EXTS] }],
  });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

export async function pickOutputFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({
    multiple: false,
    directory: true,
    canCreateDirectories: true,
    title: "Choose the converted files folder",
  });
  return typeof dir === "string" ? dir : null;
}
