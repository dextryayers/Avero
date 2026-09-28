import { describe, it, expect } from "vitest";
import { TOOLS } from "../components/ToolBar";
import {
  CLONE_TOOLS,
  CLICK_TOOLS,
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
  PEN_TOOLS,
  RETOUCH_MAP,
  TEXT_TOOLS,
  ZOOM_TOOLS,
} from "./toolPresets";
import { TOOL_HINT, topBarKindOf, type TopBarKind } from "./toolOptions";

const GENERIC_TRAPS = [
  "Select and drag on canvas to use this tool.",
  "Click to auto select.",
  "Drag to select. Shift adds, Alt subtracts.",
];

function allKnownIds(): string[] {
  const s = new Set<string>();
  for (const t of TOOLS) s.add(t.id);
  for (const id of PAINT_TOOLS) s.add(id as string);
  for (const id of Object.keys(RETOUCH_MAP)) s.add(id);
  for (const id of Object.keys(DISTORT_MAP)) s.add(id);
  for (const id of ERASER_TOOLS) s.add(id as string);
  for (const id of CLONE_TOOLS) s.add(id as string);
  for (const id of IS_CROP_TOOL) s.add(id as string);
  for (const id of IS_SELECTION_TOOL) s.add(id as string);
  for (const id of IS_SHAPE_TOOL) s.add(id as string);
  for (const id of MOVE_TOOLS) s.add(id as string);
  for (const id of TEXT_TOOLS) s.add(id as string);
  for (const id of ZOOM_TOOLS) s.add(id as string);
  for (const id of MEASURE_DRAG_TOOLS) s.add(id as string);
  for (const id of PEN_TOOLS) s.add(id as string);
  for (const id of GRADIENT_TOOLS) s.add(id as string);
  for (const id of FILL_TOOLS) s.add(id as string);
  for (const id of EYEDROPPER_TOOLS) s.add(id as string);
  for (const id of MARQUEE_TOOLS) s.add(id as string);
  for (const id of CLICK_TOOLS) s.add(id as string);
  return [...s];
}

describe("top options bar model (plan2 Fase E)", () => {
  it("every known tool has a specific non-empty hint (zero generic fallbacks)", () => {
    const bad: string[] = [];
    for (const id of allKnownIds()) {
      const h = (TOOL_HINT as Record<string, string>)[id];
      if (!h || !h.trim() || GENERIC_TRAPS.includes(h)) bad.push(id);
    }
    expect(bad).toEqual([]);
  });

  it("every toolbar tool resolves to exactly one bar kind", () => {
    const kinds: TopBarKind[] = [
      "paint", "retouch", "eraser", "clone", "select-marquee", "select-auto",
      "select-click", "crop", "crop-overlay", "shape", "text", "pen",
      "gradient", "fill", "measure", "navigate", "move", "eyedropper", "click",
    ];
    for (const t of TOOLS) {
      expect(kinds).toContain(topBarKindOf(t.id as never));
    }
  });

  it("spot-checks kinds that users hit every minute", () => {
    expect(topBarKindOf("brush" as never)).toBe("paint");
    expect(topBarKindOf("dry-flat" as never)).toBe("paint");
    expect(topBarKindOf("magic-eraser" as never)).toBe("eraser");
    expect(topBarKindOf("clone" as never)).toBe("clone");
    expect(topBarKindOf("healing-brush" as never)).toBe("clone");
    expect(topBarKindOf("select-rect" as never)).toBe("select-marquee");
    expect(topBarKindOf("wand" as never)).toBe("select-auto");
    expect(topBarKindOf("select-grow" as never)).toBe("select-click");
    expect(topBarKindOf("crop" as never)).toBe("crop");
    expect(topBarKindOf("crop-169" as never)).toBe("crop");
    expect(topBarKindOf("crop-thirds" as never)).toBe("crop-overlay");
    expect(topBarKindOf("shape-rect" as never)).toBe("shape");
    expect(topBarKindOf("text" as never)).toBe("text");
    expect(topBarKindOf("pen" as never)).toBe("pen");
    expect(topBarKindOf("gradient" as never)).toBe("gradient");
    expect(topBarKindOf("fill" as never)).toBe("fill");
    expect(topBarKindOf("ruler" as never)).toBe("measure");
    expect(topBarKindOf("zoom" as never)).toBe("navigate");
    expect(topBarKindOf("move" as never)).toBe("move");
    expect(topBarKindOf("align-center" as never)).toBe("move");
    expect(topBarKindOf("eyedropper" as never)).toBe("eyedropper");
    expect(topBarKindOf("dodge" as never)).toBe("retouch");
    expect(topBarKindOf("distort-twirl" as never)).toBe("retouch");
    expect(topBarKindOf("blur" as never)).toBe("retouch");
  });

  it("no em-dash sneaks into bar hints", () => {
    const bad = Object.entries(TOOL_HINT).filter(([, h]) => h.includes("\u2014"));
    expect(bad).toEqual([]);
  });
});
