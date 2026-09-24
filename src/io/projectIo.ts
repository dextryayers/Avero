import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useEditorStore, type LayerMeta } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { clearSelectionMask } from "../engine/selection";
import { getCompositeCanvas } from "../components/CanvasArea";

export const AVX_MAGIC = "AVX1";
export const AVX_VERSION = 1;

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

function utf8ToB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar layer rusak"));
    img.src = dataUrl;
  });
}

function thumbOf(canvas: HTMLCanvasElement, maxSide = 320): string | null {
  try {
    const sc = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
    const t = document.createElement("canvas");
    t.width = Math.max(1, Math.round(canvas.width * sc));
    t.height = Math.max(1, Math.round(canvas.height * sc));
    t.getContext("2d")!.drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}

export async function pickAvxToOpen(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const file = await open({
      multiple: false,
      filters: [{ name: "AVERO Project", extensions: ["avx"] }],
    });
    return typeof file === "string" ? file : null;
  } catch {
    return null;
  }
}

export async function pickAvxSavePath(defaultName: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const file = await save({
      defaultPath: defaultName.endsWith(".avx") ? defaultName : `${defaultName}.avx`,
      filters: [{ name: "AVERO Project", extensions: ["avx"] }],
    });
    if (!file) return null;
    return file.toLowerCase().endsWith(".avx") ? file : `${file}.avx`;
  } catch {
    return null;
  }
}

interface AvxLayer {
  meta: LayerMeta;
  pixels: string | null;
  maskPixels: string | null;
}

interface AvxFile {
  magic: string;
  version: number;
  app: string;
  savedAt: number;
  doc: { name: string; width: number; height: number };
  layers: AvxLayer[];
  activeLayerName: string | null;
  adjustments: unknown[];
  filters: unknown[];
  masks: unknown;
  transforms: unknown;
  textSpecs: unknown;
  shapeSpecs: unknown;
  guidesH: number[];
  guidesV: number[];
  showGrid: boolean;
  gridSize: number;
  color: unknown;
  raw: unknown;
}

export function getProjectPath(): string | null {
  return useEditorStore.getState().doc.projectPath ?? null;
}

