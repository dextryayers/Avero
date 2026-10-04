import { describe, it, expect } from "vitest";
import {
  TOOL_FAMILIES,
  TOOL_LABEL,
  TOOL_MAP,
  FAMILY_OF,
  TOOLS,
} from "../components/ToolBar";
import {
  dispatchKindOf,
  ERASER_TOOLS,
  CLONE_TOOLS,
  FRESH_STROKE_TOOLS,
  STAY_ON_LAYER_TOOLS,
  MOVE_TOOLS,
  MARQUEE_TOOLS,
  EYEDROPPER_TOOLS,
  TEXT_TOOLS,
  ZOOM_TOOLS,
  MEASURE_DRAG_TOOLS,
  PEN_TOOLS,
  GRADIENT_TOOLS,
  FILL_TOOLS,
  CLICK_TOOLS,
  IS_CROP_TOOL,
  IS_SELECTION_TOOL,
  IS_SHAPE_TOOL,
  PAINT_TOOLS,
  RETOUCH_MAP,
  DISTORT_MAP,
} from "./toolPresets";

describe("tool registry completeness (plan2 A.0)", () => {
  it("every listed tool resolves to exactly one dispatch kind (no dead tools)", () => {
    const dead: string[] = [];
    for (const t of TOOLS) {
      if (dispatchKindOf(t.id) === null) dead.push(t.id);
    }
    expect(dead).toEqual([]);
  });

  it("label, map and family lookups cover every tool", () => {
    for (const t of TOOLS) {
      expect(TOOL_LABEL[t.id], `${t.id} label`).toBeTruthy();
      expect(TOOL_MAP[t.id], `${t.id} map`).toBeTruthy();
      expect(FAMILY_OF[t.id], `${t.id} family`).toBeTruthy();
    }
  });

  it("every tool has description, usage and shortcut", () => {
    const bad: string[] = [];
    for (const f of TOOL_FAMILIES) {
      for (const t of f.tools) {
        if (!t.description.trim() || !t.usage.trim() || !t.shortcut.trim()) bad.push(t.id);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no duplicate ids and no empty families", () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const t of TOOLS) {
      if (seen.has(t.id)) dup.push(t.id);
      seen.add(t.id);
    }
    expect(dup).toEqual([]);
    for (const f of TOOL_FAMILIES) {
      expect(f.tools.length, `${f.id} empty`).toBeGreaterThan(0);
    }
  });

  it("eraser family routes all six erasers to paint (photo-safe path)", () => {
    for (const id of ["eraser", "background-eraser", "magic-eraser", "eraser-hard", "eraser-soft", "eraser-block"] as const) {
      expect(ERASER_TOOLS.has(id)).toBe(true);
      expect(dispatchKindOf(id)).toBe("paint");
    }
  });

  it("clone family routes all eight clone tools to clone", () => {
    for (const id of ["clone", "clone-mirror", "clone-rotate", "clone-soft", "pattern-stamp", "pattern-dots", "texture-stamp", "pattern-fill"] as const) {
      expect(CLONE_TOOLS.has(id)).toBe(true);
      expect(dispatchKindOf(id)).toBe("clone");
    }
  });

  it("every retouch map entry and distort map entry dispatches", () => {
    for (const id of Object.keys(RETOUCH_MAP)) {
      expect(dispatchKindOf(id as never), id).not.toBeNull();
    }
    for (const id of Object.keys(DISTORT_MAP)) {
      expect(dispatchKindOf(id as never)).toBe("distort");
    }
  });

  it("crop, selection and shape sets all dispatch", () => {
    for (const id of IS_CROP_TOOL) expect(dispatchKindOf(id)).toBe("crop");
    for (const id of IS_SELECTION_TOOL) expect(dispatchKindOf(id), id).not.toBeNull();
    for (const id of IS_SHAPE_TOOL) expect(dispatchKindOf(id)).toBe("shape");
  });

  it("move, text, zoom, measure, pen, gradient, fill and eyedropper sets all dispatch", () => {
    for (const id of MOVE_TOOLS) expect(dispatchKindOf(id)).toBe("move");
    for (const id of TEXT_TOOLS) expect(dispatchKindOf(id)).toBe("text");
    for (const id of ZOOM_TOOLS) expect(dispatchKindOf(id)).toBe("zoom");
    for (const id of MEASURE_DRAG_TOOLS) expect(dispatchKindOf(id)).toBe("measure");
    for (const id of PEN_TOOLS) expect(dispatchKindOf(id)).toBe("pen");
    for (const id of GRADIENT_TOOLS) expect(dispatchKindOf(id)).toBe("gradient");
    for (const id of FILL_TOOLS) expect(dispatchKindOf(id)).toBe("fill");
    for (const id of EYEDROPPER_TOOLS) expect(dispatchKindOf(id)).toBe("eyedropper");
    for (const id of MARQUEE_TOOLS) expect(dispatchKindOf(id)).toBe("selection");
  });

  it("paint tools all dispatch to paint", () => {
    for (const id of PAINT_TOOLS) expect(dispatchKindOf(id)).toBe("paint");
  });

  it("click tools all dispatch to click", () => {
    for (const id of CLICK_TOOLS) expect(dispatchKindOf(id)).toBe("click");
  });

  it("fresh stroke set partitions paint tools with documented keepers", () => {
    for (const id of PAINT_TOOLS) {
      const fresh = FRESH_STROKE_TOOLS.has(id);
      const keeper = (STAY_ON_LAYER_TOOLS as Set<string>).has(id);
      expect(fresh !== keeper, id).toBe(true);
    }
    expect([...STAY_ON_LAYER_TOOLS].sort()).toEqual([
      "art-oil",
      "art-smear",
      "brush-wet",
      "color-replacement",
      "mixer-brush",
    ]);
  });
});
