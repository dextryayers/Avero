// Plan5 Fase 4: pure merge policy for auto segmentation (unit-tested).
// Rust owns tensors and pixels; TypeScript owns boxes, labels and merge
// policy: dedupe near-duplicates, drop specks, order for layering.

export type SegmentSource = "yolo" | "stuff" | "text";

export interface MergeBox {
  label: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
  source: SegmentSource;
}

export function boxArea(b: { w: number; h: number }): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

export function iouBoxes(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const ix0 = Math.max(a.x, b.x);
  const iy0 = Math.max(a.y, b.y);
  const ix1 = Math.min(a.x + a.w, b.x + b.w);
  const iy1 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, ix1 - ix0);
  const ih = Math.max(0, iy1 - iy0);
  const inter = iw * ih;
  const ua = boxArea(a) + boxArea(b) - inter;
  return ua <= 0 ? 0 : inter / ua;
}

/** Drop near-duplicate boxes of the same label, keeping the best score. */
export function dedupeSameLabel<T extends MergeBox>(items: T[], iouThr = 0.85): T[] {
  const sorted = [...items].sort((p, q) => q.score - p.score);
  const kept: T[] = [];
  for (const it of sorted) {
    let clash = false;
    for (const k of kept) {
      if (k.label === it.label && iouBoxes(k, it) > iouThr) {
        clash = true;
        break;
      }
    }
    if (!clash) kept.push(it);
  }
  return kept;
}

/** Drop boxes under a fraction of the frame area (speck filter). */
export function filterMinArea<T extends { w: number; h: number }>(
  items: T[],
  frameArea: number,
  frac = 0.003,
): T[] {
  if (frameArea <= 0) return [];
  return items.filter((it) => boxArea(it) >= frameArea * frac);
}

export function sortAreaDesc<T extends { w: number; h: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => boxArea(b) - boxArea(a));
}

/** Reading order: bands of ~8% frame height, then left to right. */
export function readingOrder<T extends { x: number; y: number; w: number; h: number }>(
  items: T[],
  frameH: number,
): T[] {
  const band = Math.max(1, frameH * 0.08);
  return [...items].sort((a, b) => {
    const ra = Math.floor((a.y + a.h / 2) / band);
    const rb = Math.floor((b.y + b.h / 2) / band);
    if (ra !== rb) return ra - rb;
    return a.x - b.x;
  });
}

/** Round a box and clamp it inside the frame (min 2px side). */
export function clampBox(
  b: { x: number; y: number; w: number; h: number },
  W: number,
  H: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, Math.min(W - 1, Math.round(b.x)));
  const y = Math.max(0, Math.min(H - 1, Math.round(b.y)));
  const w = Math.max(2, Math.min(W - x, Math.round(b.w)));
  const h = Math.max(2, Math.min(H - y, Math.round(b.h)));
  return { x, y, w, h };
}
