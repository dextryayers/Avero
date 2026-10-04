// WGSL parity harness primitives (plan6 Phase 7): CPU side contracts that
// every future GPU kernel must satisfy before it ships. Operates on raw
// RGBA8 buffers, so tests run in plain vitest with zero GPU, canvas or DOM
// dependency. Tile split and join must round trip exactly; kernel outputs
// must stay within a documented diff of the CPU reference.

export interface RgbaTile {
  /** Tile origin in full frame pixels. */
  x: number;
  /** Tile origin in full frame pixels. */
  y: number;
  /** Clamped tile width in pixels. */
  w: number;
  /** Clamped tile height in pixels. */
  h: number;
  /** Row major RGBA8 bytes, length w * h * 4. */
  data: Uint8ClampedArray;
}

/** Split a full frame into row major tiles, edges clamped to the frame. */
export function splitTiles(data: Uint8ClampedArray, width: number, height: number, tile: number): RgbaTile[] {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const t = Math.max(1, Math.floor(tile));
  if (w === 0 || h === 0) return [];
  const out: RgbaTile[] = [];
  for (let y = 0; y < h; y += t) {
    for (let x = 0; x < w; x += t) {
      const tw = Math.min(t, w - x);
      const th = Math.min(t, h - y);
      const buf = new Uint8ClampedArray(tw * th * 4);
      for (let row = 0; row < th; row++) {
        const src = ((y + row) * w + x) * 4;
        buf.set(data.subarray(src, src + tw * 4), row * tw * 4);
      }
      out.push({ x, y, w: tw, h: th, data: buf });
    }
  }
  return out;
}

/** Reassemble tiles into a full frame. Tiles must come from one split. */
export function joinTiles(tiles: RgbaTile[], width: number, height: number): Uint8ClampedArray {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const out = new Uint8ClampedArray(w * h * 4);
  for (const t of tiles) {
    for (let row = 0; row < t.h; row++) {
      const dst = ((t.y + row) * w + t.x) * 4;
      out.set(t.data.subarray(row * t.w * 4, (row + 1) * t.w * 4), dst);
    }
  }
  return out;
}

/** Largest absolute per channel difference. Equal buffers score 0. */
export function maxAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) throw new Error(`maxAbsDiff: length mismatch ${a.length} vs ${b.length}.`);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

/** Mean absolute per channel difference. Equal buffers score 0. */
export function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) throw new Error(`meanAbsDiff: length mismatch ${a.length} vs ${b.length}.`);
  if (a.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
