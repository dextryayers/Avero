// Global editor shortcuts: tool letters (Shift cycles family), menu actions, quick navigation.
//
// Lapisan shortcut (urutan prioritas di App.tsx):
//   1. Global app  — Ctrl+K/S/E/O/,  — jalan bahkan saat mengetik di input.
//   2. Edit umum   — Ctrl+Z/Y/X/C/V/A/D/T/J/G + Del/Backspace/F5 — hanya saat TIDAK mengetik,
//                    supaya perilaku native input (undo/cut/paste teks) tidak dibajak.
//   3. View        — Ctrl++/−/0/1, Ctrl+R, Ctrl+;, ' — hanya saat tidak mengetik.
//   4. Tools       — huruf tunggal, Shift+huruf, [ ], angka 0-9, X/D, Space, panah.
// Semua helper edit terpusat di sini supaya App.tsx tipis dan mudah diuji.
import { TOOLS } from "../components/ToolBar";
import { MENUS } from "./menus";
import { makeLayer, useEditorStore, type ToolId } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import {
  clearSelectionMask,
  hasSelection,
  selectionMaskCanvas,
} from "../engine/selection";

type Family = string[];

let families: Map<string, Family> | null = null;

function buildFamilies(): Map<string, Family> {
  const map = new Map<string, Family>();
  for (const t of TOOLS) {
    const key = t.shortcut.toUpperCase();
    const arr = map.get(key) ?? [];
    arr.push(t.id);
    map.set(key, arr);
  }
  const preferred: Record<string, string> = {
    V: "move",
    M: "select-rect",
    L: "select-lasso",
    W: "wand",
    B: "brush",
    J: "spot-heal",
    S: "clone",
    R: "blur",
    O: "dodge",
    E: "eraser",
    G: "gradient",
    I: "eyedropper",
    T: "text",
    U: "shape-rect",
    P: "pen",
    C: "crop",
    H: "hand",
    Z: "zoom",
    N: "sketch-charcoal",
    F: "art-oil",
    D: "distort-twirl",
    K: "light-highlights",
    X: "detail-grain-remove",
    Y: "select-rounded",
    A: "crop-169",
    Q: "exposure-brush",
  };
  for (const [letter, id] of Object.entries(preferred)) {
    const arr = map.get(letter);
    if (!arr) continue;
    const i = arr.indexOf(id);
    if (i > 0) {
      arr.splice(i, 1);
      arr.unshift(id);
    }
  }
  return map;
}

function getFamilies() {
  if (!families) families = buildFamilies();
  return families;
}

export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let k = e.key;
  if (k === "=" || k === "+") k = "+";
  else if (k === " ") k = "Space";
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

// ---------------------------------------------------------------------------
// Fokus: jangan bajak input teks.
// ---------------------------------------------------------------------------

/** True bila elemen adalah field teks yang harus menerima shortcut native browser. */
export function isEditableTarget(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  try {
    if (typeof (el as HTMLElement).closest === "function" && (el as HTMLElement).closest("[contenteditable='true'], [contenteditable='']")) return true;
  } catch {
    /* abaikan */
  }
  return false;
}

