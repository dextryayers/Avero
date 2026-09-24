/** Tiled renderer: pecah kanvas besar jadi tile 512 untuk hemat RAM. Fallback ke pipeline penuh jika kecil. */
import { nativePipelineLight, nativePipeline } from "../io/nativeEngine";
import type { NativeOp, NativeFilterOp } from "../io/nativeEngine";
import { shouldUseLight } from "../io/memoryManager";

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
  const tile = Math.max(256, Math.min(1024, opts.tile ?? 512));
  const light = opts.light ?? shouldUseLight(canvas.width, canvas.height);
  const t0 = performance.now();
  if (!light && canvas.width * canvas.height < 2048 * 2048) {
    const fn = light ? nativePipelineLight : nativePipeline;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = await fn(id.data, canvas.width, canvas.height, ops, filters);
    ctx.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
    return { light, tiles: 1, ms: Math.round(performance.now() - t0) };
  }
  // tiled path: potong kanvas jadi tile, proses per tile via light pipeline
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
    const c = document.createElement("canvas");
    c.width = tw; c.height = th;
    c.getContext("2d")!.putImageData(id, 0, 0);
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
