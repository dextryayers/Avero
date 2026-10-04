import { describe, it, expect } from "vitest";
import {
  BYTES_PER_MB,
  BYTES_PER_PIXEL,
  TILE_AREA_THRESHOLD,
  clampDpr,
  estimateDocMB,
  pickTileSize,
  shouldTile,
  tileGrid,
  tilePixels,
  tileRamMB,
} from "./renderBudget";

describe("render budget math (plan6 lightweight contracts)", () => {
  it("uses RGBA8 constants", () => {
    expect(BYTES_PER_PIXEL).toBe(4);
    expect(BYTES_PER_MB).toBe(1048576);
    expect(TILE_AREA_THRESHOLD).toBe(2048 * 2048);
  });

  it("tile 512 costs exactly 1 MB", () => {
    expect(tilePixels(512)).toBe(262144);
    expect(tileRamMB(512)).toBe(1);
    expect(tileRamMB(1024)).toBe(4);
    expect(tileRamMB(256)).toBe(0.25);
  });

  it("estimates document frames", () => {
    expect(estimateDocMB(1920, 1080)).toBeCloseTo(7.91, 1);
    expect(estimateDocMB(0, 1080)).toBe(0);
    expect(estimateDocMB(-4, 1080)).toBe(0);
  });

  it("tiles only above the threshold", () => {
    expect(shouldTile(2048, 2048)).toBe(false);
    expect(shouldTile(2049, 2048)).toBe(true);
    expect(shouldTile(810, 1080)).toBe(false);
    expect(shouldTile(6000, 4000)).toBe(true);
    expect(shouldTile(Number.NaN, 1080)).toBe(false);
  });

  it("covers frames with a tile grid", () => {
    expect(tileGrid(1024, 1024, 512)).toEqual({ cols: 2, rows: 2, count: 4 });
    expect(tileGrid(1000, 1000, 512)).toEqual({ cols: 2, rows: 2, count: 4 });
    expect(tileGrid(512, 512, 1024)).toEqual({ cols: 1, rows: 1, count: 1 });
  });

  it("clamps DPR into range with a safe fallback", () => {
    expect(clampDpr(3, 2)).toBe(2);
    expect(clampDpr(1, 2)).toBe(1);
    expect(clampDpr(1.5, 1.5)).toBe(1.5);
    expect(clampDpr(Number.NaN, 2)).toBe(1);
    expect(clampDpr(0, 2)).toBe(1);
    expect(clampDpr(2, 0)).toBe(1);
  });

  it("picks tile size from texture limits", () => {
    expect(pickTileSize(16384)).toBe(1024);
    expect(pickTileSize(8192)).toBe(1024);
    expect(pickTileSize(4096)).toBe(512);
    expect(pickTileSize(2048)).toBe(512);
    expect(pickTileSize(1024)).toBe(256);
    expect(pickTileSize(0)).toBe(256);
    expect(pickTileSize(Number.NaN)).toBe(256);
  });
});