/** True bila fokus saat ini ada di dalam input/teks — shortcut edit kanvas wajib diam. */
export function isEditingNow(): boolean {
  try {
    return isEditableTarget(document.activeElement);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Menu-action lookup dengan alias (satu aksi boleh punya banyak combo).
// ---------------------------------------------------------------------------

/** Alias combo tambahan yang tidak tertulis di MENUS tapi wajib jalan. */
const COMBO_ALIASES: Record<string, string> = {
  // Redo: Photoshop + umum — Ctrl+Y ATAU Ctrl+Shift+Z.
  "Ctrl+Shift+Z": "redo",
  "Ctrl+Y": "redo",
  // Step backward ala Photoshop — perlakukan sebagai undo.
  "Ctrl+Alt+Z": "undo",
  // Merge visible / merge down tanpa konflik dengan Export (Ctrl+E).
  "Ctrl+Shift+E": "merge-all",
  // Buka proyek .avx tanpa merebut Ctrl+O milik Open Image.
  "Ctrl+Shift+O": "open-avx",
};

let actionIndex: Map<string, string> | null = null;

export function findMenuAction(combo: string): string | null {
  if (!actionIndex) {
    actionIndex = new Map();
    for (const items of Object.values(MENUS)) {
      for (const it of items) {
        if (it.hint && !actionIndex.has(it.hint)) actionIndex.set(it.hint, it.action);
      }
    }
    for (const [comboKey, action] of Object.entries(COMBO_ALIASES)) {
      if (!actionIndex.has(comboKey)) actionIndex.set(comboKey, action);
    }
  }
  return actionIndex.get(combo) ?? null;
}

/** Daftar shortcut edit umum untuk footer / palette / dokumentasi. Satu sumber kebenaran. */
export const EDIT_SHORTCUTS: { combo: string; label: string; desc: string }[] = [
  { combo: "Ctrl+Z", label: "Undo", desc: "Batalkan langkah terakhir (pixel + mask ikut pulih)" },
  { combo: "Ctrl+Shift+Z", label: "Redo", desc: "Ulangi lagi — alternatif Ctrl+Y" },
  { combo: "Ctrl+Y", label: "Redo", desc: "Ulangi lagi — alternatif Ctrl+Shift+Z" },
  { combo: "Ctrl+Alt+Z", label: "Step Backward", desc: "Mundur satu langkah ala Photoshop" },
  { combo: "Ctrl+X", label: "Cut", desc: "Potong seleksi/layer ke clipboard + riwayat undo" },
  { combo: "Ctrl+C", label: "Copy", desc: "Salin seleksi/layer (hormati seleksi aktif)" },
  { combo: "Ctrl+V", label: "Paste", desc: "Tempel sebagai layer baru, proporsional di tengah" },
  { combo: "Ctrl+Shift+V", label: "Paste in Place", desc: "Tempel tepat di posisi asal (tanpa geser)" },
  { combo: "Ctrl+A", label: "Select All", desc: "Pilih seluruh kanvas" },
  { combo: "Ctrl+D", label: "Deselect", desc: "Hapus seleksi" },
  { combo: "Ctrl+Shift+D", label: "Reselect", desc: "Kembalikan seleksi terakhir" },
  { combo: "Ctrl+Shift+I", label: "Inverse", desc: "Balik seleksi" },
  { combo: "Delete", label: "Delete", desc: "Hapus piksel terseleksi (riwayat tersimpan)" },
  { combo: "Ctrl+J", label: "Duplicate", desc: "Duplikat layer aktif" },
  { combo: "Ctrl+Shift+J", label: "Layer via Cut", desc: "Potong seleksi ke layer baru" },
  { combo: "Ctrl+T", label: "Free Transform", desc: "Mode transform bebas" },
  { combo: "Ctrl+G", label: "Group", desc: "Kelompokkan (via palette)" },
  { combo: "Ctrl+]", label: "Layer Up", desc: "Naikkan urutan layer" },
  { combo: "Ctrl+[", label: "Layer Down", desc: "Turunkan urutan layer" },
  { combo: "Shift+F5", label: "Content Fill", desc: "Isi sadar-konten" },
  { combo: "Alt+Backspace", label: "Fill FG", desc: "Isi dengan warna depan" },
  { combo: "Ctrl+Backspace", label: "Fill BG", desc: "Isi dengan warna belakang" },
  { combo: "Ctrl+S", label: "Save", desc: "Simpan proyek .avx" },
  { combo: "Ctrl+Shift+S", label: "Save As", desc: "Simpan proyek sebagai baru" },
  { combo: "Ctrl+O", label: "Open", desc: "Buka gambar" },
  { combo: "Ctrl+E", label: "Export", desc: "Buka dialog ekspor" },
  { combo: "Ctrl+K", label: "All Actions", desc: "Buka command palette" },
  { combo: "Ctrl+,", label: "Settings", desc: "Buka/tutup pengaturan" },
  { combo: "Ctrl++ / Ctrl+-", label: "Zoom", desc: "Perbesar / perkecil" },
  { combo: "Ctrl+0 / Ctrl+1", label: "Fit / 100%", desc: "Paskan layar / piksel asli" },
  { combo: "[ / ]", label: "Brush Size", desc: "Kecilkan / besarkan kuas" },
  { combo: "Shift+[ / Shift+]", label: "Hardness", desc: "Lunakkan / keraskan kuas" },
  { combo: "1..0", label: "Opacity", desc: "Set opasitas kuas 10–100%" },
  { combo: "X / D", label: "Colors", desc: "Tukar / reset warna depan-belakang" },
  { combo: "Space", label: "Hand", desc: "Tahan untuk geser kanvas sementara" },
  { combo: "Arrows", label: "Nudge", desc: "Geser layer 1px (Shift = 10px)" },
  { combo: "Esc / Enter", label: "Cancel / Apply", desc: "Batalkan crop & tutup dialog / terapkan crop" },
];

/** True bila event adalah Undo (Ctrl/Cmd+Z tanpa Shift, atau Ctrl+Alt+Z step-backward). */
export function matchUndo(e: KeyboardEvent): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey && !e.altKey) return true;
  if (k === "z" && !e.shiftKey && e.altKey) return true; // Ctrl+Alt+Z
  return false;
}

