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
];

export const OUTPUT_FORMATS = ["png", "jpg", "webp", "bmp", "tiff", "tga", "qoi"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

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

export function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
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
