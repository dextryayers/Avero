// Selection engine.
// The selection is stored as an alpha mask on a document-sized offscreen canvas.
// Types: rect marquee, freehand/polygon lasso, tolerance flood-fill wand.
// Ops: feather (blur), expand/contract (dilate/erode approximation), inverse, clear.

export type SelectionKind = "none" | "rect" | "lasso" | "wand";

export interface RectSel {
  x: number;
  y: number;
  w: number;
  h: number;
}

let selCanvas: HTMLCanvasElement | null = null;
let selW = 0;
let selH = 0;

// Last-selection memory for the Reselect tool: keeps the previous mask so
// users can bring it back after clearing.
let lastCanvas: HTMLCanvasElement | null = null;

function stashCurrent() {
  if (!selCanvas || !hasSelection()) return;
  try {
    if (!lastCanvas || lastCanvas.width !== selCanvas.width || lastCanvas.height !== selCanvas.height) {
      lastCanvas = document.createElement("canvas");
      lastCanvas.width = selCanvas.width;
      lastCanvas.height = selCanvas.height;
    }
    const g = lastCanvas.getContext("2d")!;
    g.clearRect(0, 0, lastCanvas.width, lastCanvas.height);
    g.drawImage(selCanvas, 0, 0);
  } catch {
    /* ignore */
  }
}

export function hasLastSelection(): boolean {
  return !!lastCanvas;
}

export function restoreLastSelection(): boolean {
  if (!lastCanvas) return false;
  const c = ensureSel(lastCanvas.width, lastCanvas.height);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(lastCanvas, 0, 0);
  markSelectionDirty();
  return true;
}

// Fast path: cache the hasSelection result to avoid a full getImageData per frame.
// A 1920x1080 getImageData is an 8MB copy on every call, hit several times per render.
let selDirty = true;
let selCachedHas = false;
export function markSelectionDirty() {
  selDirty = true;
}

function ensureSel(w: number, h: number): HTMLCanvasElement {
  if (!selCanvas || selW !== w || selH !== h) {
    selCanvas = document.createElement("canvas");
    selCanvas.width = w;
    selCanvas.height = h;
    selW = w;
    selH = h;
  }
  return selCanvas;
}

export function clearSelectionMask() {
  if (!selCanvas) {
    selCachedHas = false;
    selDirty = false;
    return;
  }
  const ctx = selCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  selCachedHas = false;
  selDirty = false;
}

export function selectionMaskCanvas(): HTMLCanvasElement | null {
  return selCanvas;
}

// Restore the selection mask from an image (used when opening an .avx project).
export function restoreSelectionMask(w: number, h: number, img: CanvasImageSource) {
  const c = ensureSel(w, h);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  markSelectionDirty();
}

export function hasSelection(): boolean {
  if (!selCanvas) return false;
  if (!selDirty) return selCachedHas;
  // fast alpha-sample check every 8px to stay cheap
  const ctx = selCanvas.getContext("2d", { willReadFrequently: true })!;
  try {
    const d = ctx.getImageData(0, 0, selCanvas.width, selCanvas.height);
    const data = d.data;
    for (let i = 3; i < data.length; i += 32) {
      if (data[i] > 4) {
        selCachedHas = true;
        selDirty = false;
        return true;
      }
    }
    selCachedHas = false;
    selDirty = false;
    return false;
  } catch {
    return selCachedHas;
  }
}

export type SelCombineMode = "new" | "add" | "subtract" | "intersect";

function withMode(w: number, h: number, mode: SelCombineMode, paint: (g: CanvasRenderingContext2D) => void) {
  stashCurrent();
  const c = ensureSel(w, h);
  if (mode === "new") {
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,1)";
    paint(ctx);
    markSelectionDirty();
    return;
  }
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const t = tmp.getContext("2d")!;
  t.fillStyle = "rgba(255,255,255,1)";
  paint(t);
  const ctx = c.getContext("2d")!;
  ctx.save();
  ctx.globalCompositeOperation =
    mode === "add" ? "source-over" : mode === "subtract" ? "destination-out" : "destination-in";
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  markSelectionDirty();
}

export function drawRectSelection(w: number, h: number, r: RectSel, mode: SelCombineMode = "new") {
  withMode(w, h, mode, (ctx) => {
    const x = Math.min(r.x, r.x + r.w);
    const y = Math.min(r.y, r.y + r.h);
    ctx.fillRect(x, y, Math.abs(r.w), Math.abs(r.h));
  });
}

