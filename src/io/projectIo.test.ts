import { describe, it, expect, vi } from "vitest";

vi.mock("../components/CanvasArea", () => ({
  getCompositeCanvas: () => null,
}));

import { AVX_MAGIC, AVX_VERSION, parseAvxJson, encodeBmpDataUrl, type AvxFile } from "./projectIo";

function sampleProject(): AvxFile {
  return {
    magic: AVX_MAGIC,
    version: AVX_VERSION,
    app: "AVERO STUDIO",
    savedAt: 1700000000000,
    doc: { name: "Uji.avx", width: 800, height: 600 },
    layers: [
      {
        meta: {
          id: "layer-a",
          name: "Background",
          visible: true,
          locked: false,
          opacity: 100,
          blendMode: "normal",
          kind: "raster",
        },
        pixels: "data:image/png;base64,iVBORw0KGgo=",
        maskPixels: null,
      },
      {
        meta: {
          id: "layer-b",
          name: "Teks",
          visible: false,
          locked: false,
          opacity: 64,
          blendMode: "multiply",
          kind: "text",
        },
        pixels: null,
        maskPixels: "data:image/png;base64,iVBORw0KGgo=",
      },
    ],
    activeLayerName: "Teks",
    adjustments: [{ id: "adj-1", type: "brightness", name: "Kecerahan", enabled: true, opacity: 100, params: { brightness: 12 } }],
    filters: [{ id: "flt-1", type: "gaussianBlur", name: "Blur", enabled: false, opacity: 50, params: { radius: 4 } }],
    masks: { "layer-a": { hasMask: true, density: 100 } },
    transforms: { "layer-a": { x: 10, y: 20, scale: 1, rotate: 0 } },
    textSpecs: {},
    shapeSpecs: {},
    guidesH: [100, 250],
    guidesV: [64],
    showGrid: true,
    gridSize: 32,
    color: { workingSpace: "sRGB", bitDepth: 8 },
    raw: { isRaw: false, exposure: 0 },
    selPixels: "data:image/png;base64,iVBORw0KGgo=",
    ui: {
      selKind: "ellipse",
      selFeather: 3,
      selTolerance: 30,
      selExpand: -2,
      savedSelections: [{ id: "sel-1", name: "Pilihan 1", time: 1700000000000 }],
      paintMask: true,
      gradTo: "black",
      snapEnabled: false,
      brush: { size: 42, opacity: 80, hardness: 60, color: "#ff0000" },
    },
  };
}

describe("parseAvxJson", () => {
  it("menerima proyek valid utuh tanpa kehilangan data", () => {
    const src = sampleProject();
    const json = JSON.stringify(src);
    const out = parseAvxJson(json);
    expect(out).toEqual(src);
    expect(out.layers).toHaveLength(2);
    expect(out.ui?.brush?.color).toBe("#ff0000");
    expect(out.guidesH).toEqual([100, 250]);
    expect(out.selPixels).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("menerima file lama tanpa bagian ui", () => {
    const src = sampleProject();
    delete (src as Partial<AvxFile>).ui;
    const out = parseAvxJson(JSON.stringify(src));
    expect(out.ui).toBeUndefined();
    expect(out.layers).toHaveLength(2);
  });

  it("menolak JSON rusak", () => {
    expect(() => parseAvxJson("{tidak valid")).toThrow("File bukan proyek .avx yang valid");
    expect(() => parseAvxJson("")).toThrow("File bukan proyek .avx yang valid");
  });

  it("menolak magic yang salah", () => {
    const src = sampleProject();
    (src as { magic: string }).magic = "PSD1";
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("File bukan proyek .avx yang valid");
  });

  it("menolak versi lebih baru", () => {
    const src = sampleProject();
    src.version = AVX_VERSION + 1;
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("versi AVERO yang lebih baru");
  });

  it("menolak dokumen tanpa ukuran", () => {
    const src = sampleProject();
    (src as { doc: unknown }).doc = { name: "x" };
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("data dokumen hilang");
  });

  it("menolak file tanpa daftar layer", () => {
    const src = sampleProject();
    (src as { layers: unknown }).layers = "bukan-array";
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("data layer hilang");
  });
});

describe("encodeBmpDataUrl", () => {
  it("menghasilkan BMP 24-bit dengan header benar", () => {
    const w = 3;
    const h = 2;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 128;
      data[i + 2] = 64;
      data[i + 3] = 255;
    }
    const url = encodeBmpDataUrl({ width: w, height: h, data } as unknown as ImageData);
    expect(url.startsWith("data:image/bmp;base64,")).toBe(true);
    const bin = atob(url.split(",")[1]);
    expect(bin[0]).toBe("B");
    expect(bin[1]).toBe("M");
    const dv = new DataView(new Uint8Array(bin.split("").map((c) => c.charCodeAt(0))).buffer);
    const rowSize = Math.floor((24 * w + 31) / 32) * 4;
    expect(dv.getUint32(2, true)).toBe(54 + rowSize * h);
    expect(dv.getUint32(18, true)).toBe(w);
    expect(dv.getUint32(22, true)).toBe(h);
    expect(dv.getUint16(28, true)).toBe(24);
  });
});
