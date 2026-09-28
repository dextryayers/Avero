import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore, type LayerMeta } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { clearSelectionMask, hasSelection, selectionMaskCanvas, restoreSelectionMask } from "../engine/selection";
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

// Read/write text files through the app core process (no plugin-fs scope limits).
export async function readTextFile(path: string): Promise<string> {
  return await invoke<string>("cmd_read_text_file", { path });
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await invoke("cmd_write_text_file", { path, contents });
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
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
    img.onerror = () => reject(new Error("Corrupt layer image"));
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
      directory: false,
      title: "Open Avero project (.avx)",
      filters: [{ name: "Avero Project Design", extensions: ["avx"] }],
    });
    return typeof file === "string" ? file : null;
  } catch {
    return null;
  }
}

export async function pickAvxSavePath(defaultPath: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    // Word-like: the dialog always appears on first save, defaulting to .avx.
    const withExt = ensureAvxExtension(defaultPath);
    const file = await save({
      defaultPath: withExt,
      title: "Save Avero project (.avx)",
      filters: [{ name: "Avero Project Design", extensions: ["avx"] }],
    });
    if (!file) return null;
    return ensureAvxExtension(file);
  } catch {
    return null;
  }
}

// ---- Word-like project folder helpers ----
export function sanitizeProjectName(name: string): string {
  const clean = (name || "Untitled").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim();
  return clean.slice(0, 80) || "Untitled";
}

export function ensureAvxExtension(p: string): string {
  const t = (p || "").trim();
  if (!t) return "Untitled.avx";
  return t.toLowerCase().endsWith(".avx") ? t : `${t}.avx`;
}

export function joinPath(a: string, b: string): string {
  if (!a) return b;
  const sep = a.includes("\\") && !a.includes("/") ? "\\" : "/";
  const left = a.endsWith("/") || a.endsWith("\\") ? a.slice(0, -1) : a;
  const right = b.startsWith("/") || b.startsWith("\\") ? b.slice(1) : b;
  return `${left}${sep}${right}`;
}

export function parentDir(p: string | null): string | null {
  if (!p) return null;
  const t = p.replace(/[/\\]+$/, "");
  const i = Math.max(t.lastIndexOf("/"), t.lastIndexOf("\\"));
  if (i <= 0) return null;
  return t.slice(0, i);
}

export function baseName(p: string | null, ext = true): string {
  if (!p) return "Untitled";
  const t = p.split(/[/\\]/).pop() ?? "Untitled";
  if (ext || !t.toLowerCase().endsWith(".avx")) return t;
  return t.slice(0, -4);
}

// Pick a dedicated project folder (enforced on Create New, holds assets/images like Word).
// canCreateDirectories lets the user create the special folder on the spot.
export async function pickProjectFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const dir = await open({
      multiple: false,
      directory: true,
      canCreateDirectories: true,
      title: "Choose a folder for the new project",
    });
    return typeof dir === "string" ? dir : null;
  } catch {
    return null;
  }
}

export async function ensureProjectDir(folder: string): Promise<string> {
  if (!isTauri()) return folder;
  try {
    return await invoke<string>("cmd_ensure_dir", { path: folder });
  } catch (e) {
    throw new Error(`Could not create project folder: ${String(e)}`);
  }
}

async function projectDirExists(folder: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>("cmd_path_exists", { path: folder });
  } catch {
    return false;
  }
}

export function getProjectFolder(): string | null {
  return useEditorStore.getState().doc.projectFolder ?? null;
}

// File the app was launched with (double-clicked .avx). Null on web or plain launch.
export async function fetchStartupFile(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<string | null>("cmd_startup_file");
  } catch {
    return null;
  }
}

/** Companion preview image beside the .avx so file managers show a visual result. */
export function previewPathFor(avxPath: string): string {
  const dot = avxPath.lastIndexOf(".");
  const base = dot > 0 ? avxPath.slice(0, dot) : avxPath;
  return `${base}_preview.jpg`;
}

// Best-effort startup registration so Explorer shows
// "Avero Project Design" in the Type column for .avx files.
export async function registerAvxAssociation(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("cmd_register_avx_association");
  } catch {
    /* best effort only, never blocks startup */
  }
}

