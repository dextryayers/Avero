import { describe, it, expect } from "vitest";
import { joinTiles, maxAbsDiff, meanAbsDiff, splitTiles } from "./tileParity";

function gradientFrame(w: number, h: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = (x * 255) / Math.max(1, w - 1);
      d[i + 1] = (y * 255) / Math.max(1, h - 1);
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  return d;
}

describe("tile parity harness (plan6 WGSL gate contracts)", () => {
  it("splits 100x70 into a 4 by 3 grid with clamped edges", () => {
    const tiles = splitTiles(gradientFrame(100, 70), 100, 70, 32);
    expect(tiles.length).toBe(12);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, w: 32, h: 32 });
    const last = tiles[tiles.length - 1];
    expect(last).toMatchObject({ x: 96, y: 64, w: 4, h: 6 });
    for (const t of tiles) expect(t.data.length).toBe(t.w * t.h * 4);
  });

  it("round trips exactly through split and join", () => {
    const src = gradientFrame(100, 70);
    const tiles = splitTiles(src, 100, 70, 32);
    expect(maxAbsDiff(joinTiles(tiles, 100, 70), src)).toBe(0);
  });

  it("handles empty frames without throwing", () => {
    expect(splitTiles(new Uint8ClampedArray(0), 0, 70, 32)).toEqual([]);
    expect(joinTiles([], 0, 0).length).toBe(0);
  });

  it("scores identical buffers at zero", () => {
    const a = gradientFrame(16, 16);
    const b = gradientFrame(16, 16);
    expect(maxAbsDiff(a, b)).toBe(0);
    expect(meanAbsDiff(a, b)).toBe(0);
  });

  it("scores a single channel nudge", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    const b = new Uint8ClampedArray([13, 20, 30, 255]);
    expect(maxAbsDiff(a, b)).toBe(3);
    expect(meanAbsDiff(a, b)).toBeCloseTo(0.75, 5);
  });

  it("rejects length mismatches loudly", () => {
    const a = new Uint8ClampedArray(4);
    const b = new Uint8ClampedArray(8);
    expect(() => maxAbsDiff(a, b)).toThrowError(/length mismatch/);
    expect(() => meanAbsDiff(a, b)).toThrowError(/length mismatch/);
  });
});
