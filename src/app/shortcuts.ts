// Global editor shortcuts: tool letters (Shift cycles family), menu actions, quick navigation.
//
// Shortcut layers (priority order in App.tsx):
//   1. Global app — Ctrl+K/S/E/O/, — works even while typing in inputs.
//   2. General edit — Ctrl+Z/Y/X/C/V/A/D/T/J/G + Del/Backspace/F5 — only when NOT typing,
//      so native input behavior (text undo/cut/paste) is never hijacked.
//   3. View — Ctrl++/−/0/1, Ctrl+R, Ctrl+;, ' — only when not typing.
//   4. Tools — single letters, Shift+letter, [ ], digits 0-9, X/D, Space, arrows.
// All edit helpers live here so App.tsx stays thin and testable.
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
// Focus guard: never hijack text inputs.
// ---------------------------------------------------------------------------

/** True when the element is a text field that must receive native browser shortcuts. */
export function isEditableTarget(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  try {
    if (typeof (el as HTMLElement).closest === "function" && (el as HTMLElement).closest("[contenteditable='true'], [contenteditable='']")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** True when focus is inside an input/text field — canvas edit shortcuts must stay quiet. */
export function isEditingNow(): boolean {
  try {
    return isEditableTarget(document.activeElement);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Menu-action lookup with aliases (one action may own several combos).
// ---------------------------------------------------------------------------

/** Extra combos not printed in MENUS but required to work. */
const COMBO_ALIASES: Record<string, string> = {
  // Redo: Photoshop + common — Ctrl+Y OR Ctrl+Shift+Z.
  "Ctrl+Shift+Z": "redo",
  "Ctrl+Y": "redo",
  // Photoshop-style step backward — treated as undo.
  "Ctrl+Alt+Z": "undo",
  // Merge visible / merge down without conflicting with Export (Ctrl+E).
  "Ctrl+Shift+E": "merge-all",
  // Open .avx projects without stealing Ctrl+O from Open Image.
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

/** General edit shortcuts for the footer / palette / docs. Single source of truth. */
export const EDIT_SHORTCUTS: { combo: string; label: string; desc: string }[] = [
  { combo: "Ctrl+Z", label: "Undo", desc: "Undo the last step (pixels + mask are restored)" },
  { combo: "Ctrl+Shift+Z", label: "Redo", desc: "Redo again — Ctrl+Y alternative" },
  { combo: "Ctrl+Y", label: "Redo", desc: "Redo again — Ctrl+Shift+Z alternative" },
  { combo: "Ctrl+Alt+Z", label: "Step Backward", desc: "Step one stroke back, Photoshop-style" },
  { combo: "Ctrl+X", label: "Cut", desc: "Cut selection/layer to clipboard + undo history" },
  { combo: "Ctrl+C", label: "Copy", desc: "Copy selection/layer (respects the active selection)" },
  { combo: "Ctrl+V", label: "Paste", desc: "Paste as a new layer, scaled proportionally, centered" },
  { combo: "Ctrl+Shift+V", label: "Paste in Place", desc: "Paste back at the exact source position" },
  { combo: "Ctrl+A", label: "Select All", desc: "Select the whole canvas" },
  { combo: "Ctrl+D", label: "Deselect", desc: "Clear the selection" },
  { combo: "Ctrl+Shift+D", label: "Reselect", desc: "Restore the last selection" },
  { combo: "Ctrl+Shift+I", label: "Inverse", desc: "Invert the selection" },
  { combo: "Delete", label: "Delete", desc: "Delete selected pixels (history is kept)" },
  { combo: "Ctrl+J", label: "Duplicate", desc: "Duplicate the active layer" },
  { combo: "Ctrl+Shift+J", label: "Layer via Cut", desc: "Cut the selection to a new layer" },
  { combo: "Ctrl+T", label: "Free Transform", desc: "Free-transform mode" },
  { combo: "Ctrl+G", label: "Group", desc: "Group layers (via palette)" },
  { combo: "Ctrl+]", label: "Layer Up", desc: "Raise the layer order" },
  { combo: "Ctrl+[", label: "Layer Down", desc: "Lower the layer order" },
  { combo: "Shift+F5", label: "Content Fill", desc: "Content-aware fill" },
  { combo: "Alt+Backspace", label: "Fill FG", desc: "Fill with the foreground color" },
  { combo: "Ctrl+Backspace", label: "Fill BG", desc: "Fill with the background color" },
  { combo: "Ctrl+S", label: "Save", desc: "Save the .avx project" },
  { combo: "Ctrl+Shift+S", label: "Save As", desc: "Save the project under a new name" },
  { combo: "Ctrl+O", label: "Open", desc: "Open an image" },
  { combo: "Ctrl+E", label: "Export", desc: "Open the export dialog" },
  { combo: "Ctrl+K", label: "All Actions", desc: "Open the command palette" },
  { combo: "Ctrl+,", label: "Settings", desc: "Open/close settings" },
  { combo: "Ctrl++ / Ctrl+-", label: "Zoom", desc: "Zoom in / out" },
  { combo: "Ctrl+0 / Ctrl+1", label: "Fit / 100%", desc: "Fit to screen / actual pixels" },
  { combo: "[ / ]", label: "Brush Size", desc: "Decrease / increase brush size" },
  { combo: "Shift+[ / Shift+]", label: "Hardness", desc: "Soften / harden the brush edge" },
  { combo: "1..0", label: "Opacity", desc: "Set brush opacity 10–100%" },
  { combo: "X / D", label: "Colors", desc: "Swap / reset foreground-background colors" },
  { combo: "Space", label: "Hand", desc: "Hold to pan the canvas temporarily" },
  { combo: "Arrows", label: "Nudge", desc: "Move the layer 1px (Shift = 10px)" },
  { combo: "Esc / Enter", label: "Cancel / Apply", desc: "Cancel crop & close dialogs / apply crop" },
];

/** True when the event is an Undo (Ctrl/Cmd+Z without Shift, or Ctrl+Alt+Z step-backward). */
export function matchUndo(e: KeyboardEvent): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey && !e.altKey) return true;
  if (k === "z" && !e.shiftKey && e.altKey) return true; // Ctrl+Alt+Z
  return false;
}

/** True when the event is a Redo (Ctrl+Y or Ctrl+Shift+Z). */
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

/** Photoshop-style digit keys 1..0: 1=10%, 5=50%, 0=100%. Shift+digit = Flow. */
export function setBrushOpacityDigit(digit: string, toFlow = false): boolean {
  const n = digit === "0" ? 100 : Math.max(1, Math.min(9, Number(digit))) * 10;
  if (!Number.isFinite(n)) return false;
  if (toFlow) useEditorStore.getState().setBrush({ flow: n });
  else useEditorStore.getState().setBrush({ opacity: n });
  return true;
}

/** X: swap foreground/background colors. D: reset to Photoshop-style black/white. */
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
  // Never hijack Space while typing text.
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
// Clipboard + general edit ops (single source of truth, used by App.tsx and
// the avero:clip event). Every destructive op pushes history for Undo.
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
    /* ignore */
  }
}

/** Downscale layers to max 2048px so PNG dataURLs stay manageable at 4K. */
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

/** Try writing the PNG to the system clipboard (best-effort, may fail on plain web). */
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
    /* System clipboard is optional — the in-memory fallback is enough */
  }
}

