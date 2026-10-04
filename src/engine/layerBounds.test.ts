import { describe, expect, it } from "vitest";
import {
  anchorForHandle,
  applyLayerTransform,
  inverseLayerTransform,
  pickBoxAt,
  pickTopLayerAt,
  resizeAboutAnchor,
  resizeScales,
  rotateAboutContentCenter,
  transformedBox,
} from "./layerBounds";

describe("layerBounds transform math", () => {
  it("identity transform maps points to themselves", () => {
    const t = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    expect(applyLayerTransform(100, 60, 800, 600, t)).toEqual({ x: 100, y: 60 });
  });

  it("translation shifts around doc center", () => {
    const t = { x: 10, y: -20, scaleX: 1, scaleY: 1, rotation: 0 };
    const p = applyLayerTransform(400, 300, 800, 600, t);
    expect(Math.round(p.x)).toBe(410);
    expect(Math.round(p.y)).toBe(280);
  });

  it("inverse undoes forward", () => {
    const t = { x: 15, y: 25, scaleX: 1.5, scaleY: 0.5, rotation: 30 };
    const fwd = applyLayerTransform(500, 350, 800, 600, t);
    const back = inverseLayerTransform(fwd.x, fwd.y, 800, 600, t);
    expect(back.x).toBeCloseTo(500, 5);
    expect(back.y).toBeCloseTo(350, 5);
  });

  it("transformedBox scales size and keeps rotation", () => {
    const box = transformedBox({ x: 300, y: 200, w: 200, h: 100 }, 800, 600, {
      x: 0,
      y: 0,
      scaleX: 2,
      scaleY: 0.5,
      rotation: 45,
    });
    expect(box.w).toBeCloseTo(400, 5);
    expect(box.h).toBeCloseTo(50, 5);
    expect(box.rotation).toBe(45);
  });

  it("picks topmost box containing the point", () => {
    const layers = [
      {
        id: "bottom",
        visible: true,
        canvas: undefined,
        bounds: { x: 0, y: 0, w: 800, h: 600 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      },
      {
        id: "top",
        visible: true,
        canvas: undefined,
        bounds: { x: 100, y: 100, w: 50, h: 50 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      },
    ];
    // topmost-first order
    const ordered = [...layers].reverse();
    expect(pickBoxAt(110, 110, 800, 600, ordered)).toBe("top");
    expect(pickBoxAt(10, 10, 800, 600, ordered)).toBe("bottom");
    // alpha path with no canvas falls back to null (needs pixels)
    expect(pickTopLayerAt(110, 110, 800, 600, ordered)).toBeNull();
  });

  it("corner drag never mirrors a positive scale", () => {
    const a = resizeScales(200, 100, 1, 1, "se", 150, 75, false);
    expect(a.scaleX).toBeGreaterThan(0);
    expect(a.scaleY).toBeGreaterThan(0);
    // Dragging across the center shrinks toward the minimum instead of flipping.
    const b = resizeScales(200, 100, 1, 1, "nw", -1, -1, false);
    expect(b.scaleX).toBeGreaterThan(0);
    expect(b.scaleY).toBeGreaterThan(0);
    expect(b.scaleX).toBeCloseTo(0.02, 5);
  });

  it("edge drag keeps the untouched axis stable", () => {
    const e = resizeScales(200, 100, 1, 2, "e", 120, 999, false);
    expect(e.scaleX).toBeGreaterThan(0);
    expect(e.scaleY).toBe(2);
    const n = resizeScales(200, 100, 1, 1, "n", 999, 60, false);
    expect(n.scaleX).toBe(1);
    expect(n.scaleY).toBeGreaterThan(0);
  });

  it("locked aspect keeps x and y equal without mirroring", () => {
    const u = resizeScales(200, 100, 1, 1, "se", 150, 10, true);
    expect(u.scaleX).toBeGreaterThan(0);
    expect(u.scaleX).toBeCloseTo(u.scaleY, 5);
  });

  it("anchors sit on opposite corners and edges", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    expect(anchorForHandle(c, "se")).toEqual({ x: 100, y: 50 });
    expect(anchorForHandle(c, "nw")).toEqual({ x: 300, y: 150 });
    expect(anchorForHandle(c, "e")).toEqual({ x: 100, y: 100 });
    expect(anchorForHandle(c, "n")).toEqual({ x: 200, y: 150 });
  });

  it("se drag sizes each axis from the pointer with the opposite corner fixed", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    const start = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const fixed = applyLayerTransform(100, 50, 800, 600, start);
    const next = resizeAboutAnchor(c, 800, 600, start, "se", { x: 500, y: 200 }, false);
    expect(next.scaleX).toBeCloseTo(2, 5);
    expect(next.scaleY).toBeCloseTo(1.5, 5);
    const held = applyLayerTransform(100, 50, 800, 600, { ...start, ...next });
    expect(held.x).toBeCloseTo(fixed.x, 5);
    expect(held.y).toBeCloseTo(fixed.y, 5);
  });

  it("locked aspect corners stay uniform with the anchor fixed", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    const start = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const fixed = applyLayerTransform(100, 50, 800, 600, start);
    const next = resizeAboutAnchor(c, 800, 600, start, "se", { x: 500, y: 200 }, true);
    expect(next.scaleX).toBeCloseTo(2, 5);
    expect(next.scaleY).toBeCloseTo(2, 5);
    const held = applyLayerTransform(100, 50, 800, 600, { ...start, ...next });
    expect(held.x).toBeCloseTo(fixed.x, 5);
    expect(held.y).toBeCloseTo(fixed.y, 5);
  });

  it("edge drag changes one axis and holds the opposite edge", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    const start = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const fixed = applyLayerTransform(100, 100, 800, 600, start);
    const next = resizeAboutAnchor(c, 800, 600, start, "e", { x: 400, y: 100 }, false);
    expect(next.scaleX).toBeCloseTo(1.5, 5);
    expect(next.scaleY).toBe(1);
    const held = applyLayerTransform(100, 100, 800, 600, { ...start, ...next });
    expect(held.x).toBeCloseTo(fixed.x, 5);
    expect(held.y).toBeCloseTo(fixed.y, 5);
  });

  it("anchor drag never mirrors, even across the anchor", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    const start = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const tiny = resizeAboutAnchor(c, 800, 600, start, "se", { x: 100, y: 50 }, false);
    expect(tiny.scaleX).toBeGreaterThan(0);
    expect(tiny.scaleY).toBeGreaterThan(0);
    const held = applyLayerTransform(100, 50, 800, 600, { ...start, ...tiny });
    expect(held.x).toBeCloseTo(100, 5);
    expect(held.y).toBeCloseTo(50, 5);
  });

  it("anchor holds under 45 deg rotation", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    const start = { x: 10, y: -20, scaleX: 1, scaleY: 1, rotation: 45 };
    const fixed = applyLayerTransform(100, 50, 800, 600, start);
    const moved = applyLayerTransform(300, 150, 800, 600, start);
    const next = resizeAboutAnchor(c, 800, 600, start, "se", { x: moved.x + 10, y: moved.y + 70 }, false);
    expect(next.scaleX).toBeGreaterThan(1);
    expect(next.scaleY).toBeGreaterThan(1);
    const held = applyLayerTransform(100, 50, 800, 600, { ...start, ...next });
    expect(held.x).toBeCloseTo(fixed.x, 4);
    expect(held.y).toBeCloseTo(fixed.y, 4);
  });

  it("rotation keeps the content center pixel fixed", () => {
    const c = { x: 100, y: 50, w: 200, h: 100 };
    const start = { x: 30, y: -40, scaleX: 1.5, scaleY: 0.75, rotation: 10 };
    const before = applyLayerTransform(200, 100, 800, 600, start);
    const next = rotateAboutContentCenter(c, 800, 600, start, 75);
    expect(next.rotation).toBe(75);
    const after = applyLayerTransform(200, 100, 800, 600, { ...start, ...next });
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });
});