// Create a dedicated `<parent>/<Name>/` folder + `images/`; linked to the new document.
// Appends ` - 2`, ` - 3`, ... when the name is taken so projects never mix.
// The .avx file itself is written on Save (dialog defaults into this folder).
export async function createNewProjectWithFolder(
  name: string,
  parentFolder: string,
): Promise<string> {
  const clean = sanitizeProjectName(name);
  let root = joinPath(parentFolder, clean);
  for (let n = 2; n <= 99; n++) {
    if (!(await projectDirExists(root))) break;
    root = joinPath(parentFolder, `${clean} - ${n}`);
  }
  await ensureProjectDir(root);
  return root;
}

interface AvxLayer {
  meta: LayerMeta;
  pixels: string | null;
  maskPixels: string | null;
}

export interface AvxFile {
  magic: string;
  version: number;
  app: string;
  savedAt: number;
  checksum?: string;
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
  selPixels?: string | null;
  ui?: {
    selKind?: string;
    selFeather?: number;
    selTolerance?: number;
    selExpand?: number;
    savedSelections?: unknown[];
    paintMask?: boolean;
    gradTo?: string;
    snapEnabled?: boolean;
    brush?: { size?: number; opacity?: number; hardness?: number; color?: string };
  };
}

export function getProjectPath(): string | null {
  return useEditorStore.getState().doc.projectPath ?? null;
}

// Validate .avx contents purely, without touching the store. Throws on invalid data.
export function parseAvxJson(json: string): AvxFile {
  let file: AvxFile;
  try {
    file = JSON.parse(json) as AvxFile;
  } catch {
    throw new Error("Not a valid .avx project file");
  }
  if (file.magic !== AVX_MAGIC) throw new Error("Not a valid .avx project file");
  if (file.version > AVX_VERSION) throw new Error("Project was created with a newer AVERO version");
  if (!file.doc || typeof file.doc.width !== "number" || typeof file.doc.height !== "number") {
    throw new Error("Not a valid .avx project file (missing document data)");
  }
  if (!Array.isArray(file.layers)) throw new Error("Not a valid .avx project file (missing layer data)");
  if (typeof file.checksum === "string" && file.checksum.length > 0) {
    if (!verifyAvxChecksum(file)) throw new Error("Project checksum mismatch, file may be corrupt");
  }
  return file;
}

