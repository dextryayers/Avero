import { describe, it, expect } from "vitest";
import {
  boxArea,
  clampBox,
  dedupeSameLabel,
  filterMinArea,
  iouBoxes,
  readingOrder,
  segmentLabelId,
  segmentLayerName,
  sortAreaDesc,
  type MergeBox,
} from "./segmentMerge";

const B = (label: string, x: number, y: number, w: number, h: number, score = 0.9): MergeBox => ({
  label,
  score,
  x,
  y,
  w,
  h,
  source: "yolo",
});

describe("segment merge policy (plan5 Fase 4)", () => {
  it("iou of identical, half-overlap and disjoint boxes", () => {
    expect(iouBoxes(B("a", 0, 0, 10, 10), B("a", 0, 0, 10, 10))).toBeCloseTo(1, 6);
    expect(iouBoxes(B("a", 0, 0, 10, 10), B("a", 5, 0, 10, 10))).toBeCloseTo(1 / 3, 6);
    expect(iouBoxes(B("a", 0, 0, 5, 5), B("a", 6, 6, 5, 5))).toBe(0);
    expect(boxArea({ w: 4, h: 5 })).toBe(20);
  });

  it("dedupe keeps best score per label, keeps other labels", () => {
    const items = [B("Bus", 0, 0, 100, 100, 0.6), B("Bus", 2, 2, 98, 98, 0.9), B("Person", 2, 2, 98, 98, 0.5)];
    const out = dedupeSameLabel(items, 0.85);
    expect(out.map((o) => [o.label, o.score])).toEqual([
      ["Bus", 0.9],
      ["Person", 0.5],
    ]);
  });

  it("filterMinArea drops specks under the fraction", () => {
    const items = [B("a", 0, 0, 100, 100), B("b", 0, 0, 2, 2)];
    expect(filterMinArea(items, 10000, 0.003).map((o) => o.label)).toEqual(["a"]);
    expect(filterMinArea(items, 0)).toEqual([]);
  });

  it("sortAreaDesc orders biggest first without mutating", () => {
    const items = [B("s", 0, 0, 5, 5), B("b", 0, 0, 50, 50), B("m", 0, 0, 20, 20)];
    expect(sortAreaDesc(items).map((o) => o.label)).toEqual(["b", "m", "s"]);
    expect(items[0].label).toBe("s");
  });

  it("readingOrder goes top band first, then left to right", () => {
    const items = [
      B("c", 10, 200, 50, 20),
      B("a", 300, 10, 50, 20),
      B("b", 10, 12, 50, 20),
    ];
    expect(readingOrder(items, 1000).map((o) => o.label)).toEqual(["b", "a", "c"]);
  });

  it("clampBox rounds and stays inside the frame", () => {
    expect(clampBox({ x: -5.6, y: 2.4, w: 10.2, h: 10.2 }, 100, 100)).toEqual({ x: 0, y: 2, w: 10, h: 10 });
    expect(clampBox({ x: 95, y: 95, w: 50, h: 50 }, 100, 100)).toEqual({ x: 95, y: 95, w: 5, h: 5 });
  });

  it("segmentLabelId translates known labels and passes unknown through", () => {
    expect(segmentLabelId("bus")).toBe("Bus");
    expect(segmentLabelId("person")).toBe("Orang");
    expect(segmentLabelId("house")).toBe("Rumah");
    expect(segmentLabelId("Text")).toBe("Tulisan");
    expect(segmentLabelId("skyscraper")).toBe("Gedung Pencakar Langit");
    expect(segmentLabelId("unknownlabel")).toBe("unknownlabel");
  });

  it("segmentLayerName honors the language toggle", () => {
    expect(segmentLayerName("Bus", 1, false)).toBe("Bus 1");
    expect(segmentLayerName("Bus", 1, true)).toBe("Bus 1");
    expect(segmentLayerName("Person", 2, true)).toBe("Orang 2");
    expect(segmentLayerName("Text", 3, true)).toBe("Tulisan 3");
    expect(segmentLayerName("house", 1, true)).toBe("Rumah 1");
  });
});
