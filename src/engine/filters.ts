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
    case "emboss":
    case "findEdges":
    case "highPass": {
      const srcCtx = src.getContext("2d", { willReadFrequently: true })!;
      const id = srcCtx.getImageData(0, 0, src.width, src.height);
      const outId = ctx.createImageData(src.width, src.height);
      let kernel: number[];
      if (filter.type === "emboss") {
        const st = (p.strength ?? 60) / 60;
        kernel = [-st, -st, 0, -st, 1, st, 0, st, st];
      } else if (filter.type === "findEdges") {
        kernel = [-1, -1, -1, -1, 8, -1, -1, -1, -1];
      } else {
        kernel = [-1, -2, -1, -2, 12, -2, -1, -2, -1].map((v) => v / 4);
      }
      convolve(id, outId, src.width, src.height, kernel);
      if (filter.type === "highPass") {
        // overlay gray 128 agar natural
        for (let i = 0; i < outId.data.length; i += 4) {
          outId.data[i] = Math.max(0, Math.min(255, outId.data[i] * 0.6 + 128 * 0.4));
          outId.data[i + 1] = Math.max(0, Math.min(255, outId.data[i + 1] * 0.6 + 128 * 0.4));
          outId.data[i + 2] = Math.max(0, Math.min(255, outId.data[i + 2] * 0.6 + 128 * 0.4));
        }
      }
      if (filter.type === "findEdges") {
        const th = p.threshold ?? 24;
        for (let i = 0; i < outId.data.length; i += 4) {
          const lum = (outId.data[i] + outId.data[i + 1] + outId.data[i + 2]) / 3;
          const v = lum < th ? 0 : 255;
          outId.data[i] = 255 - v;
          outId.data[i + 1] = 255 - v;
          outId.data[i + 2] = 255 - v;
        }
      }
      ctx.putImageData(outId, 0, 0);
      break;
    }
    case "unsharpMask": {
      const amount = (p.amount ?? 70) / 100;
      const radius = Math.max(1, p.radius ?? 2);
      const blurC = document.createElement("canvas");
      blurC.width = src.width;
      blurC.height = src.height;
      const bctx = blurC.getContext("2d")!;
      bctx.filter = `blur(${radius}px)`;
      bctx.drawImage(src, 0, 0);
      bctx.filter = "none";
      const sCtx = src.getContext("2d", { willReadFrequently: true })!;
      const bId = bctx.getImageData(0, 0, src.width, src.height);
      const sId = sCtx.getImageData(0, 0, src.width, src.height);
      const outId = ctx.createImageData(src.width, src.height);
      for (let i = 0; i < sId.data.length; i += 4) {
        outId.data[i] = Math.max(0, Math.min(255, sId.data[i] + (sId.data[i] - bId.data[i]) * amount));
        outId.data[i + 1] = Math.max(0, Math.min(255, sId.data[i + 1] + (sId.data[i + 1] - bId.data[i + 1]) * amount));
        outId.data[i + 2] = Math.max(0, Math.min(255, sId.data[i + 2] + (sId.data[i + 2] - bId.data[i + 2]) * amount));
        outId.data[i + 3] = sId.data[i + 3];
      }
      ctx.putImageData(outId, 0, 0);
      break;
    }
    case "reduceNoise": {
      const st = Math.max(1, Math.round((p.strength ?? 40) / 12));
      ctx.filter = `blur(${st * 0.6}px)`;
      ctx.drawImage(src, 0, 0);
      ctx.filter = "none";
      break;
    }
    case "filmGrain": {
      const amt = p.amount ?? 18;
      ctx.drawImage(src, 0, 0);
      const id = ctx.getImageData(0, 0, out.width, out.height);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 2 * amt;
        id.data[i] += n * 0.9;
        id.data[i + 1] += n * 0.85;
        id.data[i + 2] += n * 1.05;
      }
      ctx.putImageData(id, 0, 0);
      break;
    }
    case "halftone": {
      const size = Math.max(3, Math.round(p.size ?? 6));
      ctx.drawImage(src, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      for (let y = 0; y < out.height; y += size) {
        for (let x = 0; x < out.width; x += size) {
          const r = ((x / size + y / size) % 2) * 0.6 + 0.7;
          ctx.beginPath();
          ctx.arc(x, y, (size / 3) * r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "oilPaintLite": {
      const r = Math.max(1, Math.round(p.radius ?? 3));
      ctx.filter = `blur(${r}px) saturate(1.35) contrast(1.08)`;
      ctx.drawImage(src, 0, 0);
      ctx.filter = "none";
      break;
    }
    case "tiltShift": {
      const focus = (p.focus ?? 50) / 100;
      const blur = Math.max(1, p.blur ?? 8);
      ctx.drawImage(src, 0, 0);
      const bandH = src.height * 0.32;
      const fy = src.height * focus;
      const top = document.createElement("canvas");
      top.width = src.width;
      top.height = src.height;
      const tctx = top.getContext("2d")!;
      tctx.filter = `blur(${blur}px)`;
      tctx.drawImage(src, 0, 0);
      tctx.filter = "none";
      // tengah tajam, atas-bawah blur
      ctx.drawImage(top, 0, 0, src.width, Math.max(0, fy - bandH), 0, 0, src.width, Math.max(0, fy - bandH));
      ctx.drawImage(top, 0, Math.min(src.height, fy + bandH), src.width, Math.max(0, src.height - (fy + bandH)), 0, Math.min(src.height, fy + bandH), src.width, Math.max(0, src.height - (fy + bandH)));
      break;
    }
    case "vignette": {
      const amount = (p.amount ?? 45) / 100;
      const feather = Math.max(10, p.feather ?? 60);
      ctx.drawImage(src, 0, 0);
      const g = ctx.createRadialGradient(
        out.width / 2, out.height / 2, Math.min(out.width, out.height) * 0.25,
        out.width / 2, out.height / 2, Math.max(out.width, out.height) * 0.72,
      );
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${0.15 + amount * 0.65})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, out.width, out.height);
      void feather;
      break;
    }
    case "chromaticAberration": {
      const amt = Math.max(0, p.amount ?? 3);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(src, 0, 0);
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(src, amt, 0);
      ctx.drawImage(src, -amt, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
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
