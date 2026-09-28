import type { ToolId } from "../stores/useEditorStore";
import { ERASER_TOOLS } from "./toolPresets";

// Photo-safe eraser targeting (plan2 Fase B).
// Golden rule: paint-type erasers NEVER write to photo layers. Strokes live
// on transparent paint layers, so the eraser only removes strokes.
// Background Eraser and Magic Eraser are explicit photo-editing tools and
// intentionally operate on the active layer (with lock/selection guards).

export interface EraserLayerInfo {
  id: string;
  visible: boolean;
  locked: boolean;
}

export interface ResolveEraserTargetArgs {
  activeId: string | null;
  layers: EraserLayerInfo[];
  lastPaintId: string | null;
  isPhoto: (id: string) => boolean;
  hasCanvas: (id: string) => boolean;
}

export function isEraserTool(t: ToolId): boolean {
  return ERASER_TOOLS.has(t);
}

/** Paint-type erasers (retargeted, photo-safe). */
export function isPaintEraser(t: ToolId): boolean {
  return t === "eraser" || t === "eraser-hard" || t === "eraser-soft" || t === "eraser-block";
}

/** Photo-editing erasers (work on the active layer by design). */
export function isPhotoEraser(t: ToolId): boolean {
  return t === "background-eraser" || t === "magic-eraser";
}

/**
 * Resolve which layer a paint-type eraser stroke may touch.
 * Returns the active layer itself when it is not a photo, otherwise the
 * last painted stroke layer, otherwise the topmost editable non-photo layer.
 * Returns null when nothing is safely erasable (caller must notify, not paint).
 */
export function resolveEraserTarget(a: ResolveEraserTargetArgs): string | null {
  const { activeId, layers, lastPaintId, isPhoto, hasCanvas } = a;
  if (!activeId) return null;
  const active = layers.find((l) => l.id === activeId);
  if (!active || active.locked || !active.visible) return null;
  if (!isPhoto(activeId)) return activeId;
  const last = lastPaintId ? layers.find((l) => l.id === lastPaintId) : undefined;
  if (
    last &&
    last.visible &&
    !last.locked &&
    !isPhoto(last.id) &&
    hasCanvas(last.id)
  ) {
    return last.id;
  }
  const top = [...layers]
    .reverse()
    .find((l) => !isPhoto(l.id) && l.visible && !l.locked && hasCanvas(l.id));
  return top ? top.id : null;
}
