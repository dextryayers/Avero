import type { FilterEntry } from "../stores/useProStore";

// Fase 2.5: Filter stack. Gunakan ctx.filter GPU browser untuk blur,
// convolution manual untuk sharpen, noise additive, pixelate via downscale.

export function applyFilterToCanvas(
  src: HTMLCanvasElement,
  filter: FilterEntry,
): HTMLCanvasElement {
  if (!filter.enabled || filter.opacity <= 0) return src;
  const p = filter.params;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;
  const alpha = filter.opacity / 100;

  switch (filter.type) {
    case "gaussianBlur":
    case "boxBlur": {
      const r = Math.max(0, p.radius ?? 4);
      ctx.filter = r <= 0 ? "none" : `blur(${r}px)`;
      ctx.drawImage(src, 0, 0);
      ctx.filter = "none";
      break;
    }
    case "motionBlur": {
      const r = Math.max(1, Math.round(p.radius ?? 8));
      const ang = ((p.angle ?? 0) * Math.PI) / 180;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      ctx.globalAlpha = 1 / r;
      for (let i = 0; i < r; i++) {
        const off = i - r / 2;
        ctx.drawImage(src, dx * off, dy * off);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "sharpen": {
      const amount = (p.amount ?? 60) / 100;
      // unsharp via convolution 3x3
      const srcCtx = src.getContext("2d", { willReadFrequently: true })!;
      const id = srcCtx.getImageData(0, 0, src.width, src.height);
      const outId = ctx.createImageData(src.width, src.height);
      const kernel = [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0];
      convolve(id, outId, src.width, src.height, kernel);
      ctx.putImageData(outId, 0, 0);
      break;
    }
    case "noise": {
      const amt = p.amount ?? 8;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, out.width, out.height);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 2 * amt;
        id.data[i] += n;
        id.data[i + 1] += n;
        id.data[i + 2] += n;
      }
      ctx.putImageData(id, 0, 0);
      break;
    }
    case "pixelate": {
      const size = Math.max(2, Math.round(p.size ?? 8));
      const tw = Math.max(1, Math.floor(src.width / size));
      const th = Math.max(1, Math.floor(src.height / size));
      const tmp = document.createElement("canvas");
      tmp.width = tw;
      tmp.height = th;
      const tctx = tmp.getContext("2d")!;
      tctx.drawImage(src, 0, 0, tw, th);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, out.width, out.height);
      ctx.imageSmoothingEnabled = true;
      break;
    }
  }

  if (alpha < 1) {
    // blend hasil filter dengan source sesuai opacity
    const blended = document.createElement("canvas");
    blended.width = src.width;
    blended.height = src.height;
    const bctx = blended.getContext("2d")!;
    bctx.drawImage(src, 0, 0);
    bctx.globalAlpha = alpha;
    bctx.drawImage(out, 0, 0);
    bctx.globalAlpha = 1;
    return blended;
  }
  return out;
}

function convolve(src: ImageData, dst: ImageData, w: number, h: number, k: number[]) {
  const sd = src.data;
  const dd = dst.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const idx = (py * w + px) * 4;
          const kv = k[(ky + 1) * 3 + (kx + 1)];
          r += sd[idx] * kv;
          g += sd[idx + 1] * kv;
          b += sd[idx + 2] * kv;
        }
      }
      const o = (y * w + x) * 4;
      dd[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      dd[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      dd[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      dd[o + 3] = sd[o + 3];
    }
  }
}
