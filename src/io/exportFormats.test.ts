import { describe, it, expect } from "vitest";
import {
  EXPORT_FORMATS,
  estimateBytes,
  formatBytes,
  formatMeta,
  needsMatteFor,
  usesQualityFor,
} from "./exportFormats";

describe("export formats catalog", () => {
  it("covers every Rust encoder plus canvas, svg and avx", () => {
    const ids = EXPORT_FORMATS.map((f) => f.id);
    for (const id of ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif", "tga", "qoi", "pnm", "hdr", "exr", "ff", "ico", "svg", "avx"]) {
      expect(ids).toContain(id);
    }
  });

  it("flags rust encoders honestly", () => {
    expect(formatMeta("png").rust).toBe(false);
    expect(formatMeta("webp").rust).toBe(false);
    expect(formatMeta("svg").rust).toBe(false);
    expect(formatMeta("tiff").rust).toBe(true);
    expect(formatMeta("exr").rust).toBe(true);
  });

  it("mirrors the Rust matte rule", () => {
    expect(needsMatteFor("jpg")).toBe(true);
    expect(needsMatteFor("jpeg")).toBe(true);
    expect(needsMatteFor("bmp")).toBe(true);
    expect(needsMatteFor("png")).toBe(false);
    expect(needsMatteFor("tiff")).toBe(false);
    expect(needsMatteFor("gif")).toBe(false);
  });

  it("offers quality only where it matters", () => {
    expect(usesQualityFor("jpg")).toBe(true);
    expect(usesQualityFor("webp")).toBe(true);
    expect(usesQualityFor("png")).toBe(false);
    expect(usesQualityFor("tiff")).toBe(false);
  });

  it("estimates sanely and formats bytes", () => {
    expect(estimateBytes("png", 100, 100, 90)).toBeGreaterThan(estimateBytes("jpg", 100, 100, 90));
    expect(estimateBytes("bmp", 100, 100, 90)).toBeGreaterThan(estimateBytes("png", 100, 100, 90));
    expect(formatBytes(512)).toBe("1 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("falls back to png for unknown ids", () => {
    expect(formatMeta("nope").id).toBe("png");
  });
});
