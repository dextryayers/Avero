// Sticker engine: 72 professional assets in 6 categories, zero emoji.
// Vector stamps render from declarative specs and FX overlays paint
// procedurally, both in the brush color with a white halo and soft shadow.
// Placed stickers become normal raster layers, which means the blue
// transform box can move, resize and rotate them exactly like photos.
// Legacy ids are reused unchanged, so the registry, shortcuts, dispatch
// and old documents (pixels only) never churn.

import { STICKER_V2, paintStickerArt, type NewStickerCategory, type StickerFxKind, type StickerShape } from "./stickerArt";

export type StickerCategory = NewStickerCategory;

export interface StickerMeta {
  id: string;
  label: string;
  category: StickerCategory;
  description: string;
  art: StickerShape[];
  fx?: StickerFxKind;
}

export const STICKER_CATEGORIES: { id: StickerCategory; label: string }[] = [
  { id: "marks", label: "Marks" },
  { id: "badges", label: "Badges" },
  { id: "frames", label: "Frames" },
  { id: "labels", label: "Labels" },
  { id: "nature", label: "Nature" },
  { id: "fx", label: "FX" },
  { id: "poster", label: "Poster" },
  { id: "social", label: "Social" },
];

export const STICKER_META: StickerMeta[] = STICKER_V2.map((s) => ({
  id: s.id,
  label: s.label,
  category: s.category,
  description: `${s.label} asset. Click the canvas to place it.`,
  art: s.shapes,
  fx: s.fx,
}));

export const STICKER_BY_ID: Record<string, StickerMeta> = Object.fromEntries(
  STICKER_META.map((s) => [s.id, s]),
);

export const STICKER_IDS: string[] = STICKER_META.map((s) => s.id);

export const STICKER_USAGE =
  "Click the canvas to place. Then use Move to resize or rotate.";

export function isStickerTool(id: string): boolean {
  return id.startsWith("sticker-");
}

export function getSticker(id: string): StickerMeta | undefined {
  return STICKER_BY_ID[id];
}

/** Sensible default sticker size for a document: 22 percent of the short side. */
export function defaultStickerSize(docW: number, docH: number): number {
  const m = Math.min(Math.max(1, docW), Math.max(1, docH));
  return Math.max(96, Math.min(384, Math.round(m * 0.22)));
}

/** Stamp a sticker onto a document size layer canvas. Returns false for unknown ids. */
export function renderStickerToLayer(
  canvas: HTMLCanvasElement,
  stickerId: string,
  dx: number,
  dy: number,
  sizePx: number,
  color: string,
): boolean {
  const meta = STICKER_BY_ID[stickerId];
  if (!meta) return false;
  const s = Math.max(16, Math.round(sizePx));
  try {
    const tile = document.createElement("canvas");
    tile.width = s;
    tile.height = s;
    const g = tile.getContext("2d");
    if (!g) return false;
    paintStickerArt(g, { shapes: meta.art, fx: meta.fx }, color, s);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tile, Math.round(dx), Math.round(dy), s, s);
    return true;
  } catch {
    return false;
  }
}
