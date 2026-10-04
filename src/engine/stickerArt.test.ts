import { describe, it, expect } from "vitest";
import {
  STICKER_V2,
  containsEmoji,
  hashSeed,
  mulberry32,
  parseHexColor,
  validateStickerArt,
} from "./stickerArt";
import { STICKER_IDS } from "./stickers";

describe("sticker v2 catalog (plan7 professional assets)", () => {
  it("reuses all 72 legacy ids with zero additions or renames", () => {
    expect(STICKER_V2.length).toBe(72);
    expect(new Set(STICKER_V2.map((s) => s.id)).size).toBe(72);
    expect([...STICKER_V2.map((s) => s.id)].sort()).toEqual([...STICKER_IDS].sort());
  });

  it("covers the 6 new categories with the frozen counts", () => {
    const count = (c: string) => STICKER_V2.filter((s) => s.category === c).length;
    expect(count("marks")).toBe(14);
    expect(count("badges")).toBe(12);
    expect(count("frames")).toBe(12);
    expect(count("labels")).toBe(12);
    expect(count("nature")).toBe(10);
    expect(count("fx")).toBe(12);
  });

  it("labels are clean English with no emoji", () => {
    for (const s of STICKER_V2) {
      expect(s.label.length, `${s.id} label`).toBeGreaterThan(0);
      expect(s.label, `${s.id} label`).toMatch(/^[A-Za-z0-9 ]+$/);
      expect(containsEmoji(s.label), `${s.id} label`).toBe(false);
    }
  });

  it("all 60 stamp specs validate clean", () => {
    const stamps = STICKER_V2.filter((s) => !s.fx);
    expect(stamps.length).toBe(60);
    for (const s of stamps) {
      expect(validateStickerArt(s.shapes), s.id).toEqual([]);
    }
  });

  it("all 12 fx entries carry a known kind with empty shapes", () => {
    const kinds = [
      "sunburst", "lens-flare", "bokeh", "grain", "vignette", "streak",
      "glow-orb", "sparkle-spray", "haze", "duotone", "edge-burn", "beam",
    ];
    const fx = STICKER_V2.filter((s) => s.fx);
    expect(fx.length).toBe(12);
    expect([...fx.map((s) => s.fx as string)].sort()).toEqual([...kinds].sort());
    for (const s of fx) expect(s.shapes).toEqual([]);
  });

  it("validator rejects broken specs loudly", () => {
    expect(validateStickerArt([]).length).toBeGreaterThan(0);
    expect(validateStickerArt([{ op: "dot", cx: 50, cy: 50, r: -4 }]).length).toBeGreaterThan(0);
    expect(validateStickerArt([{ op: "cut", cx: 50, cy: 50, r: 8 }]).length).toBeGreaterThan(0);
    expect(validateStickerArt([{ op: "burst", cx: 50, cy: 50, ro: 10, ri: 20, n: 5 }]).length).toBeGreaterThan(0);
    expect(validateStickerArt([{ op: "poly", pts: [[0, 0], [1, 1]] }]).length).toBeGreaterThan(0);
    expect(validateStickerArt([{ op: "nope" } as never]).length).toBeGreaterThan(0);
  });

  it("emoji detector catches legacy glyphs and passes clean text", () => {
    expect(containsEmoji("😀")).toBe(true);
    expect(containsEmoji("❤️")).toBe(true);
    expect(containsEmoji("Check")).toBe(false);
    expect(containsEmoji("Step One 123")).toBe(false);
  });

  it("seeded random is deterministic and ranged", () => {
    const a = mulberry32(hashSeed("sticker-donut"));
    const b = mulberry32(hashSeed("sticker-donut"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const c = mulberry32(hashSeed("sticker-cupcake"));
    const seq = [c(), c(), c(), c()];
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(seq).not.toEqual([a(), a(), a(), a()]);
  });

  it("parses hex colors with a safe fallback", () => {
    expect(parseHexColor("#2f7cf6")).toEqual([47, 124, 246]);
    expect(parseHexColor("2F7CF6")).toEqual([47, 124, 246]);
    expect(parseHexColor("not-a-color")).toEqual([47, 124, 246]);
  });

  it("keeps emoji out of the sticker engine source", () => {
    const sources = import.meta.glob("./sticker*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const files = Object.keys(sources).filter(
      (f) => f.endsWith("/stickers.ts") || f.endsWith("/stickerArt.ts"),
    );
    expect(files.length).toBe(2);
    for (const f of files) expect(containsEmoji(sources[f]), f).toBe(false);
  });
});
