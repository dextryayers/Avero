import { describe, it, expect, vi } from "vitest";

vi.mock("../components/CanvasArea", () => ({
  getCompositeCanvas: () => null,
}));

import { AVX_MAGIC, AVX_VERSION, parseAvxJson, encodeBmpDataUrl, verifyAvxChecksum, normalizeAvxFile, sanitizeProjectName, ensureAvxExtension, joinPath, parentDir, baseName, previewPathFor, type AvxFile } from "./projectIo";

function sampleProject(): AvxFile {
  return {
    magic: AVX_MAGIC,
    version: AVX_VERSION,
    app: "AVERO STUDIO",
    savedAt: 1700000000000,
    doc: { name: "Test.avx", width: 800, height: 600 },
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
          name: "Text",
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
    activeLayerName: "Text",
    adjustments: [{ id: "adj-1", type: "brightness", name: "Brightness", enabled: true, opacity: 100, params: { brightness: 12 } }],
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
      savedSelections: [{ id: "sel-1", name: "Selection 1", time: 1700000000000 }],
      paintMask: true,
      gradTo: "black",
      snapEnabled: false,
      brush: { size: 42, opacity: 80, hardness: 60, color: "#ff0000" },
    },
  };
}

describe("parseAvxJson", () => {
  it("accepts a complete valid project without data loss", () => {
    const src = sampleProject();
    const json = JSON.stringify(src);
    const out = parseAvxJson(json);
    expect(out).toEqual(src);
    expect(out.layers).toHaveLength(2);
    expect(out.ui?.brush?.color).toBe("#ff0000");
    expect(out.guidesH).toEqual([100, 250]);
    expect(out.selPixels).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("accepts legacy files without a ui section", () => {
    const src = sampleProject();
    delete (src as Partial<AvxFile>).ui;
    const out = parseAvxJson(JSON.stringify(src));
    expect(out.ui).toBeUndefined();
    expect(out.layers).toHaveLength(2);
  });

  it("rejects corrupt JSON", () => {
    expect(() => parseAvxJson("{invalid")).toThrow("Not a valid .avx project file");
    expect(() => parseAvxJson("")).toThrow("Not a valid .avx project file");
  });

  it("rejects wrong magic", () => {
    const src = sampleProject();
    (src as { magic: string }).magic = "PSD1";
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("Not a valid .avx project file");
  });

  it("rejects newer version", () => {
    const src = sampleProject();
    src.version = AVX_VERSION + 1;
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("newer AVERO version");
  });

  it("rejects document without size", () => {
    const src = sampleProject();
    (src as { doc: unknown }).doc = { name: "x" };
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("missing document data");
  });

  it("rejects file without layer list", () => {
    const src = sampleProject();
    (src as { layers: unknown }).layers = "not-an-array";
    expect(() => parseAvxJson(JSON.stringify(src))).toThrow("missing layer data");
  });
});

describe("avx checksum", () => {
  it("accepts legacy files without checksum", () => {
    const src = sampleProject();
    expect(verifyAvxChecksum(src)).toBe(true);
    expect(parseAvxJson(JSON.stringify(src)).magic).toBe(AVX_MAGIC);
  });

  it("rejects tampered checksum", () => {
    const src = sampleProject();
    const stamped = { ...src, checksum: "deadbeefdeadbeef" };
    expect(verifyAvxChecksum(stamped)).toBe(false);
    expect(() => parseAvxJson(JSON.stringify(stamped))).toThrow("checksum mismatch");
  });
});

describe("encodeBmpDataUrl", () => {
  it("produces a 24-bit BMP with a correct header", () => {
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

describe("word-like project helpers", () => {
  it("sanitizeProjectName strips forbidden characters", () => {
    expect(sanitizeProjectName('Proyek: Baru/Bagus*?')).toBe("Proyek_ Baru_Bagus_");
    expect(sanitizeProjectName("")).toBe("Untitled");
  });

  it("ensureAvxExtension always defaults to .avx", () => {
    expect(ensureAvxExtension("Kerja")).toBe("Kerja.avx");
    expect(ensureAvxExtension("Kerja.avx")).toBe("Kerja.avx");
    expect(ensureAvxExtension("Kerja.AVX")).toBe("Kerja.AVX");
    expect(ensureAvxExtension("")).toBe("Untitled.avx");
  });

  it("joinPath + parentDir + baseName stay consistent on win/posix", () => {
    expect(joinPath("D:\\kerja", "Proyek")).toBe("D:\\kerja\\Proyek");
    expect(joinPath("/home/u", "Proyek")).toBe("/home/u/Proyek");
    expect(parentDir("D:\\kerja\\Proyek\\a.avx")).toBe("D:\\kerja\\Proyek");
    expect(parentDir("/home/u/Proyek/a.avx")).toBe("/home/u/Proyek");
    expect(baseName("/home/u/Proyek/a.avx")).toBe("a.avx");
    expect(parentDir(null)).toBeNull();
  });

  it("previewPathFor sits beside the project", () => {
    expect(previewPathFor("D:\\kerja\\Proyek\\a.avx")).toBe("D:\\kerja\\Proyek\\a_preview.jpg");
    expect(previewPathFor("/home/u/Proyek/a.avx")).toBe("/home/u/Proyek/a_preview.jpg");
  });
});

describe("normalizeAvxFile anti-corruption", () => {
  it("fills defaults for minimal legacy files", () => {
    const raw = {
      magic: AVX_MAGIC,
      version: 1,
      doc: { name: "Lama", width: 100, height: 100 },
      layers: [{ meta: { id: "x" }, pixels: "bukan-gambar", maskPixels: null }],
    } as unknown as AvxFile;
    const out = normalizeAvxFile(raw);
    expect(out.layers).toHaveLength(1);
    expect(out.layers[0].meta.name).toBe("Layer 1");
    expect(out.layers[0].pixels).toBeNull();
    expect(out.adjustments).toEqual([]);
    expect(out.guidesH).toEqual([]);
  });

  it("drops broken layers without failing the document", () => {
    const raw = {
      magic: AVX_MAGIC,
      version: 1,
      doc: { name: "X", width: 50, height: 50 },
      layers: [null, { meta: { id: "a", name: "A" }, pixels: null, maskPixels: null }],
    } as unknown as AvxFile;
    const out = normalizeAvxFile(raw);
    expect(out.layers).toHaveLength(1);
    expect(out.layers[0].meta.id).toBe("a");
  });
});