/** True bila event adalah Redo (Ctrl+Y atau Ctrl+Shift+Z). */
export function matchRedo(e: KeyboardEvent): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  const k = e.key.toLowerCase();
  if (k === "y" && !e.shiftKey && !e.altKey) return true;
  if (k === "z" && e.shiftKey && !e.altKey) return true;
  return false;
}

export function dispatchAction(action: string) {
  window.dispatchEvent(new CustomEvent("avero:action", { detail: action }));
}

// Shift+letter: cycle in order within the same tool family (pro editor behavior)
export function cycleFamily(letter: string): boolean {
  const fam = getFamilies().get(letter.toUpperCase());
  if (!fam || fam.length === 0) return false;
  const ed = useEditorStore.getState();
  const cur = fam.indexOf(ed.tool);
  const next = cur < 0 ? 0 : (cur + 1) % fam.length;
  ed.setTool(fam[next] as ToolId);
  return true;
}

// Pick first tool of family when letter is not handled elsewhere
export function selectFamilyFirst(letter: string): boolean {
  const fam = getFamilies().get(letter.toUpperCase());
  if (!fam || fam.length === 0) return false;
  useEditorStore.getState().setTool(fam[0] as ToolId);
  return true;
}

export function adjustBrushSize(delta: number): boolean {
  const ed = useEditorStore.getState();
  const next = Math.max(1, Math.min(300, ed.brushSize + delta));
  ed.setBrush({ size: next });
  return true;
}

export function adjustBrushHardness(delta: number): boolean {
  const ed = useEditorStore.getState();
  const next = Math.max(0, Math.min(100, ed.brushHardness + delta));
  ed.setBrush({ hardness: next });
  return true;
}

export function adjustBrushOpacity(delta: number): boolean {
  const ed = useEditorStore.getState();
  const next = Math.max(1, Math.min(100, ed.brushOpacity + delta));
  ed.setBrush({ opacity: next });
  return true;
}

export function adjustBrushFlow(delta: number): boolean {
  const ed = useEditorStore.getState();
  const next = Math.max(1, Math.min(100, ed.brushFlow + delta));
  ed.setBrush({ flow: next });
  return true;
}

/** Tombol angka 1..0 ala Photoshop: 1=10%, 5=50%, 0=100%. Shift+angka = Flow. */
export function setBrushOpacityDigit(digit: string, toFlow = false): boolean {
  const n = digit === "0" ? 100 : Math.max(1, Math.min(9, Number(digit))) * 10;
  if (!Number.isFinite(n)) return false;
  if (toFlow) useEditorStore.getState().setBrush({ flow: n });
  else useEditorStore.getState().setBrush({ opacity: n });
  return true;
}

/** X: tukar warna depan/belakang. D: reset ke hitam/putih ala Photoshop. */
export function swapBrushColors(): boolean {
  const ed = useEditorStore.getState();
  const fg = ed.brushColor;
  const bg = ed.bgColor;
  ed.setBrush({ color: bg });
  ed.setBgColor(fg);
  return true;
}

