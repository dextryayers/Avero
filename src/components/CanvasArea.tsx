import { useEffect, useRef, useState } from "react";
import { useEditorStore, makeLayer, type ToolId } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { fitZoom } from "../engine/canvasMath";
import {
  clearSelectionMask,
  drawEllipseSelection,
  drawLassoSelection,
  drawRectSelection,
  featherSelection,
  hasSelection,
  isPointInSelection,
  selectionMaskCanvas,
  wandFromImage,
} from "../engine/selection";
import { applyAdjustmentToImageData, applyRawDevelop } from "../engine/adjustments";
import { applyFilterToCanvas } from "../engine/filters";
import { applySoftProof, convertWorkingSpace } from "../engine/color";
import { renderShapeToLayer, renderTextToLayer } from "../engine/textShape";
import ToolOptionsBar from "./ToolOptionsBar";
import { TOOL_LABEL } from "./ToolBar";
import { askText } from "../ui/notify";

export function getCompositeCanvas(): HTMLCanvasElement | null {
  return (window as any).__avero_comp ?? null;
}

// Pooled doc-size composite canvas: reuses one canvas across renders
// instead of allocating a full doc-size canvas per frame (8MB+ for HD).
let pooledComp: HTMLCanvasElement | null = null;
function getPooledComp(w: number, h: number): HTMLCanvasElement {
  if (!pooledComp) {
    pooledComp = document.createElement("canvas");
    pooledComp.width = w;
    pooledComp.height = h;
    return pooledComp;
  }
  if (pooledComp.width !== w || pooledComp.height !== h) {
    pooledComp.width = w;
    pooledComp.height = h;
  }
  return pooledComp;
}

