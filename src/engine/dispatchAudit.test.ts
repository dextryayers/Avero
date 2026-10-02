import { describe, it, expect } from "vitest";
import { TOOL_FAMILIES } from "../components/ToolBar";
import { TOOL_HINT, topBarKindOf } from "./toolOptions";
import {
  CLONE_TOOLS,
  CLICK_TOOLS,
  CROP_RATIOS,
  DISTORT_MAP,
  ERASER_TOOLS,
  EYEDROPPER_TOOLS,
  FILL_TOOLS,
  GRADIENT_TOOLS,
  IS_CROP_TOOL,
  IS_SELECTION_TOOL,
  IS_SHAPE_TOOL,
  MARQUEE_TOOLS,
  MEASURE_DRAG_TOOLS,
  MOVE_TOOLS,
  PAINT_TOOLS,
  PATTERN_MOTIF_OF,
  PEN_STYLES,
  PEN_TOOLS,
  RETOUCH_MAP,
  RETOUCH_TWEAK,
  SHAPE_KIND_OF,
  TEXT_TOOLS,
  ZOOM_TOOLS,
  dispatchKindOf,
  paintPreset,
} from "./toolPresets";
import type { ToolId } from "../stores/useEditorStore";

// Plan4 rule 4: proof that every sub-tool of every family resolves to a real
// behavior. A tool that is listed in the toolbar but has no dispatch kind is
// dead on the canvas, no matter what plan3 claimed. This harness fails loudly
// on any such gap so fixes land in source, never in silence.

const all = TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => ({ family: f.id, id: t.id as ToolId })));

