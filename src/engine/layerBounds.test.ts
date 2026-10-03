import { describe, expect, it } from "vitest";
import {
  applyLayerTransform,
  inverseLayerTransform,
  pickBoxAt,
  pickTopLayerAt,
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
});
