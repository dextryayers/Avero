// LayerManager memegang pixel data per layer di offscreen canvas.
// Zustand hanya simpan metadata, pixel disimpan di sini agar undo cepat.

class LayerManager {
  private canvases = new Map<string, HTMLCanvasElement>();

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
  }

  clear() {
    this.canvases.clear();
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
