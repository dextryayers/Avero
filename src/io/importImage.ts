import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { pickImagesToOpen, pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "./tauriIo";
import { showError, showMessage } from "../ui/notify";
import { triggerAutoSegment } from "./autoSegmentTrigger";

let busy = false;

export function isImportBusy(): boolean {
  return busy;
}

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image is damaged or unreadable"));
    img.src = src;
  });
}

function pickWebImageFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.multiple = true;
    inp.accept = "image/png,image/jpeg,image/webp,image/bmp,image/gif,image/tiff,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff";
    inp.onchange = () => resolve(Array.from(inp.files ?? []));
    inp.oncancel = () => resolve([]);
    inp.click();
  });
}

function readFileAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(f);
  });
}

function baseNameOf(p: string): string {
  const t = p.split(/[/\\]/).pop() ?? "Image";
  return t.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Image";
}

// Images are drawn proportionally at the document center.
// - Never stretched: the original aspect is always kept.
// - Never upscaled: small images stay sharp at their native size.
// - Large images are downscaled to fit fully inside the document.
function drawContainCentered(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | ImageBitmap,
  natW: number,
  natH: number,
  docW: number,
  docH: number,
): { dw: number; dh: number; dx: number; dy: number } {
  const iw = Math.max(1, natW);
  const ih = Math.max(1, natH);
  const scale = Math.min(1, docW / iw, docH / ih);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));
  const dx = Math.round((docW - dw) / 2);
  const dy = Math.round((docH - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, docW, docH);
  ctx.drawImage(img as unknown as CanvasImageSource, dx, dy, dw, dh);
  return { dw, dh, dx, dy };
}

// After import, a layer is immediately flexible: active, transform ready,
// and the Move tool selected so the photo can be dragged and clicked. Free
// 360 rotation and scaling are available through the blue canvas handles and
// the Transform panel.
function activateFlexible(layerId: string, label: string, silent = false): void {
  try {
    const st = useEditorStore.getState();
    st.setActiveLayer(layerId);
    useProStore.getState().ensureTransform(layerId);
    st.setTool("move");
    st.markDirty();
    useProStore.getState().bumpHistogram();
  } catch {
    /* ignore */
  }
  if (!silent) {
    void showMessage(`Imported ${label}. Click an image to select it, drag to move it, drag a blue corner to resize, and use the black button to rotate.`);
  }
}

function cascadeOffset(index: number): { x: number; y: number } {
  // The 2nd, 3rd, and later images are shifted slightly so they do not stack exactly.
  const step = 28;
  return { x: index * step, y: index * step };
}

// Import external images as new layers in the active document, single or many.
// Used by the Import button above the canvas and the Layers panel button.
// Proportional output with no stretch, immediately flexible for composing.
export async function importImageAsLayer(): Promise<boolean> {
  if (busy) return false;
  const ed = useEditorStore.getState();
  const docW = Math.round(ed.doc.width);
  const docH = Math.round(ed.doc.height);
  const hasDoc = ed.layers.length > 0 && docW > 0 && docH > 0;
  if (!hasDoc) {
    await showError("Create or open a project first, then import images as layers.");
    return false;
  }
  busy = true;
  try {
    if (isTauri()) {
      // Try multi select first, fall back to single when the dialog is old.
      let paths: string[] | null = null;
      try {
        paths = await pickImagesToOpen();
      } catch {
        paths = null;
      }
      if (!paths || paths.length === 0) {
        const single = await pickImageToOpen().catch(() => null);
        if (!single) return false;
        paths = [single];
      }
      let ok = 0;
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        try {
          const label = baseNameOf(path);
          const info = await rustImageInfo(path).catch(() => null);
          const dataUrl = await rustDecodeToDataUrl(path, 4096);
          const img = await loadHtmlImage(dataUrl);
          let natW = info?.width && info.width > 0 ? info.width : img.naturalWidth || img.width;
          let natH = info?.height && info.height > 0 ? info.height : img.naturalHeight || img.height;
          if (!natW || !natH) {
            natW = img.naturalWidth || img.width;
            natH = img.naturalHeight || img.height;
          }
          const st = useEditorStore.getState();
          const layer = makeLayer(label);
          const c = layerManager.ensure(layer.id, st.doc.width, st.doc.height);
          const g = c.getContext("2d")!;
          drawContainCentered(g, img, natW, natH, st.doc.width, st.doc.height);
          layerManager.markPhoto(layer.id);
          st.addLayer(layer);
          const off = cascadeOffset(i);
          useProStore.getState().ensureTransform(layer.id);
          useProStore.getState().updateTransform(layer.id, { x: off.x, y: off.y, scaleX: 1, scaleY: 1, rotation: 0 });
          activateFlexible(layer.id, label, true);
          ok++;
        } catch {
          /* continue with the next file */
        }
      }
      if (ok > 0) {
        void showMessage(
          ok === 1
            ? "Imported 1 image. Click an image to select it, drag a blue corner to resize, and use the black button to rotate."
            : `Imported ${ok} images as layers. Click each image to select it.`,
        );
        void triggerAutoSegment();
        return true;
      }
      return false;
    }

    const files = await pickWebImageFiles();
    if (!files || files.length === 0) return false;
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const label = baseNameOf(f.name);
        const dataUrl = await readFileAsDataUrl(f);
        const img = await loadHtmlImage(dataUrl);
        const natW = img.naturalWidth || img.width;
        const natH = img.naturalHeight || img.height;
        if (!natW || !natH) continue;
        const st = useEditorStore.getState();
        const layer = makeLayer(label);
        const c = layerManager.ensure(layer.id, st.doc.width, st.doc.height);
        const g = c.getContext("2d")!;
        drawContainCentered(g, img, natW, natH, st.doc.width, st.doc.height);
        layerManager.markPhoto(layer.id);
        st.addLayer(layer);
        const off = cascadeOffset(i);
        useProStore.getState().ensureTransform(layer.id);
        useProStore.getState().updateTransform(layer.id, { x: off.x, y: off.y, scaleX: 1, scaleY: 1, rotation: 0 });
        activateFlexible(layer.id, label, true);
        ok++;
      } catch {
        /* continue */
      }
    }
    if (ok > 0) {
      void showMessage(
        ok === 1
          ? "Imported 1 image. Click an image to select it, drag a blue corner to resize, and use the black button to rotate."
          : `Imported ${ok} images as layers. Click each image to select it.`,
      );
      void triggerAutoSegment();
      return true;
    }
    return false;
  } catch (e) {
    await showError(`Import failed: ${String(e)}`);
    return false;
  } finally {
    busy = false;
  }
}

