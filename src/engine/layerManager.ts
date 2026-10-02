// LayerManager holds per-layer pixel data on offscreen canvases.
// Zustand keeps metadata only, pixels live here for fast undo.

// Lightweight path: pooled temp canvases for compositing to avoid allocating
// 2 canvases per layer per frame (the cause of GC spikes + RAM bloat).
// The pool is split per slot + size so the doc-size comp never aliases the
// mask temp (old bug: the mask overwrote the composite on masked layers).
const pools = new Map<string, HTMLCanvasElement>();
function pooledCanvas(w: number, h: number, slot: "out" | "mask"): HTMLCanvasElement {
  const key = `${slot}:${w}x${h}`;
  const cur = pools.get(key);
  if (cur) return cur;
  // Bound pool size: max 2 entries (out+mask per size). Evict stale sizes.
  if (pools.size >= 6) {
    const first = pools.keys().next().value as string | undefined;
    if (first) pools.delete(first);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  pools.set(key, c);
  return c;
}

class LayerManager {
  private canvases = new Map<string, HTMLCanvasElement>();
  private masks = new Map<string, HTMLCanvasElement>();
  // Layers that hold an opened photo (drawImageToLayer). Brush strokes on a
  // photo layer would merge with pixels so the eraser could never remove only
  // the scribble, so CanvasArea auto-creates a transparent paint layer instead.
  private photoLayers = new Set<string>();

  ensure(id: string, w: number, h: number): HTMLCanvasElement {
    let c = this.canvases.get(id);
    if (!c) {
      c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      this.canvases.set(id, c);
    } else if (c.width !== w || c.height !== h) {
      const next = document.createElement("canvas");
      next.width = w;
      next.height = h;
      const ctx = next.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      this.canvases.set(id, next);
      c = next;
    }
    return c;
  }

  get(id: string): HTMLCanvasElement | undefined {
    return this.canvases.get(id);
  }

  remove(id: string) {
    this.canvases.delete(id);
    this.masks.delete(id);
    this.photoLayers.delete(id);
  }

  clear() {
    this.canvases.clear();
    this.masks.clear();
    this.photoLayers.clear();
  }

  // Phase 2.2: per-layer bitmap mask, white = visible, black = hidden
  ensureMask(id: string, w: number, h: number): HTMLCanvasElement {
    let m = this.masks.get(id);
    if (!m) {
      m = document.createElement("canvas");
      m.width = w;
      m.height = h;
      const ctx = m.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      this.masks.set(id, m);
    } else if (m.width !== w || m.height !== h) {
      const next = document.createElement("canvas");
      next.width = w;
      next.height = h;
      const ctx = next.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(m, 0, 0);
      this.masks.set(id, next);
      m = next;
    }
    return m;
  }

  getMask(id: string): HTMLCanvasElement | undefined {
    return this.masks.get(id);
  }

  removeMask(id: string) {
    this.masks.delete(id);
  }

  // Composite layer + mask into a temp canvas with feather and density.
  // Fast path: no mask -> return src directly (zero-alloc).
  // With mask -> use the pooled canvas; copy to a fresh canvas only for outside reads.
  compositedWithMask(
    id: string,
    feather: number,
    density: number,
    enabled: boolean,
  ): HTMLCanvasElement | undefined {
    const src = this.canvases.get(id);
    if (!src) return undefined;
    const mask = this.masks.get(id);
    if (!mask || !enabled) return src;
    const out = pooledCanvas(src.width, src.height, "out");
    const ctx = out.getContext("2d")!;
    // apply the mask via destination-in with feather blur
    const mtmp = pooledCanvas(mask.width, mask.height, "mask");
    const mctx = mtmp.getContext("2d")!;
    mctx.filter = feather > 0 ? `blur(${feather}px)` : "none";
    mctx.globalAlpha = Math.max(0, Math.min(1, density / 100));
    mctx.clearRect(0, 0, mtmp.width, mtmp.height);
    mctx.drawImage(mask, 0, 0);
    mctx.filter = "none";
    mctx.globalAlpha = 1;
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mtmp, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    return out;
  }

  snapshot(id: string): ImageData | null {
    const c = this.canvases.get(id);
    if (!c) return null;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    try {
      return ctx.getImageData(0, 0, c.width, c.height);
    } catch {
      return null;
    }
  }

  snapshotMask(id: string): ImageData | null {
    const m = this.masks.get(id);
    if (!m) return null;
    try {
      return m
        .getContext("2d", { willReadFrequently: true })!
        .getImageData(0, 0, m.width, m.height);
    } catch {
      return null;
    }
  }

  restoreMask(id: string, snap: ImageData | null) {
    const m = this.masks.get(id);
    if (!m || !snap) return;
    if (m.width !== snap.width || m.height !== snap.height) {
      m.width = snap.width;
      m.height = snap.height;
    }
    m.getContext("2d")!.putImageData(snap, 0, 0);
  }

  restore(id: string, snap: ImageData | null) {
    const c = this.canvases.get(id);
    if (!c || !snap) return;
    const ctx = c.getContext("2d")!;
    if (c.width !== snap.width || c.height !== snap.height) {
      c.width = snap.width;
      c.height = snap.height;
    }
    ctx.putImageData(snap, 0, 0);
  }

  drawImageToLayer(id: string, img: HTMLImageElement, dw: number, dh: number) {
    const c = this.canvases.get(id);
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, dw, dh);
    this.photoLayers.add(id);
  }

  isPhotoLayer(id: string): boolean {
    return this.photoLayers.has(id);
  }

  // Plan4 Fase 1.4: re-arm photo protection without repainting pixels.
  // Used when pixels arrive from paths that bypass drawImageToLayer
  // (project reload, drag-drop, paste from a photo source).
  markPhoto(id: string): void {
    this.photoLayers.add(id);
  }

  fillChecker(id: string) {
    const c = this.canvases.get(id);
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
  }
}

export const layerManager = new LayerManager();

export function clearRenderPools() {
  pools.clear();
}
