import { describe, expect, it } from "vitest";
import {
  STICKER_BY_ID,
  STICKER_CATEGORIES,
  STICKER_IDS,
  STICKER_META,
  STICKER_USAGE,
  defaultStickerSize,
  getSticker,
  isStickerTool,
} from "./stickers";
import { TOOL_FAMILIES } from "../components/ToolBar";
import { validateStickerArt } from "./stickerArt";
import { STICKER_TOOLS, dispatchKindOf } from "./toolPresets";
import { TOOL_HINT, topBarKindOf } from "./toolOptions";
import type { ToolId } from "../stores/useEditorStore";

describe("sticker studio catalog", () => {
  it("ships 70 or more stickers", () => {
    expect(STICKER_META.length).toBeGreaterThanOrEqual(70);
    expect(STICKER_IDS.length).toBe(STICKER_META.length);
  });

  it("has unique ids, all prefixed, with art, label and description", () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const s of STICKER_META) {
      if (seen.has(s.id)) dup.push(s.id);
      seen.add(s.id);
      expect(s.id.startsWith("sticker-"), s.id).toBe(true);
      if (s.fx) {
        expect(s.art, `${s.id} art`).toEqual([]);
      } else {
        expect(validateStickerArt(s.art), `${s.id} art`).toEqual([]);
      }
      expect(s.label.trim().length, `${s.id} label`).toBeGreaterThan(0);
      expect(s.description.trim().length, `${s.id} description`).toBeGreaterThan(0);
    }
    expect(dup).toEqual([]);
  });

  it("covers 8 professional categories with the frozen counts", () => {
    expect(STICKER_CATEGORIES.map((c) => c.id).sort()).toEqual(
      ["badges", "frames", "fx", "labels", "marks", "nature", "poster", "social"].sort(),
    );
    const counts: Record<string, number> = {
      marks: 14,
      badges: 12,
      frames: 12,
      labels: 12,
      nature: 10,
      fx: 24,
      poster: 24,
      social: 12,
    };
    for (const c of STICKER_CATEGORIES) {
      const n = STICKER_META.filter((s) => s.category === c.id).length;
      expect(n, c.id).toBe(counts[c.id]);
    }
  });

  it("lookup helpers agree with the catalog", () => {
    for (const s of STICKER_META) {
      expect(STICKER_BY_ID[s.id]).toBe(s);
      expect(getSticker(s.id)).toBe(s);
      expect(isStickerTool(s.id)).toBe(true);
      expect(STICKER_TOOLS.has(s.id as ToolId)).toBe(true);
    }
    expect(isStickerTool("brush")).toBe(false);
    expect(getSticker("sticker-nope")).toBeUndefined();
  });

  it("default size scales with the document and stays clamped", () => {
    expect(defaultStickerSize(1920, 1080)).toBeGreaterThanOrEqual(96);
    expect(defaultStickerSize(1920, 1080)).toBeLessThanOrEqual(384);
    expect(defaultStickerSize(10000, 8000)).toBe(384);
    expect(defaultStickerSize(100, 100)).toBe(96);
  });

  it("toolbar sticker family mirrors the catalog exactly", () => {
    const fam = TOOL_FAMILIES.find((f) => f.id === "sticker");
    expect(fam).toBeTruthy();
    expect(fam!.tools.length).toBe(STICKER_META.length);
    const barIds = new Set<string>(fam!.tools.map((t) => t.id));
    for (const id of STICKER_IDS) expect(barIds.has(id), id).toBe(true);
  });

  it("every sticker dispatches, hints and lands on the click top bar", () => {
    for (const s of STICKER_META) {
      expect(dispatchKindOf(s.id as ToolId), s.id).toBe("sticker");
      expect(topBarKindOf(s.id as ToolId), s.id).toBe("click");
      const h = TOOL_HINT[s.id as ToolId];
      expect(h && h.trim().length > 0, `${s.id} hint`).toBe(true);
    }
    expect(STICKER_USAGE.trim().length).toBeGreaterThan(0);
  });

  it("no em dash in sticker strings", () => {
    const bad: string[] = [];
    for (const s of STICKER_META) {
      if (`${s.label} ${s.description}`.includes("\u2014")) bad.push(s.id);
    }
    expect(bad).toEqual([]);
  });
});