function emitSelectionChanged(): void {
  try {
    window.dispatchEvent(new Event("avero:selection-changed"));
  } catch {
    /* ignore */
  }
}

/**
 * Copy the active layer to the clipboard.
 * Respects the selection: when one exists, only the selected area is copied
 * (cropped to its bounding box so paste carries no empty canvas).
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
        // Crop to the bbox to keep the clipboard lean.
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
            // Keep the offset so Paste-in-Place can drop it exactly back.
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
    // Keep the bbox offset for paste-in-place (Shift never moves it).
    try {
      const ox = (out as HTMLCanvasElement & { __ox?: number }).__ox ?? 0;
      const oy = (out as HTMLCanvasElement & { __oy?: number }).__oy ?? 0;
      (window as unknown as Record<string, unknown>)[`${MEM_CLIP_KEY}:ox`] = ox;
      (window as unknown as Record<string, unknown>)[`${MEM_CLIP_KEY}:oy`] = oy;
    } catch {
      /* ignore */
    }
    void tryWriteSystemClipboard(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cut: copy first, then erase pixels (respects the selection).
 * Always pushes history so Ctrl+Z can restore it.
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

/** Erase layer pixel content (respects selection + paper background), no clipboard. */
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

/** Delete/Backspace: erase selected pixels (or the whole layer) + history. */
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
 * Paste the clipboard as a new layer.
 * Proportional + centered (fixes the old bug that stretched to document size).
 * inPlace=true drops it back at the source offset (Ctrl+Shift+V).
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
            // Draw as-is, centered — no stretching.
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

/** Duplicate the active layer (Ctrl+J) — carries pixels + opacity/blend/kind. */
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

/** Layer via Cut (Ctrl+Shift+J): cut the selection to a new layer, rest is Undoable. */
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
    // Move the selected pixels to the new layer.
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

/** Nudge the active layer (arrow keys). History coalesces for 1.5s for clean Undo. */
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
