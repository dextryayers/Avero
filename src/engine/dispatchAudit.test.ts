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
  SHAPE_KIND_OF,
  TEXT_TOOLS,
  ZOOM_TOOLS,
  dispatchKindOf,
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
