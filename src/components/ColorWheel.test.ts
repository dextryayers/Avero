import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, hsvToRgb, rgbToHsv, triVertices, triSV, triPoint } from "./ColorWheel";

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

  it("hsvToRgb matches known anchors", () => {
    expect(hsvToRgb(0, 100, 100)).toEqual([255, 0, 0]);
    expect(hsvToRgb(0, 0, 100)).toEqual([255, 255, 255]);
    expect(hsvToRgb(0, 0, 0)).toEqual([0, 0, 0]);
    expect(hsvToRgb(120, 100, 100)).toEqual([0, 255, 0]);
    expect(hsvToRgb(240, 100, 100)).toEqual([0, 0, 255]);
  });

  it("rgbToHsv round-trips hsvToRgb", () => {
    for (const [r, g, b] of [[255, 0, 0], [0, 255, 0], [47, 124, 246], [128, 128, 128], [0, 0, 0]] as const) {
      const [h, s, v] = rgbToHsv(r, g, b);
      const [r2, g2, b2] = hsvToRgb(h, s, v);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(4);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(4);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(4);
    }
  });

  it("triangle vertices hit pure hue, white and black", () => {
    const v = triVertices(184, 70);
    expect(triSV(v.ex, v.ey, v)).toEqual({ s: 1, v: 1 });
    const w = triSV(v.wx, v.wy, v);
    expect(w.s).toBeCloseTo(0, 5);
    expect(w.v).toBeCloseTo(1, 5);
    const b = triSV(v.bx, v.by, v);
    expect(b.v).toBeCloseTo(0, 5);
  });

  it("triangle center is half saturated two thirds bright", () => {
    const v = triVertices(184, 70);
    const c = triSV((v.ex + v.wx + v.bx) / 3, (v.ey + v.wy + v.by) / 3, v);
    expect(c.s).toBeCloseTo(0.5, 2);
    expect(c.v).toBeCloseTo(2 / 3, 2);
  });

  it("triangle clamps outside points and round-trips", () => {
    const v = triVertices(184, 70);
    const far = triSV(-500, -500, v);
    expect(far.s).toBeGreaterThanOrEqual(0);
    expect(far.s).toBeLessThanOrEqual(1);
    expect(far.v).toBeGreaterThanOrEqual(0);
    expect(far.v).toBeLessThanOrEqual(1);
    for (const [s, vv] of [[1, 1], [0, 1], [0.5, 0.5], [0.2, 0.8]] as const) {
      const p = triPoint(s, v, vv);
      const back = triSV(p.x, p.y, v);
      expect(back.s).toBeCloseTo(s, 1);
      expect(back.v).toBeCloseTo(vv, 1);
    }
  });
});