function fnv1aHex(s: string): string {
  let h = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

async function avxChecksum(payload: string): Promise<string> {
  try {
    if (isTauri()) {
      return await invoke<string>("cmd_data_hash", { contents: payload });
    }
  } catch {
    /* fall through to local hash */
  }
  return fnv1aHex(payload);
}

function canonicalPayload(file: AvxFile): string {
  const ordered = {
    magic: file.magic,
    version: file.version,
    app: file.app,
    savedAt: file.savedAt,
    doc: file.doc,
    layers: file.layers,
    activeLayerName: file.activeLayerName,
    adjustments: file.adjustments,
    filters: file.filters,
    masks: file.masks,
    transforms: file.transforms,
    textSpecs: file.textSpecs,
    shapeSpecs: file.shapeSpecs,
    guidesH: file.guidesH,
    guidesV: file.guidesV,
    showGrid: file.showGrid,
    gridSize: file.gridSize,
    color: file.color,
    raw: file.raw,
    selPixels: file.selPixels ?? null,
    ui: file.ui ?? null,
  };
  return JSON.stringify(ordered);
}

export function verifyAvxChecksum(file: AvxFile): boolean {
  if (!file.checksum) return true;
  return fnv1aHex(canonicalPayload(file)) === file.checksum;
}

// Tolerant normalization: old files / missing fields still open without corruption.
// Fills safe defaults for every invalid section.
export function normalizeAvxFile(file: AvxFile): AvxFile {
  const layers = Array.isArray(file.layers) ? file.layers : [];
  const cleanLayers: AvxLayer[] = layers
    .filter((l) => l && typeof l === "object")
    .map((l, i) => ({
      meta: {
        id: typeof l.meta?.id === "string" ? l.meta.id : `layer-${i}`,
        name: typeof l.meta?.name === "string" && l.meta.name ? l.meta.name : `Layer ${i + 1}`,
        visible: l.meta?.visible !== false,
        locked: l.meta?.locked === true,
        opacity: clampNum(l.meta?.opacity, 0, 100, 100),
        blendMode: (typeof l.meta?.blendMode === "string" ? l.meta.blendMode : "normal") as AvxLayer["meta"]["blendMode"],
        kind: (l.meta?.kind === "text" || l.meta?.kind === "shape" || l.meta?.kind === "background"
          ? l.meta.kind
          : "raster") as AvxLayer["meta"]["kind"],
        clipped: l.meta?.clipped === true ? true : undefined,
      },
      pixels: typeof l.pixels === "string" && l.pixels.startsWith("data:image/") ? l.pixels : null,
      maskPixels:
        typeof l.maskPixels === "string" && l.maskPixels.startsWith("data:image/") ? l.maskPixels : null,
    }));
  return {
    magic: AVX_MAGIC,
    version: typeof file.version === "number" ? file.version : AVX_VERSION,
    app: typeof file.app === "string" ? file.app : "AVERO STUDIO",
    savedAt: typeof file.savedAt === "number" ? file.savedAt : Date.now(),
    checksum: typeof file.checksum === "string" ? file.checksum : undefined,
    doc: {
      name: typeof file.doc?.name === "string" && file.doc.name ? file.doc.name : "Untitled",
      width: clampNum(file.doc?.width, 1, 16384, 1920),
      height: clampNum(file.doc?.height, 1, 16384, 1080),
    },
    layers: cleanLayers,
    activeLayerName: typeof file.activeLayerName === "string" ? file.activeLayerName : null,
    adjustments: Array.isArray(file.adjustments) ? file.adjustments : [],
    filters: Array.isArray(file.filters) ? file.filters : [],
    masks: file.masks && typeof file.masks === "object" ? file.masks : {},
    transforms: file.transforms && typeof file.transforms === "object" ? file.transforms : {},
    textSpecs: file.textSpecs && typeof file.textSpecs === "object" ? file.textSpecs : {},
    shapeSpecs: file.shapeSpecs && typeof file.shapeSpecs === "object" ? file.shapeSpecs : {},
    guidesH: Array.isArray(file.guidesH) ? file.guidesH.filter((n) => Number.isFinite(n)) : [],
    guidesV: Array.isArray(file.guidesV) ? file.guidesV.filter((n) => Number.isFinite(n)) : [],
    showGrid: !!file.showGrid,
    gridSize: clampNum(file.gridSize, 8, 512, 64),
    color: file.color && typeof file.color === "object" ? file.color : {},
    raw: file.raw && typeof file.raw === "object" ? file.raw : {},
    selPixels:
      typeof file.selPixels === "string" && file.selPixels.startsWith("data:image/")
        ? file.selPixels
        : null,
    ui: file.ui && typeof file.ui === "object" ? file.ui : undefined,
  };
}

// Word-style automatic backup: before overwriting an old .avx, keep a `.bak` copy.
async function backupExistingAvx(path: string): Promise<void> {
  if (!isTauri() || !path.toLowerCase().endsWith(".avx")) return;
  try {
    const prev = await readTextFile(path);
    if (!prev || prev.length < 32) return;
    await writeTextFile(`${path}.bak`, prev);
  } catch {
    /* best-effort backup; a backup failure never fails the save */
  }
}

// Save the full project to .avx, Word-style.
// - First save / Save As: ALWAYS opens the file manager, defaulting to `Name.avx`
//   inside the dedicated project folder when one exists.
// - Later saves: write straight to the same path (atomic + backup + verify).
export async function saveAvxProject(saveAs = false): Promise<string | null> {
  const ed = useEditorStore.getState();
  const pro = useProStore.getState();
  const doc = ed.doc;
  let path = saveAs ? null : (doc.projectPath ?? null);
  if (!path) {
    const base = sanitizeProjectName(doc.name);
    if (isTauri()) {
      const folder = doc.projectFolder ?? null;
      const def = folder ? joinPath(folder, ensureAvxExtension(base)) : ensureAvxExtension(base);
      path = await pickAvxSavePath(def);
      if (!path) return null;
    } else {
      path = ensureAvxExtension(base);
    }
  } else {
    path = ensureAvxExtension(path);
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

  let selPixels: string | null = null;
  try {
    const sc = selectionMaskCanvas();
    if (sc && hasSelection()) selPixels = sc.toDataURL("image/png");
  } catch {
    selPixels = null;
  }

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
    selPixels,
    ui: {
      selKind: pro.selKind,
      selFeather: pro.selFeather,
      selTolerance: pro.selTolerance,
      selExpand: pro.selExpand,
      savedSelections: pro.savedSelections,
      paintMask: pro.paintMask,
      gradTo: pro.gradTo,
      snapEnabled: pro.snapEnabled,
      brush: {
        size: ed.brushSize,
        opacity: ed.brushOpacity,
        hardness: ed.brushHardness,
        color: ed.brushColor,
      },
    },
  };
  const checksum = await avxChecksum(canonicalPayload(file));
  const stamped: AvxFile = { ...file, checksum };
  const json = JSON.stringify(stamped);

  // Verify before writing: never write a corrupt file to disk.
  // If verification fails, abort the save with a clear error.
  try {
    const recheck = parseAvxJson(json);
    if (recheck.layers.length !== file.layers.length) {
      throw new Error("Layer count changed during verify");
    }
  } catch (e) {
    throw new Error(`Project file is invalid, save aborted: ${String(e)}`);
  }

  if (isTauri() && path && !path.startsWith("<")) {
    await backupExistingAvx(path);
    try {
      await invoke("cmd_write_text_atomic", { path, contents: json });
    } catch {
      await writeTextFile(path, json);
    }
    // Light post-verify: re-read the header + magic so corruption is caught immediately.
    try {
      const back = await readTextFile(path);
      const head = back.slice(0, 64);
      if (!head.includes(AVX_MAGIC)) throw new Error("header mismatch");
    } catch (e) {
      throw new Error(`Save verification failed: ${String(e)}`);
    }
    // Companion preview: a real JPG beside the .avx so file managers show
    // the visual result. Encoded by the Rust image engine, best effort only.
    try {
      const comp = getCompositeCanvas();
      if (comp && comp.width > 0 && comp.height > 0) {
        const sc = Math.min(1, 1024 / Math.max(comp.width, comp.height));
        const pw = Math.max(1, Math.round(comp.width * sc));
        const ph = Math.max(1, Math.round(comp.height * sc));
        const pc = document.createElement("canvas");
        pc.width = pw;
        pc.height = ph;
        pc.getContext("2d")!.drawImage(comp, 0, 0, pw, ph);
        const { rustSaveDataUrl } = await import("./tauriIo");
        await rustSaveDataUrl(pc.toDataURL("image/jpeg", 0.82), previewPathFor(path));
      }
    } catch {
      /* preview never fails the save */
    }
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
    doc: {
      ...s.doc,
      projectPath: isTauri() ? path : s.doc.projectPath,
      projectFolder: isTauri() && path ? (parentDir(path) ?? s.doc.projectFolder) : s.doc.projectFolder,
      dirty: false,
    },
  }));
  const short = (isTauri() ? path : doc.name).split(/[/\\]/).pop() ?? doc.name;
  // Lightweight recent thumbnail from the composite
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

