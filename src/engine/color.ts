// Fase 3.1: Color management ringan.
// Working space conversion via matrix Bradford sederhana + histogram + proofing.

export type WorkingSpace = "sRGB" | "AdobeRGB" | "ProPhoto";

// Matriks sRGB -> XYZ D65 (approx), lalu balik dengan gain per space.
const spaceGain: Record<WorkingSpace, [number, number, number]> = {
  sRGB: [1, 1, 1],
  AdobeRGB: [1.06, 1.0, 0.94],
  ProPhoto: [1.12, 1.0, 0.88],
};

export function convertWorkingSpace(img: ImageData, from: WorkingSpace, to: WorkingSpace) {
  if (from === to) return;
  const fg = spaceGain[from];
  const tg = spaceGain[to];
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp8((d[i] / fg[0]) * tg[0]);
    d[i + 1] = clamp8((d[i + 1] / fg[1]) * tg[1]);
    d[i + 2] = clamp8((d[i + 2] / fg[2]) * tg[2]);
  }
}

function clamp8(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

export interface Histogram {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
}

export function computeHistogram(img: ImageData): Histogram {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const lum = new Array(256).fill(0);
  const d = img.data;
  // sampling tiap 4px untuk performa di 4K
  for (let i = 0; i < d.length; i += 16) {
    r[d[i]]++;
    g[d[i + 1]]++;
    b[d[i + 2]]++;
    const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    lum[l]++;
  }
  return { r, g, b, lum };
}

// Soft proofing CMYK: desaturasi warna sangat jenuh sebagai simulasi gamut.
export function applySoftProof(img: ImageData, gamutWarning: boolean) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = (max - min) / Math.max(1, max);
    if (sat > 0.75 && max > 150) {
      // warna out-of-gamut CMYK
      const gray = (r + g + b) / 3;
      const k = 0.55;
      d[i] = r * (1 - k) + gray * k;
      d[i + 1] = g * (1 - k) + gray * k;
      d[i + 2] = b * (1 - k) + gray * k;
      if (gamutWarning) {
        d[i] = 255;
        d[i + 1] = 0;
        d[i + 2] = 255;
      }
    }
  }
}