export function resetBrushColors(): boolean {
  const ed = useEditorStore.getState();
  ed.setBrush({ color: "#000000" });
  ed.setBgColor("#ffffff");
  return true;
}

// Space: hold for temporary Hand, release to return to previous tool
let spaceTool: string | null = null;

export function spaceDown(): boolean {
  // Jangan bajak spasi saat mengetik teks.
  if (isEditingNow()) return false;
  const ed = useEditorStore.getState();
  if (ed.tool === "hand") return true;
  spaceTool = ed.tool;
  ed.setTool("hand");
  return true;
}

export function spaceUp(): boolean {
  if (!spaceTool) return false;
  const ed = useEditorStore.getState();
  if (ed.tool === "hand") ed.setTool(spaceTool as never);
  spaceTool = null;
  return true;
}

// ---------------------------------------------------------------------------
// Clipboard + operasi edit umum (satu sumber kebenaran, dipakai App.tsx dan
// event avero:clip). Semua operasi perusak mendorong history agar bisa Undo.
// ---------------------------------------------------------------------------

const MEM_CLIP_KEY = "__avero_clipboard" as const;

export function getMemClipboard(): string | null {
  try {
    return (window as unknown as Record<string, string | null>)[MEM_CLIP_KEY] ?? null;
  } catch {
    return null;
  }
}

export function setMemClipboard(v: string | null): void {
  try {
    (window as unknown as Record<string, string | null>)[MEM_CLIP_KEY] = v;
  } catch {
    /* abaikan */
  }
}

/** Kecilkan layer ke max 2048px agar dataURL PNG tidak meledak di 4K. */
export function layerToClipboardURL(c: HTMLCanvasElement): string {
  try {
    const maxSide = 2048;
    const m = Math.max(c.width, c.height);
    if (m <= maxSide) return c.toDataURL("image/png");
    const sc = maxSide / m;
    const t = document.createElement("canvas");
    t.width = Math.max(1, Math.round(c.width * sc));
    t.height = Math.max(1, Math.round(c.height * sc));
    t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
    return t.toDataURL("image/png");
  } catch {
    return c.toDataURL("image/png");
  }
}

/** Coba tulis PNG ke clipboard sistem (best-effort, boleh gagal di web biasa). */
async function tryWriteSystemClipboard(dataUrl: string): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      clipboard?: { write?: (items: ClipboardItem[]) => Promise<void> };
    };
    if (!nav.clipboard?.write) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await nav.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
  } catch {
    /* clipboard sistem opsional — memori internal sudah cukup */
  }
}

function emitSelectionChanged(): void {
  try {
    window.dispatchEvent(new Event("avero:selection-changed"));
  } catch {
    /* abaikan */
  }
}

/**
 * Salin layer aktif ke clipboard.
 * Hormati seleksi: bila ada seleksi, hanya area terseleksi yang disalin
 * (cropped ke bounding box agar paste tidak membawa kanvas kosong).
 */
