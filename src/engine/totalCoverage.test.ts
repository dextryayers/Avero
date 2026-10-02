import { describe, it, expect } from "vitest";
import { TOOL_FAMILIES, TOOLS } from "../components/ToolBar";
import {
  CLICK_TOOLS,
  CROP_RATIOS,
  DISTORT_MAP,
  IS_CROP_TOOL,
  IS_SHAPE_TOOL,
  MARQUEE_TOOLS,
  PEN_STYLES,
  RETOUCH_MAP,
  RETOUCH_TWEAK,
  SHAPE_KIND_OF,
  dispatchKindOf,
  isPaintTool,
  paintPreset,
  retouchModeOf,
} from "./toolPresets";
import { TOOL_HINT, topBarKindOf } from "./toolOptions";
import type { ToolId } from "../stores/useEditorStore";

// The only ToolIds without dispatch: hidden offline AI approximations.
// No toolbar entry, no shortcut, no palette entry, never selectable.
const AI_EXCLUDED: ReadonlySet<string> = new Set([
  "ai-bg-remove",
  "ai-subject",
  "ai-upscale",
  "ai-denoise",
  "ai-colorize",
  "ai-sky",
]);

const BRUSH_II = [
  "dry-flat", "dry-round", "wet-glaze", "wet-palette", "oil-fan", "oil-filbert",
  "water-bloom", "water-salt", "gouache-flat", "gouache-velvet", "acrylic-bristle",
  "air-soft", "air-texture", "pencil-2b", "pencil-6b", "charcoal-vine", "chalk-oil",
  "crayon-wax", "pastel-hard", "ink-brush", "ink-nib", "liner-fine", "marker-chisel",
  "neon-tube", "glow-soft", "glitter-fine", "glitter-chunk", "smoke-thin", "smoke-bill",
  "fur-short",
];

const HEAL_II = [
  "heal-mole", "heal-acne", "heal-scar-fade", "heal-shine", "heal-pores",
  "heal-tan-line", "heal-veins", "heal-chapped", "heal-stray-hair", "heal-flyaway",
  "heal-price-tag", "heal-tourist", "heal-wire", "heal-trash", "heal-reflection",
  "heal-glare", "heal-shadow-lift", "heal-fog-cut", "heal-grain-match",
  "heal-texture-copy", "heal-fabric", "heal-glass", "heal-chrome", "heal-rust-spot",
];

const TONE_II = [
  "dodge-mid", "dodge-detail", "burn-edge", "burn-depth", "sponge-warm", "sponge-cool",
  "vibrance-skin", "vibrance-foliage", "temp-sunset", "temp-arctic", "tint-cinema",
  "clarity-skin", "clarity-detail", "dehaze-sky", "dehaze-portrait", "grain-push",
  "grain-pull", "fade-blacks", "fade-whites", "split-gold",
];

const DETAIL_II = [
  "blur-tilt-strong", "blur-zoom", "blur-spin", "blur-frosted", "blur-mosaic-soft",
  "sharpen-halo-fix", "sharpen-print", "sharpen-screen", "clarity-structure",
  "denoise-luma", "denoise-chroma", "grain-35mm", "grain-120mm", "grain-push2",
  "lens-swirl", "lens-bubble", "motion-zoom", "motion-spin",
];

const DISTORT_II = [
  "distort-bulge", "distort-dent", "distort-squeeze", "distort-stretch",
  "distort-swirl-tight", "distort-waves-big", "distort-glass", "distort-heat",
  "distort-melt", "distort-flag", "distort-ripple-big", "distort-arc-top",
  "distort-arc-bottom", "distort-perspective",
];

