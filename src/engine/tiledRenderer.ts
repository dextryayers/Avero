/** Tiled renderer: split large canvases into tiles to keep RAM flat. Falls back to full pipeline when small. */
import { nativePipelineLight, nativePipeline, nativePipelineTiled, isTauri } from "../io/nativeEngine";
import type { NativeOp, NativeFilterOp } from "../io/nativeEngine";
import { shouldUseLight } from "../io/memoryManager";
import { effectiveTile } from "../stores/useSettingsStore";

export interface TiledOptions {
  tile: number; // 256..1024
  light: boolean; // paksa light C++ tiled
}

export async function tiledPipelineCanvas(
  canvas: HTMLCanvasElement,
  ops: NativeOp[],
  filters: NativeFilterOp[],
  opts: Partial<TiledOptions> = {},
): Promise<{ light: boolean; tiles: number; ms: number }> {
  const tile = Math.max(256, Math.min(1024, opts.tile ?? (() => { try { return effectiveTile(); } catch { return 512; } })()));
  const light = opts.light ?? shouldUseLight(canvas.width, canvas.height);
  const t0 = performance.now();
  // Ultra path: single IPC to Rust tiled pipeline (rayon parallel, no per-tile
  // JS loop, no transient 4-8x heap duplication). Best for complex/extreme docs.
  if (isTauri() && canvas.width * canvas.height > 2048 * 2048) {
    try {
      const ctx0 = canvas.getContext("2d", { willReadFrequently: true })!;
      const id0 = ctx0.getImageData(0, 0, canvas.width, canvas.height);
      const out = await nativePipelineTiled(id0.data, canvas.width, canvas.height, ops, filters, tile);
      ctx0.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
      const cols = Math.ceil(canvas.width / tile);
      const rows = Math.ceil(canvas.height / tile);
      return { light: true, tiles: cols * rows, ms: Math.round(performance.now() - t0) };
    } catch {
      /* fall through to JS tiled loop */
    }
  }
  if (!light && canvas.width * canvas.height < 2048 * 2048) {
    const fn = light ? nativePipelineLight : nativePipeline;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = await fn(id.data, canvas.width, canvas.height, ops, filters);
    ctx.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
    return { light, tiles: 1, ms: Math.round(performance.now() - t0) };
  }
  // tiled path: potong kanvas jadi tile, proses per tile via light pipeline
  // Jalur A: hapus alloc canvas per-tile yang tidak terpakai (hemat GC),
  // kirim ImageData.data langsung ke native tanpa canvas temp.
  const w = canvas.width, h = canvas.height;
  const cols = Math.ceil(w / tile), rows = Math.ceil(h / tile);
  const src = document.createElement("canvas");
  src.width = w; src.height = h;
  src.getContext("2d")!.drawImage(canvas, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = w; dst.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const dctx = dst.getContext("2d")!;
  let tiles = 0;
  for (let ty = 0; ty < rows; ++ty) for (let tx = 0; tx < cols; ++tx) {
    const x = tx * tile, y = ty * tile;
    const tw = Math.min(tile, w - x), th = Math.min(tile, h - y);
    const id = sctx.getImageData(x, y, tw, th);
    const fn = light ? nativePipelineLight : nativePipeline;
    const out = await fn(id.data, tw, th, ops, filters);
    const nid = new ImageData(out, tw, th);
    dctx.putImageData(nid, x, y);
    tiles++;
    // yield agar UI tidak freeze
    if (tiles % 8 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(dst, 0, 0);
  return { light, tiles, ms: Math.round(performance.now() - t0) };
}

export function estimateTiles(w: number, h: number, tile = 512): number {
  return Math.ceil(w / tile) * Math.ceil(h / tile);
}
