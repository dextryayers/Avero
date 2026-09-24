// LayerManager memegang pixel data per layer di offscreen canvas.
// Zustand hanya simpan metadata, pixel disimpan di sini agar undo cepat.

class LayerManager {
  private canvases = new Map<string, HTMLCanvasElement>();
  private masks = new Map<string, HTMLCanvasElement>();

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
  }

  clear() {
    this.canvases.clear();
    this.masks.clear();
  }

  // Fase 2.2: mask bitmap per layer, putih = tampil, hitam = sembunyi
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

  // Komposit layer + mask menjadi canvas temp dengan feather dan density.
  compositedWithMask(
    id: string,
    feather: number,
    density: number,
    enabled: boolean
  ): HTMLCanvasElement | undefined {
    const src = this.canvases.get(id);
    if (!src) return undefined;
    const mask = this.masks.get(id);
    if (!mask || !enabled) return src;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d")!;
    // terapkan mask via destination-in dengan blur feather
    const mtmp = document.createElement("canvas");
    mtmp.width = mask.width;
    mtmp.height = mask.height;
    const mctx = mtmp.getContext("2d")!;
    mctx.filter = feather > 0 ? `blur(${feather}px)` : "none";
    mctx.globalAlpha = Math.max(0, Math.min(1, density / 100));
    mctx.drawImage(mask, 0, 0);
    mctx.filter = "none";
    mctx.globalAlpha = 1;
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
  }

  fillChecker(id: string) {
    const c = this.canvases.get(id);
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
  }
}

export const layerManager = new LayerManager();
