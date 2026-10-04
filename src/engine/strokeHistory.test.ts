import { describe, it, expect } from "vitest";
import { shouldRecreateStrokeLayer, shouldRemoveStrokeLayer } from "./strokeHistory";

describe("stroke layer lifecycle (plan6 one item per layer)", () => {
  it("removes the fresh layer only for its own stroke", () => {
    expect(shouldRemoveStrokeLayer({ layerId: "a", createdLayerId: "a" }, ["a", "b"], 2)).toBe(true);
    expect(shouldRemoveStrokeLayer({ layerId: "a" }, ["a", "b"], 2)).toBe(false);
    expect(shouldRemoveStrokeLayer({ layerId: "a", createdLayerId: "b" }, ["a", "b"], 2)).toBe(false);
    expect(shouldRemoveStrokeLayer({ layerId: "a", createdLayerId: "a" }, ["b"], 1)).toBe(false);
    expect(shouldRemoveStrokeLayer({ layerId: "a", createdLayerId: "a" }, ["a"], 1)).toBe(false);
  });

  it("recreates the layer on redo only when it is gone", () => {
    const spec = { name: "Brush 3", kind: "raster" as const, opacity: 100, blendMode: "normal" };
    expect(shouldRecreateStrokeLayer({ layerId: "a", createdLayerId: "a", createdLayer: spec }, ["b"])).toBe(true);
    expect(shouldRecreateStrokeLayer({ layerId: "a", createdLayerId: "a", createdLayer: spec }, ["a", "b"])).toBe(false);
    expect(shouldRecreateStrokeLayer({ layerId: "a", createdLayerId: "a" }, ["b"])).toBe(false);
    expect(shouldRecreateStrokeLayer({ layerId: "a" }, ["b"])).toBe(false);
  });
});
