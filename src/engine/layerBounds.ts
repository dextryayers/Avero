// layerBounds: Canva-style per-layer geometry for click-select + transform box.
// Layers store full doc-size canvases, so the tight content rect is derived
// from non-transparent pixels, then the non-destructive transform
// (translate / scale / rotate around doc center, same order as the compositor)
// maps it to screen space.

export interface ContentRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export const DEFAULT_TRANSFORM: LayerTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Forward map: untransformed doc point -> transformed doc point. */
export function applyLayerTransform(
  px: number,
  py: number,
  docW: number,
  docH: number,
  t: LayerTransform,
): { x: number; y: number } {
  const cx = docW / 2;
  const cy = docH / 2;
  let vx = (px - cx) * t.scaleX;
  let vy = (py - cy) * t.scaleY;
  const r = deg2rad(t.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const rx = vx * cos - vy * sin;
  const ry = vx * sin + vy * cos;
  return { x: rx + cx + t.x, y: ry + cy + t.y };
}

/** Inverse map: transformed doc point -> untransformed doc point. */
export function inverseLayerTransform(
  px: number,
  py: number,
  docW: number,
  docH: number,
  t: LayerTransform,
): { x: number; y: number } {
  const cx = docW / 2;
  const cy = docH / 2;
  const dx = px - cx - t.x;
  const dy = py - cy - t.y;
  const r = deg2rad(-t.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const ux = dx * cos - dy * sin;
  const uy = dx * sin + dy * cos;
  const sx = t.scaleX === 0 ? 0 : ux / t.scaleX;
  const sy = t.scaleY === 0 ? 0 : uy / t.scaleY;
  return { x: sx + cx, y: sy + cy };
}

/** Transformed center + pixel size of a content rect (for the HTML overlay). */
export function transformedBox(
  rect: ContentRect,
  docW: number,
  docH: number,
  t: LayerTransform,
): { cx: number; cy: number; w: number; h: number; rotation: number } {
  const ccx = rect.x + rect.w / 2;
  const ccy = rect.y + rect.h / 2;
  const c = applyLayerTransform(ccx, ccy, docW, docH, t);
  return {
    cx: c.x,
    cy: c.y,
    w: Math.max(1, rect.w * Math.abs(t.scaleX)),
    h: Math.max(1, rect.h * Math.abs(t.scaleY)),
    rotation: t.rotation,
  };
}

/**
 * Tight content bounds of a layer canvas (doc-space, untransformed).
 * Hybrid: full scan with stride for docs <= ~12MP, thumbnail scan above that
 * so 4K/8K canvases stay fast. Returns null when fully transparent.
 */
export function getContentBounds(canvas: HTMLCanvasElement): ContentRect | null {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 1 || h < 1) return null;
  try {
    // Large canvas: downscale to a thumbnail and scan that.
    if (w * h > 12_000_000) {
      const maxSide = 240;
      const sc = Math.min(1, maxSide / Math.max(w, h));
      const tw = Math.max(1, Math.round(w * sc));
      const th = Math.max(1, Math.round(h * sc));
      const tmp = document.createElement("canvas");
      tmp.width = tw;
      tmp.height = th;
      const tctx = tmp.getContext("2d", { willReadFrequently: true })!;
      tctx.drawImage(canvas, 0, 0, tw, th);
      const id = tctx.getImageData(0, 0, tw, th);
      const d = id.data;
      let x0 = tw;
      let y0 = th;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          if (d[(y * tw + x) * 4 + 3] > 10) {
            if (x < x0) x0 = x;
            if (y < y0) y0 = y;
            if (x > x1) x1 = x;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;
      return {
        x: Math.floor(x0 / sc),
        y: Math.floor(y0 / sc),
        w: Math.max(1, Math.ceil((x1 - x0 + 1) / sc)),
        h: Math.max(1, Math.ceil((y1 - y0 + 1) / sc)),
      };
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const stride = Math.max(1, Math.floor(Math.max(w, h) / 600));
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        if (d[(y * w + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    // Expand by stride so the box is not 1 stride too tight.
    x0 = Math.max(0, x0 - stride);
    y0 = Math.max(0, y0 - stride);
    x1 = Math.min(w - 1, x1 + stride);
    y1 = Math.min(h - 1, y1 + stride);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch {
    return null;
  }
}

/** Alpha at an untransformed doc point (0 when outside). */
export function alphaAt(canvas: HTMLCanvasElement, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) return 0;
  try {
    const a = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1)
      .data[3];
    return a;
  } catch {
    return 0;
  }
}

export interface HittableLayer {
  id: string;
  visible: boolean;
  canvas: HTMLCanvasElement | undefined;
  bounds: ContentRect | null;
  transform: LayerTransform;
}

/**
 * Topmost layer under a doc-space point. Bounds are checked in transformed
 * space, then a 1px alpha test lets clicks pass through transparent areas
 * (Canva-style). Caller supplies layers topmost-first.
 */
export function pickTopLayerAt(
  docX: number,
  docY: number,
  docW: number,
  docH: number,
  orderedTopFirst: HittableLayer[],
): string | null {
  for (const l of orderedTopFirst) {
    if (!l.visible || !l.canvas || !l.bounds) continue;
    const b = l.bounds;
    const local = inverseLayerTransform(docX, docY, docW, docH, l.transform);
    if (local.x < b.x || local.y < b.y || local.x > b.x + b.w || local.y > b.y + b.h) {
      continue;
    }
    if (alphaAt(l.canvas, local.x, local.y) > 8) return l.id;
  }
  return null;
}

/** Fallback when alpha test is too strict: bounding-box only pick. */
export function pickBoxAt(
  docX: number,
  docY: number,
  docW: number,
  docH: number,
  orderedTopFirst: HittableLayer[],
): string | null {
  for (const l of orderedTopFirst) {
    if (!l.visible || !l.bounds) continue;
    const b = l.bounds;
    const local = inverseLayerTransform(docX, docY, docW, docH, l.transform);
    if (local.x >= b.x && local.y >= b.y && local.x <= b.x + b.w && local.y <= b.y + b.h) {
      return l.id;
    }
  }
  return null;
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

const MIN_SCALE = 0.02;
const MAX_SCALE = 8;

function clampScale(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, v));
}

/**
 * Opposite anchor point in untransformed content coords for a handle.
 * Corners anchor the opposite corner, edges anchor the opposite edge
 * center, so the dragged side grows toward the pointer Canva style.
 */
export function anchorForHandle(content: ContentRect, handle: ResizeHandle): { x: number; y: number } {
  const cx = content.x + content.w / 2;
  const cy = content.y + content.h / 2;
  switch (handle) {
    case "nw":
      return { x: content.x + content.w, y: content.y + content.h };
    case "ne":
      return { x: content.x, y: content.y + content.h };
    case "sw":
      return { x: content.x + content.w, y: content.y };
    case "se":
      return { x: content.x, y: content.y };
    case "n":
      return { x: cx, y: content.y + content.h };
    case "s":
      return { x: cx, y: content.y };
    case "e":
      return { x: content.x, y: cy };
    case "w":
      return { x: content.x + content.w, y: cy };
  }
}

/**
 * Exact opposite-corner anchored resize for the doc-center pivot compositor.
 * Scale comes from the pointer distance to the fixed anchor (unrotated
 * frame), so the dragged edge lands exactly under the pointer, the anchor
 * never moves, and scales stay positive so mirrors never appear. Flip
 * stays exclusive to the Flip buttons, which intentionally negate an axis.
 */
export function resizeAboutAnchor(
  content: ContentRect,
  docW: number,
  docH: number,
  start: LayerTransform,
  handle: ResizeHandle,
  pointerDoc: { x: number; y: number },
  lockAspect: boolean,
): { scaleX: number; scaleY: number; x: number; y: number } {
  const signX = start.scaleX < 0 ? -1 : 1;
  const signY = start.scaleY < 0 ? -1 : 1;
  const anchor = anchorForHandle(content, handle);
  const fixed = applyLayerTransform(anchor.x, anchor.y, docW, docH, start);
  const rad = deg2rad(-start.rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ux = (pointerDoc.x - fixed.x) * cos - (pointerDoc.y - fixed.y) * sin;
  const uy = (pointerDoc.x - fixed.x) * sin + (pointerDoc.y - fixed.y) * cos;
  const affectsX = handle === "nw" || handle === "ne" || handle === "sw" || handle === "se" || handle === "e" || handle === "w";
  const affectsY = handle === "nw" || handle === "ne" || handle === "sw" || handle === "se" || handle === "n" || handle === "s";
  const isCorner = affectsX && affectsY;
  const rawX = content.w > 0 ? Math.abs(ux) / content.w : Math.abs(start.scaleX) || 1;
  const rawY = content.h > 0 ? Math.abs(uy) / content.h : Math.abs(start.scaleY) || 1;
  let magX = affectsX ? clampScale(rawX) : Math.abs(start.scaleX) || 1;
  let magY = affectsY ? clampScale(rawY) : Math.abs(start.scaleY) || 1;
  if (isCorner && lockAspect) {
    const r = clampScale(Math.max(rawX, rawY));
    magX = r;
    magY = r;
  }
  const scaleX = affectsX ? signX * magX : start.scaleX;
  const scaleY = affectsY ? signY * magY : start.scaleY;
  // Compensate translation so the anchor maps back onto its fixed point.
  const moved = applyLayerTransform(anchor.x, anchor.y, docW, docH, { ...start, scaleX, scaleY });
  return { scaleX, scaleY, x: start.x + (fixed.x - moved.x), y: start.y + (fixed.y - moved.y) };
}

/**
 * Rotation that spins in place: the content center stays pixel fixed while
 * the angle follows the pointer, so layers never orbit the document center.
 */
export function rotateAboutContentCenter(
  content: ContentRect,
  docW: number,
  docH: number,
  start: LayerTransform,
  nextRotation: number,
): { rotation: number; x: number; y: number } {
  const ccx = content.x + content.w / 2;
  const ccy = content.y + content.h / 2;
  const before = applyLayerTransform(ccx, ccy, docW, docH, start);
  const after = applyLayerTransform(ccx, ccy, docW, docH, { ...start, rotation: nextRotation });
  return { rotation: nextRotation, x: start.x + (before.x - after.x), y: start.y + (before.y - after.y) };
}

/**
 * Corner and edge resize math with a strict no mirror rule.
 * Local offsets are absolute distances from the box center, so dragging a
 * handle across the center shrinks the image toward zero and grows it again
 * without ever flipping it. Flip stays exclusive to the Flip H and Flip V
 * buttons, which intentionally negate a scale axis.
 */
export function resizeScales(
  contentW: number,
  contentH: number,
  startScaleX: number,
  startScaleY: number,
  handle: ResizeHandle,
  localX: number,
  localY: number,
  lockAspect: boolean,
): { scaleX: number; scaleY: number } {
  const signX = startScaleX < 0 ? -1 : 1;
  const signY = startScaleY < 0 ? -1 : 1;
  const ax = Math.abs(localX);
  const ay = Math.abs(localY);
  const isCorner = handle === "nw" || handle === "ne" || handle === "sw" || handle === "se";
  if (isCorner && lockAspect) {
    const rx = contentW > 1 ? (ax * 2) / contentW : Math.abs(startScaleX) || 1;
    const ry = contentH > 1 ? (ay * 2) / contentH : Math.abs(startScaleY) || 1;
    const r = clampScale(Math.max(rx, ry));
    return { scaleX: signX * r, scaleY: signY * r };
  }
  if (isCorner) {
    const nx = contentW > 1 ? clampScale((ax * 2) / contentW) : Math.abs(startScaleX) || 1;
    const ny = contentH > 1 ? clampScale((ay * 2) / contentH) : Math.abs(startScaleY) || 1;
    return { scaleX: signX * nx, scaleY: signY * ny };
  }
  if (handle === "e" || handle === "w") {
    const nx = contentW > 1 ? clampScale((ax * 2) / contentW) : Math.abs(startScaleX) || 1;
    return { scaleX: signX * nx, scaleY: startScaleY };
  }
  const ny = contentH > 1 ? clampScale((ay * 2) / contentH) : Math.abs(startScaleY) || 1;
  return { scaleX: startScaleX, scaleY: signY * ny };
}
