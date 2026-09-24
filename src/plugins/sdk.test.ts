import { describe, it, expect } from "vitest";
import { runPlugin, EXAMPLE_PLUGINS } from "./sdk";

describe("plugin SDK", () => {
  it("3 contoh plugin tersedia", () => {
    expect(EXAMPLE_PLUGINS.length).toBe(3);
  });
  it("duotone berjalan tanpa error", () => {
    const d = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    d[3] = 255;
    const img = new ImageData(d, 4, 4);
    const out = runPlugin(EXAMPLE_PLUGINS[0], img, { strength: 80 });
    expect(out.width).toBe(4);
    expect(out.data.length).toBe(d.length);
  });
});