export function copyActiveLayer(): boolean {
  try {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return false;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || !meta.visible) return false;
    const c = layerManager.get(id);
    if (!c || c.width < 1 || c.height < 1) return false;
    let out: HTMLCanvasElement = c;
    if (hasSelection()) {
      const sel = selectionMaskCanvas();
      if (sel) {
        const masked = document.createElement("canvas");
        masked.width = c.width;
        masked.height = c.height;
        const g = masked.getContext("2d")!;
        g.drawImage(c, 0, 0);
        g.globalCompositeOperation = "destination-in";
        g.drawImage(sel, 0, 0);
        g.globalCompositeOperation = "source-over";
        // Crop ke bbox agar clipboard ramping.
        try {
          const data = g.getImageData(0, 0, masked.width, masked.height).data;
          let x0 = masked.width;
          let y0 = masked.height;
          let x1 = -1;
          let y1 = -1;
          for (let y = 0; y < masked.height; y += 2) {
            for (let x = 0; x < masked.width; x += 2) {
              if (data[(y * masked.width + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x;
                if (y < y0) y0 = y;
                if (x > x1) x1 = x;
                if (y > y1) y1 = y;
              }
            }
          }
          if (x1 >= x0 && y1 >= y0) {
            const cw = x1 - x0 + 1;
            const ch = y1 - y0 + 1;
            const cropped = document.createElement("canvas");
            cropped.width = cw;
            cropped.height = ch;
            cropped.getContext("2d")!.drawImage(masked, x0, y0, cw, ch, 0, 0, cw, ch);
            // Simpan offset agar Paste-in-Place bisa menaruh tepat kembali.
            (cropped as HTMLCanvasElement & { __ox?: number; __oy?: number }).__ox = x0;
            (cropped as HTMLCanvasElement & { __oy?: number; __oy2?: number }).__oy = y0;
            out = cropped;
          } else {
            out = masked;
          }
        } catch {
          out = masked;
        }
      }
    }
    const url = layerToClipboardURL(out);
    setMemClipboard(url);
    // Simpan offset bbox untuk paste-in-place (Shift tidak mengubah posisi).
    try {
      const ox = (out as HTMLCanvasElement & { __ox?: number }).__ox ?? 0;
      const oy = (out as HTMLCanvasElement & { __oy?: number }).__oy ?? 0;
      (window as unknown as Record<string, unknown>)[`${MEM_CLIP_KEY}:ox`] = ox;
      (window as unknown as Record<string, unknown>)[`${MEM_CLIP_KEY}:oy`] = oy;
    } catch {
      /* abaikan */
    }
    void tryWriteSystemClipboard(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Potong: salin dulu lalu hapus piksel (hormati seleksi).
 * Selalu dorong history agar Ctrl+Z bisa mengembalikan.
 */
export function cutActiveLayer(): boolean {
  try {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return false;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return false;
    if (!copyActiveLayer()) return false;
    const c = layerManager.get(id);
    if (!c) return false;
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Cut", layerId: id, snapshot: snap });
    erasePixelsOf(id, true);
    st.markDirty();
    useProStore.getState().bumpHistogram();
    clearSelectionMask();
    emitSelectionChanged();
    return true;
  } catch {
    return false;
  }
}

/** Hapus isi piksel layer (hormati seleksi + paper background), tanpa clipboard. */
function erasePixelsOf(id: string, _forCut: boolean): void {
  const st = useEditorStore.getState();
  const meta = st.layers.find((l) => l.id === id);
  const c = layerManager.get(id);
  if (!c || !meta) return;
  const ctx = c.getContext("2d")!;
  const paper = meta.kind === "background" ? st.bgColor || "#ffffff" : null;
  if (hasSelection()) {
    const sel = selectionMaskCanvas();
    if (sel) {
      if (paper) {
        const tmp = document.createElement("canvas");
        tmp.width = c.width;
        tmp.height = c.height;
        const tctx = tmp.getContext("2d")!;
        tctx.fillStyle = paper;
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(sel, 0, 0);
        ctx.save();
        ctx.drawImage(tmp, 0, 0);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(sel, 0, 0);
        ctx.restore();
      }
      return;
    }
  }
  if (paper) {
    ctx.save();
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  } else {
    ctx.clearRect(0, 0, c.width, c.height);
  }
}

/** Delete/Backspace: hapus piksel terseleksi (atau seluruh layer) + history. */
export function deleteActivePixels(): boolean {
  try {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return false;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return false;
    const c = layerManager.get(id);
    if (!c) return false;
    const snap = layerManager.snapshot(id);
    erasePixelsOf(id, false);
    if (snap) st.pushHistory({ label: "Delete", layerId: id, snapshot: snap });
    st.markDirty();
    useProStore.getState().bumpHistogram();
    clearSelectionMask();
    emitSelectionChanged();
    return true;
  } catch {
    return false;
  }
}

/**
 * Tempel clipboard sebagai layer baru.
 * Proporsional + di tengah (perbaiki bug lama yang me-stretch ke ukuran dokumen).
 * inPlace=true menaruh kembali di offset asal (Ctrl+Shift+V).
 */
export function pasteClipboardAsLayer(inPlace = false): Promise<boolean> {
  const dataUrl = getMemClipboard();
  if (!dataUrl) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const cur = useEditorStore.getState();
          const l = makeLayer("Paste");
          const nc = layerManager.ensure(l.id, cur.doc.width, cur.doc.height);
          const g = nc.getContext("2d")!;
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          if (inPlace) {
            const ox = Number((window as unknown as Record<string, unknown>)[`${MEM_CLIP_KEY}:ox`] ?? 0) || 0;
            const oy = Number((window as unknown as Record<string, unknown>)[`${MEM_CLIP_KEY}:oy`] ?? 0) || 0;
            g.drawImage(img, ox, oy, iw, ih);
          } else {
            // Muat apa adanya, pusatkan — tanpa stretch.
            const dw = Math.min(iw, cur.doc.width);
            const dh = Math.min(ih, cur.doc.height);
            const sc = Math.min(1, dw / Math.max(1, iw), dh / Math.max(1, ih));
            const w = Math.max(1, Math.round(iw * sc));
            const h = Math.max(1, Math.round(ih * sc));
            const dx = Math.round((cur.doc.width - w) / 2);
            const dy = Math.round((cur.doc.height - h) / 2);
            if (sc < 1) g.drawImage(img, dx, dy, w, h);
            else g.drawImage(img, dx, dy);
          }
          cur.addLayer(l);
          cur.setActiveLayer(l.id);
          cur.markDirty();
          useProStore.getState().bumpHistogram();
          resolve(true);
        } catch {
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    } catch {
      resolve(false);
    }
  });
}

/** Duplikat layer aktif (Ctrl+J) — bawa piksel + opacity/blend/kind. */
export function duplicateActiveLayer(): boolean {
  try {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    const src = st.layers.find((l) => l.id === id);
    if (!id || !src) return false;
    const l = makeLayer(`${src.name} copy`);
    const nl = { ...l, opacity: src.opacity, blendMode: src.blendMode, kind: src.kind };
    const sc = layerManager.get(src.id);
    const dc = layerManager.ensure(nl.id, st.doc.width, st.doc.height);
    if (sc) dc.getContext("2d")!.drawImage(sc, 0, 0);
    st.addLayer(nl);
    st.markDirty();
    return true;
  } catch {
    return false;
  }
}

/** Layer via Cut (Ctrl+Shift+J): potong seleksi ke layer baru, sisa bisa Undo. */
export function layerViaCut(): boolean {
  try {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id || !hasSelection()) return false;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return false;
    const src = layerManager.get(id);
    const sel = selectionMaskCanvas();
    if (!src || !sel) return false;
    const snap = layerManager.snapshot(id);
    // Pindahkan piksel terseleksi ke layer baru.
    const moved = document.createElement("canvas");
    moved.width = src.width;
    moved.height = src.height;
    const mg = moved.getContext("2d")!;
    mg.drawImage(src, 0, 0);
    mg.globalCompositeOperation = "destination-in";
    mg.drawImage(sel, 0, 0);
    mg.globalCompositeOperation = "source-over";
    erasePixelsOf(id, false);
    if (snap) st.pushHistory({ label: "Layer via cut", layerId: id, snapshot: snap });
    const l = makeLayer(`${meta.name} cut`);
    const nc = layerManager.ensure(l.id, st.doc.width, st.doc.height);
    nc.getContext("2d")!.drawImage(moved, 0, 0);
    st.addLayer(l);
    st.setActiveLayer(l.id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
    clearSelectionMask();
    emitSelectionChanged();
    return true;
  } catch {
    return false;
  }
}

/** Geser layer aktif (arrow keys). Riwayat digabung 1,5 detik agar Undo bersih. */
export function nudgeActiveLayer(dx: number, dy: number): boolean {
  try {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return false;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return false;
    if (meta.lockPosition) return false;
    const pro = useProStore.getState();
    pro.ensureTransform(id);
    const t = pro.transforms[id] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    const h = st.history;
    const lastH = h[h.length - 1];
    if (!(lastH && lastH.label === "Nudge" && Date.now() - lastH.time < 1500)) {
      const snap = layerManager.snapshot(id);
      if (snap) st.pushHistory({ label: "Nudge", layerId: id, snapshot: snap });
    }
    pro.updateTransform(id, { x: t.x + dx, y: t.y + dy });
    st.markDirty();
    return true;
  } catch {
    return false;
  }
}
