import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from "./ColorWheel";

describe("colour math (studio Colour tab)", () => {
  it("hexToRgb parses 6-digit hex", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#2f7cf6")).toEqual([47, 124, 246]);
    expect(hexToRgb("zzzzzz")).toEqual([0, 0, 0]);
  });

  it("rgbToHex round-trips", () => {
    expect(rgbToHex(47, 124, 246)).toBe("#2f7cf6");
    expect(rgbToHex(-5, 300, 0)).toBe("#00ff00");
  });

  it("rgbToHsl matches known anchors", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 100, 50]);
    expect(rgbToHsl(255, 255, 255)).toEqual([0, 0, 100]);
    expect(rgbToHsl(0, 0, 0)).toEqual([0, 0, 0]);
    const [h, s, l] = rgbToHsl(47, 124, 246);
    expect(h).toBeGreaterThan(200);
    expect(h).toBeLessThan(230);
    expect(s).toBeGreaterThan(80);
    expect(l).toBeGreaterThan(30);
    expect(l).toBeLessThan(70);
  });

  it("hslToRgb round-trips rgbToHsl within integer-display quantization", () => {
    for (const [r, g, b] of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [47, 124, 246], [128, 128, 128]] as const) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [r2, g2, b2] = hslToRgb(h, s, l);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(4);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(4);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(4);
    }
  });

  it("hslToRgb handles achromatic and wrap", () => {
    expect(hslToRgb(0, 0, 50)).toEqual([128, 128, 128]);
    expect(hslToRgb(360, 100, 50)).toEqual(hslToRgb(0, 100, 50));
    expect(hslToRgb(-30, 100, 50)).toEqual(hslToRgb(330, 100, 50));
  });
});