export default function CanvasArea() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState("0, 0");
  const [isPainting, setIsPainting] = useState(false);
  const [selDrag, setSelDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const [cropDrag, setCropDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const [gradDrag, setGradDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );
  const guideDrag = useRef<{ kind: "h" | "v"; index: number } | null>(null);
  const hRulerRef = useRef<HTMLCanvasElement>(null);
  const vRulerRef = useRef<HTMLCanvasElement>(null);
  const [rulerDrag, setRulerDrag] = useState<{ kind: "h" | "v"; pos: number } | null>(null);
  const [countN, setCountN] = useState(0);
  const [measureDrag, setMeasureDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [lassoPts, setLassoPts] = useState<{ x: number; y: number }[]>([]);
  const [ants, setAnts] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const moveDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const spriteCache = useRef(new Map<string, HTMLCanvasElement>());
  const cloneRef = useRef<{ x: number; y: number } | null>(null);
  const cloneOrigin = useRef<{ x: number; y: number } | null>(null);
  const healRef = useRef<{ x: number; y: number } | null>(null);
  const historySource = useRef<ImageData | null>(null);
  const [penDrag, setPenDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [shapeDrag, setShapeDrag] = useState<{ x0: number; y0: number; x1: number; y1: number; kind: string } | null>(null);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const smudgeColor = useRef<string | null>(null);

  const doc = useEditorStore((s) => s.doc);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId ?? s.layers[s.layers.length - 1]?.id);
  const tool = useEditorStore((s) => s.tool);
  // Each tool has a distinct engine behavior (no duplicates).
  // Brush family: soft paint variants with different flow / hardness.
  // NOTE: healing-brush/patch are heal tools (Alt sets heal source), NOT clone.
  const isBrush = tool === "brush" || tool === "pencil" || tool === "mixer-brush" || tool === "history-brush" || tool === "art-history-brush" || tool === "color-replacement" || tool === "airbrush" || tool === "soft-brush";
  const isEraser = tool === "eraser" || tool === "background-eraser" || tool === "magic-eraser" || tool === "eraser-hard";
  const isHeal = tool === "spot-heal" || tool === "healing-brush" || tool === "patch" || tool === "red-eye" || tool === "content-move" || tool === "content-fill";
  const needsHealSource = tool === "healing-brush" || tool === "patch";
  const isClone = tool === "clone" || tool === "pattern-stamp";
  const isEyedropper = tool === "eyedropper" || tool === "color-sampler";
  const isCrop = tool === "crop" || tool === "perspective-crop";
  const showBrushRing =
    isBrush || isEraser || tool === "dodge" || tool === "burn" || tool === "sponge" || tool === "vibrance-brush" ||
    tool === "blur" || tool === "blur-iris" || tool === "sharpen" || tool === "sharpen-edge" || tool === "smudge" ||
    tool === "noise-reduction" || isHeal || isClone || tool === "liquify" || tool === "warp";
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const brushHardness = useEditorStore((s) => s.brushHardness);
  const brushColor = useEditorStore((s) => s.brushColor);
  const showRulers = useEditorStore((s) => s.showRulers);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const markDirty = useEditorStore((s) => s.markDirty);

  const adjustments = useProStore((s) => s.adjustments);
  const filters = useProStore((s) => s.filters);
  const masks = useProStore((s) => s.masks);
  const paintMask = useProStore((s) => s.paintMask);
  const transforms = useProStore((s) => s.transforms);
  const color = useProStore((s) => s.color);
  const raw = useProStore((s) => s.raw);
  const bumpHistogram = useProStore((s) => s.bumpHistogram);
  const historyLen = useEditorStore((s) => s.history.length);
  const isFresh = !doc.filePath && historyLen === 0;
  const gradTo = useProStore((s) => s.gradTo);
  const guidesH = useProStore((s) => s.guidesH);
  const guidesV = useProStore((s) => s.guidesV);
  const showGuides = useProStore((s) => s.showGuides);
  const showGrid = useProStore((s) => s.showGrid);
  const gridSize = useProStore((s) => s.gridSize);

  useEffect(() => {
    layers.forEach((l) => layerManager.ensure(l.id, doc.width, doc.height));
  }, [layers, doc.width, doc.height]);

  useEffect(() => {
    function onOpened(e: Event) {
      const detail = (e as CustomEvent).detail as { dataUrl: string; w: number; h: number };
      const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
      if (!id) return;
      const img = new Image();
      img.onload = () => {
        layerManager.ensure(id, detail.w, detail.h);
        layerManager.drawImageToLayer(id, img, detail.w, detail.h);
        useEditorStore.getState().markDirty();
        useProStore.getState().bumpHistogram();
      };
      img.src = detail.dataUrl;
    }
    window.addEventListener("avero:opened-image", onOpened);
    return () => window.removeEventListener("avero:opened-image", onOpened);
  }, []);

  useEffect(() => {
    clearSelectionMask();
  }, [doc.width, doc.height]);

  function fitToView() {
    const el = wrapRef.current;
    if (!el) return;
    const st = useEditorStore.getState();
    const r = el.getBoundingClientRect();
    const z = fitZoom(st.doc.width, st.doc.height, r.width - 80, r.height - 80);
    st.setZoom(Math.max(10, Math.min(100, z)));
    st.setPan(0, 0);
  }

  useEffect(() => {
    fitToView();
    // composite render deps intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height]);

  // Fit button in the status bar triggers this event
  useEffect(() => {
    window.addEventListener("avero:fit-zoom", fitToView);
    return () => window.removeEventListener("avero:fit-zoom", fitToView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag and drop image files from Explorer straight into a layer
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const bmp = await createImageBitmap(f);
      const st = useEditorStore.getState();
      st.openDocument(f.name, bmp.width, bmp.height, null, f.size);
      // recent thumb from bitmap (small), full only when file is under 2MB
      let thumb: string | null = null;
      let full: string | null = null;
      try {
        const t = document.createElement("canvas");
        const sc = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
        t.width = Math.max(1, Math.round(bmp.width * sc));
        t.height = Math.max(1, Math.round(bmp.height * sc));
        t.getContext("2d")!.drawImage(bmp, 0, 0, t.width, t.height);
        thumb = t.toDataURL("image/jpeg", 0.72);
        if (f.size < 2_000_000) {
          full = await new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(f);
          });
        }
      } catch {
        /* ignore */
      }
      useHomeStore.getState().pushRecent({
        name: f.name,
        path: null,
        thumb,
        full,
        w: bmp.width,
        h: bmp.height,
        size: f.size,
      });
      useHomeStore.getState().setHome(false);
      setTimeout(() => {
        const id =
          useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
        if (!id) return;
        const c = layerManager.ensure(id, bmp.width, bmp.height);
        c.getContext("2d")!.drawImage(bmp, 0, 0);
        bmp.close();
        useEditorStore.getState().markDirty();
        useProStore.getState().bumpHistogram();
        fitToView();
      }, 60);
      } catch {
        /* ignore unreadable file */
      }
  }

  // Marching ants animation
  useEffect(() => {
    if (!hasSelection()) return;
    const t = setInterval(() => setAnts((a) => (a + 1) % 24), 80);
    return () => clearInterval(t);
  }, [layers, zoom, panX, panY, adjustments, filters, selDrag, lassoPts]);

  // Professional pixel rulers (drawn separately to stay light while the cursor moves)
  function drawRulers() {
    const wrap = wrapRef.current;
    if (!wrap || !showRulers) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = zoom / 100;
    const dw = doc.width * s;
    const dh = doc.height * s;
    const ox = (rect.width - dw) / 2 + panX;
    const oy = (rect.height - dh) / 2 + panY;
    const [cxRaw, cyRaw] = cursor.split(",").map((v) => parseFloat(v.trim()));
    const drawRuler = (c: HTMLCanvasElement | null, horizontal: boolean) => {
      if (!c) return;
      const th = 18;
      const len = horizontal ? rect.width : rect.height;
      c.width = Math.max(1, Math.floor((horizontal ? rect.width : th) * dpr));
      c.height = Math.max(1, Math.floor((horizontal ? th : rect.height) * dpr));
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const o = horizontal ? ox : oy;
      const size = horizontal ? dw : dh;
      g.fillStyle = "#101012";
      g.fillRect(0, 0, horizontal ? rect.width : th, horizontal ? th : rect.height);
      g.fillStyle = "#1c1c1f";
      g.fillRect(horizontal ? o : 0, horizontal ? 0 : o, horizontal ? size : th, horizontal ? th : size);
      const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
      let step = steps[steps.length - 1];
      for (const v of steps) {
        if (v * s >= 70) {
          step = v;
          break;
        }
      }
      const minor = step / 5;
      const from = Math.floor(-o / s / minor) * minor;
      const to = Math.ceil((len - o) / s / minor) * minor;
      g.strokeStyle = "#5a5a63";
      g.font = "9px JetBrains Mono, monospace";
      g.beginPath();
      for (let v = from; v <= to; v += minor) {
        const p = Math.round(o + v * s) + 0.5;
        if (p < -20 || p > len + 20) continue;
        const major = Math.abs(v % step) < 1e-6;
        if (horizontal) {
          g.moveTo(p, th - (major ? 9 : 4));
          g.lineTo(p, th);
        } else {
          g.moveTo(th - (major ? 9 : 4), p);
          g.lineTo(th, p);
        }
      }
      g.stroke();
      for (let v = Math.ceil(from / step) * step; v <= to; v += step) {
        const p = Math.round(o + v * s);
        if (p < -40 || p > len + 40) continue;
        const inDoc = v >= 0 && v <= (horizontal ? doc.width : doc.height);
        g.fillStyle = inDoc ? "#c9c9d1" : "#6e6e78";
        if (horizontal) {
          g.fillText(String(Math.round(v)), p + 3, 8);
        } else {
          g.save();
          g.translate(9, p - 3);
          g.rotate(-Math.PI / 2);
          g.textAlign = "right";
          g.fillText(String(Math.round(v)), 0, 0);
          g.restore();
          g.textAlign = "left";
        }
      }
      const cur = horizontal ? cxRaw : cyRaw;
      if (Number.isFinite(cur)) {
        const p = Math.round(o + cur * s);
        g.fillStyle = "#2f7cf6";
        if (horizontal) g.fillRect(p, 0, 1, th);
        else g.fillRect(0, p, th, 1);
      }
      g.strokeStyle = "#2f7cf6";
      g.lineWidth = 1;
      g.beginPath();
      const a = Math.round(o) + 0.5;
      const b = Math.round(o + size) + 0.5;
      if (horizontal) {
        g.moveTo(a, 0);
        g.lineTo(a, th);
        g.moveTo(b, 0);
        g.lineTo(b, th);
      } else {
        g.moveTo(0, a);
        g.lineTo(th, a);
        g.moveTo(0, b);
        g.lineTo(th, b);
      }
      g.stroke();
      if (rulerDrag && rulerDrag.kind === (horizontal ? "h" : "v")) {
        const dp = Math.round(o + rulerDrag.pos * s);
        g.fillStyle = "#5a30ff";
        if (horizontal) g.fillRect(dp, 0, 2, th);
        else g.fillRect(0, dp, th, 2);
      }
    };
    drawRuler(hRulerRef.current, true);
    drawRuler(vRulerRef.current, false);
  }


  useEffect(() => {
    drawRulers();
    const onResize = () => drawRulers();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [showRulers, zoom, panX, panY, doc.width, doc.height, cursor, rulerDrag]);

  // Non-destructive composite render
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // workspace: dark base + fine dot grid + studio vignette
    ctx.fillStyle = "#101012";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    const step = 24;
    for (let x = 0; x <= rect.width; x += step) {
      for (let y = 0; y <= rect.height; y += step) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const vg = ctx.createRadialGradient(
      rect.width / 2,
      rect.height / 2,
      Math.min(rect.width, rect.height) * 0.2,
      rect.width / 2,
      rect.height / 2,
      Math.max(rect.width, rect.height) * 0.75,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.restore();

    const s = zoom / 100;
    const dw = doc.width * s;
    const dh = doc.height * s;
    const ox = (rect.width - dw) / 2 + panX;
    const oy = (rect.height - dh) / 2 + panY;


    // document backing: pro-editor style transparency checkerboard
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#232323";
    ctx.fillRect(ox, oy, dw, dh);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, dw, dh);
    ctx.clip();
    const csize = 10;
    const x0 = Math.floor(ox / csize) * csize;
    const y0 = Math.floor(oy / csize) * csize;
    ctx.fillStyle = "#2c2c31";
    ctx.fillRect(ox, oy, dw, dh);
    ctx.fillStyle = "#3a3a41";
    for (let y = y0; y < oy + dh; y += csize) {
      for (let x = x0; x < ox + dw; x += csize) {
        const col = Math.floor(x / csize);
        const row = Math.floor(y / csize);
        if ((col + row) % 2 === 0) ctx.fillRect(x, y, csize, csize);
      }
    }
    ctx.restore();

    // 1. Composite layers to doc-size offscreen (pooled: no alloc per frame)
    const comp = getPooledComp(Math.max(1, doc.width), Math.max(1, doc.height));
    const cctx = comp.getContext("2d", { willReadFrequently: true })!;
    cctx.clearRect(0, 0, comp.width, comp.height);
    layers.forEach((l) => {
      if (!l.visible) return;
      const m = masks[l.id];
      const src = layerManager.compositedWithMask(
        l.id,
        m?.feather ?? 0,
        m?.density ?? 100,
        !!m?.hasMask && !!m?.enabled,
      );
      if (!src) return;
      const t = transforms[l.id];
      cctx.save();
      cctx.globalAlpha = l.opacity / 100;
      try {
        cctx.globalCompositeOperation =
          l.blendMode === "normal" ? "source-over" : (l.blendMode as GlobalCompositeOperation);
      } catch {
        cctx.globalCompositeOperation = "source-over";
      }
      if (t && (t.x !== 0 || t.y !== 0 || t.scaleX !== 1 || t.scaleY !== 1 || t.rotation !== 0)) {
        cctx.translate(comp.width / 2 + t.x, comp.height / 2 + t.y);
        cctx.rotate((t.rotation * Math.PI) / 180);
        cctx.scale(t.scaleX, t.scaleY);
        cctx.translate(-comp.width / 2, -comp.height / 2);
      }
      // simple clipping mask: when clipped, cut with the layer-below alpha
      cctx.drawImage(src, 0, 0);
      cctx.restore();
    });

    // 2. RAW develop (netral jika default)
    const rawActive =
      raw.exposure !== 0 ||
      raw.temperature !== 5500 ||
      raw.tint !== 0 ||
      raw.highlights !== 0 ||
      raw.shadows !== 0 ||
      raw.whites !== 0 ||
      raw.blacks !== 0;
    if (rawActive) {
      try {
        const id = cctx.getImageData(0, 0, comp.width, comp.height);
        applyRawDevelop(id, raw);
        cctx.putImageData(id, 0, 0);
      } catch {
        /* ignore */
      }
    }

    // 3. Sequential adjustments
    // Path A: avoid 1 extra ImageData copy at 100% opacity (common case).
    // applyAdjustmentToImageData mutates in place, so apply directly to id with no copy.
    adjustments.forEach((adj) => {
      if (!adj.enabled || adj.opacity <= 0) return;
      try {
        const id = cctx.getImageData(0, 0, comp.width, comp.height);
        const alpha = adj.opacity / 100;
        if (alpha >= 1) {
          applyAdjustmentToImageData(id, adj);
          cctx.putImageData(id, 0, 0);
        } else {
          const copy = new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
          applyAdjustmentToImageData(copy, adj);
          const tmp = document.createElement("canvas");
          tmp.width = comp.width;
          tmp.height = comp.height;
          tmp.getContext("2d")!.putImageData(copy, 0, 0);
          cctx.save();
          cctx.globalAlpha = alpha;
          cctx.drawImage(tmp, 0, 0);
          cctx.restore();
        }
      } catch {
        /* ignore */
      }
    });

    // 4. Filters
    let filtered: HTMLCanvasElement = comp;
    filters.forEach((f) => {
      if (!f.enabled) return;
      filtered = applyFilterToCanvas(filtered, f);
    });

    // 5. Working space + proofing
    try {
      if (color.workingSpace !== "sRGB" || color.proofEnabled) {
        const id = filtered
          .getContext("2d", { willReadFrequently: true })!
          .getImageData(0, 0, filtered.width, filtered.height);
        if (color.workingSpace !== "sRGB") convertWorkingSpace(id, "sRGB", color.workingSpace);
        if (color.proofEnabled) applySoftProof(id, color.gamutWarning);
        filtered.getContext("2d")!.putImageData(id, 0, 0);
      }
    } catch {
      /* ignore */
    }

    (window as any).__avero_comp = filtered;

    // 6. Draw to screen
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(filtered, ox, oy, dw, dh);
    ctx.restore();

    // highlight active + transform box
    const t = activeLayerId ? transforms[activeLayerId] : undefined;
    ctx.save();
    ctx.strokeStyle = "rgba(10,132,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, dw, dh);
    if (t) {
      ctx.fillStyle = "#2f7cf6";
      const hs = 7;
      const corners = [
        [ox, oy],
        [ox + dw, oy],
        [ox, oy + dh],
        [ox + dw, oy + dh],
      ];
      corners.forEach(([x, y]) => ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs));
    }
    ctx.restore();

    // 7. Selection overlay marching ants
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      ctx.save();
      // dim outside selection
      ctx.beginPath();
      ctx.rect(ox, oy, dw, dh);
      ctx.rect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fill("evenodd");
      // marching ants from mask bounds via drawImage + approximate dashed stroke rect
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -ants;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      // Path A: draw mask directly, no duplicate temp canvas (saves 1x doc-size memory per frame).
      // rough edge trace: use drag selection rect when present, otherwise full mask outline via shadow
      ctx.drawImage(sel, ox, oy, dw, dh);
      ctx.globalCompositeOperation = "overlay";
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -ants;
      ctx.strokeStyle = "#2f7cf6";
      ctx.strokeRect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
      ctx.restore();
    }

    // drag rect preview
    if (selDrag) {
      const x = ox + Math.min(selDrag.x0, selDrag.x1) * s;
      const y = oy + Math.min(selDrag.y0, selDrag.y1) * s;
      const wpx = Math.abs(selDrag.x1 - selDrag.x0) * s;
      const hpx = Math.abs(selDrag.y1 - selDrag.y0) * s;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -ants;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x, y, wpx, hpx);
      ctx.restore();
    }
    if (lassoPts.length > 1) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      lassoPts.forEach((p, i) => {
        const sx = ox + p.x * s;
        const sy = oy + p.y * s;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      // polygon mode: line back to start when 3+ points
      if ((tool === "select-polygon") && lassoPts.length > 2) {
        ctx.lineTo(ox + lassoPts[0].x * s, oy + lassoPts[0].y * s);
      }
      ctx.stroke();
      ctx.restore();
    }
    // shape drag preview (pro blue outline)
    if (shapeDrag) {
      const x = ox + Math.min(shapeDrag.x0, shapeDrag.x1) * s;
      const y = oy + Math.min(shapeDrag.y0, shapeDrag.y1) * s;
      const wpx = Math.abs(shapeDrag.x1 - shapeDrag.x0) * s;
      const hpx = Math.abs(shapeDrag.y1 - shapeDrag.y0) * s;
      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#2f7cf6";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, wpx, hpx);
      ctx.fillStyle = "rgba(47,124,246,0.12)";
      ctx.fillRect(x, y, wpx, hpx);
      ctx.restore();
    }

    // 7b. Photoshop-style pro grid
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(56,160,255,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gs = Math.max(8, gridSize) * s;
      const startX = ox % gs;
      for (let x = ox - startX; x <= ox + dw + gs; x += gs) {
        if (x < ox - 1 || x > ox + dw + 1) continue;
        ctx.moveTo(Math.round(x) + 0.5, oy);
        ctx.lineTo(Math.round(x) + 0.5, oy + dh);
      }
      const startY = oy % gs;
      for (let y = oy - startY; y <= oy + dh + gs; y += gs) {
        if (y < oy - 1 || y > oy + dh + 1) continue;
        ctx.moveTo(ox, Math.round(y) + 0.5);
        ctx.lineTo(ox + dw, Math.round(y) + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 8. Guides
    if (showGuides && (guidesH.length > 0 || guidesV.length > 0)) {
      ctx.save();
      ctx.strokeStyle = "rgba(56,225,255,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      guidesH.forEach((gy) => {
        ctx.moveTo(ox, oy + gy * s);
        ctx.lineTo(ox + dw, oy + gy * s);
      });
      guidesV.forEach((gx) => {
        ctx.moveTo(ox + gx * s, oy);
        ctx.lineTo(ox + gx * s, oy + dh);
      });
      ctx.stroke();
      // label guide
      ctx.fillStyle = "rgba(56,225,255,0.9)";
      ctx.font = "10px JetBrains Mono, monospace";
      guidesV.forEach((gx) => {
        ctx.fillText(`${Math.round(gx)}`, ox + gx * s + 4, oy + 12);
      });
      guidesH.forEach((gy) => {
        ctx.fillText(`${Math.round(gy)}`, ox + 4, oy + gy * s - 4);
      });
      ctx.restore();
    }

    // 9. Crop preview: darken outside area + frame
    if (cropDrag) {
      const x = ox + Math.min(cropDrag.x0, cropDrag.x1) * s;
      const y = oy + Math.min(cropDrag.y0, cropDrag.y1) * s;
      const wpx = Math.abs(cropDrag.x1 - cropDrag.x0) * s;
      const hpx = Math.abs(cropDrag.y1 - cropDrag.y0) * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, dw, dh);
      ctx.rect(x, y, wpx, hpx);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, wpx, hpx);
      ctx.fillStyle = "#2f7cf6";
      const hs = 8;
      [
        [x, y],
        [x + wpx, y],
        [x, y + hpx],
        [x + wpx, y + hpx],
      ].forEach(([hx, hy]) => ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs));
      ctx.restore();
    }

    // 10. Gradient preview line
    if (gradDrag) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox + gradDrag.x0 * s, oy + gradDrag.y0 * s);
      ctx.lineTo(ox + gradDrag.x1 * s, oy + gradDrag.y1 * s);
      ctx.stroke();
      ctx.fillStyle = "#2f7cf6";
      ctx.beginPath();
      ctx.arc(ox + gradDrag.x0 * s, oy + gradDrag.y0 * s, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 10b. Pen/Line preview
    if (penDrag) {
      ctx.save();
      ctx.strokeStyle = "#2f7cf6";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(ox + penDrag.x0 * s, oy + penDrag.y0 * s);
      ctx.lineTo(ox + penDrag.x1 * s, oy + penDrag.y1 * s);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#2f7cf6";
      [penDrag.x0, penDrag.x1].forEach((px, i) => {
        const py = i === 0 ? penDrag.y0 : penDrag.y1;
        ctx.beginPath();
        ctx.arc(ox + px * s, oy + py * s, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    if (measureDrag) {
      const mx1 = ox + measureDrag.x0 * s;
      const my1 = oy + measureDrag.y0 * s;
      const mx2 = ox + measureDrag.x1 * s;
      const my2 = oy + measureDrag.y1 * s;
      ctx.save();
      ctx.strokeStyle = "#5a30ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(mx1, my1);
      ctx.lineTo(mx2, my2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#5a30ff";
      ctx.beginPath();
      ctx.arc(mx1, my1, 3.5, 0, Math.PI * 2);
      ctx.arc(mx2, my2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      const dx = measureDrag.x1 - measureDrag.x0;
      const dy = measureDrag.y1 - measureDrag.y0;
      const dist = Math.hypot(dx, dy);
      const ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
      ctx.font = "11px JetBrains Mono, monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${dist.toFixed(1)} px ${ang.toFixed(1)} deg`, (mx1 + mx2) / 2 + 8, (my1 + my2) / 2 - 8);
      ctx.restore();
    }

    if (zoom >= 400) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = ox; x <= ox + dw; x += s) {
        ctx.moveTo(x, oy);
        ctx.lineTo(x, oy + dh);
      }
      for (let y = oy; y <= oy + dh; y += s) {
        ctx.moveTo(ox, y);
        ctx.lineTo(ox + dw, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    // composite render deps intentional
  }, [
    layers,
    activeLayerId,
    doc.width,
    doc.height,
    zoom,
    panX,
    panY,
    isPainting,
    ants,
    selDrag,
    lassoPts,
    cropDrag,
    gradDrag,
    penDrag,
    shapeDrag,
    measureDrag,
    guidesH,
    guidesV,
    showGuides,
    showGrid,
    gridSize,
    adjustments,
    filters,
    masks,
    paintMask,
    transforms,
    color,
    raw,
  ]);

  function toDocCoords(e: React.MouseEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = zoom / 100;
    const dw = doc.width * s;
    const dh = doc.height * s;
    const ox = (rect.width - dw) / 2 + panX;
    const oy = (rect.height - dh) / 2 + panY;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { x: (sx - ox) / s, y: (sy - oy) / s, sx, sy };
  }

  // Brush engine: radial sprite per hardness, stamped along the stroke.
  // Hardness 100 = solid disc, 0 = soft gaussian.
  function brushSprite(size: number, hardness: number, color: string): HTMLCanvasElement {
    const key = `${Math.round(size)}|${Math.round(hardness)}|${color}`;
    let sp = spriteCache.current.get(key);
    if (sp) return sp;
    const s = Math.max(1, Math.round(size));
    sp = document.createElement("canvas");
    sp.width = s;
    sp.height = s;
    const ctx = sp.getContext("2d")!;
    const hard = Math.max(0, Math.min(100, hardness)) / 100;
    const inner = (s / 2) * (0.15 + 0.85 * hard);
    const ga = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    ga.addColorStop(0, "rgba(255,255,255,1)");
    ga.addColorStop(Math.min(0.99, inner / (s / 2)), "rgba(255,255,255,1)");
    ga.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = ga;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "source-over";
    if (spriteCache.current.size > 40) spriteCache.current.clear();
    spriteCache.current.set(key, sp);
    return sp;
  }

  function stampLine(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    size: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    checkSel: boolean,
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const spacing = Math.max(1, size * 0.18);
    const steps = Math.max(1, Math.floor(dist / spacing));
    for (let i = 0; i <= steps; i++) {
      const px = x0 + (dx * i) / steps;
      const py = y0 + (dy * i) / steps;
      if (checkSel && !isPointInSelection(px, py)) continue;
      ctx.drawImage(sprite, px - size / 2, py - size / 2, size, size);
    }
  }

  function paintTo(x: number, y: number, erase: boolean) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const last = lastPos.current ?? { x, y };
    const st = useEditorStore.getState();
    const curTool = st.tool;

    // Mode paint mask
    const m = masks[activeLayerId];
    if (paintMask && m?.hasMask) {
      const mc = layerManager.ensureMask(activeLayerId, doc.width, doc.height);
      const ctx = mc.getContext("2d")!;
      ctx.save();
      ctx.globalAlpha = brushOpacity / 100;
      const sp = brushSprite(brushSize, brushHardness, erase ? "#000000" : "#ffffff");
      stampLine(ctx, sp, brushSize, last.x, last.y, x, y, true);
      ctx.restore();
      lastPos.current = { x, y };
      markDirty();
      bumpHistogram();
      return;
    }

    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    ctx.save();
    // Distinct per-tool paint behavior:
    // - pencil: hard 100% alpha, full hardness
    // - airbrush: 25% flow buildup per dab
    // - soft-brush: force 0 hardness
    // - eraser-hard: 100% hard erase
    // - background-eraser: handled separately via eraseBackgroundTo()
    // - magic-eraser: handled separately via magicEraseAt()
    if (curTool === "background-eraser") {
      ctx.restore();
      eraseBackgroundTo(x, y);
      return;
    }
    if (curTool === "magic-eraser") {
      ctx.restore();
      magicEraseAt(x, y);
      return;
    }
    if (curTool === "history-brush" || curTool === "art-history-brush") {
      ctx.restore();
      historyBrushTo(x, y, curTool === "art-history-brush");
      return;
    }
    if (curTool === "color-replacement") {
      ctx.restore();
      colorReplaceTo(x, y);
      return;
    }
    if (curTool === "mixer-brush") {
      ctx.restore();
      mixerBrushTo(x, y);
      return;
    }
    if (curTool === "pattern-stamp") {
      ctx.restore();
      patternStampTo(x, y);
      return;
    }
    const isPencil = curTool === "pencil";
    const isAir = curTool === "airbrush";
    const isSoft = curTool === "soft-brush";
    const isHardErase = curTool === "eraser-hard";
    const effHard = isPencil || isHardErase ? 100 : isSoft || isAir ? 0 : brushHardness;
    const effAlpha = isPencil || isHardErase ? 1 : isAir ? (brushOpacity / 100) * 0.25 : (erase ? 1 : brushOpacity / 100);
    ctx.globalCompositeOperation = erase || isHardErase ? "destination-out" : "source-over";
    ctx.globalAlpha = effAlpha;
    const sp = brushSprite(brushSize, effHard, erase || isHardErase ? "#000000" : brushColor);
    stampLine(ctx, sp, brushSize, last.x, last.y, x, y, true);
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Background Eraser: erase only pixels similar to edge sample.
  function eraseBackgroundTo(x: number, y: number) {
    if (!activeLayerId) return;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const r = Math.max(1, brushSize / 2);
    const s = Math.round(r * 2);
    const sx = Math.round(x - r);
    const sy = Math.round(y - r);
    try {
      const edge = ctx.getImageData(Math.max(0, Math.min(c.width - 1, Math.floor(x))), Math.max(0, Math.min(c.height - 1, Math.floor(y))), 1, 1).data;
      const id = ctx.getImageData(Math.max(0, sx), Math.max(0, sy), Math.min(s, c.width), Math.min(s, c.height));
      const d = id.data;
      const tol = 48;
      for (let i = 0; i < d.length; i += 4) {
        const dr = Math.abs(d[i] - edge[0]);
        const dg = Math.abs(d[i + 1] - edge[1]);
        const db = Math.abs(d[i + 2] - edge[2]);
        if ((dr + dg + db) / 3 < tol) d[i + 3] = 0;
      }
      ctx.putImageData(id, Math.max(0, sx), Math.max(0, sy));
      markDirty();
    } catch { /* ignore edges */ }
    lastPos.current = { x, y };
  }

  // Magic Eraser: one-click flood erase with tolerance.
  function magicEraseAt(x: number, y: number) {
    if (!activeLayerId) return;
    const st = useEditorStore.getState();
    const snap = layerManager.snapshot(activeLayerId);
    if (snap) st.pushHistory({ label: "Magic erase", layerId: activeLayerId, snapshot: snap });
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    try {
      const W = c.width;
      const H = c.height;
      const ix = Math.max(0, Math.min(W - 1, Math.floor(x)));
      const iy = Math.max(0, Math.min(H - 1, Math.floor(y)));
      const img = ctx.getImageData(0, 0, W, H);
      const d = img.data;
      const start = (iy * W + ix) * 4;
      const sr = d[start];
      const sg = d[start + 1];
      const sb = d[start + 2];
      const tol = 32;
      const visited = new Uint8Array(Math.min(W * H, 2000000));
      const stack = [iy * W + ix];
      let n = 0;
      while (stack.length && n < 500000) {
        const p = stack.pop()!;
        if (p < 0 || p >= W * H || visited[p]) continue;
        visited[p] = 1;
        const idx = p * 4;
        const dist = (Math.abs(d[idx] - sr) + Math.abs(d[idx + 1] - sg) + Math.abs(d[idx + 2] - sb)) / 3;
        if (dist <= tol) {
          d[idx + 3] = 0;
          n++;
          const px = p % W;
          const py = Math.floor(p / W);
          if (px > 0) stack.push(p - 1);
          if (px < W - 1) stack.push(p + 1);
          if (py > 0) stack.push(p - W);
          if (py < H - 1) stack.push(p + W);
        }
      }
      ctx.putImageData(img, 0, 0);
      st.markDirty();
      bumpHistogram();
    } catch { /* ignore */ }
    lastPos.current = { x, y };
  }

  // History Brush: paint back from stroke-start snapshot (or last undo entry).
  // Art variant adds hue jitter for a stylized look.
  function historyBrushTo(x: number, y: number, art: boolean) {
    if (!activeLayerId) return;
    const src = historySource.current;
    if (!src) return;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    const last = lastPos.current ?? { x, y };
    const r = brushSize / 2;
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / Math.max(1, brushSize * 0.18)));
    ctx.save();
    ctx.globalAlpha = (art ? 0.7 : 0.9) * (brushOpacity / 100) + 0.1;
    for (let i = 0; i <= steps; i++) {
      const px = Math.round(last.x + (dx * i) / steps);
      const py = Math.round(last.y + (dy * i) / steps);
      if (!isPointInSelection(px, py)) continue;
      const s = Math.max(1, Math.round(r * 2));
      const sx = Math.max(0, Math.min(src.width - s, px - Math.round(r)));
      const sy = Math.max(0, Math.min(src.height - s, py - Math.round(r)));
      try {
        const tmp = document.createElement("canvas");
        tmp.width = s;
        tmp.height = s;
        const tctx = tmp.getContext("2d")!;
        const sd = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
        const full = document.createElement("canvas");
        full.width = src.width;
        full.height = src.height;
        full.getContext("2d")!.putImageData(sd, 0, 0);
        tctx.drawImage(full, sx, sy, s, s, 0, 0, s, s);
        if (art) {
          tctx.globalCompositeOperation = "source-atop";
          tctx.globalAlpha = 0.25;
          tctx.fillStyle = brushColor;
          tctx.fillRect(0, 0, s, s);
          tctx.globalAlpha = 1;
          tctx.globalCompositeOperation = "source-over";
        }
        ctx.drawImage(tmp, px - Math.round(r), py - Math.round(r));
      } catch { /* ignore edges */ }
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Color Replacement: shift hue toward brush color, keep luminance.
  function colorReplaceTo(x: number, y: number) {
    if (!activeLayerId) return;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const last = lastPos.current ?? { x, y };
    const r = Math.max(1, brushSize / 2);
    const strength = brushOpacity / 100;
    const fr = parseInt(brushColor.slice(1, 3), 16);
    const fg = parseInt(brushColor.slice(3, 5), 16);
    const fb = parseInt(brushColor.slice(5, 7), 16);
    for (const { px, py } of dabPath(last.x, last.y, x, y)) {
      if (!isPointInSelection(px, py)) continue;
      const s = Math.round(r * 2);
      const sx = Math.round(px - r);
      const sy = Math.round(py - r);
      if (sx < 0 || sy < 0 || sx + s > c.width || sy + s > c.height) continue;
      try {
        const id = ctx.getImageData(sx, sy, s, s);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
          const tr = (fr / 255);
          const tg = (fg / 255);
          const tb = (fb / 255);
          const tAvg = (tr + tg + tb) / 3 || 1;
          d[i] = Math.max(0, Math.min(255, (d[i] + (tr / tAvg) * lum * 255 * 0.9) * (1 - strength * 0.6) + (tr * lum * 255) * strength * 0.6));
          d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] + (tg / tAvg) * lum * 255 * 0.9) * (1 - strength * 0.6) + (tg * lum * 255) * strength * 0.6));
          d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] + (tb / tAvg) * lum * 255 * 0.9) * (1 - strength * 0.6) + (tb * lum * 255) * strength * 0.6));
        }
        ctx.putImageData(id, sx, sy);
      } catch { /* ignore */ }
    }
    lastPos.current = { x, y };
    markDirty();
  }

  // Mixer Brush: wet mix of canvas color + brush color at 45% strength.
  function mixerBrushTo(x: number, y: number) {
    if (!activeLayerId) return;
    pickSmudgeColor({ x, y });
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    const last = lastPos.current ?? { x, y };
    const col = smudgeColor.current ?? brushColor;
    ctx.save();
    ctx.globalAlpha = 0.45 * (brushOpacity / 100) + 0.05;
    const sp = brushSprite(brushSize, Math.max(0, brushHardness - 30), col);
    stampLine(ctx, sp, brushSize, last.x, last.y, x, y, true);
    ctx.globalAlpha = 0.25 * (brushOpacity / 100);
    const sp2 = brushSprite(brushSize * 0.7, 0, brushColor);
    stampLine(ctx, sp2, brushSize * 0.7, last.x, last.y, x, y, true);
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Pattern Stamp: neutral checker weave stamped with brush color tint.
  function patternStampTo(x: number, y: number) {
    if (!activeLayerId) return;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    const last = lastPos.current ?? { x, y };
    const s = Math.max(8, Math.round(brushSize));
    const pat = document.createElement("canvas");
    pat.width = s;
    pat.height = s;
    const pctx = pat.getContext("2d")!;
    const cell = Math.max(2, Math.round(s / 8));
    for (let yy = 0; yy < s; yy += cell) {
      for (let xx = 0; xx < s; xx += cell) {
        pctx.fillStyle = ((xx + yy) / cell) % 2 === 0 ? brushColor : "#ffffff";
        pctx.globalAlpha = 0.85;
        pctx.fillRect(xx, yy, cell, cell);
      }
    }
    pctx.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = brushOpacity / 100;
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / Math.max(1, s * 0.3)));
    for (let i = 0; i <= steps; i++) {
      const px = last.x + (dx * i) / steps;
      const py = last.y + (dy * i) / steps;
      if (!isPointInSelection(px, py)) continue;
      ctx.drawImage(pat, px - s / 2, py - s / 2, s, s);
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Clone stamp: Alt+click sets the source, paint to copy.
  function cloneTo(x: number, y: number) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const src = cloneRef.current;
    if (!src) {
      setCursor("Alt-click to set source");
      return;
    }
    if (!cloneOrigin.current) cloneOrigin.current = { x, y };
    const ox = cloneOrigin.current.x - src.x;
    const oy = cloneOrigin.current.y - src.y;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    const r = brushSize / 2;
    const last = lastPos.current ?? { x, y };
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / Math.max(1, brushSize * 0.18)));
    ctx.save();
    ctx.globalAlpha = brushOpacity / 100;
    for (let i = 0; i <= steps; i++) {
      const px = last.x + (dx * i) / steps;
      const py = last.y + (dy * i) / steps;
      if (!isPointInSelection(px, py)) continue;
      ctx.drawImage(c, px - ox - r, py - oy - r, r * 2, r * 2, px - r, py - r, r * 2, r * 2);
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // ===== Retouch pro engine (dodge/burn/sponge/blur/sharpen/smudge/heal) =====
  function dabPath(x0: number, y0: number, x1: number, y1: number): { px: number; py: number }[] {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / Math.max(1, brushSize * 0.22)));
    const pts: { px: number; py: number }[] = [];
    for (let i = 0; i <= steps; i++) pts.push({ px: x0 + (dx * i) / steps, py: y0 + (dy * i) / steps });
    return pts;
  }

  function retouchTo(x: number, y: number, mode: "dodge" | "burn" | "sponge" | "vibrance" | "blur" | "blur-iris" | "sharpen" | "sharpen-edge" | "heal" | "heal-source" | "red-eye" | "content-move" | "smudge" | "noise" | "content-fill") {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const last = lastPos.current ?? { x, y };
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const strength = brushOpacity / 100;
    const r = Math.max(1, brushSize / 2);
    for (const { px, py } of dabPath(last.x, last.y, x, y)) {
      if (!isPointInSelection(px, py)) continue;
      const sx = Math.round(px - r);
      const sy = Math.round(py - r);
      const s = Math.round(r * 2);
      if (sx < 0 || sy < 0 || sx + s > c.width || sy + s > c.height) continue;
      try {
        if (mode === "dodge" || mode === "burn") {
          ctx.save();
          ctx.globalAlpha = 0.16 * strength + 0.04;
          ctx.fillStyle = mode === "dodge" ? "#ffffff" : "#000000";
          ctx.beginPath();
          ctx.arc(px, py, r * (brushHardness / 130 + 0.35), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (mode === "blur" || mode === "blur-iris" || mode === "heal" || mode === "heal-source") {
          const hs = healRef.current;
          const ox = mode === "heal-source" && hs ? px - hs.x : 0;
          const oy = mode === "heal-source" && hs ? py - hs.y : 0;
          const tmp = document.createElement("canvas");
          tmp.width = s;
          tmp.height = s;
          const tctx = tmp.getContext("2d")!;
          // Low-spec guard: CSS blur with r>48 is extremely slow per dab.
          // Use cheap downscale-upscale blur approximation for large brushes.
          if (r > 48) {
            const ds = Math.max(8, Math.round(s / 4));
            const tiny = document.createElement("canvas");
            tiny.width = ds;
            tiny.height = ds;
            const ictx = tiny.getContext("2d")!;
            if (mode === "heal-source" && hs) ictx.drawImage(c, sx - Math.round(ox), sy - Math.round(oy), s, s, 0, 0, ds, ds);
            else ictx.drawImage(c, sx, sy, s, s, 0, 0, ds, ds);
            tctx.imageSmoothingEnabled = true;
            tctx.drawImage(tiny, 0, 0, s, s);
          } else {
            const blurR = mode === "blur-iris" ? Math.max(2, r / 1.5) : Math.max(1, r / 3);
            tctx.filter = `blur(${blurR}px)`;
            if (mode === "heal-source" && hs) tctx.drawImage(c, sx - Math.round(ox), sy - Math.round(oy), s, s, 0, 0, s, s);
            else tctx.drawImage(c, sx, sy, s, s, 0, 0, s, s);
            tctx.filter = "none";
          }
          ctx.save();
          ctx.globalAlpha = mode === "heal" || mode === "heal-source" ? 0.85 * strength + 0.15 : mode === "blur-iris" ? 0.8 * strength + 0.15 : 0.55 * strength + 0.1;
          ctx.drawImage(tmp, sx, sy);
          ctx.restore();
        } else if (mode === "red-eye") {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            // red eye: red channel dominates green+blue
            if (d[i] > 90 && d[i] > d[i + 1] * 1.4 && d[i] > d[i + 2] * 1.4) {
              const lum = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
              const k = 0.75 * strength + 0.25;
              d[i] = Math.round(d[i] * (1 - k) + lum * k);
              d[i + 1] = Math.round(d[i + 1] * (1 - k * 0.4) + lum * k * 0.4);
              d[i + 2] = Math.round(d[i + 2] * (1 - k * 0.4) + lum * k * 0.4);
            }
          }
          ctx.putImageData(id, sx, sy);
        } else if (mode === "content-move") {
          const mvx = Math.round(r * 0.6);
          const mvy = Math.round(r * 0.3);
          try {
            const id = ctx.getImageData(sx, sy, s, s);
            const tmp = document.createElement("canvas");
            tmp.width = s;
            tmp.height = s;
            tmp.getContext("2d")!.putImageData(id, 0, 0);
            ctx.save();
            ctx.globalAlpha = 0.9 * strength + 0.1;
            ctx.drawImage(tmp, sx + mvx, sy + mvy, s, s, sx, sy, s, s);
            ctx.restore();
          } catch { /* ignore */ }
        } else if (mode === "sharpen" || mode === "sharpen-edge") {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          const amt = (mode === "sharpen-edge" ? 0.5 : 0.35) * strength + 0.1;
          for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
            // edge variant skips flat areas to avoid noise boost
            if (mode === "sharpen-edge") {
              const edge = Math.max(Math.abs(d[i] - avg), Math.abs(d[i + 1] - avg), Math.abs(d[i + 2] - avg));
              if (edge < 12) continue;
            }
            d[i] = Math.max(0, Math.min(255, d[i] + (d[i] - avg) * amt));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (d[i + 1] - avg) * amt));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (d[i + 2] - avg) * amt));
          }
          ctx.putImageData(id, sx, sy);
        } else if (mode === "sponge" || mode === "vibrance") {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          const amt = (mode === "vibrance" ? 0.35 : 0.25) * strength + 0.05;
          for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
            const mx = Math.max(d[i], d[i + 1], d[i + 2]);
            const mn = Math.min(d[i], d[i + 1], d[i + 2]);
            const sat = mx - mn;
            // vibrance protects already-saturated + skin tones
            const w = mode === "vibrance" ? Math.max(0, 1 - sat / 90) : 1;
            d[i] = Math.max(0, Math.min(255, avg + (d[i] - avg) * (1 + amt * w)));
            d[i + 1] = Math.max(0, Math.min(255, avg + (d[i + 1] - avg) * (1 + amt * w)));
            d[i + 2] = Math.max(0, Math.min(255, avg + (d[i + 2] - avg) * (1 + amt * w)));
          }
          ctx.putImageData(id, sx, sy);
        } else if (mode === "noise") {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          const amt = 0.5 * strength + 0.2;
          for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
            d[i] = Math.max(0, Math.min(255, d[i] + (avg - d[i]) * amt * 0.6));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (avg - d[i + 1]) * amt * 0.6));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (avg - d[i + 2]) * amt * 0.6));
          }
          ctx.putImageData(id, sx, sy);
        } else if (mode === "content-fill") {
          const tmp = document.createElement("canvas");
          tmp.width = s;
          tmp.height = s;
          const tctx = tmp.getContext("2d")!;
          tctx.filter = `blur(${Math.max(2, r / 2)}px)`;
          tctx.drawImage(c, sx, sy, s, s, 0, 0, s, s);
          tctx.filter = "none";
          ctx.save();
          ctx.globalAlpha = 0.9 * strength + 0.1;
          ctx.drawImage(tmp, sx, sy);
          ctx.restore();
        } else if (mode === "smudge") {
          const col = smudgeColor.current ?? brushColor;
          ctx.save();
          ctx.globalAlpha = 0.28 * strength + 0.08;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(px, py, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } catch {
        /* ignore edges */
      }
    }
    lastPos.current = { x, y };
    markDirty();
  }

  function pickSmudgeColor(p: { x: number; y: number }) {
    try {
      const c = layerManager.get(activeLayerId ?? "");
      if (!c) return;
      const ix = Math.max(0, Math.min(c.width - 1, Math.floor(p.x)));
      const iy = Math.max(0, Math.min(c.height - 1, Math.floor(p.y)));
      const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1).data;
      smudgeColor.current = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    } catch {
      /* ignore */
    }
  }

  function floodFillAt(x: number, y: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return;
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Paint bucket fill", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const ix = Math.max(0, Math.min(c.width - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(c.height - 1, Math.floor(y)));
    // If a selection exists, fill the selection with color (fast, Photoshop-style fill selection)
    try {
      const selOn = isPointInSelection(ix, iy);
      if (hasSelection() && selOn) {
        ctx.save();
        ctx.globalAlpha = st.brushOpacity / 100;
        ctx.fillStyle = st.brushColor;
        ctx.fillRect(0, 0, c.width, c.height);
        const sel = selectionMaskCanvas();
        if (sel) {
          ctx.globalCompositeOperation = "destination-in";
          ctx.globalAlpha = 1;
          ctx.drawImage(sel, 0, 0);
        }
        ctx.restore();
        st.markDirty();
        useProStore.getState().bumpHistogram();
        return;
      }
    } catch {
      /* lanjut flood fill */
    }
    // Simple tolerant flood fill
    try {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      const W = c.width;
      const H = c.height;
      const start = (iy * W + ix) * 4;
      const sr = d[start];
      const sg = d[start + 1];
      const sb = d[start + 2];
      const sa = d[start + 3];
      const hex = st.brushColor;
      const fr = parseInt(hex.slice(1, 3), 16);
      const fg = parseInt(hex.slice(3, 5), 16);
      const fb = parseInt(hex.slice(5, 7), 16);
      if (Math.abs(sr - fr) < 4 && Math.abs(sg - fg) < 4 && Math.abs(sb - fb) < 4 && sa === 255) {
        return;
      }
      const tol = 42;
      const visited = new Uint8Array(W * H);
      const stack: number[] = [iy * W + ix];
      visited[iy * W + ix] = 1;
      let filled = 0;
      while (stack.length && filled < 900000) {
        const cur = stack.pop()!;
        const cx = cur % W;
        const cy = Math.floor(cur / W);
        const o = cur * 4;
        const dr = Math.abs(d[o] - sr);
        const dg = Math.abs(d[o + 1] - sg);
        const db = Math.abs(d[o + 2] - sb);
        if (dr + dg + db > tol * 3) continue;
        if (!isPointInSelection(cx, cy)) continue;
        d[o] = fr;
        d[o + 1] = fg;
        d[o + 2] = fb;
        d[o + 3] = 255;
        filled++;
        if (cx > 0 && !visited[cur - 1]) {
          visited[cur - 1] = 1;
          stack.push(cur - 1);
        }
        if (cx < W - 1 && !visited[cur + 1]) {
          visited[cur + 1] = 1;
          stack.push(cur + 1);
        }
        if (cy > 0 && !visited[cur - W]) {
          visited[cur - W] = 1;
          stack.push(cur - W);
        }
        if (cy < H - 1 && !visited[cur + W]) {
          visited[cur + W] = 1;
          stack.push(cur + W);
        }
      }
      ctx.putImageData(img, 0, 0);
      st.markDirty();
      useProStore.getState().bumpHistogram();
    } catch {
      /* ignore */
    }
  }

  function applyPenLine(x0: number, y0: number, x1: number, y1: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return;
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: tool === "pen" ? "Pen stroke" : "Line", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.globalAlpha = st.brushOpacity / 100;
    ctx.strokeStyle = st.brushColor;
    ctx.lineWidth = Math.max(1, st.brushSize / 4);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (tool === "line") {
      ctx.lineTo(x1, y1);
    } else {
      const mx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(x0, y0, mx, (y0 + y1) / 2);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.restore();
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  function applyCrop() {
    const st = useEditorStore.getState();
    if (!cropDrag) return;
    const x = Math.max(0, Math.floor(Math.min(cropDrag.x0, cropDrag.x1)));
    const y = Math.max(0, Math.floor(Math.min(cropDrag.y0, cropDrag.y1)));
    const w = Math.min(st.doc.width - x, Math.floor(Math.abs(cropDrag.x1 - cropDrag.x0)));
    const h = Math.min(st.doc.height - y, Math.floor(Math.abs(cropDrag.y1 - cropDrag.y0)));
    if (w < 2 || h < 2) {
      setCropDrag(null);
      return;
    }
    // snapshot all layers so crop can be undone per layer
    st.layers.forEach((l) => {
      const snap = layerManager.snapshot(l.id);
      if (snap) st.pushHistory({ label: "Crop", layerId: l.id, snapshot: snap });
    });
    st.layers.forEach((l) => {
      const c = layerManager.get(l.id);
      if (c) {
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d")!.drawImage(c, x, y, w, h, 0, 0, w, h);
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(tmp, 0, 0);
      }
      const mc = layerManager.getMask(l.id);
      if (mc) {
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d")!.drawImage(mc, x, y, w, h, 0, 0, w, h);
        mc.width = w;
        mc.height = h;
        mc.getContext("2d")!.drawImage(tmp, 0, 0);
      }
      // transform reset because document origin changed
      useProStore.getState().updateTransform(l.id, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    });
    st.setDocSize(w, h);
    clearSelectionMask();
    st.markDirty();
    setCropDrag(null);
    useProStore.getState().bumpHistogram();
    fitToView();
  }

  function gradientFillAt(x: number, y: number, radial: boolean) {
    const st = useEditorStore.getState();
    if (!radial) {
      setGradDrag({ x0: x, y0: y, x1: x, y1: y });
      return;
    }
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return;
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Radial gradient", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const to = gradTo === "white" ? "#ffffff" : gradTo === "black" ? "#000000" : "rgba(0,0,0,0)";
    const from = st.brushColor;
    const rad = Math.max(c.width, c.height) * 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    if (gradTo === "transparent") {
      g.addColorStop(0, from);
      const r = parseInt(from.slice(1, 3), 16);
      const gg = parseInt(from.slice(3, 5), 16);
      const b = parseInt(from.slice(5, 7), 16);
      g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    } else {
      g.addColorStop(0, from);
      g.addColorStop(1, to);
    }
    ctx.save();
    ctx.globalAlpha = st.brushOpacity / 100;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.globalAlpha = 1;
      ctx.drawImage(sel, 0, 0);
    }
    ctx.restore();
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  function applyGradient(x0: number, y0: number, x1: number, y1: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) return;
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Gradient", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const to =
      gradTo === "white" ? "#ffffff" : gradTo === "black" ? "#000000" : "rgba(0,0,0,0)";
    const from = st.brushColor;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    if (gradTo === "transparent") {
      g.addColorStop(0, from);
      const r = parseInt(from.slice(1, 3), 16);
      const gg = parseInt(from.slice(3, 5), 16);
      const b = parseInt(from.slice(5, 7), 16);
      g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    } else {
      g.addColorStop(0, from);
      g.addColorStop(1, to);
    }
    ctx.save();
    ctx.globalAlpha = st.brushOpacity / 100;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    // respect selection: clip to selection mask
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.globalAlpha = 1;
      ctx.drawImage(sel, 0, 0);
    }
    ctx.restore();
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  // Enter applies crop, Esc cancels. Only while the crop tool is active.
  useEffect(() => {
    if (tool !== "crop" || !cropDrag) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") applyCrop();
      if (e.key === "Escape") setCropDrag(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, cropDrag]);

  // Eyedropper: pick color from the composite then return to brush.
  function pickColor(p: { x: number; y: number }) {
    const comp = getCompositeCanvas();
    if (!comp) return;
    const ix = Math.max(0, Math.min(comp.width - 1, Math.floor(p.x)));
    const iy = Math.max(0, Math.min(comp.height - 1, Math.floor(p.y)));
    try {
      const d = comp.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1).data;
      const hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const st = useEditorStore.getState();
      st.setBrush({ color: hex });
      st.setTool("brush");
      setCursor(`Color ${hex}`);
    } catch {
      /* ignore */
    }
  }

  function handleWandClick(p: { x: number; y: number }) {
    const comp = getCompositeCanvas();
    if (!comp) return;
    try {
      const id = comp
        .getContext("2d", { willReadFrequently: true })!
        .getImageData(0, 0, comp.width, comp.height);
      const tol = useProStore.getState().selTolerance;
      wandFromImage(comp.width, comp.height, id, p.x, p.y, tol);
      const feather = useProStore.getState().selFeather;
      if (feather > 0) featherSelection(feather);
      setAnts((a) => a + 1);
    } catch {
      /* ignore */
    }
  }

  function createTextLayer(p: { x: number; y: number }, presetText?: string, vertical = false) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const l = makeLayer(`Text ${st.layers.length + 1}`);
    (l as any).kind = "text";
    layerManager.ensure(l.id, doc.width, doc.height);
    const spec = {
      text: presetText ?? "Edit text in panel",
      fontFamily: "Inter",
      fontSize: Math.max(24, Math.round(doc.width / 24)),
      color: "#ffffff",
      bold: true,
      italic: false,
      tracking: 0,
      leading: 1.25,
    };
    if (vertical && !presetText) spec.text = spec.text.split("").join("\n");
    pro.setTextSpec(l.id, spec);
    const c = layerManager.ensure(l.id, doc.width, doc.height);
    renderTextToLayer(c, spec, Math.round(p.x), Math.round(p.y));
    st.addLayer({ ...l, kind: "text" });
    pro.ensureTransform(l.id);
    markDirty();
  }

  function createShapeLayer(kind: "rect" | "ellipse" | "polygon", sides = 6, namePrefix?: string) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const l = makeLayer(`${namePrefix ?? "Shape"} ${st.layers.length + 1}`);
    layerManager.ensure(l.id, doc.width, doc.height);
    const spec = {
      kind,
      fill: "#2f7cf6",
      stroke: "#ffffff",
      strokeWidth: 3,
      sides,
      rotation: 0,
    };
    pro.setShapeSpec(l.id, spec);
    renderShapeToLayer(layerManager.ensure(l.id, doc.width, doc.height), spec);
    st.addLayer({ ...l, kind: "shape" });
    pro.ensureTransform(l.id);
  }

  // Drag from the ruler to create a new guide, pro-editor style
  function startRulerDrag(kind: "h" | "v", e: React.MouseEvent) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const s = zoom / 100;
    const ox = (r.width - doc.width * s) / 2 + panX;
    const oy = (r.height - doc.height * s) / 2 + panY;
    const posAt = (ev: { clientX: number; clientY: number }) =>
      kind === "h" ? (ev.clientY - r.top - oy) / s : (ev.clientX - r.left - ox) / s;
    setRulerDrag({ kind, pos: posAt(e.nativeEvent) });
    const onMove = (ev: MouseEvent) => setRulerDrag({ kind, pos: posAt(ev) });
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const pos = posAt(ev);
      const max = kind === "h" ? doc.height : doc.width;
      if (pos >= 0 && pos <= max) {
        const pro = useProStore.getState();
        pro.addGuide(kind, Math.round(pos));
        if (!pro.showGuides) pro.toggleGuides();
      }
      setRulerDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#161618]">
      {showRulers && (
        <div className="relative h-[18px] shrink-0 border-b border-[#2c2c31] bg-[#101012]">
          <canvas
            ref={hRulerRef}
            className="absolute inset-0 h-full w-full"
            onMouseDown={(e) => {
              e.stopPropagation();
              startRulerDrag("h", e);
            }}
          />
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setZoom(100)}
            title="Click for 100% zoom"
            className="absolute left-0 top-0 z-10 grid h-full w-[18px] place-items-center border-r border-[#2c2c31] bg-[#1c1c1f] font-mono text-[8px] leading-none text-[#8fb6f5] hover:bg-[#232327]"
          >
            {zoom}
          </button>
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onDoubleClick={() => {
          if (tool === "select-polygon" && lassoPts.length > 2) {
            drawLassoSelection(doc.width, doc.height, lassoPts);
            const feather = useProStore.getState().selFeather;
            if (feather > 0) featherSelection(feather);
            setLassoPts([]);
            window.dispatchEvent(new Event("avero:selection-changed"));
          }
        }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            // zoom to cursor: keep doc point under pointer stable
            e.preventDefault();
            const canvas = canvasRef.current;
            const wrap = wrapRef.current;
            if (!canvas || !wrap) return;
            const rect = canvas.getBoundingClientRect();
            const s0 = zoom / 100;
            const z1 = Math.max(10, Math.min(800, zoom + (e.deltaY < 0 ? 10 : -10)));
            if (z1 === zoom) return;
            const s1 = z1 / 100;
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const dw0 = doc.width * s0;
            const dh0 = doc.height * s0;
            const ox0 = (rect.width - dw0) / 2 + panX;
            const oy0 = (rect.height - dh0) / 2 + panY;
            const dx = (mx - ox0) / s0;
            const dy = (my - oy0) / s0;
            const dw1 = doc.width * s1;
            const dh1 = doc.height * s1;
            const ox1 = (rect.width - dw1) / 2;
            const oy1 = (rect.height - dh1) / 2;
            setZoom(z1);
            setPan(mx - ox1 - dx * s1, my - oy1 - dy * s1);
          } else if (e.shiftKey) {
            setPan(panX - e.deltaY, panY);
          } else {
            setPan(panX - e.deltaX, panY - e.deltaY);
          }
        }}
        onMouseDown={async (e) => {
          if (e.button === 1 || tool === "pan" || tool === "hand" || tool === "rotate-view") {
            panning.current = { sx: e.clientX, sy: e.clientY, px: panX, py: panY };
            return;
          }
          const p = toDocCoords(e);
          if (tool === "move" || tool === "path-select" || tool === "direct-select") {
            // prefer Photoshop-style guide drag when hitting a line
            if (showGuides) {
              const thr = 7 / (zoom / 100);
              let bestKind: "h" | "v" = "v";
              let bestIndex = -1;
              let bestD = Infinity;
              for (let i = 0; i < guidesV.length; i++) {
                const d = Math.abs(p.x - guidesV[i]);
                if (d < thr && d < bestD) {
                  bestD = d;
                  bestKind = "v";
                  bestIndex = i;
                }
              }
              for (let i = 0; i < guidesH.length; i++) {
                const d = Math.abs(p.y - guidesH[i]);
                if (d < thr && d < bestD) {
                  bestD = d;
                  bestKind = "h";
                  bestIndex = i;
                }
              }
              if (bestIndex >= 0) {
                guideDrag.current = { kind: bestKind, index: bestIndex };
                return;
              }
            }
            const t = transforms[activeLayerId ?? ""];
            moveDrag.current = { sx: e.clientX, sy: e.clientY, ox: t?.x ?? 0, oy: t?.y ?? 0 };
            return;
          }
          if (isCrop) {
            setCropDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "gradient") {
            setGradDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if ((tool as ToolId) === ("gradient-radial" as ToolId)) {
            gradientFillAt(p.x, p.y, true);
            return;
          }
          if (tool === "select-rect" || tool === "select-ellipse" || tool === "single-row" || tool === "single-column") {
            if (tool === "single-row") setSelDrag({ x0: 0, y0: p.y, x1: doc.width, y1: p.y + 1 });
            else if (tool === "single-column") setSelDrag({ x0: p.x, y0: 0, x1: p.x + 1, y1: doc.height });
            else setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "select-polygon") {
            setLassoPts((pts) => [...pts.slice(-800), { x: p.x, y: p.y }]);
            return;
          }
          if (tool === "quick-select" || tool === "object-select") {
            handleWandClick(p);
            try {
              const { expandContractSelection } = await import("../engine/selection");
              expandContractSelection(tool === "object-select" ? Math.max(2, Math.round(brushSize / 6)) : Math.max(1, Math.round(brushSize / 8)));
              window.dispatchEvent(new Event("avero:selection-changed"));
            } catch { /* ignore */ }
            return;
          }
          if (tool === "frame") {
            createShapeLayer("rect", 4, "Frame");
            return;
          }
          if (tool === "artboard") {
            createShapeLayer("rect", 4, "Artboard");
            return;
          }
          if (tool === "slice" || tool === "slice-select") {
            setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (isEyedropper) {
            pickColor(p);
            return;
          }
          if (isClone) {
            if (e.altKey) {
              cloneRef.current = { x: p.x, y: p.y };
              cloneOrigin.current = null;
              setCursor(`Source ${Math.round(p.x)}, ${Math.round(p.y)}`);
              return;
            }
            const snap = layerManager.snapshot(activeLayerId ?? "");
            if (snap && activeLayerId) {
              pushHistory({ label: "Clone stamp", layerId: activeLayerId, snapshot: snap });
            }
            setIsPainting(true);
            lastPos.current = null;
            cloneOrigin.current = null;
            cloneTo(p.x, p.y);
            return;
          }
          if (tool === "select-lasso") {
            setLassoPts([{ x: p.x, y: p.y }]);
            return;
          }
          if (tool === "wand") {
            handleWandClick(p);
            return;
          }
          if (tool === "text" || tool === "text-vertical") {
            createTextLayer(p, undefined, tool === "text-vertical");
            return;
          }
          if (tool === "note") {
            const t = await askText("Add Note", "Note text:", "");
            if (t) createTextLayer(p, t);
            return;
          }
          if (tool === "count") {
            setCountN((n) => n + 1);
            setCursor(`Count ${countN + 1} at ${Math.round(p.x)}, ${Math.round(p.y)}`);
            return;
          }
          if (tool === "shape-rect") {
            setShapeDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind: "rect" });
            return;
          }
          if (tool === "shape-ellipse") {
            setShapeDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind: "ellipse" });
            return;
          }
          if (tool === "triangle-shape") {
            setShapeDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind: "triangle" });
            return;
          }
          if (tool === "shape-polygon" || tool === "shape-line" || tool === "shape-custom" || tool === "shape-star" || tool === "shape-arrow") {
            setShapeDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind: tool });
            return;
          }
          if (tool === "ruler") {
            setMeasureDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "fill" || tool === "content-fill") {
            if (tool === "content-fill") {
              const st0 = useEditorStore.getState();
              const snap0 = layerManager.snapshot(activeLayerId ?? "");
              if (snap0 && activeLayerId) pushHistory({ label: "Content fill", layerId: activeLayerId, snapshot: snap0 });
              retouchTo(p.x, p.y, "content-fill");
              st0.markDirty();
              bumpHistogram();
            } else floodFillAt(p.x, p.y);
            return;
          }
          if (tool === "gradient-radial") {
            gradientFillAt(p.x, p.y, true);
            return;
          }
          if (tool === "pen" || tool === "line" || tool === "curvature-pen") {
            setPenDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          const distort = tool === "liquify" || tool === "warp";
          const isTone = tool === "dodge" || tool === "burn" || tool === "sponge" || tool === "vibrance-brush";
          const isDetail = tool === "blur" || tool === "blur-iris" || tool === "sharpen" || tool === "sharpen-edge" || tool === "smudge" || tool === "noise-reduction";
          if (
            isBrush ||
            isEraser ||
            isTone ||
            isDetail ||
            distort ||
            isHeal
          ) {
            const snap = layerManager.snapshot(activeLayerId ?? "");
            const maskSnap = paintMask ? layerManager.snapshotMask(activeLayerId ?? "") : null;
            if (snap && activeLayerId) {
              const labels: Record<string, string> = {
                brush: "Brush stroke",
                eraser: "Eraser",
                dodge: "Dodge",
                burn: "Burn",
                sponge: "Sponge",
                blur: "Blur",
                sharpen: "Sharpen",
                smudge: "Smudge",
                "spot-heal": "Spot heal",
              };
              pushHistory({
                label: paintMask ? "Paint mask" : (labels[tool] ?? tool),
                layerId: activeLayerId,
                snapshot: snap,
                maskSnapshot: maskSnap,
              });
            }
            setIsPainting(true);
            lastPos.current = null;
            if (tool === "smudge" || distort) pickSmudgeColor(p);
            // Alt sets heal source for healing-brush / patch (does not paint)
            if (needsHealSource && e.altKey) {
              healRef.current = { x: p.x, y: p.y };
              setCursor(`Heal source ${Math.round(p.x)}, ${Math.round(p.y)}`);
              setIsPainting(false);
              return;
            }
            // capture history source BEFORE this stroke mutates pixels
            if (tool === "history-brush" || tool === "art-history-brush") {
              historySource.current = snap ?? null;
            }
            if (isBrush || isEraser) paintTo(p.x, p.y, isEraser);
            else if ((tool as string) === "blur-iris") retouchTo(p.x, p.y, "blur-iris");
            else if ((tool as string) === "sharpen-edge") retouchTo(p.x, p.y, "sharpen-edge");
            else if ((tool as string) === "vibrance-brush") retouchTo(p.x, p.y, "vibrance");
            else if ((tool as string) === "noise-reduction") retouchTo(p.x, p.y, "noise");
            else if (tool === "healing-brush" || tool === "patch") retouchTo(p.x, p.y, "heal-source");
            else if (tool === "red-eye") retouchTo(p.x, p.y, "red-eye");
            else if (tool === "content-move") retouchTo(p.x, p.y, "content-move");
            else
              retouchTo(
                p.x,
                p.y,
                (distort ? "smudge" : tool) as "dodge" | "burn" | "sponge" | "vibrance" | "blur" | "blur-iris" | "sharpen" | "sharpen-edge" | "smudge" | "heal" | "heal-source" | "red-eye" | "content-move" | "noise" | "content-fill",
              );
            if (tool === "spot-heal") retouchTo(p.x, p.y, "heal");
            setCursor(`${Math.round(p.x)}, ${Math.round(p.y)}`);
          }
          if (tool === "zoom") {
            setZoom(e.altKey ? zoom - 25 : zoom + 25);
          }
        }}
        onMouseMove={(e) => {
          const p = toDocCoords(e);
          setCursor(`${Math.round(p.x)}, ${Math.round(p.y)}`);
          // brush ring follows pointer in screen space (hidden while panning)
          if (!panning.current && showBrushRing) {
            const wrap = wrapRef.current;
            if (wrap) {
              const r = wrap.getBoundingClientRect();
              setRing({ x: e.clientX - r.left, y: e.clientY - r.top });
            }
          } else if (panning.current) {
            setRing(null);
          }
          if (panning.current) {
            setPan(
              panning.current.px + (e.clientX - panning.current.sx),
              panning.current.py + (e.clientY - panning.current.sy),
            );
            return;
          }
          if (moveDrag.current && activeLayerId) {
            const s = zoom / 100;
            let dx = (e.clientX - moveDrag.current.sx) / s;
            let dy = (e.clientY - moveDrag.current.sy) / s;
            const pro0 = useProStore.getState();
            // Photoshop-style snap: to guides + grid + document center
            if (pro0.snapEnabled && !e.altKey) {
              const thr = 10 / s + 3;
              let nx = moveDrag.current.ox + dx;
              let ny = moveDrag.current.oy + dy;
              // snap to guides (layer center position)
              const cx = doc.width / 2 + nx;
              const cy = doc.height / 2 + ny;
              for (const gx of pro0.guidesV) {
                if (Math.abs(cx - gx) < thr) {
                  nx = gx - doc.width / 2;
                  break;
                }
              }
              for (const gy of pro0.guidesH) {
                if (Math.abs(cy - gy) < thr) {
                  ny = gy - doc.height / 2;
                  break;
                }
              }
              // snap to grid
              if (pro0.showGrid) {
                const gs = pro0.gridSize;
                const sx = Math.round(cx / gs) * gs;
                const sy = Math.round(cy / gs) * gs;
                if (Math.abs(cx - sx) < thr) nx = sx - doc.width / 2;
                if (Math.abs(cy - sy) < thr) ny = sy - doc.height / 2;
              }
              // snap to document center
              if (Math.abs(nx) < thr) nx = 0;
              if (Math.abs(ny) < thr) ny = 0;
              dx = nx - moveDrag.current.ox;
              dy = ny - moveDrag.current.oy;
              if (Math.abs(dx - (e.clientX - moveDrag.current.sx) / s) > 0.5) {
                setCursor(`Snap ${Math.round(nx)}, ${Math.round(ny)}`);
              }
            }
            useProStore.getState().ensureTransform(activeLayerId);
            useProStore.getState().updateTransform(activeLayerId, {
              x: moveDrag.current.ox + dx,
              y: moveDrag.current.oy + dy,
            });
            return;
          }
          if (guideDrag.current) {
            const pro = useProStore.getState();
            if (guideDrag.current.kind === "v")
              pro.moveGuide("v", guideDrag.current.index, Math.round(Math.max(0, Math.min(doc.width, p.x))));
            else
              pro.moveGuide("h", guideDrag.current.index, Math.round(Math.max(0, Math.min(doc.height, p.y))));
            return;
          }
          if (cropDrag) {
            setCropDrag({ ...cropDrag, x1: p.x, y1: p.y });
            return;
          }
          if (gradDrag) {
            let x1 = p.x;
            let y1 = p.y;
            if (e.shiftKey) {
              // lock angle at 45 degrees
              const dx = x1 - gradDrag.x0;
              const dy = y1 - gradDrag.y0;
              const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
              const len = Math.hypot(dx, dy);
              x1 = gradDrag.x0 + Math.cos(ang) * len;
              y1 = gradDrag.y0 + Math.sin(ang) * len;
            }
            setGradDrag({ ...gradDrag, x1, y1 });
            return;
          }
          if (selDrag) {
            setSelDrag({ ...selDrag, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "select-lasso" && lassoPts.length > 0 && e.buttons === 1) {
            setLassoPts((pts) => [...pts.slice(-800), { x: p.x, y: p.y }]);
            return;
          }
          if (measureDrag) {
            setMeasureDrag({ ...measureDrag, x1: p.x, y1: p.y });
            return;
          }
          if (penDrag) {
            let x1 = p.x;
            let y1 = p.y;
            if (tool === "line" && e.shiftKey) {
              const dx = x1 - penDrag.x0;
              const dy = y1 - penDrag.y0;
              const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
              const len = Math.hypot(dx, dy);
              x1 = penDrag.x0 + Math.cos(ang) * len;
              y1 = penDrag.y0 + Math.sin(ang) * len;
            }
            setPenDrag({ ...penDrag, x1, y1 });
            return;
          }
          if (shapeDrag) {
            setShapeDrag({ ...shapeDrag, x1: p.x, y1: p.y });
            return;
          }
          if (isPainting) {
            if (isClone) cloneTo(p.x, p.y);
            else if (isBrush || isEraser) paintTo(p.x, p.y, isEraser);
            else if (tool === "smudge" || tool === "liquify" || tool === "warp") {
              retouchTo(p.x, p.y, "smudge");
            } else if ((tool as string) === "blur-iris") retouchTo(p.x, p.y, "blur-iris");
            else if ((tool as string) === "sharpen-edge") retouchTo(p.x, p.y, "sharpen-edge");
            else if ((tool as string) === "vibrance-brush") retouchTo(p.x, p.y, "vibrance");
            else if ((tool as string) === "noise-reduction") retouchTo(p.x, p.y, "noise");
            else if (tool === "healing-brush" || tool === "patch") retouchTo(p.x, p.y, "heal-source");
            else if (tool === "red-eye") retouchTo(p.x, p.y, "red-eye");
            else if (tool === "content-move") retouchTo(p.x, p.y, "content-move");
            else if (
              tool === "dodge" ||
              tool === "burn" ||
              tool === "sponge" ||
              tool === "blur" ||
              tool === "sharpen" ||
              tool === "spot-heal" ||
              tool === "content-fill"
            ) {
              retouchTo(p.x, p.y, tool === "spot-heal" ? "heal" : tool);
            }
          }
        }}
        onMouseUp={() => {
          if (penDrag) {
            const dx = penDrag.x1 - penDrag.x0;
            const dy = penDrag.y1 - penDrag.y0;
            if (Math.hypot(dx, dy) > 3) applyPenLine(penDrag.x0, penDrag.y0, penDrag.x1, penDrag.y1);
            setPenDrag(null);
          }
          if (gradDrag) {
            const dx = gradDrag.x1 - gradDrag.x0;
            const dy = gradDrag.y1 - gradDrag.y0;
            if (Math.hypot(dx, dy) > 6) applyGradient(gradDrag.x0, gradDrag.y0, gradDrag.x1, gradDrag.y1);
            setGradDrag(null);
          }
          if (measureDrag) {
            const dx = measureDrag.x1 - measureDrag.x0;
            const dy = measureDrag.y1 - measureDrag.y0;
            const dist = Math.hypot(dx, dy);
            const ang = (Math.atan2(-dy, dx) * 180) / Math.PI;
            if (dist > 1) setCursor(`Distance ${dist.toFixed(1)} px | ${ang.toFixed(1)} deg`);
            setMeasureDrag(null);
          }
          if (guideDrag.current) guideDrag.current = null;
          if (selDrag) {
            const r = {
              x: selDrag.x0,
              y: selDrag.y0,
              w: selDrag.x1 - selDrag.x0,
              h: selDrag.y1 - selDrag.y0,
            };
            if (Math.abs(r.w) > 4 && Math.abs(r.h) > 4) {
              if (tool === "select-ellipse") drawEllipseSelection(doc.width, doc.height, r);
              else drawRectSelection(doc.width, doc.height, r);
              const feather = useProStore.getState().selFeather;
              if (feather > 0) featherSelection(feather);
            }
            setSelDrag(null);
          }
          if (lassoPts.length > 2 && (tool === "select-lasso" || tool === "select-polygon")) {
            drawLassoSelection(doc.width, doc.height, lassoPts);
            setLassoPts([]);
          } else if (tool === "select-lasso" || tool === "select-polygon") {
            if (tool === "select-lasso") setLassoPts([]);
            // polygon keeps points until double-click closes
          }
          if (shapeDrag) {
            const w = Math.abs(shapeDrag.x1 - shapeDrag.x0);
            const h = Math.abs(shapeDrag.y1 - shapeDrag.y0);
            if (w > 6 && h > 6) {
              const kind = shapeDrag.kind;
              if (kind === "rect") createShapeLayer("rect");
              else if (kind === "ellipse") createShapeLayer("ellipse");
              else if (kind === "triangle") createShapeLayer("polygon", 3);
              else createShapeLayer("polygon", kind === "shape-star" ? 5 : 6);
              // move the new shape to drag origin via transform
              const st = useEditorStore.getState();
              const nid = st.activeLayerId;
              if (nid) {
                useProStore.getState().updateTransform(nid, {
                  x: Math.min(shapeDrag.x0, shapeDrag.x1) - doc.width / 2,
                  y: Math.min(shapeDrag.y0, shapeDrag.y1) - doc.height / 2,
                  scaleX: Math.max(0.05, w / Math.max(1, doc.width)),
                  scaleY: Math.max(0.05, h / Math.max(1, doc.height)),
                  rotation: 0,
                });
              }
            }
            setShapeDrag(null);
          }
          if (moveDrag.current) {
            moveDrag.current = null;
            markDirty();
            bumpHistogram();
          }
          setIsPainting(false);
          lastPos.current = null;
          panning.current = null;
          cloneOrigin.current = null;
          if (isPainting) bumpHistogram();
        }}
        onMouseLeave={() => {
          setIsPainting(false);
          lastPos.current = null;
          panning.current = null;
          moveDrag.current = null;
          cloneOrigin.current = null;
          smudgeColor.current = null;
          setRing(null);
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            cursor:
              tool === "pan" || tool === "hand" || tool === "rotate-view"
                ? "grab"
                : tool === "brush" ||
                    tool === "pencil" ||
                    tool === "eraser" ||
                    tool === "clone" ||
                    tool === "eyedropper" ||
                    tool === "spot-heal" ||
                    tool === "healing-brush" ||
                    tool === "patch" ||
                    tool === "content-move" ||
                    tool === "pattern-stamp" ||
                    tool === "history-brush" ||
                    tool === "art-history-brush" ||
                    tool === "color-replacement" ||
                    tool === "mixer-brush" ||
                    tool === "background-eraser" ||
                    tool === "magic-eraser" ||
                    tool === "liquify" ||
                    tool === "warp" ||
                    tool === "blur" ||
                    tool === "sharpen" ||
                    tool === "smudge" ||
                    tool === "dodge" ||
                    tool === "burn" ||
                    tool === "sponge" ||
                    tool === "fill" ||
                    tool === "pen" ||
                    tool === "line" ||
                    tool === "ruler" ||
                    tool === "note" ||
                    tool === "count"
                  ? "crosshair"
                  : tool === "select-rect" ||
                      tool === "select-ellipse" ||
                      tool === "select-lasso" ||
                      tool === "wand" ||
                      tool === "select-polygon" ||
                      tool === "quick-select" ||
                      tool === "object-select"
                    ? "crosshair"
                    : tool === "text" || tool === "text-vertical"
                      ? "text"
                      : "default",
          }}
        />
        {showRulers && (
          <canvas
            ref={vRulerRef}
            className="absolute left-0 top-0 z-10 h-full w-[18px] cursor-ns-resize"
            onMouseDown={(e) => {
              e.stopPropagation();
              startRulerDrag("v", e);
            }}
          />
        )}
        <ToolOptionsBar onApplyCrop={applyCrop} onCancelCrop={() => setCropDrag(null)} />
        {/* Bottom-left HUD: position and tool info */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/65 px-2.5 py-1.5 font-mono text-[10px] text-white/75 shadow-lg backdrop-blur-md">
          <span className="rounded bg-[#2f7cf6] px-1.5 py-0.5 font-semibold text-white">{TOOL_LABEL[tool] ?? tool}</span>
          <span className="tabular-nums">{cursor}</span>
          <span className="text-white/40">|</span>
          <span className="tabular-nums text-white/60">
            {doc.width} x {doc.height}
          </span>
          {hasSelection() && (
            <>
              <span className="text-white/40">|</span>
              <span className="rounded bg-[#d9a441]/20 px-1.5 py-0.5 text-[#f0c674]">Selection active</span>
            </>
          )}
          {countN > 0 && (
            <>
              <span className="text-white/40">|</span>
              <span className="rounded bg-[#5a30ff]/25 px-1.5 py-0.5 text-[#b9a8ff]">Count {countN}</span>
            </>
          )}
          {paintMask && (
            <>
              <span className="text-white/40">|</span>
              <span className="rounded bg-[#2f7cf6]/20 px-1.5 py-0.5 text-[#8fb6f5]">Mask paint</span>
            </>
          )}
        </div>

        {/* Bottom-right zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-0.5 overflow-hidden rounded-lg border border-white/10 bg-black/70 p-1 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setZoom(Math.max(1, zoom - 25))}
            className="grid h-6 w-6 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white"
            title="Zoom out (Ctrl+-)"
          >
            -
          </button>
          <button
            onClick={() => setZoom(100)}
            className="min-w-[46px] rounded px-1 py-0.5 font-mono text-[10px] tabular-nums text-white/85 hover:bg-white/10 hover:text-white"
            title="Zoom 100% (Ctrl+1)"
          >
            {zoom}%
          </button>
          <button
            onClick={() => setZoom(Math.min(400, zoom + 25))}
            className="grid h-6 w-6 place-items-center rounded text-white/70 hover:bg-white/10 hover:text-white"
            title="Zoom in (Ctrl++)"
          >
            +
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            onClick={() => window.dispatchEvent(new Event("avero:fit-zoom"))}
            className="rounded px-2 py-0.5 font-mono text-[10px] text-white/70 hover:bg-white/10 hover:text-white"
            title="Fit to screen"
          >
            Fit
          </button>
        </div>
        {dragging && (
          <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-lg border-2 border-dashed border-[#2f7cf6] bg-[#2f7cf6]/10">
            <div className="rounded bg-black/70 px-4 py-2 text-[13px] text-white">
              Release to open image
            </div>
          </div>
        )}
        {/* Brush cursor ring: true-size preview for paint/retouch tools */}
        {ring && showBrushRing && !isPainting && (
          <div
            className="pointer-events-none absolute z-20 rounded-full border-[1.5px] border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
            style={{
              left: ring.x - (brushSize * (zoom / 100)) / 2,
              top: ring.y - (brushSize * (zoom / 100)) / 2,
              width: Math.max(4, brushSize * (zoom / 100)),
              height: Math.max(4, brushSize * (zoom / 100)),
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
          </div>
        )}
        {isFresh && !dragging && (
          <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-lg bg-black/65 px-4 py-2.5 text-center text-[12px] text-[#c9c9d1]">
            <span className="font-semibold text-white">Drag image here</span> to start, or
            press{" "}
            <span className="rounded bg-[#2c2c31] px-1.5 py-0.5 font-mono text-[11px]">Ctrl+K</span>{" "}
            then Open image
          </div>
        )}
      </div>
    </div>
  );
}
