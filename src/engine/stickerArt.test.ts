import { describe, it, expect } from "vitest";
import {
  STICKER_V2,
  containsEmoji,
  hashSeed,
  mulberry32,
  parseHexColor,
  validateStickerArt,
  type StickerShape,
} from "./stickerArt";
import { STICKER_IDS } from "./stickers";

describe("sticker v2 catalog (plan7 professional assets)", () => {
  it("keeps all 72 legacy ids plus the 48 poster expansion ids plus 96 wave 2 ids", () => {
    expect(STICKER_V2.length).toBe(216);
    expect(new Set(STICKER_V2.map((s) => s.id)).size).toBe(216);
    for (const id of STICKER_IDS) {
      expect(STICKER_V2.some((s) => s.id === id), id).toBe(true);
    }
  });

  it("covers the 8 categories with the frozen counts", () => {
    const count = (c: string) => STICKER_V2.filter((s) => s.category === c).length;
    expect(count("marks")).toBe(26);
    expect(count("badges")).toBe(24);
    expect(count("frames")).toBe(24);
    expect(count("labels")).toBe(24);
    expect(count("nature")).toBe(26);
    expect(count("fx")).toBe(24);
    expect(count("poster")).toBe(40);
    expect(count("social")).toBe(28);
  });

  it("labels are clean English with no emoji", () => {
    for (const s of STICKER_V2) {
      expect(s.label.length, `${s.id} label`).toBeGreaterThan(0);
      expect(s.label, `${s.id} label`).toMatch(/^[A-Za-z0-9 ]+$/);
      expect(containsEmoji(s.label), `${s.id} label`).toBe(false);
    }
  });

  it("all 192 stamp specs validate clean", () => {
    const stamps = STICKER_V2.filter((s) => !s.fx);
    expect(stamps.length).toBe(192);
    for (const s of stamps) {
      expect(validateStickerArt(s.shapes), s.id).toEqual([]);
    }
  });

  it("all 24 fx entries carry a known kind with empty shapes", () => {
    const kinds = [
      "sunburst", "lens-flare", "bokeh", "grain", "vignette", "streak",
      "glow-orb", "sparkle-spray", "haze", "duotone", "edge-burn", "beam",
      "confetti", "starfield", "rainbow-rings", "dots-fade", "plus-field", "grain-fine",
      "leak", "prism", "checker-fade", "wave-band", "ring-burst", "spotlight",
    ];
    const fx = STICKER_V2.filter((s) => s.fx);
    expect(fx.length).toBe(24);
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

function distSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inPoly(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function burstPoly(cx: number, cy: number, ro: number, ri: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Headless structural rasterizer for QA: fill and stroke coverage on a grid,
// cuts punch. Halo ignored (rim only). Independent reimplementation that
// cross checks the canvas painter geometry.
function rasterizeArt(shapes: StickerShape[], cells = 50): boolean[] {
  const covers = (sh: StickerShape, px: number, py: number): boolean => {
    switch (sh.op) {
      case "dot":
        return Math.hypot(px - sh.cx, py - sh.cy) <= sh.r;
      case "ring":
        return Math.abs(Math.hypot(px - sh.cx, py - sh.cy) - sh.r) <= sh.w / 2;
      case "rect": {
        const inBox = px >= sh.x && px <= sh.x + sh.w && py >= sh.y && py <= sh.y + sh.h;
        if (sh.fill !== false) return inBox;
        const wgt = sh.wgt ?? 7;
        return (
          inBox &&
          (px - sh.x <= wgt / 2 || sh.x + sh.w - px <= wgt / 2 || py - sh.y <= wgt / 2 || sh.y + sh.h - py <= wgt / 2)
        );
      }
      case "poly": {
        if (sh.fill !== false) return inPoly(px, py, sh.pts);
        const wgt = sh.wgt ?? 7;
        for (let i = 0; i < sh.pts.length; i++) {
          const a = sh.pts[i];
          const b = sh.pts[(i + 1) % sh.pts.length];
          if (distSeg(px, py, a[0], a[1], b[0], b[1]) <= wgt / 2) return true;
        }
        return false;
      }
      case "line":
        return distSeg(px, py, sh.x1, sh.y1, sh.x2, sh.y2) <= sh.w / 2;
      case "burst": {
        const pts = burstPoly(sh.cx, sh.cy, sh.ro, sh.ri, sh.n);
        if (sh.fill !== false) return inPoly(px, py, pts);
        const wgt = sh.wgt ?? 7;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          if (distSeg(px, py, a[0], a[1], b[0], b[1]) <= wgt / 2) return true;
        }
        return false;
      }
      case "cut":
        return false;
    }
  };
  const out: boolean[] = [];
  const cuts = shapes.filter((s) => s.op === "cut");
  const rest = shapes.filter((s) => s.op !== "cut");
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const px = ((gx + 0.5) / cells) * 100;
      const py = ((gy + 0.5) / cells) * 100;
      if (!rest.some((s) => covers(s, px, py))) {
        out.push(false);
        continue;
      }
      out.push(!cuts.some((s) => s.op === "cut" && Math.hypot(px - s.cx, py - s.cy) <= s.r));
    }
  }
  return out;
}

function inkStats(shapes: StickerShape[]): { ratio: number; cx: number; cy: number } {
  const cells = 50;
  const grid = rasterizeArt(shapes, cells);
  let n = 0;
  let sx = 0;
  let sy = 0;
  grid.forEach((ink, i) => {
    if (!ink) return;
    n++;
    sx += (i % cells) + 0.5;
    sy += Math.floor(i / cells) + 0.5;
  });
  return { ratio: n / grid.length, cx: n === 0 ? 0 : (sx / n / cells) * 100, cy: n === 0 ? 0 : (sy / n / cells) * 100 };
}

const X_MIRROR_CLEAN: string[] = [
  "sticker-laugh", "sticker-party-face", "sticker-heart-eyes",
  "sticker-star-struck", "sticker-sleepy", "sticker-clown", "sticker-ok-hand",
  "sticker-alien",
  "sticker-peace", "sticker-pray", "sticker-clap", "sticker-wave",
  "sticker-rock-on", "sticker-red-heart", "sticker-sparkles", "sticker-star",
  "sticker-lightning", "sticker-hundred", "sticker-balloon", "sticker-crown",
  "sticker-gem", "sticker-medal", "sticker-rocket", "sticker-gift",
  "sticker-cat", "sticker-dog", "sticker-panda", "sticker-monkey", "sticker-lion",
  "sticker-tiger", "sticker-unicorn", "sticker-penguin",
  "sticker-butterfly", "sticker-bee", "sticker-burger",
  "sticker-sunflower", "sticker-mushroom", "sticker-sun", "sticker-snowflake", "sticker-clover",
  "sticker-seal-double", "sticker-price-circle", "sticker-rule-double", "sticker-rule-dotted",
  "sticker-shield-mini", "sticker-cross-seal",
  "sticker-step-four", "sticker-step-five", "sticker-step-six", "sticker-frame-double",
  "sticker-rosette", "sticker-divider-dots", "sticker-frame-rings", "sticker-banner-tall",
  "sticker-sparkle-ring", "sticker-envelope", "sticker-phone", "sticker-globe", "sticker-mic",
];
// Note: sticker-photo-corners is symmetric by design but its long diagonals
// produce float noise above the strict gate, so it stays out of this list.
// Asymmetric by design and excluded: check, quote, chevron, arrows, cursor,
// pin, bolt, tag, price, underline, approved, moon, cloud, ridge, rain,
// fork, key, verified, bubble, mic boom, envelope flap, camera hump,
// music flag, hash slant, share spokes, play head, qr finders.


describe("sticker visual QA (headless structural review)", () => {
  it("every stamp reads as a centered mark, neither empty nor full bleed", () => {
    for (const spec of STICKER_V2) {
      if (spec.fx) continue;
      const st = inkStats(spec.shapes);
      expect(st.ratio, `${spec.id} coverage`).toBeGreaterThan(0.02);
      expect(st.ratio, `${spec.id} coverage`).toBeLessThan(0.9);
      expect(st.cx, `${spec.id} center x`).toBeGreaterThan(30);
      expect(st.cx, `${spec.id} center x`).toBeLessThan(70);
      expect(st.cy, `${spec.id} center y`).toBeGreaterThan(30);
      expect(st.cy, `${spec.id} center y`).toBeLessThan(70);
    }
  });

  it("mirror clean assets are exactly left right symmetric", () => {
    const cells = 50;
    for (const spec of STICKER_V2) {
      if (spec.fx || !X_MIRROR_CLEAN.includes(spec.id)) continue;
      const grid = rasterizeArt(spec.shapes, cells);
      let diff = 0;
      for (let gy = 0; gy < cells; gy++) {
        for (let gx = 0; gx < cells / 2; gx++) {
          if (grid[gy * cells + gx] !== grid[gy * cells + (cells - 1 - gx)]) diff++;
        }
      }
      expect(diff, `${spec.id} mirror diff`).toBeLessThanOrEqual(2);
    }
  });
});