describe("total usability lock (every tool one by one)", () => {
  it("every ToolId dispatches, except the documented hidden AI set", () => {
    const dead: string[] = [];
    const ids = Object.keys(TOOL_HINT);
    expect(ids.length).toBeGreaterThan(400);
    for (const id of ids) {
      if (AI_EXCLUDED.has(id)) continue;
      if (dispatchKindOf(id as ToolId) === null) dead.push(id);
    }
    expect(dead).toEqual([]);
  });

  it("the undispatched set is exactly the hidden AI set (nothing else dead)", () => {
    const nulls = Object.keys(TOOL_HINT).filter((id) => dispatchKindOf(id as ToolId) === null).sort();
    expect(nulls).toEqual([...AI_EXCLUDED].sort());
  });

  it("hidden AI tools are unreachable: no toolbar entry", () => {
    const barIds = new Set<string>(TOOLS.map((t) => t.id));
    for (const id of AI_EXCLUDED) expect(barIds.has(id)).toBe(false);
  });

  it("all 30 Brush II presets exist and differ from the base brush", () => {
    expect(BRUSH_II).toHaveLength(30);
    const base = JSON.stringify(paintPreset("brush" as ToolId, 80));
    for (const id of BRUSH_II) {
      expect(isPaintTool(id as ToolId), `${id} paint`).toBe(true);
      const p = paintPreset(id as ToolId, 80);
      expect(JSON.stringify(p) === base, `${id} identical to base brush`).toBe(false);
    }
  });

  it("all 30 Brush II presets are pairwise distinct (no clone feel)", () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const id of BRUSH_II) {
      const key = JSON.stringify(paintPreset(id as ToolId, 80));
      if (seen.has(key)) dup.push(`${id} == ${seen.get(key)}`);
      else seen.set(key, id);
    }
    expect(dup).toEqual([]);
  });

  it("all 24 Heal II tools map to distinct retouch modes", () => {
    expect(HEAL_II).toHaveLength(24);
    const modes = new Set<string>();
    for (const id of HEAL_II) {
      const m = retouchModeOf(id as ToolId);
      expect(m, `${id} mode`).not.toBeNull();
      modes.add(m as string);
    }
    expect(modes.size).toBe(24);
  });

  it("all 20 Tone II tools map to distinct retouch modes", () => {
    expect(TONE_II).toHaveLength(20);
    const modes = new Set<string>();
    for (const id of TONE_II) {
      const m = retouchModeOf(id as ToolId);
      expect(m, `${id} mode`).not.toBeNull();
      modes.add(m as string);
    }
    expect(modes.size).toBe(20);
  });

  it("all 18 Detail II tools map to distinct retouch modes", () => {
    expect(DETAIL_II).toHaveLength(18);
    const modes = new Set<string>();
    for (const id of DETAIL_II) {
      const m = retouchModeOf(id as ToolId);
      expect(m, `${id} mode`).not.toBeNull();
      modes.add(m as string);
    }
    expect(modes.size).toBe(18);
  });

  it("all 14 Distort II tools map to distinct distort kinds", () => {
    expect(DISTORT_II).toHaveLength(14);
    for (const id of DISTORT_II) {
      expect(dispatchKindOf(id as ToolId), `${id} dispatch`).toBe("distort");
    }
    const kinds = DISTORT_II.map((id) => (DISTORT_MAP as Record<string, string>)[id]);
    expect(new Set(kinds).size).toBe(14);
  });

  it("every crop tool has a ratio entry and every shape tool has a kind", () => {
    for (const id of IS_CROP_TOOL) {
      expect(id in CROP_RATIOS, `${id} ratio`).toBe(true);
      expect(dispatchKindOf(id)).toBe("crop");
    }
    for (const id of IS_SHAPE_TOOL) {
      expect(SHAPE_KIND_OF[id], `${id} kind`).toBeTruthy();
      expect(dispatchKindOf(id)).toBe("shape");
    }
  });

  it("new pen tools have explicit styles (no silent default)", () => {
    for (const id of ["pen-thin", "pen-medium", "pen-bold", "pen-dashed", "pen-arrow-both", "pen-glow"]) {
      expect(PEN_STYLES[id as ToolId], `${id} style`).toBeTruthy();
      expect(dispatchKindOf(id as ToolId)).toBe("pen");
    }
  });

  it("sampler 3x3/11x11 route to click handlers", () => {
    for (const id of ["sampler-3x3", "sampler-11x11"]) {
      expect(CLICK_TOOLS.has(id as ToolId), `${id} click`).toBe(true);
      expect(dispatchKindOf(id as ToolId)).toBe("click");
    }
  });

  it("marquee set covers circle, stadium and crosshair", () => {
    for (const id of ["select-circle", "select-stadium", "select-crosshair"]) {
      expect(MARQUEE_TOOLS.has(id as ToolId), `${id} marquee`).toBe(true);
      expect(topBarKindOf(id as ToolId)).toBe("select-marquee");
    }
  });

  it("new tools land on the correct top bar", () => {
    const cases: [string, string][] = [
      ["dry-flat", "paint"], ["heal-mole", "retouch"], ["dodge-mid", "retouch"],
      ["blur-zoom", "retouch"], ["distort-bulge", "retouch"], ["crop-55", "crop"],
      ["crop-thirds", "crop-overlay"], ["select-last", "select-click"],
      ["wand-flood", "select-auto"], ["range-skin", "select-auto"],
      ["lasso-straight", "select-marquee"], ["gradient-conic", "gradient"],
      ["fill-foreground", "fill"], ["bucket-global", "fill"],
      ["pen-glow", "pen"], ["text-fire", "text"], ["shape-pin", "shape"],
      ["ruler-triple", "measure"], ["measure-dpi", "measure"],
      ["zoom-marquee", "navigate"], ["rotate-15", "navigate"],
      ["sampler-3x3", "measure"], ["note-color", "measure"],
      ["clone-soft", "clone"], ["pattern-dots", "clone"],
      ["magic-eraser", "eraser"], ["align-center", "move"],
    ];
    for (const [id, kind] of cases) {
      expect(topBarKindOf(id as ToolId), id).toBe(kind);
    }
  });

  it("icons are unique within each family (diverse, matching function)", () => {
    for (const f of TOOL_FAMILIES) {
      const seen = new Map<unknown, string>();
      const dup: string[] = [];
      for (const t of f.tools) {
        if (seen.has(t.icon)) dup.push(`${t.id} == ${seen.get(t.icon)}`);
        else seen.set(t.icon, t.id);
      }
      expect(dup, `family ${f.id}`).toEqual([]);
    }
  });

  it("every toolbar tool has a specific top bar hint", () => {
    const bad: string[] = [];
    for (const t of TOOLS) {
      const h = TOOL_HINT[t.id as ToolId];
      if (!h || !h.trim()) bad.push(t.id);
    }
    expect(bad).toEqual([]);
  });

  it("no em-dash in user-facing tool strings", () => {
    const bad: string[] = [];
    for (const t of TOOLS) {
      const s = `${t.label} ${t.shortcut}`;
      if (s.includes("\u2014")) bad.push(t.id);
    }
    for (const [id, h] of Object.entries(TOOL_HINT)) {
      if (h.includes("\u2014")) bad.push(id);
    }
    expect(bad).toEqual([]);
  });

  it("aliased retouch modes: base untweaked, every alias fingerprinted", () => {
    // Documented intentional shares (same role by design, not clones):
    // smudge engine for smudge/liquify/warp; source-heal for healing-brush/patch.
    const INTENTIONAL_SHARES = new Set(["smudge", "heal-source"]);
    const byMode = new Map<string, string[]>();
    for (const [id, mode] of Object.entries(RETOUCH_MAP)) {
      if (!mode) continue;
      const arr = byMode.get(mode) ?? [];
      arr.push(id);
      byMode.set(mode, arr);
    }
    const bad: string[] = [];
    for (const [mode, ids] of byMode) {
      if (ids.length < 2 || INTENTIONAL_SHARES.has(mode)) continue;
      const untweaked = ids.filter((id) => !RETOUCH_TWEAK[id as ToolId]);
      if (untweaked.length !== 1) bad.push(`${mode}: ${untweaked.length} untweaked`);
      for (const id of ids) {
        const tw = RETOUCH_TWEAK[id as ToolId];
        if (!tw) continue;
        const sm = tw.strengthMul ?? 1;
        const rm = tw.radiusMul ?? 1;
        if (sm < 0.2 || sm > 2 || rm < 0.5 || rm > 2 || (sm === 1 && rm === 1)) {
          bad.push(`${id}: invalid tweak`);
        }
      }
    }
    expect(byMode.size).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
