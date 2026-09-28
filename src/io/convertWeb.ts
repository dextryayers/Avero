import { computeTargetSize, type ResizeInput } from "./convert";

// Browser-native converter engine for web preview mode (no Tauri backend).
// Covers PNG/JPG/WebP through Canvas2D with high-quality smoothing.
// Desktop mode keeps using the Rust engine with all 7 formats.

export type WebFormat = "png" | "jpg" | "webp";
export const WEB_FORMATS: WebFormat[] = ["png", "jpg", "webp"];

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
