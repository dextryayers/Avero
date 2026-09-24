import { yieldToUI } from "./runtime";

// Fase 4.2: segmentasi lokal heuristik.
// Background remover: asumsikan background di tepi, hitung warna dominan tepi,
// hapus piksel mirip + refine edge dengan feather. Auto select: kebalikan + bobot tengah.

function edgeColors(img: ImageData, samples = 240): { r: number; g: number; b: number }[] {
  const w = img.width;
  const h = img.height;
  const d = img.data;
  const out: { r: number; g: number; b: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const t = Math.floor((i / samples) * (2 * w + 2 * h));
    let x = 0;
    let y = 0;
    if (t < w) {
      x = t;
      y = 2;
    } else if (t < w + h) {
      x = w - 3;
      y = t - w;
    } else if (t < 2 * w + h) {
      x = t - w - h;
      y = h - 3;
    } else {
      x = 2;
      y = t - 2 * w - h;
    }
    x = Math.max(0, Math.min(w - 1, x));
    y = Math.max(0, Math.min(h - 1, y));
    const idx = (y * w + x) * 4;
    out.push({ r: d[idx], g: d[idx + 1], b: d[idx + 2] });
  }
  return out;
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr * 0.5 + dg * dg * 0.8 + db * db * 0.4);
}

export async function backgroundRemoveAlpha(
  src: HTMLCanvasElement,
  tolerance = 42,
  onProgress?: (p: number) => void,
  cancelled?: () => boolean,
): Promise<HTMLCanvasElement> {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const img = sctx.getImageData(0, 0, w, h);
  const edges = edgeColors(img);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  const oid = octx.createImageData(w, h);
  oid.data.set(img.data);
  const d = oid.data;
  for (let y = 0; y < h; y++) {
    if (cancelled?.()) break;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];
      let best = 1e9;
      for (let k = 0; k < edges.length; k += 6) {
        const e = edges[k];
        const dist = colorDist(r, g, b, e.r, e.g, e.b);
        if (dist < best) best = dist;
      }
      // bobot tengah: pertahankan subjek di tengah walau mirip background
      const nx = x / w - 0.5;
      const ny = y / h - 0.5;
      const center = Math.sqrt(nx * nx + ny * ny);
      const keepBias = center < 0.28 ? tolerance * 0.45 : 0;
      if (best < tolerance - keepBias) {
        const soft = Math.max(0, Math.min(1, (best - (tolerance - keepBias - 18)) / 18));
        d[idx + 3] = Math.round(d[idx + 3] * (1 - soft));
      }
    }
    if (y % 32 === 0) {
      onProgress?.(Math.round((y / h) * 100));
      await yieldToUI(y);
    }
  }
  octx.putImageData(oid, 0, 0);
  // feather halus 1px untuk edge
  const f = document.createElement("canvas");
  f.width = w;
  f.height = h;
  const fctx = f.getContext("2d")!;
  fctx.filter = "blur(0.6px)";
  fctx.drawImage(out, 0, 0);
  onProgress?.(100);
  return out;
}

// Auto select subject: buat selection mask dari saliency kontras + posisi tengah.
export async function autoSubjectMask(
  comp: HTMLCanvasElement,
  onProgress?: (p: number) => void,
): Promise<HTMLCanvasElement> {
  const w = comp.width;
  const h = comp.height;
  const ctx = comp.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // rata-rata global
  let mr = 0;
  let mg = 0;
  let mb = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 16) {
    mr += d[i];
    mg += d[i + 1];
    mb += d[i + 2];
  }
  mr /= n / 4;
  mg /= n / 4;
  mb /= n / 4;
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d")!;
  const mid = mctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const contrast = colorDist(d[idx], d[idx + 1], d[idx + 2], mr, mg, mb) / 220;
      const nx = x / w - 0.5;
      const ny = y / h - 0.5;
      const center = Math.sqrt(nx * nx * 1.4 + ny * ny * 1.4);
      const score = contrast * 0.72 + Math.max(0, 0.5 - center) * 0.9;
      const a = score > 0.34 ? 255 : 0;
      mid.data[idx + 3] = a;
      mid.data[idx] = 255;
      mid.data[idx + 1] = 255;
      mid.data[idx + 2] = 255;
    }
    if (y % 48 === 0) {
      onProgress?.(Math.round((y / h) * 100));
      await yieldToUI(y);
    }
  }
  mctx.putImageData(mid, 0, 0);
  // bersihkan noise kecil dengan blur + threshold
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d")!;
  tctx.filter = "blur(2px)";
  tctx.drawImage(mask, 0, 0);
  const tid = tctx.getImageData(0, 0, w, h);
  for (let i = 3; i < tid.data.length; i += 4) tid.data[i] = tid.data[i] > 90 ? 255 : 0;
  tctx.putImageData(tid, 0, 0);
  mctx.clearRect(0, 0, w, h);
  mctx.drawImage(tmp, 0, 0);
  onProgress?.(100);
  return mask;
}
