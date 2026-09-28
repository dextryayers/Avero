import { computeTargetSize, type ResizeInput } from "./convert";

// File System Access folder picker is outside the TS DOM lib, declare it once.
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}

// Browser-native converter engine for web preview mode (no Tauri backend).
// Covers PNG/JPG/WebP through Canvas2D with high-quality smoothing.
// Desktop mode keeps using the Rust engine with all 7 formats.

export type WebFormat = "png" | "jpg" | "webp";
export const WEB_FORMATS: WebFormat[] = ["png", "jpg", "webp"];

/** Canvas decoders cannot read Photoshop files, so PSD stays desktop-only. */
export const WEB_INPUT_EXTS = [
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

export function isWebInputSupported(name: string): boolean {
  const i = name.lastIndexOf(".");
  const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : "";
  return WEB_INPUT_EXTS.includes(ext);
}

/** True when the browser can write real files into a chosen local folder. */
export function supportsSaveFolder(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function pickSaveDirectory(): Promise<{ handle: FileSystemDirectoryHandle; name: string } | null> {
  const pick = window.showDirectoryPicker;
  if (typeof pick !== "function") return null;
  try {
    const handle = await pick.call(window, { mode: "readwrite" });
    return { handle, name: handle.name || "chosen folder" };
  } catch {
    return null; // dismissed or denied
  }
}

/**
 * Write a blob into a local folder handle.
 * Returns the final filename, or null when skipped by policy.
 */
export async function writeBlobToDir(
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
  overwrite: "overwrite" | "skip" | "rename",
): Promise<string | null> {
  const exists = async (name: string): Promise<boolean> => {
    try {
      await dir.getFileHandle(name, { create: false });
      return true;
    } catch {
      return false;
    }
  };
  let finalName = filename;
  if (await exists(finalName)) {
    if (overwrite === "skip") return null;
    if (overwrite === "rename") {
      const dot = filename.lastIndexOf(".");
      const base = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : "";
      let done = false;
      for (let n = 2; n <= 99; n++) {
        const c = `${base} - ${n}${ext}`;
        if (!(await exists(c))) {
          finalName = c;
          done = true;
          break;
        }
      }
      if (!done) finalName = `${base} - ${Date.now().toString(36)}${ext}`;
    }
  }
  try {
    const fh = await dir.getFileHandle(finalName, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return finalName;
  } catch (e) {
    throw new Error(`Could not write ${finalName}: ${String(e)}`);
  }
}

export interface WebConvertOptions {
  format: WebFormat;
  quality: number; // jpeg/webp 1-100
  matte: [number, number, number];
  resize: ResizeInput;
  noEnlarge: boolean;
}

export async function webProbe(file: File): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const out = { w: bmp.width, h: bmp.height };
  bmp.close();
  return out;
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable in this browser.");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  return [c, g];
}

export async function webConvertImage(
  file: File,
  opts: WebConvertOptions,
): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  try {
    const sw = bmp.width;
    const sh = bmp.height;
    if (sw < 1 || sh < 1) throw new Error("Image has no pixels.");
    const { w: tw, h: th } = computeTargetSize(sw, sh, opts.resize, opts.noEnlarge);
    const fill = opts.resize.mode === "exact" && (opts.resize.fit ?? "fit") === "fill";
    const boxW =
      fill ? Math.max(1, Math.min(16384, Math.round(opts.resize.width ?? tw))) : tw;
    const boxH =
      fill ? Math.max(1, Math.min(16384, Math.round(opts.resize.height ?? th))) : th;

    const [work, wctx] = canvasOf(tw, th);
    if (opts.format === "jpg") {
      wctx.fillStyle = `rgb(${opts.matte[0]},${opts.matte[1]},${opts.matte[2]})`;
      wctx.fillRect(0, 0, tw, th);
    }
    wctx.drawImage(bmp, 0, 0, tw, th);

    let src: HTMLCanvasElement = work;
    if (fill && (tw !== boxW || th !== boxH)) {
      const [out, octx] = canvasOf(boxW, boxH);
      if (opts.format === "jpg") {
        octx.fillStyle = `rgb(${opts.matte[0]},${opts.matte[1]},${opts.matte[2]})`;
        octx.fillRect(0, 0, boxW, boxH);
      }
      octx.drawImage(work, Math.round((boxW - tw) / 2), Math.round((boxH - th) / 2));
      src = out;
    }

    const mime = opts.format === "png" ? "image/png" : opts.format === "jpg" ? "image/jpeg" : "image/webp";
    const q = Math.max(1, Math.min(100, Math.round(opts.quality))) / 100;
    const blob = await new Promise<Blob | null>((res) =>
      src.toBlob(res, mime, mime === "image/png" ? undefined : q),
    );
    if (!blob) throw new Error(`Browser could not encode ${opts.format.toUpperCase()}.`);
    return { blob, w: src.width, h: src.height };
  } finally {
    bmp.close();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
