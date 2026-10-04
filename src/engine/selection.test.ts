import { describe, it, expect } from "vitest";
import { crossBars } from "./selection";

describe("crosshair marquee geometry (plan6 shape matches function)", () => {
  it("centers full-span bars on the rect", () => {
    const b = crossBars(10, 20, 100, 60);
    expect(b.vw).toBe(b.hh);
    expect(b.vy).toBe(20);
    expect(b.vh).toBe(60);
    expect(b.hx).toBe(10);
    expect(b.hw).toBe(100);
    expect(b.vx + b.vw / 2).toBeCloseTo(60, 5);
    expect(b.hy + b.hh / 2).toBeCloseTo(50, 5);
  });

  it("scales arms with the smaller side, minimum 3px", () => {
    expect(crossBars(0, 0, 100, 100).vw).toBe(20);
    expect(crossBars(0, 0, 10, 200).vw).toBe(3);
    expect(crossBars(0, 0, 5, 5).vw).toBe(3);
  });

  it("keeps bars inside the rect", () => {
    const b = crossBars(10, 20, 100, 60);
    expect(b.vx).toBeGreaterThanOrEqual(10);
    expect(b.vx + b.vw).toBeLessThanOrEqual(110);
    expect(b.hy).toBeGreaterThanOrEqual(20);
    expect(b.hy + b.hh).toBeLessThanOrEqual(80);
  });
});
