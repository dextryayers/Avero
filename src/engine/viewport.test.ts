import { describe, it, expect } from "vitest";
import { viewportRect, panForCenter, fitThumb } from "./viewport";

describe("navigator viewport math", () => {
  it("centered doc at 100 percent shows the whole document", () => {
    const r = viewportRect(1000, 800, 800, 600, 100, 0, 0);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(800);
    expect(r.h).toBeCloseTo(600);
  });

  it("zoomed in clamps the visible rect inside the document", () => {
    const r = viewportRect(1000, 800, 800, 600, 200, 0, 0);
    expect(r.w).toBeCloseTo(500);
    expect(r.h).toBeCloseTo(400);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(800);
    expect(r.y + r.h).toBeLessThanOrEqual(600);
  });

  it("pan shifts the visible rect", () => {
    const a = viewportRect(1000, 800, 800, 600, 200, 0, 0);
    const b = viewportRect(1000, 800, 800, 600, 200, -100, 0);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("panForCenter centers the clicked point (round trip)", () => {
    const wrap = { w: 1000, h: 800 };
    const { panX, panY } = panForCenter(wrap.w, wrap.h, 800, 600, 200, 400, 300);
    const r = viewportRect(wrap.w, wrap.h, 800, 600, 200, panX, panY);
    expect(r.x + r.w / 2).toBeCloseTo(400);
    expect(r.y + r.h / 2).toBeCloseTo(300);
  });

  it("fitThumb keeps aspect inside bounds", () => {
    expect(fitThumb(1920, 1080, 168, 120)).toEqual({ w: 168, h: 95 });
    expect(fitThumb(600, 1200, 168, 120)).toEqual({ w: 60, h: 120 });
  });
});