// Drag and drop from Explorer: an empty document opens from the dropped file.
// When the document already has artwork, drops become layers so no work is lost.
export async function dropImageFile(f: File): Promise<boolean> {
  try {
    if (!f || !f.type.startsWith("image/")) return false;
    const st = useEditorStore.getState();
    const isFresh = st.layers.length === 0 || (!st.doc.filePath && st.history.length === 0);
    if (isFresh) {
      const bmp = await createImageBitmap(f);
      try {
        st.openDocument(f.name, bmp.width, bmp.height, null, f.size);
      } catch {
        return false;
      }
      let thumb: string | null = null;
      try {
        const t = document.createElement("canvas");
        const sc = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
        t.width = Math.max(1, Math.round(bmp.width * sc));
        t.height = Math.max(1, Math.round(bmp.height * sc));
        t.getContext("2d")!.drawImage(bmp, 0, 0, t.width, t.height);
        thumb = t.toDataURL("image/jpeg", 0.72);
      } catch {
        thumb = null;
      }
      useHomeStore.getState().pushRecent({
        name: f.name,
        path: null,
        thumb,
        full: null,
        w: bmp.width,
        h: bmp.height,
        size: f.size,
      });
      useHomeStore.getState().setHome(false);
      setTimeout(() => {
        const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
        if (!id) return;
        const c = layerManager.ensure(id, bmp.width, bmp.height);
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(bmp, 0, 0);
        layerManager.markPhoto(id);
        try {
          bmp.close();
        } catch {
          /* ignore */
        }
        useEditorStore.getState().markDirty();
        useProStore.getState().bumpHistogram();
        window.dispatchEvent(new Event("avero:fit-zoom"));
        void triggerAutoSegment();
      }, 60);
      return true;
    }
    // Document exists: add as a proportional centered layer.
    // Multi drop: shift slightly by layer count so drops do not stack exactly.
    const dataUrl = await readFileAsDataUrl(f);
    const img = await loadHtmlImage(dataUrl);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return false;
    const cur = useEditorStore.getState();
    const layer = makeLayer(baseNameOf(f.name));
    const c = layerManager.ensure(layer.id, cur.doc.width, cur.doc.height);
    const g = c.getContext("2d")!;
    drawContainCentered(g, img, natW, natH, cur.doc.width, cur.doc.height);
    layerManager.markPhoto(layer.id);
    cur.addLayer(layer);
    try {
      const n = useEditorStore.getState().layers.length;
      const off = (n % 8) * 20;
      useProStore.getState().ensureTransform(layer.id);
      useProStore.getState().updateTransform(layer.id, { x: off, y: off, scaleX: 1, scaleY: 1, rotation: 0 });
    } catch {
      /* bonus offset */
    }
    activateFlexible(layer.id, baseNameOf(f.name), true);
    void triggerAutoSegment();
    return true;
  } catch {
    return false;
  }
}

// Drop many files at once, 2, 3, or more: the first file opens the document
// when it is still empty, the rest become layers. Used by CanvasArea onDrop.
export async function dropImageFiles(files: File[]): Promise<number> {
  const imgs = (files ?? []).filter((f) => f && f.type.startsWith("image/"));
  if (imgs.length === 0) return 0;
  let ok = 0;
  for (const f of imgs) {
    try {
      const r = await dropImageFile(f);
      if (r) ok++;
    } catch {
      /* continue */
    }
  }
  if (ok > 1) {
    void showMessage(`Imported ${ok} images. Click each image to select it.`);
  }
  return ok;
}
