import { yieldToUI } from "./runtime";

// Fase 4.3: Inpaint heuristik (isi area seleksi/transparan dari tetangga),
// upscale bicubic + sharpen, color transfer Reinhard.

export async function inpaintSelection(
  layer: HTMLCanvasElement,
  selMask: HTMLCanvasElement | null,
  radius = 6,
  onProgress?: (p: number) => void
): Promise<void> {
  const w = layer.width;
  const h = layer.height;
  const ctx = layer.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, w, h);
  let maskA: Uint8ClampedArray;
  if (selMask) {
    const mctx = selMask.getContext("2d", { willReadFrequently: true })!;
    const mid = mctx.getImageData(0, 0, Math.min(w, selMask.width), Math.min(h, selMask.height));
    maskA = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < mid.width && y < mid.height) maskA[y * w + x] = mid.data[(y * mid.width + x) * 4 + 3];
        else maskA[y * w + x] = 0;
      }
    }
  } else {
    // tanpa seleksi: inpaint area transparan
    maskA = new Uint8ClampedArray(w * h);
    for (let i = 3, p = 0; i < img.data.length; i += 4, p++) maskA[p] = img.data[i] < 12 ? 255 : 0;
  }
  const d = img.data;
  // 3 pass box-blur dari tetangga valid
  for (let pass = 0; pass < 3; pass++) {
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (maskA[p] < 20) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let c = 0;
        for (let oy = -radius; oy <= radius; oy += 2) {
          for (let ox = -radius; ox <= radius; ox += 2) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const np = ny * w + nx;
            if (maskA[np] > 20) continue;
            const idx = np * 4;
            r += copy[idx];
            g += copy[idx + 1];
            b += copy[idx + 2];
            a += copy[idx + 3];
            c++;
          }
        }
        if (c > 0) {
          const idx = p * 4;
          d[idx] = r / c;
          d[idx + 1] = g / c;
          d[idx + 2] = b / c;
          d[idx + 3] = Math.max(d[idx + 3], a / c);
        }
      }
      if (y % 64 === 0) {
        onProgress?.(Math.round(((pass * h + y) / (h * 3)) * 100));
        await yieldToUI(y);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  onProgress?.(100);
}

export async function upscaleLayer(
  src: HTMLCanvasElement,
  scale: 2 | 4,
  onProgress?: (p: number) => void
): Promise<HTMLCanvasElement> {
  onProgress?.(8);
  await yieldToUI(1);
  const out = document.createElement("canvas");
  out.width = src.width * scale;
  out.height = src.height * scale;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // 2 tahap untuk 4x agar lebih tajam
  if (scale === 4) {
    const mid = document.createElement("canvas");
    mid.width = src.width * 2;
    mid.height = src.height * 2;
    mid.getContext("2d")!.drawImage(src, 0, 0, mid.width, mid.height);
    onProgress?.(45);
    await yieldToUI(2);
    ctx.drawImage(mid, 0, 0, out.width, out.height);
  } else {
    ctx.drawImage(src, 0, 0, out.width, out.height);
  }
  onProgress?.(72);
  await yieldToUI(3);
  // sharpen ringan unsharp via overlay kontras
  ctx.globalAlpha = 0.32;
  ctx.filter = "contrast(1.12) saturate(1.04)";
  ctx.drawImage(out, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  onProgress?.(100);
  return out;
}

// Reinhard color transfer: samakan mean/std Lab aproksimasi via YUV.
export function colorTransfer(src: ImageData, ref: ImageData) {
  const sMean = meanStd(src);
  const rMean = meanStd(ref);
  const d = src.data;
  for (let i = 0; i < d.length; i += 4) {
    // ruang sederhana: geser per channel berdasar mean/std
    d[i] = clamp8(((d[i] - sMean.m[0]) * (rMean.s[0] / Math.max(1, sMean.s[0])) + rMean.m[0]));
    d[i + 1] = clamp8(((d[i + 1] - sMean.m[1]) * (rMean.s[1] / Math.max(1, sMean.s[1])) + rMean.m[1]));
    d[i + 2] = clamp8(((d[i + 2] - sMean.m[2]) * (rMean.s[2] / Math.max(1, sMean.s[2])) + rMean.m[2]));
  }
}

function meanStd(img: ImageData) {
  const d = img.data;
  const n = d.length / 4;
  let m0 = 0;
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    m0 += d[i];
    m1 += d[i + 1];
    m2 += d[i + 2];
  }
  m0 /= n;
  m1 /= n;
  m2 /= n;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    s0 += (d[i] - m0) ** 2;
    s1 += (d[i + 1] - m1) ** 2;
    s2 += (d[i + 2] - m2) ** 2;
  }
  return { m: [m0, m1, m2], s: [Math.sqrt(s0 / n), Math.sqrt(s1 / n), Math.sqrt(s2 / n)] };
}

function clamp8(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
