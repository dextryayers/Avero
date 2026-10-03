// Right dock sizing: total width plus the Color/Layers split.
// Both values persist in EditorView localStorage keys. Every helper clamps
// so columns never collapse below a usable width while dragging.

export const DOCK_MIN_TOTAL = 320;
export const DOCK_MAX_TOTAL = 720;
export const DOCK_MIN_COL = 170;
export const DOCK_DEFAULT_TOTAL = 480;
export const DOCK_DEFAULT_SPLIT = 0.485;

export function clampTotal(w: number): number {
  if (!Number.isFinite(w)) return DOCK_DEFAULT_TOTAL;
  return Math.max(DOCK_MIN_TOTAL, Math.min(DOCK_MAX_TOTAL, Math.round(w)));
}

export function clampSplit(split: number, total: number): number {
  const t = clampTotal(total);
  if (!Number.isFinite(split)) return DOCK_DEFAULT_SPLIT;
  const lo = DOCK_MIN_COL / t;
  const hi = 1 - DOCK_MIN_COL / t;
  if (lo >= hi) return 0.5;
  return Math.max(lo, Math.min(hi, split));
}

export function splitWidths(total: number, split: number): { left: number; right: number } {
  const t = clampTotal(total);
  const s = clampSplit(split, t);
  const left = Math.round(t * s);
  return { left, right: t - left };
}
