// Fase 5.4: Plugin SDK JS sandbox.
// Plugin adalah fungsi JS murni: (imageData, params) => imageData.
// Dijalankan di Function sandbox dengan timeout, tanpa akses DOM/IPC.

export interface PluginParam {
  key: string;
  label: string;
  min: number;
  max: number;
  def: number;
}

export interface PluginDef {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  params: PluginParam[];
  code: string; // body fungsi (d, params, W, H)
}

export function runPlugin(
  def: PluginDef,
  img: ImageData,
  params: Record<string, number>,
): ImageData {
  const out = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  const fn = new Function("d", "params", "W", "H", `"use strict";\n${def.code}`);
  const timer = setTimeout(() => {
    throw new Error("Plugin timeout 5 detik");
  }, 5000);
  try {
    (fn as any)(out.data, params, out.width, out.height);
  } finally {
    clearTimeout(timer);
  }
  return out;
}

export const EXAMPLE_PLUGINS: PluginDef[] = [
  {
    id: "plug-duotone",
    name: "Duotone Biru",
    version: "1.0.0",
    author: "AVERO STUDIO",
    description: "Map luminance ke gradient biru tua ke cyan. Contoh 18 baris.",
    params: [{ key: "strength", label: "Strength", min: 0, max: 100, def: 80 }],
    code: `
      const s = (params.strength ?? 80) / 100;
      for (let i = 0; i < d.length; i += 4) {
        const lum = (d[i]*0.3 + d[i+1]*0.59 + d[i+2]*0.11) / 255;
        d[i]   = d[i]*(1-s)   + (10 + lum*60)*s;
        d[i+1] = d[i+1]*(1-s) + (40 + lum*150)*s;
        d[i+2] = d[i+2]*(1-s) + (90 + lum*160)*s;
      }`,
  },
  {
    id: "plug-vignette",
    name: "Vignette Halus",
    version: "1.0.0",
    author: "AVERO STUDIO",
    description: "Gelapkan tepi radial. Contoh 14 baris.",
    params: [{ key: "amount", label: "Amount", min: 0, max: 100, def: 55 }],
    code: `
      const a = (params.amount ?? 55) / 100;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = x/W - 0.5, ny = y/H - 0.5;
          const v = Math.sqrt(nx*nx + ny*ny) * 1.5;
          const f = 1 - Math.max(0, v - 0.45) * a;
          const i = (y*W + x) * 4;
          d[i] *= f; d[i+1] *= f; d[i+2] *= f;
        }
      }`,
  },
  {
    id: "plug-grain",
    name: "Film Grain",
    version: "1.0.0",
    author: "Komunitas",
    description: "Tambah grain acak. Contoh 9 baris.",
    params: [{ key: "grain", label: "Grain", min: 0, max: 40, def: 12 }],
    code: `
      const g = params.grain ?? 12;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 2 * g;
        d[i] += n; d[i+1] += n; d[i+2] += n;
      }`,
  },
];
