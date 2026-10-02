import { describe, it, expect } from "vitest";
import { layerManager } from "./layerManager";
import { normalizeAvxFile } from "../io/projectIo";

// Plan4 Fase 1.7: photo protection must survive save/load/drop/paste.
// The resolver semantics themselves are pinned in eraser.test.ts; these tests
// pin the flag plumbing that the resolver depends on.

describe("photo flag lifecycle (plan4 Fase 1.4)", () => {
  it("markPhoto arms protection, remove disarms it", () => {
    const id = `photo-lifecycle-${Date.now()}`;
    expect(layerManager.isPhotoLayer(id)).toBe(false);
    layerManager.markPhoto(id);
    expect(layerManager.isPhotoLayer(id)).toBe(true);
    layerManager.remove(id);
    expect(layerManager.isPhotoLayer(id)).toBe(false);
  });

  it("markPhoto is idempotent and independent per layer", () => {
    const a = `photo-a-${Date.now()}`;
    const b = `photo-b-${Date.now()}`;
    layerManager.markPhoto(a);
    layerManager.markPhoto(a);
    expect(layerManager.isPhotoLayer(a)).toBe(true);
    expect(layerManager.isPhotoLayer(b)).toBe(false);
    layerManager.remove(a);
  });
});

describe("avx photo flag round-trip (plan4 Fase 1.4)", () => {
  const baseFile = {
    magic: "AVX1",
    version: 1,
    doc: { name: "T", width: 10, height: 10 },
    layers: [
      { meta: { id: "p1", kind: "raster" }, pixels: null, maskPixels: null, photo: true },
      { meta: { id: "p2", kind: "raster" }, pixels: null, maskPixels: null, photo: false },
      { meta: { id: "p3", kind: "background" }, pixels: null, maskPixels: null },
    ],
  };

  it("normalizeAvxFile keeps photo:true and drops falsy flags", () => {
    const out = normalizeAvxFile(baseFile as never);
    expect(out.layers[0].photo).toBe(true);
    expect(out.layers[1].photo).toBeUndefined();
    expect(out.layers[2].photo).toBeUndefined();
  });

  it("background kind still survives normalization (paper stays paper)", () => {
    const out = normalizeAvxFile(baseFile as never);
    expect(out.layers[2].meta.kind).toBe("background");
  });
});
