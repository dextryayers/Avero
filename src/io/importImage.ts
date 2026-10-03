import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "./tauriIo";
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
    img.onerror = () => reject(new Error("Gambar rusak atau tidak terbaca"));
    img.src = src;
  });
}

function pickWebImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg,image/webp,image/bmp,image/gif,image/tiff,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff";
    inp.onchange = () => resolve(inp.files?.[0] ?? null);
    inp.oncancel = () => resolve(null);
    inp.click();
  });
}

function readFileAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Gagal membaca file"));
    r.readAsDataURL(f);
  });
}

function baseNameOf(p: string): string {
  const t = p.split(/[/\\]/).pop() ?? "Image";
  return t.replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "Image";
}

// Gambar digambar proporsional di tengah kanvas dokumen.
// - Tidak pernah di-stretch: aspect asli selalu dijaga.
// - Tidak pernah di-upscale: gambar kecil tetap tajam di ukuran aslinya.
// - Gambar besar di-downscale pas agar muat penuh di dokumen.
// Hasil: sesuai gambar yang diimport, normal untuk membuat karya.
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

// Import gambar eksternal sebagai layer baru di dokumen aktif.
// Dipakai dari tombol Import di atas canvas dan tombol di panel Layers.
// Normal, tanpa stretch bug, siap untuk membuat karya.
export async function importImageAsLayer(): Promise<boolean> {
  if (busy) return false;
  const ed = useEditorStore.getState();
  const docW = Math.round(ed.doc.width);
  const docH = Math.round(ed.doc.height);
  const hasDoc = ed.layers.length > 0 && docW > 0 && docH > 0;
  if (!hasDoc) {
    await showError("Buat atau buka project dulu, lalu Import gambar sebagai layer.");
    return false;
  }
  busy = true;
  try {
    let dataUrl = "";
    let label = "Image";
    let natW = 0;
    let natH = 0;

    if (isTauri()) {
      const path = await pickImageToOpen();
      if (!path) return false;
      label = baseNameOf(path);
      // maxSide besar agar gambar impor tetap detail, bukan thumbnail.
      const info = await rustImageInfo(path).catch(() => null);
      dataUrl = await rustDecodeToDataUrl(path, 4096);
      const img = await loadHtmlImage(dataUrl);
      natW = info?.width && info.width > 0 ? info.width : img.naturalWidth || img.width;
      natH = info?.height && info.height > 0 ? info.height : img.naturalHeight || img.height;
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
      st.setActiveLayer(layer.id);
      st.markDirty();
      useProStore.getState().ensureTransform(layer.id);
      useProStore.getState().bumpHistogram();
      await showMessage(`Imported ${label} sebagai layer baru.`);
      void triggerAutoSegment();
      return true;
    }

    const f = await pickWebImageFile();
    if (!f) return false;
    label = baseNameOf(f.name);
    dataUrl = await readFileAsDataUrl(f);
    const img = await loadHtmlImage(dataUrl);
    natW = img.naturalWidth || img.width;
    natH = img.naturalHeight || img.height;
    if (!natW || !natH) throw new Error("Gambar rusak atau tidak terbaca");
    const st = useEditorStore.getState();
    const layer = makeLayer(label);
    const c = layerManager.ensure(layer.id, st.doc.width, st.doc.height);
    const g = c.getContext("2d")!;
    drawContainCentered(g, img, natW, natH, st.doc.width, st.doc.height);
    layerManager.markPhoto(layer.id);
    st.addLayer(layer);
    st.setActiveLayer(layer.id);
    st.markDirty();
    useProStore.getState().ensureTransform(layer.id);
    useProStore.getState().bumpHistogram();
    await showMessage(`Imported ${label} sebagai layer baru.`);
    void triggerAutoSegment();
    return true;
  } catch (e) {
    await showError(`Import gagal: ${String(e)}`);
    return false;
  } finally {
    busy = false;
  }
}

// Drag-drop dari Explorer: bila dokumen masih kosong, buka sebagai dokumen.
// Bila dokumen sudah berisi karya, tambah sebagai layer agar karya tidak hilang.
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
    // Dokumen sudah ada: tambah sebagai layer proporsional di tengah.
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
    cur.setActiveLayer(layer.id);
    cur.markDirty();
    useProStore.getState().ensureTransform(layer.id);
    useProStore.getState().bumpHistogram();
    await showMessage(`Imported ${baseNameOf(f.name)} sebagai layer baru.`);
    void triggerAutoSegment();
    return true;
  } catch {
    return false;
  }
}
