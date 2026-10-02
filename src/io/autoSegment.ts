import { getCompositeCanvas } from "../engine/compositeRef";
import { isTauri, segmentModelPath, segmentObjects } from "./nativeEngine";
import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { notify, showError, showMessage } from "../ui/notify";
import { restoreSelectionMask } from "../engine/selection";

// Plan5 Fase 1 vertical slice: "Auto Segment Objects" palette command.
// Runs YOLO11n-seg (Rust) on the current composite and turns every detected
// object into a real editable raster layer. The photo underneath is untouched.
// Full auto-run on import + model manager arrive in Fase 5/6.

const SEG_BUFFER_SIDE = 960;
const SEG_MAX_LAYERS = 24;

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function loadMask(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("mask decode failed"));
    img.src = dataUrl;
  });
}

export async function runAutoSegment(): Promise<void> {
  if (!isTauri()) {
    await showMessage("Auto Segment needs the desktop app (YOLO runs in Rust).");
    return;
  }
  const comp = getCompositeCanvas();
  if (!comp || comp.width < 8 || comp.height < 8) {
    await showMessage("Nothing to segment. Open an image first.");
    return;
  }
  let status;
  try {
    status = await segmentModelPath();
  } catch (e) {
    await showError(`Segment engine unavailable: ${String(e)}`);
    return;
  }
  if (!status.found) {
    await showMessage(
      `YOLO model not found.\nPlace yolo11n-seg.onnx at:\n${status.path}\n(one-time setup; fully offline after that)`,
      "Auto Segment",
    );
    return;
  }
  // Downscale once for inference (aspect kept, plain resize).
  const sc0 = Math.min(1, SEG_BUFFER_SIDE / Math.max(comp.width, comp.height));
  const bw = Math.max(8, Math.round(comp.width * sc0));
  const bh = Math.max(8, Math.round(comp.height * sc0));
  const buf = document.createElement("canvas");
  buf.width = bw;
  buf.height = bh;
  const bctx = buf.getContext("2d", { willReadFrequently: true })!;
  bctx.drawImage(comp, 0, 0, bw, bh);
  const rgba = bctx.getImageData(0, 0, bw, bh).data;

  notify("Segmenting objects with YOLO11...");
  let res;
  try {
    res = await segmentObjects(status.path, rgba, bw, bh, 0.35);
  } catch (e) {
    await showError(`Segmentation failed: ${String(e)}`);
    return;
  }
  const dets = res.detections.slice(0, SEG_MAX_LAYERS);
  if (dets.length === 0) {
    notify("No objects found. Try a photo with clearer subjects.");
    return;
  }
  const st = useEditorStore.getState();
  const fx = st.doc.width / Math.max(1, res.input_width);
  const fy = st.doc.height / Math.max(1, res.input_height);
  let biggestId: string | null = null;
  let biggestArea = -1;
  let biggestMask: { img: HTMLImageElement; dx: number; dy: number; dw: number; dh: number } | null = null;
  for (let i = 0; i < dets.length; i++) {
    const d = dets[i];
    const dx = Math.max(0, Math.min(st.doc.width - 1, Math.round(d.x * fx)));
    const dy = Math.max(0, Math.min(st.doc.height - 1, Math.round(d.y * fy)));
    const dw = Math.max(2, Math.min(st.doc.width - dx, Math.round(d.w * fx)));
    const dh = Math.max(2, Math.min(st.doc.height - dy, Math.round(d.h * fy)));
    let mask: HTMLImageElement;
    try {
      mask = await loadMask(`data:image/png;base64,${d.mask_png_base64}`);
    } catch {
      continue;
    }
    const name = `${capitalize(d.label)} ${i + 1}`;
    const l = makeLayer(name);
    const nc = layerManager.ensure(l.id, st.doc.width, st.doc.height);
    const g = nc.getContext("2d")!;
    g.drawImage(comp, dx, dy, dw, dh, dx, dy, dw, dh);
    g.save();
    g.globalCompositeOperation = "destination-in";
    g.drawImage(mask, dx, dy, dw, dh);
    g.restore();
    st.addLayer(l);
    if (dw * dh > biggestArea) {
      biggestArea = dw * dh;
      biggestId = l.id;
      biggestMask = { img: mask, dx, dy, dw, dh };
    }
  }
  if (biggestId) st.setActiveLayer(biggestId);
  // Select the biggest object right away (marching ants, no extra click).
  if (biggestMask) {
    try {
      const full = document.createElement("canvas");
      full.width = st.doc.width;
      full.height = st.doc.height;
      full.getContext("2d")!.drawImage(biggestMask.img, biggestMask.dx, biggestMask.dy, biggestMask.dw, biggestMask.dh);
      restoreSelectionMask(st.doc.width, st.doc.height, full);
      window.dispatchEvent(new Event("avero:selection-changed"));
    } catch {
      /* selection is a bonus; layers are the deliverable */
    }
  }
  st.markDirty();
  useProStore.getState().bumpHistogram();
  notify(`Segmented ${dets.length} objects into layers in ${res.millis} ms.`);
}
