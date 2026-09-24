import type { AdjustmentEntry } from "../stores/useProStore";

// Fase 2.3: Terapkan satu adjustment ke ImageData secara non-destructive.
// Semua fungsi bekerja di CPU untuk MVP; struktur siap dipindah ke wgpu shader.

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function applyAdjustmentToImageData(img: ImageData, adj: AdjustmentEntry) {
  const d = img.data;
  const p = adj.params;
  switch (adj.type) {
    case "brightnessContrast": {
      const b = (p.brightness ?? 0) * 2.55;
      const c = (p.contrast ?? 0) / 100;
      const factor = (259 * (c * 100 + 255)) / (255 * (259 - c * 100));
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp255(factor * (d[i] - 128 + b) + 128);
        d[i + 1] = clamp255(factor * (d[i + 1] - 128 + b) + 128);
        d[i + 2] = clamp255(factor * (d[i + 2] - 128 + b) + 128);
      }
      break;
    }
    case "levels": {
      const inB = p.inBlack ?? 0;
      const inW = p.inWhite ?? 255;
      const gamma = p.gamma ?? 1;
      const outB = p.outBlack ?? 0;
      const outW = p.outWhite ?? 255;
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) {
        let n = (v - inB) / Math.max(1, inW - inB);
        n = Math.min(1, Math.max(0, n));
        n = Math.pow(n, 1 / Math.max(0.05, gamma));
        lut[v] = Math.round(outB + n * (outW - outB));
      }
      for (let i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      break;
    }
    case "curves": {
      const lift = (p.lift ?? 0) * 1.2;
      const gain = 1 + (p.gain ?? 0) / 100;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp255((d[i] + lift) * gain);
        d[i + 1] = clamp255((d[i + 1] + lift) * gain);
        d[i + 2] = clamp255((d[i + 2] + lift) * gain);
      }
      break;
    }
    case "exposure": {
      const ev = p.exposure ?? 0;
      const off = (p.offset ?? 0) * 2;
      const gamma = p.gamma ?? 1;
      const mul = Math.pow(2, ev);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp255(Math.pow(d[i] * mul + off, 1 / gamma));
        d[i + 1] = clamp255(Math.pow(d[i + 1] * mul + off, 1 / gamma));
        d[i + 2] = clamp255(Math.pow(d[i + 2] * mul + off, 1 / gamma));
      }
      break;
    }
    case "hueSaturation": {
      const hShift = (p.hue ?? 0) / 360;
      const sMul = 1 + (p.saturation ?? 0) / 100;
      const lAdd = (p.lightness ?? 0) * 2.55;
      for (let i = 0; i < d.length; i += 4) {
        const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        const [r, g, b] = hslToRgb(
          (h + hShift + 1) % 1,
          Math.min(1, Math.max(0, s * sMul)),
          Math.min(1, Math.max(0, l + lAdd / 255)),
        );
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
      break;
    }
    case "blackWhite": {
      // aproksimasi mixer channel sederhana
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.round(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      break;
    }
    case "invert": {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      break;
    }
    case "threshold": {
      const t = p.level ?? 128;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = lum >= t ? 255 : 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      break;
    }
    case "posterize": {
      const lv = Math.max(2, Math.min(16, Math.round(p.levels ?? 4)));
      const step = 255 / (lv - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(Math.round((d[i] / 255) * (lv - 1)) * step);
        d[i + 1] = Math.round(Math.round((d[i + 1] / 255) * (lv - 1)) * step);
        d[i + 2] = Math.round(Math.round((d[i + 2] / 255) * (lv - 1)) * step);
      }
      break;
    }
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

// Terapkan RAW develop sebagai kombinasi exposure + WB sederhana.
export function applyRawDevelop(
  img: ImageData,
  raw: {
    exposure: number;
    temperature: number;
    tint: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
  },
) {
  const d = img.data;
  const evMul = Math.pow(2, raw.exposure);
  const tempShift = (raw.temperature - 5500) / 5500; // -1..1
  const rMul = 1 + tempShift * 0.18 + raw.tint * 0.0004;
  const bMul = 1 - tempShift * 0.16 - raw.tint * 0.0004;
  const hi = raw.highlights / 100;
  const sh = raw.shadows / 100;
  const wh = raw.whites * 0.8;
  const bl = raw.blacks * 0.8;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * evMul * rMul;
    let g = d[i + 1] * evMul;
    let b = d[i + 2] * evMul * bMul;
    const lum = (r + g + b) / 3 / 255;
    // highlights compress terang, shadows lift gelap
    const hiF = 1 - hi * Math.max(0, lum - 0.6) * 1.4;
    const shF = 1 + sh * Math.max(0, 0.4 - lum) * 1.2;
    r = r * hiF * shF + wh + bl * (1 - lum);
    g = g * hiF * shF + wh + bl * (1 - lum);
    b = b * hiF * shF + wh + bl * (1 - lum);
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}