// Open an .avx file and fully restore it: layers, masks, adjustments, filters, transforms, guides.
// Corruption-proof: tolerant normalization + safe per-layer loading + image timeouts.
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

  if (!json || json.length < 16) throw new Error("Empty or corrupt .avx file");
  const raw = parseAvxJson(json);
  const file = normalizeAvxFile(raw);

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
  if (newLayers.length === 0) throw new Error("Empty project, no layers found");

  ed.openDocument(file.doc.name || "Untitled", W, H, path, json.length);
  useEditorStore.setState((s) => ({
    layers: newLayers,
    activeLayerId:
      newLayers.find((l) => l.name === file.activeLayerName)?.id ?? newLayers[newLayers.length - 1].id,
    history: [],
    future: [],
    doc: { ...s.doc, projectPath: path, projectFolder: parentDir(path) ?? s.doc.projectFolder },
  }));

  const loadWithTimeout = (dataUrl: string, ms = 8000): Promise<HTMLImageElement> =>
    Promise.race([
      loadImage(dataUrl),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Layer image timeout")), ms)),
    ]);

  let okLayers = 0;
  for (const [i, l] of file.layers.entries()) {
    const nid = idMap.get(l.meta.id)!;
    const c = layerManager.ensure(nid, W, H);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    if (l.pixels) {
      try {
        const img = await loadWithTimeout(l.pixels);
        // Gambar corrupt berdimensi aneh: gambar apa adanya, jangan stretch merusak.
        try {
          ctx.drawImage(img, 0, 0, W, H);
        } catch {
          ctx.drawImage(img, 0, 0);
        }
        okLayers += 1;
      } catch {
        /* leave the layer blank, the document still opens normally */
      }
    } else {
      okLayers += 1; // an empty layer is valid (e.g. pure text/shape)
    }
    if (l.maskPixels) {
      try {
        const mc = layerManager.ensureMask(nid, W, H);
        const mctx = mc.getContext("2d")!;
        mctx.clearRect(0, 0, W, H);
        const mimg = await loadWithTimeout(l.maskPixels);
        try {
          mctx.drawImage(mimg, 0, 0, W, H);
        } catch {
          mctx.drawImage(mimg, 0, 0);
        }
      } catch {
        /* ignore a broken mask */
      }
    }
    void i;
  }
  void okLayers;

  // Restore the saved active selection mask, if present
  if (file.selPixels) {
    try {
      const simg = await loadImage(file.selPixels);
      restoreSelectionMask(W, H, simg);
    } catch {
      clearSelectionMask();
    }
  }

  // Restore non-destructive state with the new layer ids
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

  // Restore saved editor UI state, if present
  const ui = file.ui ?? {};
  const selKinds = ["none", "rect", "ellipse", "lasso", "wand"];
  const gradTos = ["transparent", "white", "black"];
  useProStore.setState({
    selKind: ui.selKind && selKinds.includes(ui.selKind) ? (ui.selKind as typeof pro.selKind) : pro.selKind,
    selFeather: clampNum(ui.selFeather, 0, 250, pro.selFeather),
    selTolerance: clampNum(ui.selTolerance, 0, 255, pro.selTolerance),
    selExpand: clampNum(ui.selExpand, -100, 100, pro.selExpand),
    savedSelections: Array.isArray(ui.savedSelections) ? (ui.savedSelections as typeof pro.savedSelections) : pro.savedSelections,
    paintMask: typeof ui.paintMask === "boolean" ? ui.paintMask : false,
    gradTo: ui.gradTo && gradTos.includes(ui.gradTo) ? (ui.gradTo as typeof pro.gradTo) : pro.gradTo,
    snapEnabled: typeof ui.snapEnabled === "boolean" ? ui.snapEnabled : pro.snapEnabled,
  });
  if (ui.brush) {
    useEditorStore.setState({
      brushSize: clampNum(ui.brush.size, 1, 300, ed.brushSize),
      brushOpacity: clampNum(ui.brush.opacity, 1, 100, ed.brushOpacity),
      brushHardness: clampNum(ui.brush.hardness, 0, 100, ed.brushHardness),
      brushColor: typeof ui.brush.color === "string" ? ui.brush.color : ed.brushColor,
    });
  }

  // Recent thumbnail from a manual composite
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
    /* ignore thumbnail failures */
  }

  pro.bumpHistogram();
  useHomeStore.getState().setHome(false);
  return true;
}

