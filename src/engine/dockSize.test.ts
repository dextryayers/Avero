import { describe, expect, it } from "vitest";
import {
  DOCK_DEFAULT_SPLIT,
  DOCK_DEFAULT_TOTAL,
  DOCK_MAX_TOTAL,
  DOCK_MIN_COL,
  DOCK_MIN_TOTAL,
  clampSplit,
  clampTotal,
  splitWidths,
} from "./dockSize";

describe("right dock sizing", () => {
  it("clamps the total width into range", () => {
    expect(clampTotal(10)).toBe(DOCK_MIN_TOTAL);
    expect(clampTotal(5000)).toBe(DOCK_MAX_TOTAL);
    expect(clampTotal(480)).toBe(480);
    expect(clampTotal(Number.NaN)).toBe(DOCK_DEFAULT_TOTAL);
  });

  it("keeps both columns above the minimum width", () => {
    const s0 = clampSplit(0, DOCK_DEFAULT_TOTAL);
    expect(DOCK_DEFAULT_TOTAL * s0).toBeGreaterThanOrEqual(DOCK_MIN_COL);
    const s1 = clampSplit(1, DOCK_DEFAULT_TOTAL);
    expect(DOCK_DEFAULT_TOTAL * (1 - s1)).toBeGreaterThanOrEqual(DOCK_MIN_COL);
    expect(clampSplit(Number.NaN, 480)).toBe(DOCK_DEFAULT_SPLIT);
  });

  it("split widths always add up to the clamped total", () => {
    for (const total of [340, 480, 720]) {
      for (const split of [0, 0.2, 0.485, 0.9, 1]) {
        const { left, right } = splitWidths(total, split);
        expect(left + right).toBe(total);
        expect(left).toBeGreaterThanOrEqual(DOCK_MIN_COL);
        expect(right).toBeGreaterThanOrEqual(DOCK_MIN_COL);
      }
    }
  });
});