// Simpan seluruh proyek ke .avx. Jika saveAs false dan sudah ada path, tulis langsung.
export async function saveAvxProject(saveAs = false): Promise<string | null> {
  const ed = useEditorStore.getState();
  const pro = useProStore.getState();
  const doc = ed.doc;
  let path = saveAs ? null : (doc.projectPath ?? null);
  if (!path) {
    const base = (doc.name || "Untitled").replace(/[\\/:*?"<>|]+/g, "_");
    if (isTauri()) {
      path = await pickAvxSavePath(base);
      if (!path) return null;
    } else {
      path = `${base}.avx`;
    }
  }

  const layers: AvxLayer[] = ed.layers.map((l) => {
    const c = layerManager.get(l.id);
    const m = layerManager.getMask(l.id);
    let pixels: string | null = null;
    let maskPixels: string | null = null;
    try {
      pixels = c ? c.toDataURL("image/png") : null;
    } catch {
      pixels = null;
    }
    try {
      maskPixels = m ? m.toDataURL("image/png") : null;
    } catch {
      maskPixels = null;
    }
    return { meta: { ...l }, pixels, maskPixels };
  });
  const active = ed.layers.find((l) => l.id === ed.activeLayerId) ?? null;

  const file: AvxFile = {
    magic: AVX_MAGIC,
    version: AVX_VERSION,
    app: "AVERO STUDIO",
    savedAt: Date.now(),
    doc: { name: doc.name, width: doc.width, height: doc.height },
    layers,
    activeLayerName: active ? active.name : null,
    adjustments: pro.adjustments,
    filters: pro.filters,
    masks: pro.masks,
    transforms: pro.transforms,
    textSpecs: pro.textSpecs,
    shapeSpecs: pro.shapeSpecs,
    guidesH: pro.guidesH,
    guidesV: pro.guidesV,
    showGrid: pro.showGrid,
    gridSize: pro.gridSize,
    color: pro.color,
    raw: pro.raw,
  };
  const json = JSON.stringify(file);

  if (isTauri() && path && !path.startsWith("<")) {
    await writeTextFile(path, json);
  } else {
    const blob = new Blob([json], { type: "application/x-avero" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  useEditorStore.setState((s) => ({
    doc: { ...s.doc, projectPath: isTauri() ? path : s.doc.projectPath, dirty: false },
  }));
  const short = (isTauri() ? path : doc.name).split(/[/\\]/).pop() ?? doc.name;
  // thumbnail untuk recent: komposit ringan
  let thumb: string | null = null;
  try {
    const comp = getCompositeCanvas();
    if (comp) thumb = thumbOf(comp);
    if (!thumb) {
      const tmp = document.createElement("canvas");
      tmp.width = Math.min(320, doc.width);
      tmp.height = Math.max(1, Math.round((tmp.width * doc.height) / Math.max(1, doc.width)));
      const c = layerManager.get(ed.layers[0]?.id ?? "");
      if (c) tmp.getContext("2d")!.drawImage(c, 0, 0, tmp.width, tmp.height);
      thumb = tmp.toDataURL("image/jpeg", 0.6);
    }
  } catch { thumb = null; }
  useHomeStore.getState().pushRecent({
    name: short,
    path: isTauri() ? path : null,
    thumb,
    full: null,
    w: doc.width,
    h: doc.height,
    size: json.length,
  });
  return path;
}

// Buka .avx dan pulihkan utuh: layer, mask, adjustment, filter, transform, guide.
export async function openAvxProject(fromPath?: string): Promise<boolean> {
  let path = fromPath ?? null;
  let json = "";
  if (path) {
    json = await readTextFile(path);
  } else if (isTauri()) {
    path = await pickAvxToOpen();
    if (!path) return false;
    json = await readTextFile(path);
  } else {
    const picked = await new Promise<string | null>((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".avx,application/json";
      inp.onchange = () => {
        const f = inp.files?.[0];
        if (!f) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.onerror = () => resolve(null);
        r.readAsText(f);
      };
      inp.click();
    });
    if (!picked) return false;
    json = picked;
    path = null;
  }

  let file: AvxFile;
  try {
    file = JSON.parse(json) as AvxFile;
  } catch {
    throw new Error("File bukan proyek .avx yang valid");
  }
  if (file.magic !== AVX_MAGIC) throw new Error("File bukan proyek .avx yang valid");
  if (file.version > AVX_VERSION) throw new Error("Proyek dibuat versi AVERO yang lebih baru");

  const ed = useEditorStore.getState();
  const pro = useProStore.getState();
  const W = Math.max(1, Math.min(16384, Math.round(file.doc.width)));
  const H = Math.max(1, Math.min(16384, Math.round(file.doc.height)));

  layerManager.clear();
  clearSelectionMask();

  const freshId = (() => {
    let n = 0;
    return (p: string) => `${p}-avx-${Date.now().toString(36)}-${(n += 1)}`;
  })();

  const newLayers: LayerMeta[] = [];
  const idMap = new Map<string, string>();
  for (const [i, l] of file.layers.entries()) {
    const nid = freshId("layer");
    idMap.set(l.meta.id, nid);
    newLayers.push({ ...l.meta, id: nid, name: l.meta.name || `Layer ${i + 1}` });
  }
  if (newLayers.length === 0) throw new Error("Proyek kosong, tidak ada layer");

  ed.openDocument(file.doc.name || "Untitled", W, H, path, json.length);
  useEditorStore.setState((s) => ({
    layers: newLayers,
    activeLayerId:
      newLayers.find((l) => l.name === file.activeLayerName)?.id ?? newLayers[newLayers.length - 1].id,
    history: [],
    future: [],
    doc: { ...s.doc, projectPath: path },
  }));

  for (const [i, l] of file.layers.entries()) {
    const nid = idMap.get(l.meta.id)!;
    const c = layerManager.ensure(nid, W, H);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    if (l.pixels) {
      try {
        const img = await loadImage(l.pixels);
        ctx.drawImage(img, 0, 0, W, H);
      } catch {
        /* layer dibiarkan kosong */
      }
    }
    if (l.maskPixels) {
      try {
        const mc = layerManager.ensureMask(nid, W, H);
        const mctx = mc.getContext("2d")!;
        mctx.clearRect(0, 0, W, H);
        const mimg = await loadImage(l.maskPixels);
        mctx.drawImage(mimg, 0, 0, W, H);
      } catch {
        /* abaikan mask rusak */
      }
    }
    void i;
  }

  // Kembalikan state non-destruktif dengan id layer baru
  const remap = <T extends Record<string, unknown>>(obj: T): T => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
      out[idMap.get(k) ?? k] = v;
    }
    return out as T;
  };
  useProStore.setState({
    adjustments: Array.isArray(file.adjustments) ? (file.adjustments as typeof pro.adjustments) : [],
    filters: Array.isArray(file.filters) ? (file.filters as typeof pro.filters) : [],
    masks: remap((file.masks ?? {}) as Record<string, unknown>) as typeof pro.masks,
    transforms: remap((file.transforms ?? {}) as Record<string, unknown>) as typeof pro.transforms,
    textSpecs: remap((file.textSpecs ?? {}) as Record<string, unknown>) as typeof pro.textSpecs,
    shapeSpecs: remap((file.shapeSpecs ?? {}) as Record<string, unknown>) as typeof pro.shapeSpecs,
    guidesH: Array.isArray(file.guidesH) ? file.guidesH : [],
    guidesV: Array.isArray(file.guidesV) ? file.guidesV : [],
    showGrid: !!file.showGrid,
    gridSize: file.gridSize || 64,
    color: { ...pro.color, ...((file.color ?? {}) as object) },
    raw: { ...pro.raw, ...((file.raw ?? {}) as object) },
  });

  // Thumbnail recent dari komposit manual
  try {
    const comp = document.createElement("canvas");
    comp.width = W;
    comp.height = H;
    const cctx = comp.getContext("2d")!;
    for (const l of newLayers) {
      if (!l.visible) continue;
      const c = layerManager.get(l.id);
      if (!c) continue;
      cctx.save();
      cctx.globalAlpha = l.opacity / 100;
      cctx.drawImage(c, 0, 0);
      cctx.restore();
    }
    const thumb = thumbOf(comp);
    const short = (path ?? file.doc.name).split(/[/\\]/).pop() ?? file.doc.name;
    useHomeStore.getState().pushRecent({
      name: short,
      path,
      thumb,
      full: null,
      w: W,
      h: H,
      size: json.length,
    });
  } catch {
    /* abaikan */
  }

  pro.bumpHistogram();
  useHomeStore.getState().setHome(false);
  return true;
}

// Encoder BMP 24-bit manual untuk export yang tidak didukung browser.
export function encodeBmpDataUrl(img: ImageData): string {
  const w = img.width;
  const h = img.height;
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pxSize = rowSize * h;
  const buf = new ArrayBuffer(54 + pxSize);
  const dv = new DataView(buf);
  dv.setUint16(0, 0x4d42, true);
  dv.setUint32(2, 54 + pxSize, true);
  dv.setUint32(10, 54, true);
  dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const dstRow = (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const t = 54 + dstRow + x * 3;
      dv.setUint8(t, d[s + 2]);
      dv.setUint8(t + 1, d[s + 1]);
      dv.setUint8(t + 2, d[s]);
    }
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return `data:image/bmp;base64,${btoa(bin)}`;
}

export type ExportFormat = "png" | "jpg" | "jpeg" | "webp" | "bmp" | "svg" | "tiff";

export interface ExportOptions {
  format: ExportFormat;
  quality: number;
  scale: number;
  matte: "none" | "white" | "black";
  fileName: string;
}

// Render komposit final sesuai opsi export. SVG menanam PNG base64.
export function renderExportCanvas(opts: ExportOptions): { canvas: HTMLCanvasElement; mime: string } {
  const comp = getCompositeCanvas();
  const ed = useEditorStore.getState();
  const W = Math.max(1, Math.round(ed.doc.width * (opts.scale / 100)));
  const H = Math.max(1, Math.round(ed.doc.height * (opts.scale / 100)));
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;
  if (opts.matte !== "none") {
    ctx.fillStyle = opts.matte === "white" ? "#ffffff" : "#000000";
    ctx.fillRect(0, 0, W, H);
  }
  if (comp) {
    ctx.drawImage(comp, 0, 0, W, H);
  } else {
    ed.layers.forEach((l) => {
      if (!l.visible) return;
      const c = layerManager.get(l.id);
      if (!c) return;
      ctx.save();
      ctx.globalAlpha = l.opacity / 100;
      ctx.drawImage(c, 0, 0, W, H);
      ctx.restore();
    });
  }
  const mime =
    opts.format === "png"
      ? "image/png"
      : opts.format === "bmp"
        ? "image/bmp"
        : opts.format === "webp"
          ? "image/webp"
          : "image/jpeg";
  return { canvas: out, mime };
}

export function exportDataUrl(opts: ExportOptions): { dataUrl: string; ext: string } {
  const { canvas, mime } = renderExportCanvas(opts);
  const q = Math.max(1, Math.min(100, Math.round(opts.quality))) / 100;
  if (opts.format === "svg") {
    const png = canvas.toDataURL("image/png");
    const b64 = png.split(",")[1] ?? "";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">` +
      `<image width="${canvas.width}" height="${canvas.height}" href="data:image/png;base64,${b64}"/></svg>`;
    return { dataUrl: `data:image/svg+xml;base64,${utf8ToB64(svg)}`, ext: "svg" };
  }
  if (opts.format === "bmp") {
    const img = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    return { dataUrl: encodeBmpDataUrl(img), ext: "bmp" };
  }
  if (opts.format === "png") return { dataUrl: canvas.toDataURL("image/png"), ext: "png" };
  return { dataUrl: canvas.toDataURL(mime, q), ext: opts.format === "tiff" ? "tiff" : opts.format };
}