// Manual 24-bit BMP encoder for exports the browser cannot produce.
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

// Render the final composite for the export options. SVG embeds base64 PNG.
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
  // TIFF dirender dulu sebagai PNG lossless, lalu dikodekan ulang ke TIFF oleh mesin inti.
  const mime =
    opts.format === "png" || opts.format === "tiff"
      ? "image/png"
      : opts.format === "bmp"
        ? "image/bmp"
        : opts.format === "webp"
          ? "image/webp"
          : "image/jpeg";
  return { canvas: out, mime };
}

export interface SmartExportResult {
  dataUrl: string;
  ext: string;
  outW: number;
  outH: number;
  tiled: boolean;
  estMB: number;
}

export async function exportImageSmart(
  opts: ExportOptions,
  onProgress?: (stage: string) => void,
): Promise<SmartExportResult> {
  const ed = useEditorStore.getState();
  onProgress?.("Planning export");
  let plan = { outW: Math.max(1, Math.round(ed.doc.width * (opts.scale / 100))), outH: Math.max(1, Math.round(ed.doc.height * (opts.scale / 100))), tiled: false, tile: 0, estMB: 0 };
  try {
    const { exportPlan } = await import("./memoryManager");
    const p = await exportPlan(ed.doc.width, ed.doc.height, opts.scale);
    plan = { outW: p.outW, outH: p.outH, tiled: p.tiled, tile: p.tile, estMB: p.estMB };
  } catch {
    /* use local dimensions */
  }
  onProgress?.(plan.tiled ? `Rendering UHD ${plan.outW}x${plan.outH} tiled` : `Rendering ${plan.outW}x${plan.outH}`);
  // Yield once so the dialog can paint progress before the heavy draw.
  await new Promise((r) => setTimeout(r, 30));
  const { dataUrl, ext } = exportDataUrl(opts);
  onProgress?.("Encoding complete");
  return { dataUrl, ext, outW: plan.outW, outH: plan.outH, tiled: plan.tiled, estMB: plan.estMB };
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
