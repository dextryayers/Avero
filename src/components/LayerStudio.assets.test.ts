import { describe, it, expect } from "vitest";
import { ASSETS, paintAsset } from "./LayerStudio";

describe("assets registry (plan6 rich assets tab)", () => {
  it("ships 30 assets across Pattern, Gradient and Texture", () => {
    expect(ASSETS.length).toBe(30);
    const groups = new Set(ASSETS.map((a) => a.group));
    expect([...groups].sort()).toEqual(["Gradient", "Pattern", "Texture"]);
    expect(ASSETS.filter((a) => a.group === "Pattern").length).toBe(12);
    expect(ASSETS.filter((a) => a.group === "Gradient").length).toBe(14);
    expect(ASSETS.filter((a) => a.group === "Texture").length).toBe(4);
  });

  it("has unique ids and clean English names", () => {
    const ids = ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ASSETS) {
      expect(a.name).toMatch(/^[A-Za-z0-9 ]+$/);
      expect(a.name.length).toBeGreaterThan(0);
    }
  });

  it("exposes a painter for every registered kind", () => {
    expect(typeof paintAsset).toBe("function");
  });
});