export function drawEllipseSelection(w: number, h: number, r: RectSel, mode: SelCombineMode = "new") {
  withMode(w, h, mode, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(
      Math.min(r.x, r.x + r.w) + Math.abs(r.w) / 2,
      Math.min(r.y, r.y + r.h) + Math.abs(r.h) / 2,
      Math.abs(r.w) / 2,
      Math.abs(r.h) / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
}

export function drawRoundedRectSelection(w: number, h: number, r: RectSel, radius = 24, mode: SelCombineMode = "new") {
  withMode(w, h, mode, (ctx) => {
    const x = Math.min(r.x, r.x + r.w);
    const y = Math.min(r.y, r.y + r.h);
    const rw = Math.abs(r.w);
    const rh = Math.abs(r.h);
    const rr = Math.max(0, Math.min(radius, rw / 2, rh / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + rw - rr, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + rr);
    ctx.lineTo(x + rw, y + rh - rr);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - rr, y + rh);
    ctx.lineTo(x + rr, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.fill();
  });
}

export function drawLassoSelection(w: number, h: number, points: { x: number; y: number }[], mode: SelCombineMode = "new") {
  withMode(w, h, mode, (ctx) => {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  });
}

export interface CrossBars {
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  hx: number;
  hy: number;
  hw: number;
  hh: number;
}

/**
 * Plus geometry for the crosshair marquee: full-span bars centered on the
 * rect, so the selected shape matches the crosshair function and icon.
 * Arm thickness scales with the smaller side, minimum 3px. Pure math,
 * unit tested; callers pass normalized x, y with positive w, h.
 */
export function crossBars(x: number, y: number, w: number, h: number): CrossBars {
  const t = Math.max(3, Math.round(Math.min(w, h) / 5));
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    vx: Math.round(cx - t / 2),
    vy: Math.round(y),
    vw: t,
    vh: Math.round(h),
    hx: Math.round(x),
    hy: Math.round(cy - t / 2),
    hw: Math.round(w),
    hh: t,
  };
}

export function drawCrossSelection(w: number, h: number, r: RectSel, mode: SelCombineMode = "new") {
  withMode(w, h, mode, (ctx) => {
    const x = Math.min(r.x, r.x + r.w);
    const y = Math.min(r.y, r.y + r.h);
    const b = crossBars(x, y, Math.abs(r.w), Math.abs(r.h));
    ctx.fillRect(b.vx, b.vy, b.vw, b.vh);
    ctx.fillRect(b.hx, b.hy, b.hw, b.hh);
  });
}

// Color Range: select ALL pixels similar to a hex color (global, not flood).
export function colorRangeSelection(w: number, h: number, img: ImageData, hex: string, tolerance: number, mode: SelCombineMode = "new") {
  const r0 = parseInt(hex.slice(1, 3), 16);
  const g0 = parseInt(hex.slice(3, 5), 16);
  const b0 = parseInt(hex.slice(5, 7), 16);
  const tol = Math.round((tolerance / 100) * 160);
  const data = img.data;
  withMode(w, h, mode, (g) => {
    const out = g.createImageData(w, h);
    for (let p = 0; p < w * h; p++) {
      const idx = p * 4;
      const dist = (Math.abs(data[idx] - r0) + Math.abs(data[idx + 1] - g0) + Math.abs(data[idx + 2] - b0)) / 3;
      if (dist <= tol) {
        out.data[idx] = 255;
        out.data[idx + 1] = 255;
        out.data[idx + 2] = 255;
        out.data[idx + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
  });
}

// Magic wand: flood fill on composite ImageData with tolerance.
export function wandFromImage(
  w: number,
  h: number,
  img: ImageData,
  sx: number,
  sy: number,
  tolerance: number,
  mode: SelCombineMode = "new",
) {
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
  const data = img.data;
  const baseIdx = (iy * w + ix) * 4;
  const br = data[baseIdx];
  const bg = data[baseIdx + 1];
  const bb = data[baseIdx + 2];
  const tol = Math.round((tolerance / 100) * 120);
  const visited = new Uint8Array(w * h);
  const stack: number[] = [iy * w + ix];
  visited[iy * w + ix] = 1;
  let count = 0;
  const maxVisit = 600000; // cap to avoid freezing on huge files
  const alpha = new Uint8Array(w * h);
  while (stack.length > 0 && count < maxVisit) {
    const p = stack.pop()!;
    const px = p % w;
    const py = Math.floor(p / w);
    const idx = p * 4;
    const dr = Math.abs(data[idx] - br);
    const dg = Math.abs(data[idx + 1] - bg);
    const db = Math.abs(data[idx + 2] - bb);
    const dist = (dr + dg + db) / 3;
    if (dist <= tol) {
      alpha[p] = 255;
      count++;
      if (px > 0 && !visited[p - 1]) {
        visited[p - 1] = 1;
        stack.push(p - 1);
      }
      if (px < w - 1 && !visited[p + 1]) {
        visited[p + 1] = 1;
        stack.push(p + 1);
      }
      if (py > 0 && !visited[p - w]) {
        visited[p - w] = 1;
        stack.push(p - w);
      }
      if (py < h - 1 && !visited[p + w]) {
        visited[p + w] = 1;
        stack.push(p + w);
      }
    }
  }
  withMode(w, h, mode, (g) => {
    const out = g.createImageData(w, h);
    for (let p = 0; p < w * h; p++) {
      if (!alpha[p]) continue;
      const idx = p * 4;
      out.data[idx] = 255;
      out.data[idx + 1] = 255;
      out.data[idx + 2] = 255;
      out.data[idx + 3] = 255;
    }
    g.putImageData(out, 0, 0);
  });
}

export function featherSelection(feather: number) {
  if (!selCanvas) return;
  if (feather <= 0) return;
  // Feather approximation via a temp canvas + ctx.filter blur
  const tmp = document.createElement("canvas");
  tmp.width = selCanvas.width;
  tmp.height = selCanvas.height;
  const tctx = tmp.getContext("2d")!;
  tctx.filter = `blur(${feather}px)`;
  tctx.drawImage(selCanvas, 0, 0);
  const ctx = selCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  ctx.drawImage(tmp, 0, 0);
  markSelectionDirty();
}

export function expandContractSelection(delta: number) {
  if (!selCanvas || delta === 0) return;
  // Morphological approximation with blur + threshold
  const tmp = document.createElement("canvas");
  tmp.width = selCanvas.width;
  tmp.height = selCanvas.height;
  const tctx = tmp.getContext("2d")!;
  const r = Math.abs(delta);
  tctx.filter = `blur(${Math.min(20, r)}px)`;
  tctx.drawImage(selCanvas, 0, 0);
  const id = tctx.getImageData(0, 0, tmp.width, tmp.height);
  const th = delta > 0 ? 60 : 180;
  for (let i = 3; i < id.data.length; i += 4) {
    id.data[i] = id.data[i] > th ? 255 : 0;
  }
  tctx.putImageData(id, 0, 0);
  const ctx = selCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
  ctx.drawImage(tmp, 0, 0);
  markSelectionDirty();
}

export function inverseSelection() {
  if (!selCanvas) return;
  const ctx = selCanvas.getContext("2d", { willReadFrequently: true })!;
  const id = ctx.getImageData(0, 0, selCanvas.width, selCanvas.height);
  for (let i = 3; i < id.data.length; i += 4) {
    id.data[i] = 255 - id.data[i];
  }
  ctx.putImageData(id, 0, 0);
  markSelectionDirty();
}

// Apply the selection mask to a brush stroke: clip ctx with the selection mask.
export function applySelectionClip(ctx: CanvasRenderingContext2D) {
  if (!selCanvas || !hasSelection()) return;
  ctx.save();
  // use compositing: paint only inside the selection via a luminance mask clip
  // Simple version: build a clip path from the bounds? For accuracy, use globalCompositeOperation on a temp layer.
  ctx.restore();
}

export function isPointInSelection(x: number, y: number): boolean {
  if (!selCanvas) return true;
  if (!hasSelection()) return true;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= selCanvas.width || iy >= selCanvas.height) return false;
  const ctx = selCanvas.getContext("2d", { willReadFrequently: true })!;
  try {
    const d = ctx.getImageData(ix, iy, 1, 1);
    return d.data[3] > 10;
  } catch {
    return true;
  }
}