describe("plan4 dispatch audit: every sub-tool resolves", () => {
  it("toolbar lists a non-empty tool set", () => {
    expect(all.length).toBeGreaterThan(300);
  });

  it("has zero duplicate tool ids across families", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const t of all) {
      const prev = seen.get(t.id);
      if (prev) dupes.push(`${t.id} (in ${prev} + ${t.family})`);
      else seen.set(t.id, t.family);
    }
    expect(dupes).toEqual([]);
  });

  it("every tool has a dispatch kind (no dead tools)", () => {
    const dead = all
      .filter((t) => dispatchKindOf(t.id) === null)
      .map((t) => `${t.family}/${t.id}`);
    expect(dead).toEqual([]);
  });

  it("every tool has a top bar kind and a registered hint", () => {
    const bad: string[] = [];
    for (const t of all) {
      try {
        topBarKindOf(t.id);
      } catch {
        bad.push(`${t.family}/${t.id}:topbar`);
      }
      const h = (TOOL_HINT as Record<string, string>)[t.id];
      if (!h) bad.push(`${t.family}/${t.id}:hint`);
    }
    expect(bad).toEqual([]);
  });

  it("plan4 fase 2: move family resolves to move/shape as designed", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "move")!;
    expect(fams.tools.map((t) => t.id).sort()).toEqual(
      ["move", "artboard", "path-select", "direct-select", "move-auto", "transform-free", "align-center"].sort(),
    );
    const expected: Record<string, string> = {
      move: "move",
      "path-select": "move",
      "direct-select": "move",
      "move-auto": "move",
      "transform-free": "move",
      "align-center": "move",
      artboard: "shape",
    };
    for (const [id, kind] of Object.entries(expected)) {
      expect(dispatchKindOf(id as ToolId)).toBe(kind);
    }
  });

  it("plan4 fase 3: select family resolves to selection/click as designed", () => {
    const clickOps = new Set([
      "select-grow", "select-shrink", "select-feather", "select-border",
      "select-last", "select-inverse-click",
      "select-feather-2", "select-feather-4", "select-feather-12",
      "select-grow-2", "select-grow-8", "select-border-4", "select-border-12",
    ]);
    const fams = TOOL_FAMILIES.find((f) => f.id === "select")!;
    expect(fams.tools.length).toBe(22);
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe(clickOps.has(t.id) ? "click" : "selection");
    }
  });

  it("plan4 fase 4: crop family resolves as designed", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "crop")!;
    expect(fams.tools.length).toBe(25);
    // slice/select/overlays are click utilities; frame drag-creates (shape).
    const clickUtils = new Set([
      "slice", "slice-select",
      "crop-thirds", "crop-diagonal", "crop-triangle-guide",
      "crop-golden-spiral", "crop-center-dot",
    ]);
    for (const t of fams.tools) {
      const expected = t.id === "frame" ? "shape" : clickUtils.has(t.id) ? "click" : "crop";
      expect(dispatchKindOf(t.id as ToolId)).toBe(expected);
    }
  });

  it("plan4 fase 5: measure family resolves as designed", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "measure")!;
    expect(fams.tools.length).toBe(22);
    const drag = new Set(["ruler", "measure-angle", "measure-area", "protractor", "ruler-triple"]);
    const dropper = new Set(["eyedropper", "color-sampler", "sampler-avg"]);
    for (const t of fams.tools) {
      const expected = dropper.has(t.id) ? "eyedropper" : drag.has(t.id) ? "measure" : "click";
      expect(dispatchKindOf(t.id as ToolId)).toBe(expected);
    }
  });

  it("plan4 fase 6: brush family resolves to paint with distinct presets", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "brush")!;
    expect(fams.tools.length).toBe(59);
    // Tools with dedicated paintTo engine branches do not use paintPreset.
    const branched = new Set([
      "mixer-brush", "overlay-brush", "art-oil", "art-smear", "art-canvas",
      "art-poster", "art-glaze", "sketch-neon", "sketch-highlighter", "color-replacement",
    ]);
    const seen = new Map<string, string[]>();
    for (const t of fams.tools) {
      expect(PAINT_TOOLS.has(t.id as ToolId)).toBe(true);
      expect(dispatchKindOf(t.id as ToolId)).toBe("paint");
      if (branched.has(t.id)) continue;
      if (t.id === "brush") continue; // documented generic: pure user settings
      const fp = JSON.stringify(paintPreset(t.id as ToolId, 50));
      const arr = seen.get(fp) ?? [];
      arr.push(t.id);
      seen.set(fp, arr);
    }
    const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes).toEqual([]);
  });

  it("plan4 fase 8: heal family resolves to retouch with distinct fingerprints", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "heal")!;
    expect(fams.tools.length).toBe(39);
    const seen = new Map<string, string[]>();
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe("retouch");
      const mode = RETOUCH_MAP[t.id as ToolId];
      expect(mode, `${t.id} mode`).toBeTruthy();
      const tw = RETOUCH_TWEAK[t.id as ToolId] ?? {};
      const fp = JSON.stringify([mode, tw.strengthMul ?? 1, tw.radiusMul ?? 1]);
      const arr = seen.get(fp) ?? [];
      arr.push(t.id);
      seen.set(fp, arr);
    }
    const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes).toEqual([]);
  });

  it("plan4 fase 9: stamp family resolves to clone/paint as designed", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "stamp")!;
    expect(fams.tools.map((t) => t.id).sort()).toEqual(
      ["clone", "clone-mirror", "clone-rotate", "pattern-stamp", "pattern-fill", "texture-stamp", "history-brush", "art-history-brush", "clone-soft", "pattern-dots"].sort(),
    );
    for (const t of fams.tools) {
      // History brushes ride the generic paint path (full brush console);
      // the other eight are true clone dispatch.
      const expected = t.id === "history-brush" || t.id === "art-history-brush" ? "paint" : "clone";
      expect(dispatchKindOf(t.id as ToolId)).toBe(expected);
    }
    for (const id of ["clone", "clone-mirror", "clone-rotate", "clone-soft", "pattern-stamp", "pattern-dots", "texture-stamp", "pattern-fill"] as const) {
      expect(CLONE_TOOLS.has(id)).toBe(true);
    }
  });

  it("plan4 fase 10: tone family resolves to retouch with distinct fingerprints", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "tone")!;
    expect(fams.tools.length).toBe(36);
    const seen = new Map<string, string[]>();
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe("retouch");
      const mode = RETOUCH_MAP[t.id as ToolId];
      expect(mode, `${t.id} mode`).toBeTruthy();
      const tw = RETOUCH_TWEAK[t.id as ToolId] ?? {};
      const fp = JSON.stringify([mode, tw.strengthMul ?? 1, tw.radiusMul ?? 1]);
      const arr = seen.get(fp) ?? [];
      arr.push(t.id);
      seen.set(fp, arr);
    }
    const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes).toEqual([]);
  });

  it("plan4 fase 11: detail family resolves to retouch/distort with distinct fingerprints", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "detail")!;
    expect(fams.tools.length).toBe(58);
    const seen = new Map<string, string[]>();
    for (const t of fams.tools) {
      const k = dispatchKindOf(t.id as ToolId);
      if (t.id.startsWith("distort-")) {
        expect(k).toBe("distort");
        continue;
      }
      expect(k).toBe("retouch");
      const mode = RETOUCH_MAP[t.id as ToolId];
      expect(mode, `${t.id} mode`).toBeTruthy();
      const tw = RETOUCH_TWEAK[t.id as ToolId] ?? {};
      const fp = JSON.stringify([mode, tw.strengthMul ?? 1, tw.radiusMul ?? 1]);
      const arr = seen.get(fp) ?? [];
      arr.push(t.id);
      seen.set(fp, arr);
    }
    const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes).toEqual([]);
  });

  it("plan4 fase 12: paint family resolves to gradient/fill/click as designed", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "paint")!;
    expect(fams.tools.length).toBe(19);
    for (const t of fams.tools) {
      const expected =
        t.id === "gradient-fg-transparent" ? "click" : t.id.startsWith("gradient") ? "gradient" : "fill";
      expect(dispatchKindOf(t.id as ToolId)).toBe(expected);
    }
  });

  it("plan4 fase 13: vector family resolves to pen with explicit styles", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "vector")!;
    expect(fams.tools.length).toBe(11);
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe("pen");
      expect(PEN_TOOLS.has(t.id as ToolId)).toBe(true);
      expect(PEN_STYLES[t.id as ToolId], `${t.id} style`).toBeTruthy();
    }
  });

  it("plan4 fase 14: type family resolves to text", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "type")!;
    expect(fams.tools.length).toBe(19);
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe("text");
      expect(TEXT_TOOLS.has(t.id as ToolId)).toBe(true);
    }
  });

  it("plan4 fase 15: shape family resolves to shape with kind mapping", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "shape")!;
    expect(fams.tools.length).toBe(35);
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe("shape");
      expect(IS_SHAPE_TOOL.has(t.id as ToolId)).toBe(true);
      expect(SHAPE_KIND_OF[t.id as ToolId], `${t.id} kind`).toBeTruthy();
    }
  });

  it("plan4 fase 16: navigate family resolves as designed", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "navigate")!;
    expect(fams.tools.length).toBe(13);
    const moveTools = new Set(["hand", "pan", "rotate-view"]);
    for (const t of fams.tools) {
      const expected = moveTools.has(t.id) ? "move" : t.id === "rotate-15" ? "click" : "zoom";
      expect(dispatchKindOf(t.id as ToolId)).toBe(expected);
    }
  });

  it("plan4 fase 17: localfx family resolves to retouch with distinct modes", () => {
    const fams = TOOL_FAMILIES.find((f) => f.id === "localfx")!;
    expect(fams.tools.length).toBe(17);
    const seen = new Map<string, string[]>();
    for (const t of fams.tools) {
      expect(dispatchKindOf(t.id as ToolId)).toBe("retouch");
      const mode = RETOUCH_MAP[t.id as ToolId];
      expect(mode, `${t.id} mode`).toBeTruthy();
      const arr = seen.get(mode!) ?? [];
      arr.push(t.id);
      seen.set(mode!, arr);
    }
    const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(dupes).toEqual([]);
  });

  it("no orphan engine entries: every registered id exists in the toolbar", () => {
    const known = new Set(all.map((t) => t.id));
    const orphans: string[] = [];
    const checkSet = (name: string, set: Set<string>) => {
      for (const id of set) if (!known.has(id as ToolId)) orphans.push(`${name}/${id}`);
    };
    const checkMap = (name: string, map: Partial<Record<string, unknown>>) => {
      for (const id of Object.keys(map)) if (!known.has(id as ToolId)) orphans.push(`${name}/${id}`);
    };
    [
      ERASER_TOOLS, CLONE_TOOLS, MOVE_TOOLS, MARQUEE_TOOLS, EYEDROPPER_TOOLS,
      TEXT_TOOLS, ZOOM_TOOLS, MEASURE_DRAG_TOOLS, PEN_TOOLS, PAINT_TOOLS,
      GRADIENT_TOOLS, FILL_TOOLS, CLICK_TOOLS, IS_CROP_TOOL, IS_SELECTION_TOOL,
      IS_SHAPE_TOOL,
    ].forEach((s, i) =>
      checkSet(
        ["ERASER", "CLONE", "MOVE", "MARQUEE", "EYEDROPPER", "TEXT", "ZOOM", "MEASURE", "PEN", "PAINT", "GRADIENT", "FILL", "CLICK", "CROP", "SELECTION", "SHAPE"][i],
        s as Set<string>,
      ),
    );
    checkMap("RETOUCH_MAP", RETOUCH_MAP);
    checkMap("DISTORT_MAP", DISTORT_MAP);
    checkMap("CROP_RATIOS", CROP_RATIOS);
    checkMap("SHAPE_KIND_OF", SHAPE_KIND_OF);
    checkMap("PEN_STYLES", PEN_STYLES);
    checkMap("PATTERN_MOTIF_OF", PATTERN_MOTIF_OF);
    expect(orphans).toEqual([]);
  });
});
