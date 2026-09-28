import { describe, it, expect } from "vitest";
import { resolveEraserTarget, isPaintEraser, isPhotoEraser, type EraserLayerInfo } from "./strokeTarget";
import { ERASER_TOOLS } from "./toolPresets";

const L = (id: string, extra: Partial<EraserLayerInfo> = {}): EraserLayerInfo => ({
  id,
  visible: true,
  locked: false,
  ...extra,
});

describe("eraser targeting (plan2 Fase B: never touch BG/canvas photos)", () => {
  it("paints on a normal active layer directly", () => {
    expect(
      resolveEraserTarget({
        activeId: "a",
        layers: [L("a")],
        lastPaintId: null,
        isPhoto: () => false,
        hasCanvas: () => true,
      }),
    ).toBe("a");
  });

  it("retargets from a photo layer to the last painted stroke layer", () => {
    expect(
      resolveEraserTarget({
        activeId: "photo",
        layers: [L("photo"), L("paint1")],
        lastPaintId: "paint1",
        isPhoto: (id) => id === "photo",
        hasCanvas: () => true,
      }),
    ).toBe("paint1");
  });

  it("falls back to the topmost editable non-photo layer", () => {
    expect(
      resolveEraserTarget({
        activeId: "photo",
        layers: [L("photo"), L("paint-old"), L("paint-new")],
        lastPaintId: null,
        isPhoto: (id) => id === "photo",
        hasCanvas: () => true,
      }),
    ).toBe("paint-new");
  });

  it("never returns a photo layer, even via lastPaintId (stale ref hole)", () => {
    expect(
      resolveEraserTarget({
        activeId: "photo",
        layers: [L("photo")],
        lastPaintId: "photo",
        isPhoto: () => true,
        hasCanvas: () => true,
      }),
    ).toBeNull();
  });

  it("returns null when nothing is safely erasable", () => {
    expect(
      resolveEraserTarget({
        activeId: "photo",
        layers: [L("photo")],
        lastPaintId: null,
        isPhoto: (id) => id === "photo",
        hasCanvas: () => true,
      }),
    ).toBeNull();
  });

  it("returns null for locked, hidden or missing active layers", () => {
    const layers = [L("a", { locked: true }), L("b", { visible: false })];
    const base = {
      layers,
      lastPaintId: null,
      isPhoto: () => false,
      hasCanvas: () => true,
    };
    expect(resolveEraserTarget({ ...base, activeId: "a" })).toBeNull();
    expect(resolveEraserTarget({ ...base, activeId: "b" })).toBeNull();
    expect(resolveEraserTarget({ ...base, activeId: null })).toBeNull();
    expect(resolveEraserTarget({ ...base, activeId: "ghost" })).toBeNull();
  });

  it("skips stroke layers without a canvas", () => {
    expect(
      resolveEraserTarget({
        activeId: "photo",
        layers: [L("photo"), L("ghost-paint")],
        lastPaintId: "ghost-paint",
        isPhoto: (id) => id === "photo",
        hasCanvas: () => false,
      }),
    ).toBeNull();
  });

  it("classifies all six erasers, four paint-safe and two photo tools", () => {
    expect([...ERASER_TOOLS].sort()).toEqual(
      ["background-eraser", "eraser", "eraser-block", "eraser-hard", "eraser-soft", "magic-eraser"].sort(),
    );
    for (const t of ["eraser", "eraser-hard", "eraser-soft", "eraser-block"] as const) {
      expect(isPaintEraser(t)).toBe(true);
      expect(isPhotoEraser(t)).toBe(false);
    }
    for (const t of ["background-eraser", "magic-eraser"] as const) {
      expect(isPhotoEraser(t)).toBe(true);
      expect(isPaintEraser(t)).toBe(false);
    }
  });
});
