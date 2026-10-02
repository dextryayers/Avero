import { describe, it, expect } from "vitest";
import { applyAdjustmentToImageData } from "./adjustments";

function img2x2(): ImageData {
  const d = new Uint8ClampedArray([
    100, 100, 100, 255, 200, 200, 200, 255, 50, 50, 50, 255, 255, 255, 255, 255,
  ]);
  return new ImageData(d, 2, 2);
}

describe("adjustments", () => {
  it("invert membalik channel", () => {
    const img = img2x2();
    applyAdjustmentToImageData(img, {
      id: "t",
      type: "invert",
      name: "Invert",
      enabled: true,
      opacity: 100,
      params: {},
    });
    expect(img.data[0]).toBe(155);
    expect(img.data[4]).toBe(55);
  });
  it("threshold produces binary output", () => {
    const img = img2x2();
    applyAdjustmentToImageData(img, {
      id: "t",
      type: "threshold",
      name: "T",
      enabled: true,
      opacity: 100,
      params: { level: 128 },
    });
    const vals = [img.data[0], img.data[4], img.data[8], img.data[12]];
    expect(vals.every((v) => v === 0 || v === 255)).toBe(true);
  });
  it("blackWhite honors channel weights (reds-only keeps red, drops blue)", () => {
    const d = new Uint8ClampedArray([200, 20, 20, 255, 20, 20, 200, 255]);
    const img = new ImageData(d, 2, 1);
    applyAdjustmentToImageData(img, {
      id: "t",
      type: "blackWhite",
      name: "BW",
      enabled: true,
      opacity: 100,
      params: { reds: 100, yellows: 0, greens: 0, cyans: 0, blues: 0, magentas: 0 },
    });
    // R channel weight 1.0: red pixel stays bright, blue pixel goes dark.
    expect(img.data[0]).toBeGreaterThan(150);
    expect(img.data[4]).toBeLessThan(60);
    expect(img.data[0]).toBe(img.data[1]);
    expect(img.data[1]).toBe(img.data[2]);
  });
});
