import { getCompositeCanvas } from "../engine/compositeRef";
import {
  isTauri,
  segmentModelsStatus,
  segmentObjects,
  segmentStuff,
  segmentText,
} from "./nativeEngine";
import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { layerManager } from "../engine/layerManager";
import { notify, showError, showMessage } from "../ui/notify";
import { restoreSelectionMask } from "../engine/selection";
import { useObjectStore } from "../stores/useObjectStore";
import {
  clampBox,
  dedupeSameLabel,
  filterMinArea,
  readingOrder,
  segmentLayerName,
  sortAreaDesc,
  type MergeBox,
} from "../engine/segmentMerge";

// Plan5 Fase 6: quality-aware auto segmentation with progress events.
// Fast = 640px buffer, YOLO + text only, fewer layers (potato-PC friendly).
// Balanced = 960px buffer, all three models. The photo underneath is untouched.

const SEG_MAX_LAYERS = 24;
const SEG_MAX_LAYERS_FAST = 12;

function segProgress(file: string, pct: number): void {
  try {
    window.dispatchEvent(new CustomEvent("avero:segment-progress", { detail: { file, pct } }));
  } catch {
    /* ignore */
  }
}

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
  let models;
  try {
    models = await segmentModelsStatus();
  } catch (e) {
    await showError(`Segment engine unavailable: ${String(e)}`);
    return;
  }
  const missing = [
    !models.yolo.found && `YOLO: ${models.yolo.path}`,
    !models.stuff.found && `stuff: ${models.stuff.path}`,
    !models.text.found && `text: ${models.text.path}`,
  ].filter(Boolean) as string[];
  if (!models.yolo.found && !models.stuff.found && !models.text.found) {
    await showMessage(
      `No segment models found. Place .onnx files at:\n${missing.join("\n")}\n(one-time setup; fully offline after that)`,
      "Auto Segment",
    );
    return;
  }
  // Downscale once for inference (aspect kept, plain resize).
  const quality = useSettingsStore.getState().segmentQuality;
  const fast = quality === "fast";
  const bufferSide = fast ? 640 : 960;
  const maxLayers = fast ? SEG_MAX_LAYERS_FAST : SEG_MAX_LAYERS;
  const yoloConf = fast ? 0.45 : 0.35;
  const runStuff = models.stuff.found && !fast;
  const sc0 = Math.min(1, bufferSide / Math.max(comp.width, comp.height));
  const bw = Math.max(8, Math.round(comp.width * sc0));
  const bh = Math.max(8, Math.round(comp.height * sc0));
  const buf = document.createElement("canvas");
  buf.width = bw;
  buf.height = bh;
  const bctx = buf.getContext("2d", { willReadFrequently: true })!;
  bctx.drawImage(comp, 0, 0, bw, bh);
  const rgba = bctx.getImageData(0, 0, bw, bh).data;

  notify(fast ? "Segmenting objects (fast mode: YOLO + text)..." : "Segmenting objects (YOLO + stuff + text)...");
  segProgress("segment", 5);
  const t0 = performance.now();
  const [yoloR, stuffR, textR] = await Promise.all([
    models.yolo.found
      ? segmentObjects(models.yolo.path, rgba, bw, bh, yoloConf).then(
          (r) => {
            segProgress("segment", 40);
            return { ok: true as const, r };
          },
          (e) => ({ ok: false as const, e: String(e) }),
        )
      : Promise.resolve({ ok: false as const, e: "model missing", missing: true as const }),
    runStuff
      ? segmentStuff(models.stuff.path, rgba, bw, bh).then(
          (r) => {
            segProgress("segment", 60);
            return { ok: true as const, r };
          },
          (e) => ({ ok: false as const, e: String(e) }),
        )
      : Promise.resolve({ ok: false as const, e: "model missing", missing: true as const }),
    models.text.found
      ? segmentText(models.text.path, rgba, bw, bh).then(
          (r) => {
            segProgress("segment", 70);
            return { ok: true as const, r };
          },
          (e) => ({ ok: false as const, e: String(e) }),
        )
      : Promise.resolve({ ok: false as const, e: "model missing", missing: true as const }),
  ]);
  if (!yoloR.ok && !("missing" in yoloR)) {
    segProgress("segment", 100);
    await showError(`YOLO segmentation failed: ${yoloR.e}`);
    return;
  }
  const st = useEditorStore.getState();
  const idLabels = useSettingsStore.getState().segmentLabelsId;
  const fx = st.doc.width / Math.max(1, bw);
  const fy = st.doc.height / Math.max(1, bh);
  const toBox = (x: number, y: number, w: number, h: number) => clampBox({ x: x * fx, y: y * fy, w: w * fx, h: h * fy }, st.doc.width, st.doc.height);

  type Item = MergeBox & { maskUrl: string | null; rectMask?: boolean };
  const items: Item[] = [];
  let nThings = 0;
  let nRegions = 0;
  let nText = 0;
  if (yoloR.ok) {
    for (const d of yoloR.r.detections) {
      const b = toBox(d.x, d.y, d.w, d.h);
      items.push({
        label: capitalize(d.label),
        score: d.score,
        source: "yolo",
        ...b,
        maskUrl: `data:image/png;base64,${d.mask_png_base64}`,
      });
      nThings++;
    }
  }
  if (stuffR.ok) {
    for (const r of stuffR.r.regions) {
      const b = toBox(r.x, r.y, r.w, r.h);
      items.push({
        label: r.label,
        score: Math.min(0.99, 0.5 + r.coverage),
        source: "stuff",
        ...b,
        maskUrl: `data:image/png;base64,${r.mask_png_base64}`,
      });
      nRegions++;
    }
  }
  if (textR.ok) {
    // Name text boxes in reading order before area sorting.
    const ordered = readingOrder(
      textR.r.boxes.map((b) => {
        const bb = toBox(b.x, b.y, b.w, b.h);
        return { x: bb.x, y: bb.y, w: bb.w, h: bb.h, score: b.score };
      }),
      st.doc.height,
    );
    ordered.forEach((b) => {
      items.push({ label: "Text", score: b.score, source: "text", x: b.x, y: b.y, w: b.w, h: b.h, maskUrl: null, rectMask: true });
      nText++;
    });
  } else if (!("missing" in textR)) {
    segProgress("segment", 100);
    await showError(`Text segmentation failed: ${textR.e}`);
    return;
  }
  if (!stuffR.ok && !("missing" in stuffR)) {
    segProgress("segment", 100);
    await showError(`Stuff segmentation failed: ${stuffR.e}`);
    return;
  }
  const merged = sortAreaDesc(
    dedupeSameLabel(filterMinArea(items, st.doc.width * st.doc.height)).slice(0, maxLayers),
  );
  if (merged.length === 0) {
    segProgress("segment", 100);
    const notes = missing.length > 0 ? ` Missing models: ${missing.join(", ")}.` : "";
    notify(`No objects found. Try a photo with clearer subjects.${notes}`);
    return;
  }
  const counters = new Map<string, number>();
  let biggestId: string | null = null;
  let biggestArea = -1;
  let biggestMask: { img: HTMLImageElement | HTMLCanvasElement; dx: number; dy: number; dw: number; dh: number } | null = null;
  const objectStore = useObjectStore.getState();
  const newObjects: { id: string; layerId: string; label: string; confidence: number; thumb: string | null; source: string }[] = [];
  for (const it of merged) {
    const k = (counters.get(it.label) ?? 0) + 1;
    counters.set(it.label, k);
    let mask: HTMLImageElement | HTMLCanvasElement;
    try {
      if (it.rectMask) {
        const c = document.createElement("canvas");
        c.width = it.w;
        c.height = it.h;
        c.getContext("2d")!.fillStyle = "#ffffff";
        c.getContext("2d")!.fillRect(0, 0, it.w, it.h);
        mask = c;
      } else {
        mask = await loadMask(it.maskUrl!);
      }
    } catch {
      continue;
    }
    const name = segmentLayerName(it.label, k, idLabels);
    const l = makeLayer(name);
    const nc = layerManager.ensure(l.id, st.doc.width, st.doc.height);
    const g = nc.getContext("2d")!;
    g.drawImage(comp, it.x, it.y, it.w, it.h, it.x, it.y, it.w, it.h);
    g.save();
    g.globalCompositeOperation = "destination-in";
    g.drawImage(mask, it.x, it.y, it.w, it.h);
    g.restore();
    st.addLayer(l);
    let thumb: string | null = null;
    try {
      const t = document.createElement("canvas");
      const sc = Math.min(1, 120 / Math.max(it.w, it.h));
      t.width = Math.max(1, Math.round(it.w * sc));
      t.height = Math.max(1, Math.round(it.h * sc));
      // JPEG is ~5x smaller than PNG for thumbs and keeps the panel light.
      // Cutouts are opaque after destination-in, so no alpha is lost visually.
      const tctx = t.getContext("2d")!;
      tctx.fillStyle = "#000000";
      tctx.fillRect(0, 0, t.width, t.height);
      tctx.drawImage(nc, it.x, it.y, it.w, it.h, 0, 0, t.width, t.height);
      thumb = t.toDataURL("image/jpeg", 0.72);
    } catch {
      /* ignore */
    }
    newObjects.push({ id: `obj-${l.id}`, layerId: l.id, label: it.label, confidence: it.score, thumb, source: it.source });
    if (it.w * it.h > biggestArea) {
      biggestArea = it.w * it.h;
      biggestId = l.id;
      biggestMask = { img: mask, dx: it.x, dy: it.y, dw: it.w, dh: it.h };
    }
  }
  if (newObjects.length > 0) {
    objectStore.setObjects([...objectStore.objects, ...newObjects]);
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
  segProgress("segment", 100);
  const totalMs = Math.round(performance.now() - t0);
  const missingNote = missing.length > 0 ? ` Models missing: ${missing.join(", ")}.` : "";
  notify(
    `Segmented ${merged.length} objects (${nThings} things, ${nRegions} regions, ${nText} text) in ${totalMs} ms.${missingNote}`,
  );
}
