import type { ToolId } from "../stores/useEditorStore";
import { ERASER_TOOLS } from "./toolPresets";

// Photo-safe + paper-safe eraser targeting (plan2 Fase B, plan3 Fase 0).
// Golden rules:
// 1. Paint-type erasers NEVER write to photo layers. Strokes live on
//    transparent paint layers, so the eraser only removes strokes.
// 2. NO eraser ever eats the document paper: kind "background" layers are
//    never returned as targets. Brush strokes on paper auto-create a
//    transparent paint layer (see needsFreshPaintLayer), so there is always
//    a safe stroke layer to erase instead of punching holes in the paper.
// 3. Background Eraser and Magic Eraser are explicit photo-editing tools and
//    operate on the active layer (with lock/visibility/selection guards),
//    but they refuse kind "background" layers (guarded in CanvasArea).

export interface EraserLayerInfo {
  id: string;
  visible: boolean;
  locked: boolean;
  kind?: string;
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
 * Returns the active layer itself when it is an ordinary editable raster
 * layer, otherwise the last painted stroke layer, otherwise the topmost
 * editable non-photo non-background layer.
 * Photo layers and background (paper) layers are NEVER returned.
 * Returns null when nothing is safely erasable (caller must notify, not paint).
 */
export function resolveEraserTarget(a: ResolveEraserTargetArgs): string | null {
  const { activeId, layers, lastPaintId, isPhoto, hasCanvas } = a;
  if (!activeId) return null;
  const active = layers.find((l) => l.id === activeId);
  if (!active || active.locked || !active.visible) return null;
  const isBg = (l: EraserLayerInfo) => l.kind === "background";
  if (!isPhoto(activeId) && !isBg(active)) return activeId;
  const usable = (l: EraserLayerInfo | undefined) =>
    !!l && l.visible && !l.locked && !isPhoto(l.id) && !isBg(l) && hasCanvas(l.id);
  const last = lastPaintId ? layers.find((l) => l.id === lastPaintId) : undefined;
  if (usable(last)) {
    return last!.id;
  }
  const top = [...layers].reverse().find((l) => usable(l));
  return top ? top.id : null;
}

/**
 * Whether brush-family strokes must go to a fresh transparent paint layer
 * instead of painting directly on the active layer. True for photos (strokes
 * would merge with pixels) and for background paper (strokes would fuse with
 * the paper so the eraser could never remove only the stroke). Pure helper
 * so the rule is unit-testable and shared by every paint entry point.
 */
export function needsFreshPaintLayer(kind: string | undefined, isPhoto: boolean): boolean {
  return isPhoto || kind === "background";
}
