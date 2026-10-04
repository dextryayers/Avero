// One item per layer (plan6): pure helpers for stroke layer lifecycle.
// A deposit brush stroke opens a fresh layer; undoing that stroke removes
// the layer instead of leaving an empty shell, and redo recreates it.
// No store or canvas access here, so every rule below is unit tested.

export interface CreatedStrokeLayer {
  name: string;
  kind: "raster" | "background" | "text" | "shape" | "group" | "fill";
  opacity: number;
  blendMode: string;
}

export interface StrokeHistoryMeta {
  layerId: string;
  createdLayerId?: string;
  createdLayer?: CreatedStrokeLayer;
}

/**
 * True when undoing this entry must also remove its stroke layer:
 * the entry painted only its own fresh layer, the layer still exists,
 * and it is not the last layer standing.
 */
export function shouldRemoveStrokeLayer(
  entry: StrokeHistoryMeta,
  liveIds: readonly string[],
  totalLayers: number,
): boolean {
  const cid = entry.createdLayerId;
  if (!cid) return false;
  if (cid !== entry.layerId) return false;
  if (!liveIds.includes(cid)) return false;
  if (totalLayers <= 1) return false;
  return true;
}

/** True when redo must recreate the stroke layer before restoring pixels. */
export function shouldRecreateStrokeLayer(
  entry: StrokeHistoryMeta,
  liveIds: readonly string[],
): boolean {
  const cid = entry.createdLayerId;
  if (!cid || !entry.createdLayer) return false;
  if (cid !== entry.layerId) return false;
  return !liveIds.includes(cid);
}
