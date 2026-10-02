import { useEffect, useRef, useState } from "react";
import { useEditorStore, makeLayer, type ToolId } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useArtboardStore } from "../stores/useArtboardStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { fitZoom } from "../engine/canvasMath";
import {
  clearSelectionMask,
  colorRangeSelection,
  drawEllipseSelection,
  drawLassoSelection,
  drawRectSelection,
  drawRoundedRectSelection,
  expandContractSelection,
  featherSelection,
  hasSelection,
  inverseSelection,
  isPointInSelection,
  restoreLastSelection,
  selectionMaskCanvas,
  wandFromImage,
  type SelCombineMode,
} from "../engine/selection";
import { applyAdjustmentToImageData, applyRawDevelop } from "../engine/adjustments";
import { fitThumb, panForCenter, viewportRect } from "../engine/viewport";
import { applyFilterToCanvas } from "../engine/filters";
import { applySoftProof, convertWorkingSpace } from "../engine/color";
import { renderShapeToLayer, renderTextFxToLayer } from "../engine/textShape";
import {
  CROP_OVERLAY_TOOLS,
  CROP_RATIOS,
  ERASER_TOOLS,
  IS_CROP_TOOL,
  IS_SHAPE_TOOL,
  SHAPE_KIND_OF,
  distortOf,
  isPaintTool,
  paintPreset,
  penStyleOf,
  retouchModeOf,
  RETOUCH_TWEAK,
  type CropOverlayKind,
  type DistortKind,
  type RetouchMode,
} from "../engine/toolPresets";
import { isPaintEraser, needsFreshPaintLayer, resolveEraserTarget } from "../engine/strokeTarget";
import {
  blendToComposite,
  clearRenderCaches,
  drawCheckerboard,
  drawDocBacking,
  drawWorkspaceBackground,
} from "../engine/canvasRender";
import { gpuBackend, gpuBackendSyncFallback } from "../io/gpuBackend";
import ToolOptionsBar from "./ToolOptionsBar";
import { TOOL_LABEL } from "./ToolBar";
import { askText, notify } from "../ui/notify";

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

// Small scratch-canvas pool for per-dab temp surfaces in the brush engines.
// Reuses a handful of canvases instead of allocating (and GC-ing) one per dab.
const scratchPool: HTMLCanvasElement[] = [];
function getScratch(w: number, h: number): HTMLCanvasElement {
  for (let i = 0; i < scratchPool.length; i++) {
    const c = scratchPool[i];
    if (c.width === w && c.height === h) {
      scratchPool.splice(i, 1);
      const g = c.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.filter = "none";
      g.clearRect(0, 0, w, h);
      return c;
    }
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function releaseScratch(c: HTMLCanvasElement) {
  if (scratchPool.length < 8) scratchPool.push(c);
}

// Navigator minimap (Photoshop Navigator / Figma minimap): live thumbnail,
// viewport rectangle, click/drag to pan. Tool-independent, store-driven.
function Navigator({ wrapW, wrapH }: { wrapW: number; wrapH: number }) {
  const doc = useEditorStore((s) => s.doc);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const layers = useEditorStore((s) => s.layers);
  const tick = useProStore((s) => s.histogramTick);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(true);
  const { w: tw, h: th } = fitThumb(doc.width, doc.height, 168, 112);
  useEffect(() => {
    const c = thumbRef.current;
    if (!c) return;
    c.width = tw;
    c.height = th;
    const g = c.getContext("2d");
    if (!g) return;
    g.fillStyle = "#101012";
    g.fillRect(0, 0, tw, th);
    try {
      const comp = getCompositeCanvas();
      if (comp && comp.width > 0 && comp.height > 0) g.drawImage(comp, 0, 0, tw, th);
    } catch {
      /* fresh document, keep empty backdrop */
    }
  }, [tick, layers.length, doc.width, doc.height, tw, th]);
  if (wrapW < 10 || wrapH < 10) return null;
  const vr = viewportRect(wrapW, wrapH, doc.width, doc.height, zoom, panX, panY);
  const kx = tw / Math.max(1, doc.width);
  const ky = th / Math.max(1, doc.height);
  const panTo = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect();
    const dx = ((clientX - r.left) / Math.max(1, r.width)) * doc.width;
    const dy = ((clientY - r.top) / Math.max(1, r.height)) * doc.height;
    const np = panForCenter(wrapW, wrapH, doc.width, doc.height, zoom, dx, dy);
    useEditorStore.getState().setPan(np.panX, np.panY);
  };
  return (
    <div className="avero-fade-in absolute bottom-16 right-3 z-20 overflow-hidden rounded-md border border-[#2c2c31] bg-[#1c1c1f]">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6e6e78]">Navigator</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded px-1.5 font-mono text-[11px] text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
          title={open ? "Collapse navigator" : "Expand navigator"}
        >
          {open ? "-" : "+"}
        </button>
      </div>
      {open && (
        <div className="relative" style={{ width: tw, height: th }}>
          <canvas
            ref={thumbRef}
            style={{ width: tw, height: th }}
            className="block cursor-move"
            title="Drag to pan the canvas"
            onMouseDown={(e) => {
              e.stopPropagation();
              const el = e.currentTarget;
              panTo(e.clientX, e.clientY, el);
              const onMove = (ev: MouseEvent) => panTo(ev.clientX, ev.clientY, el);
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />
          <div
            className="pointer-events-none absolute rounded-[1px] border border-red-500/90 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
            style={{
              left: Math.max(0, vr.x * kx),
              top: Math.max(0, vr.y * ky),
              width: Math.max(4, Math.min(tw, vr.w * kx)),
              height: Math.max(4, Math.min(th, vr.h * ky)),
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function CanvasArea() {
  const wrapRef = useRef<HTMLDivElement>(null);  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  // Viewport size for the Navigator minimap (ResizeObserver, cheap single subscription).
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setViewSize((v) => (v.w === Math.round(r.width) && v.h === Math.round(r.height) ? v : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [measureDrag, setMeasureDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [lassoPts, setLassoPts] = useState<{ x: number; y: number }[]>([]);
  const [ants, setAnts] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const moveDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const spriteCache = useRef(new Map<string, HTMLCanvasElement>());
  // Clone offset origin stays a local ref (per-stroke math), but the source
  // point lives in the pro store so the top bar can show and clear it.
  const cloneOrigin = useRef<{ x: number; y: number } | null>(null);
  const historySource = useRef<ImageData | null>(null);
  const paintLayerToastShown = useRef(false);
  const cloneHintShown = useRef(false);
  const healHintShown = useRef(false);
  const lastPaintRef = useRef<string | null>(null);
  const [penDrag, setPenDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [shapeDrag, setShapeDrag] = useState<{ x0: number; y0: number; x1: number; y1: number; kind: string } | null>(null);
  const [sliceDrag, setSliceDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const smudgeColor = useRef<string | null>(null);
  const rotateStart = useRef<{ x: number; rot: number } | null>(null);
  const directStart = useRef<{ x: number; rotation: number; layerId: string } | null>(null);
  const sliceMove = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number } | null>(null);
  const tripleChain = useRef<{ x: number; y: number } | null>(null);
  // plan3 Fase 3.5: last wand dab for quick/object-select brush painting,
  // throttles full-image floods while dragging.
  const quickLast = useRef<{ x: number; y: number } | null>(null);
  // Per-stroke selection snapshot: isPointInSelection() costs a 1x1 getImageData
  // per dab, so brush strokes snapshot the mask once at stroke start and read
  // from RAM via inSel(). Captured at every setIsPainting(true) site.
  const strokeSelCache = useRef<{ data: Uint8ClampedArray; w: number; h: number } | null>(null);
  // Pre-rendered history-source canvas for the history brushes (built once per
  // stroke instead of rebuilding ImageData->canvas on every dab).
  const historyCanvas = useRef<HTMLCanvasElement | null>(null);
  function inSel(x: number, y: number): boolean {
    const sc = strokeSelCache.current;
    if (!sc) return isPointInSelection(x, y);
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= sc.w || iy >= sc.h) return false;
    return sc.data[(iy * sc.w + ix) * 4 + 3] > 10;
  }
  function captureStrokeSel() {
    strokeSelCache.current = null;
    try {
      const sel = selectionMaskCanvas();
      if (sel && hasSelection()) {
        const g = sel.getContext("2d", { willReadFrequently: true });
        if (!g) return;
        const id = g.getImageData(0, 0, sel.width, sel.height);
        strokeSelCache.current = { data: id.data, w: sel.width, h: sel.height };
      }
    } catch {
      strokeSelCache.current = null;
    }
  }
  function clearStrokeSel() {
    strokeSelCache.current = null;
    historyCanvas.current = null;
  }

  const doc = useEditorStore((s) => s.doc);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId ?? s.layers[s.layers.length - 1]?.id);
  const tool = useEditorStore((s) => s.tool);
  // Every ToolId has a real behavior via toolPresets registry, no dead tools.
  const isBrush = isPaintTool(tool);
  // Single source of truth for the eraser set (plan2 Fase B).
  const isEraser = ERASER_TOOLS.has(tool);
  const isHeal =
    tool === "spot-heal" || tool === "healing-brush" || tool === "patch" || tool === "red-eye" ||
    tool === "content-move" || tool === "content-fill" ||
    tool === "heal-dust" || tool === "heal-wrinkle" || tool === "heal-blemish" ||
    tool === "heal-sky" || tool === "heal-skin" || tool === "heal-object" ||
    tool === "heal-freckle" || tool === "heal-eye" || tool === "heal-teeth";
  const needsHealSource = tool === "healing-brush" || tool === "patch";
  const isClone =
    tool === "clone" || tool === "pattern-stamp" || tool === "texture-stamp" ||
    tool === "clone-mirror" || tool === "clone-rotate" || tool === "pattern-fill" ||
    tool === "clone-soft" || tool === "pattern-dots";
  const isEyedropper = tool === "eyedropper" || tool === "color-sampler" || tool === "sampler-avg" || tool === "sampler-3x3" || tool === "sampler-11x11";
  const isCrop = (IS_CROP_TOOL as Set<string>).has(tool);
  const retouchMode = retouchModeOf(tool);
  const distortKind = distortOf(tool);
  const isLocalFx = retouchMode !== null;
  const isDistort = distortKind !== null;
  const isShapeTool = (IS_SHAPE_TOOL as Set<string>).has(tool);
  const showBrushRing =
    isBrush || isEraser || isLocalFx || isDistort ||
    tool === "dodge" || tool === "burn" || tool === "sponge" || tool === "vibrance-brush" ||
    tool === "blur" || tool === "blur-iris" || tool === "sharpen" || tool === "sharpen-edge" || tool === "smudge" ||
    tool === "noise-reduction" || isHeal || isClone || tool === "liquify" || tool === "warp";
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const viewRotate = useEditorStore((s) => s.viewRotate);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const setViewRotate = useEditorStore((s) => s.setViewRotate);
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
  const cropOverlay = useProStore((s) => s.cropOverlay);
  const historyLen = useEditorStore((s) => s.history.length);
  const isFresh = !doc.filePath && historyLen === 0;
  const guidesH = useProStore((s) => s.guidesH);
  const guidesV = useProStore((s) => s.guidesV);
  const showGuides = useProStore((s) => s.showGuides);
  const showGrid = useProStore((s) => s.showGrid);
  const gridSize = useProStore((s) => s.gridSize);
  const slices = useProStore((s) => s.slices);
  const activeSliceId = useProStore((s) => s.activeSliceId);
  const notes = useProStore((s) => s.notes);
  const counts = useProStore((s) => s.counts);
  const samplers = useProStore((s) => s.samplers);
  const measures = useProStore((s) => s.measures);

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
    clearRenderCaches();
  }, [doc.width, doc.height]);

  // Warm GPU backend cache once (WebGPU Vulkan/D3D12/Metal or WebGL2/OpenGL).
  // Non-blocking: render uses sync fallback until probe resolves, then DPR/tile
  // caps tighten automatically on next frame with zero extra RAM.
  useEffect(() => {
    let alive = true;
    void gpuBackend().then(() => {
      if (!alive) return;
      // trigger one lightweight re-render with correct DPR cap
      useEditorStore.getState().markDirty();
    });
    return () => {
      alive = false;
    };
  }, []);

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

  // Non-destructive composite render (ultra-light):
  // - DPR capped by GPU backend (CPU=1.5, WebGL=1.75, WebGPU=2)
  // - canvas backing only resized when size changes (no per-frame realloc)
  // - workspace backdrop cached offscreen; checkerboard via pattern
  // - no per-frame shadowBlur (cached strokes instead)
  // - rAF-coalesced via React effect (one composite per commit)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dprCap = gpuBackendSyncFallback().dprCap || 1.5;
    const sysDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(dprCap, sysDpr, doc.width * doc.height > 8000 * 8000 ? 1 : dprCap);
    const wantW = Math.max(1, Math.floor(rect.width * dpr));
    const wantH = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorkspaceBackground(ctx, rect.width, rect.height, dpr);

    const s = zoom / 100;
    const dw = doc.width * s;
    const dh = doc.height * s;
    const ox = (rect.width - dw) / 2 + panX;
    const oy = (rect.height - dh) / 2 + panY;


    // document backing: cheap cached edge (no shadowBlur) + pattern checker
    drawDocBacking(ctx, ox, oy, dw, dh);
    drawCheckerboard(ctx, ox, oy, dw, dh);

    // 1. Composite layers to doc-size offscreen (pooled: no alloc per frame)
    const comp = getPooledComp(Math.max(1, doc.width), Math.max(1, doc.height));
    const cctx = comp.getContext("2d", { willReadFrequently: true })!;
    cctx.clearRect(0, 0, comp.width, comp.height);
    // Real clipping-mask: clipped layer is cut by the composited alpha below it.
    let belowAlpha: HTMLCanvasElement | null = null;
    const clipScratch = getPooledComp(Math.max(1, doc.width), Math.max(1, doc.height));
    // NOTE: getPooledComp returns a shared canvas; use a second pool slot via
    // width+1 trick? Instead reuse layerManager pool by drawing through temp.
    // Simplest correct: track below via offscreen copy only when clipping used.
    const needsClip = layers.some((l) => l.visible && l.clipped);
    if (needsClip) {
      belowAlpha = document.createElement("canvas");
      belowAlpha.width = comp.width;
      belowAlpha.height = comp.height;
    }
    void clipScratch;
    layers.forEach((l) => {
      if (!l.visible) return;
      const m = masks[l.id];
      const src = layerManager.compositedWithMask(
        l.id,
        m?.feather ?? 0,
        m?.density ?? 100,
        !!m?.hasMask && !!m?.enabled,
      );
      if (!src) {
        if (needsClip && belowAlpha) {
          const bctx = belowAlpha.getContext("2d")!;
          bctx.drawImage(comp, 0, 0);
        }
        return;
      }
      const t = transforms[l.id];
      cctx.save();
      cctx.globalAlpha = Math.max(0, Math.min(1, l.opacity / 100));
      cctx.globalCompositeOperation = blendToComposite(l.blendMode);
      if (t && (t.x !== 0 || t.y !== 0 || t.scaleX !== 1 || t.scaleY !== 1 || t.rotation !== 0)) {
        cctx.translate(comp.width / 2 + t.x, comp.height / 2 + t.y);
        cctx.rotate((t.rotation * Math.PI) / 180);
        cctx.scale(t.scaleX, t.scaleY);
        cctx.translate(-comp.width / 2, -comp.height / 2);
      }
      if (l.clipped && belowAlpha) {
        // draw src to temp, cut by below alpha, then draw to comp
        const bctx = belowAlpha.getContext("2d")!;
        const tmp = document.createElement("canvas");
        tmp.width = comp.width;
        tmp.height = comp.height;
        const tctx = tmp.getContext("2d")!;
        tctx.drawImage(src, 0, 0);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(belowAlpha, 0, 0);
        cctx.drawImage(tmp, 0, 0);
        bctx.clearRect(0, 0, belowAlpha.width, belowAlpha.height);
        bctx.drawImage(comp, 0, 0);
      } else {
        cctx.drawImage(src, 0, 0);
        if (needsClip && belowAlpha) {
          const bctx = belowAlpha.getContext("2d")!;
          bctx.clearRect(0, 0, belowAlpha.width, belowAlpha.height);
          bctx.drawImage(comp, 0, 0);
        }
      }
      cctx.restore();
    });

    // Fast preview while painting: layers+mask+transform only (no per-frame
    // full-doc getImageData passes). Full quality (RAW/adjust/filter/color)
    // renders on mouse-up when isPainting flips false. Keeps low-spec smooth.
    let filtered: HTMLCanvasElement = comp;
    if (!isPainting) {
    // 2. RAW develop (neutral when default)
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
    }

    (window as any).__avero_comp = filtered;

    // 6. Draw to screen (with non-destructive view rotation)
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (viewRotate !== 0) {
      const cx = ox + dw / 2;
      const cy = oy + dh / 2;
      ctx.translate(cx, cy);
      ctx.rotate((viewRotate * Math.PI) / 180);
      ctx.drawImage(filtered, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(filtered, ox, oy, dw, dh);
    }
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
      if ((tool === "select-polygon" || tool === "magnetic-lasso") && lassoPts.length > 2) {
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
      // plan3 Fase 4.6: composition overlay guides inside the crop rect.
      if (cropOverlay !== "none" && wpx > 4 && hpx > 4) {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (cropOverlay === "thirds") {
          for (const f of [1 / 3, 2 / 3]) {
            ctx.moveTo(x + wpx * f, y);
            ctx.lineTo(x + wpx * f, y + hpx);
            ctx.moveTo(x, y + hpx * f);
            ctx.lineTo(x + wpx, y + hpx * f);
          }
        } else if (cropOverlay === "diagonal") {
          ctx.moveTo(x, y);
          ctx.lineTo(x + wpx, y + hpx);
          ctx.moveTo(x + wpx, y);
          ctx.lineTo(x, y + hpx);
        } else if (cropOverlay === "triangle") {
          ctx.moveTo(x, y);
          ctx.lineTo(x + wpx, y + hpx);
          ctx.moveTo(x + wpx, y);
          ctx.lineTo(x + wpx / 2, y + hpx);
          ctx.moveTo(x, y + hpx);
          ctx.lineTo(x + wpx / 2, y);
        } else if (cropOverlay === "spiral") {
          const cx = x + wpx / 2;
          const cy = y + hpx / 2;
          const maxR = Math.min(wpx, hpx) / 2;
          for (let i = 0; i <= 64; i++) {
            const t = i / 64;
            const r = maxR * t * t;
            const a = t * Math.PI * 3;
            const px2 = cx + Math.cos(a) * r;
            const py2 = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px2, py2);
            else ctx.lineTo(px2, py2);
          }
        } else if (cropOverlay === "center") {
          ctx.moveTo(x + wpx / 2, y);
          ctx.lineTo(x + wpx / 2, y + hpx);
          ctx.moveTo(x, y + hpx / 2);
          ctx.lineTo(x + wpx, y + hpx / 2);
        }
        ctx.stroke();
        if (cropOverlay === "center") {
          ctx.beginPath();
          ctx.arc(x + wpx / 2, y + hpx / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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
      const mlabel =
        tool === "measure-area"
          ? `${Math.abs(dx).toFixed(0)}x${Math.abs(dy).toFixed(0)} = ${(Math.abs(dx * dy) / 1000).toFixed(1)}k px2`
          : `${dist.toFixed(1)} px ${ang.toFixed(1)} deg`;
      ctx.fillText(mlabel, (mx1 + mx2) / 2 + 8, (my1 + my2) / 2 - 8);
      ctx.restore();
    }

    // Slices overlay (cyan) + active highlight
    if (slices.length > 0 || sliceDrag) {
      ctx.save();
      ctx.font = "10px JetBrains Mono, monospace";
      slices.forEach((sl) => {
        const x = ox + sl.x * s;
        const y = oy + sl.y * s;
        const w = sl.w * s;
        const h = sl.h * s;
        const active = sl.id === activeSliceId;
        ctx.strokeStyle = active ? "#2f7cf6" : "rgba(56,225,255,0.9)";
        ctx.lineWidth = active ? 2 : 1.2;
        ctx.setLineDash(active ? [] : [5, 3]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = active ? "#2f7cf6" : "rgba(56,225,255,0.9)";
        ctx.fillText(sl.name, x + 4, y + 12);
      });
      if (sliceDrag) {
        const x = ox + Math.min(sliceDrag.x0, sliceDrag.x1) * s;
        const y = oy + Math.min(sliceDrag.y0, sliceDrag.y1) * s;
        const w = Math.abs(sliceDrag.x1 - sliceDrag.x0) * s;
        const h = Math.abs(sliceDrag.y1 - sliceDrag.y0) * s;
        ctx.strokeStyle = "#fff";
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // Notes (yellow pins), counts (numbered), samplers (color dots), measures (persisted)
    if (notes.length > 0) {
      ctx.save();
      ctx.font = "10px JetBrains Mono, monospace";
      notes.forEach((n, i) => {
        const x = ox + n.x * s;
        const y = oy + n.y * s;
        ctx.fillStyle = "#d9a441";
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.fillText(String(i + 1), x - 3, y + 3.5);
        ctx.fillStyle = "rgba(217,164,65,0.95)";
        const label = n.text.length > 24 ? `${n.text.slice(0, 24)}…` : n.text;
        ctx.fillText(label, x + 10, y + 3);
      });
      ctx.restore();
    }
    if (counts.length > 0) {
      ctx.save();
      ctx.font = "bold 10px JetBrains Mono, monospace";
      counts.forEach((cc) => {
        const x = ox + cc.x * s;
        const y = oy + cc.y * s;
        ctx.fillStyle = "#2f7cf6";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(String(cc.n), x - 4, y + 3.5);
      });
      ctx.restore();
    }
    if (samplers.length > 0) {
      ctx.save();
      ctx.font = "9px JetBrains Mono, monospace";
      samplers.forEach((sp, i) => {
        const x = ox + sp.x * s;
        const y = oy + sp.y * s;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = sp.color;
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = "#fff";
        ctx.fillText(`${i + 1}:${sp.color}`, x + 8, y - 6);
      });
      ctx.restore();
    }
    if (measures.length > 0) {
      ctx.save();
      ctx.font = "9px JetBrains Mono, monospace";
      ctx.strokeStyle = "rgba(90,48,255,0.7)";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      measures.slice(-8).forEach((mm) => {
        const x1 = ox + mm.x0 * s;
        const y1 = oy + mm.y0 * s;
        const x2 = ox + mm.x1 * s;
        const y2 = oy + mm.y1 * s;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(mm.label, (x1 + x2) / 2 + 6, (y1 + y2) / 2 - 6);
      });
      ctx.restore();
    }
    // view rotation badge
    if (viewRotate !== 0) {
      ctx.save();
      ctx.fillStyle = "rgba(47,124,246,0.95)";
      ctx.font = "11px JetBrains Mono, monospace";
      const bx = ox + dw / 2 - 52;
      const by = oy + 10;
      ctx.fillRect(bx, by, 104, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(`Rotate ${viewRotate}deg`, bx + 10, by + 14);
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
    // composite render deps intentional.
    // NOTE: `doc` (whole object) is a dep on purpose: paintTo/retouchTo call
    // markDirty() which creates a new doc object per dab, so the composite
    // refreshes live during strokes. Using only doc.width/height left the
    // canvas frozen while painting (tools looked dead).
  }, [
    layers,
    activeLayerId,
    doc,
    zoom,
    panX,
    panY,
    viewRotate,
    isPainting,
    ants,
    selDrag,
    lassoPts,
    cropDrag,
    gradDrag,
    penDrag,
    shapeDrag,
    sliceDrag,
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
    slices,
    activeSliceId,
    notes,
    counts,
    samplers,
    measures,
    tool,
    cropOverlay,
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
  // Ex variant adds nib angle (degrees) and roundness (1-100 percent) for
  // calligraphy pens and chisel markers. Angle 0 + round 100 = classic disc.
  function brushSpriteEx(
    size: number,
    hardness: number,
    color: string,
    angleDeg = 0,
    roundPct = 100,
  ): HTMLCanvasElement {
    const round = Math.max(1, Math.min(100, Math.round(roundPct)));
    const ang = Math.round(((angleDeg % 180) + 180) % 180);
    const key = `${Math.round(size)}|${Math.round(hardness)}|${color}|${ang}|${round}`;
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
    if (round < 100 || ang !== 0) {
      // Squash vertically then rotate: cheap elliptical nib.
      const flat = document.createElement("canvas");
      flat.width = s;
      flat.height = s;
      const f = flat.getContext("2d")!;
      f.translate(s / 2, s / 2);
      f.rotate((ang * Math.PI) / 180);
      f.scale(1, round / 100);
      f.drawImage(sp, -s / 2, -s / 2, s, s);
      sp = flat;
    }
    if (spriteCache.current.size > 60) spriteCache.current.clear();
    spriteCache.current.set(key, sp);
    return sp;
  }

  function brushSprite(size: number, hardness: number, color: string): HTMLCanvasElement {
    return brushSpriteEx(size, hardness, color, 0, 100);
  }

  interface StampOpts {
    spacingPct?: number; // percent of size between dabs, 1-200
    jitter?: number; // 0-100 random size/alpha wobble per dab
    rotDeg?: number; // per-dab rotation for textured stamps
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
    opts?: StampOpts,
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const spacingPct = Math.max(1, Math.min(200, opts?.spacingPct ?? 18));
    const spacing = Math.max(1, size * (spacingPct / 100));
    const jitter = Math.max(0, Math.min(100, opts?.jitter ?? 0)) / 100;
    const rot = ((opts?.rotDeg ?? 0) * Math.PI) / 180;
    const steps = Math.max(1, Math.floor(dist / spacing));
    for (let i = 0; i <= steps; i++) {
      const px = x0 + (dx * i) / steps;
      const py = y0 + (dy * i) / steps;
      if (checkSel && !inSel(px, py)) continue;
      let ds = size;
      if (jitter > 0) ds = size * (1 - jitter * 0.6 + Math.random() * jitter * 0.9);
      if (rot !== 0) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        if (jitter > 0) ctx.globalAlpha *= 1 - jitter * 0.4 * Math.random();
        ctx.drawImage(sprite, -ds / 2, -ds / 2, ds, ds);
        ctx.restore();
      } else {
        if (jitter > 0) {
          ctx.save();
          ctx.globalAlpha *= 1 - jitter * 0.4 * Math.random();
          ctx.drawImage(sprite, px - ds / 2, py - ds / 2, ds, ds);
          ctx.restore();
        } else {
          ctx.drawImage(sprite, px - ds / 2, py - ds / 2, ds, ds);
        }
      }
    }
  }

  // forceId: explicit layer for the first dab right after auto paint-layer
  // creation (store closures are stale until React re-renders).
  function paintTo(x: number, y: number, erase: boolean, forceId?: string) {
    const stFresh = useEditorStore.getState();
    const aid = forceId ?? stFresh.activeLayerId ?? activeLayerId;
    if (!aid) return;
    const meta = stFresh.layers.find((l) => l.id === aid);
    if (!meta || meta.locked || !meta.visible) return;
    // Stroke smoothing (Fase E top bar): ease the live point toward the raw
    // input. 0 = raw input exactly like the old code.
    const smoothAmt = Math.max(0, Math.min(100, stFresh.brushSmoothing ?? 0)) / 100;
    let tx = x;
    let ty = y;
    const last0 = lastPos.current;
    if (smoothAmt > 0 && last0) {
      const k = 1 - smoothAmt * 0.85;
      tx = last0.x + (x - last0.x) * k;
      ty = last0.y + (y - last0.y) * k;
    }
    x = tx;
    y = ty;
    const last = lastPos.current ?? { x, y };
    const st = stFresh;
    const curTool = st.tool as ToolId;
    const flowMul = Math.max(1, Math.min(100, st.brushFlow ?? 100)) / 100;
    const spacingPct = Math.max(1, Math.min(200, st.brushSpacing ?? 18));
    const jitterPct = Math.max(0, Math.min(100, st.brushJitter ?? 0));

    // Mode paint mask
    const m = (useProStore.getState().masks as Record<string, { hasMask?: boolean }>)[aid];
    if (useProStore.getState().paintMask && m?.hasMask) {
      const mc = layerManager.ensureMask(aid, doc.width, doc.height);
      const ctx = mc.getContext("2d")!;
      ctx.save();
      ctx.globalAlpha = (brushOpacity / 100) * flowMul;
      const sp = brushSpriteEx(brushSize, brushHardness, erase ? "#000000" : "#ffffff", st.brushAngle ?? 0, st.brushRound ?? 100);
      stampLine(ctx, sp, brushSize, last.x, last.y, x, y, true, { spacingPct, jitter: jitterPct });
      ctx.restore();
      lastPos.current = { x, y };
      markDirty();
      bumpHistogram();
      return;
    }

    const c = layerManager.ensure(aid, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    ctx.save();
    if (curTool === "background-eraser") {
      ctx.restore();
      eraseBackgroundTo(x, y, aid);
      return;
    }
    if (curTool === "magic-eraser") {
      ctx.restore();
      magicEraseAt(x, y, aid);
      return;
    }
    if (curTool === "history-brush" || curTool === "art-history-brush") {
      ctx.restore();
      historyBrushTo(x, y, curTool === "art-history-brush", aid);
      return;
    }
    if (curTool === "color-replacement") {
      ctx.restore();
      colorReplaceTo(x, y, aid);
      return;
    }
    if (curTool === "mixer-brush" || curTool === "brush-wet" || curTool === "art-oil" || curTool === "art-smear") {
      ctx.restore();
      mixerBrushTo(x, y, aid);
      return;
    }
    if (curTool === "pattern-stamp" || curTool === "texture-stamp" || curTool === "art-canvas" || curTool === "pattern-dots") {
      ctx.restore();
      if (curTool === "pattern-dots") patternStampTo(x, y, "dots");
      else if (curTool === "pattern-stamp") patternStampTo(x, y, useProStore.getState().patternMotif);
      else patternStampTo(x, y, "checker");
      return;
    }
    if (
      curTool === "overlay-brush" ||
      curTool === "sketch-neon" ||
      curTool === "art-glaze" ||
      curTool === "sketch-highlighter"
    ) {
      ctx.restore();
      overlayBrushTo(x, y, aid);
      return;
    }
    if (curTool === "art-poster") {
      ctx.restore();
      // posterize stroke: paint then posterize dab
      ctx.save();
      ctx.globalAlpha = (brushOpacity / 100) * 0.85;
      const sp0 = brushSprite(brushSize, Math.max(50, brushHardness), brushColor);
      stampLine(ctx, sp0, brushSize, last.x, last.y, x, y, true);
      ctx.restore();
      retouchTo(x, y, "posterize");
      return;
    }
    // Generic preset path covers brush/pencil/airbrush/soft + all sketch/art variants.
    const preset = paintPreset(curTool, brushHardness);
    const isHardErase = curTool === "eraser-hard" || curTool === "eraser-block";
    const isSoftErase = curTool === "eraser-soft";
    const effHard = isSoftErase ? 0 : curTool === "eraser-block" ? 100 : (preset.hardness ?? brushHardness);
    const effAlpha =
      curTool === "pencil" || curTool === "sketch-ink" || isHardErase
        ? 1
        : (brushOpacity / 100) * preset.alphaMul * flowMul;
    const effSize = Math.max(1, brushSize * preset.sizeMul);
    // Fase E brush blend override: a non-normal blend wins over the preset composite.
    const blendOverride = st.brushBlend && st.brushBlend !== "source-over" ? st.brushBlend : null;
    ctx.globalCompositeOperation = erase || isHardErase ? "destination-out" : (blendOverride ?? preset.composite);
    ctx.globalAlpha = erase ? 1 : effAlpha;
    // scatter for chalk/pastel: jitter second stamp
    const sp = brushSpriteEx(effSize, effHard, erase || isHardErase ? "#000000" : brushColor, st.brushAngle ?? 0, st.brushRound ?? 100);
    stampLine(ctx, sp, effSize, last.x, last.y, x, y, true, { spacingPct, jitter: jitterPct });
    if (preset.scatter) {
      ctx.globalAlpha = (erase ? 1 : effAlpha) * 0.5;
      const off = effSize * 0.35;
      stampLine(ctx, sp, effSize * 0.6, last.x + off, last.y - off, x + off, y - off, true, { spacingPct, jitter: jitterPct });
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Background Eraser: erase only pixels similar to edge sample.
  // Interpolated along the stroke so fast drags leave no gaps.
  function eraseBackgroundTo(x: number, y: number, forceId?: string) {
    const aid = forceId ?? useEditorStore.getState().activeLayerId ?? activeLayerId;
    if (!aid) return;
    const meta = useEditorStore.getState().layers.find((l) => l.id === aid);
    if (!meta || meta.locked || !meta.visible) return;
    // plan3 Fase 0: the paper is never editable, not even by photo erasers.
    if (meta.kind === "background") {
      notify("Background paper is protected. Paint on a new layer to edit it.");
      return;
    }
    const c = layerManager.ensure(aid, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const r = Math.max(1, brushSize / 2);
    const last = lastPos.current ?? { x, y };
    for (const { px, py } of dabPath(last.x, last.y, x, y)) {
      if (hasSelection() && !inSel(px, py)) continue;
      const s = Math.round(r * 2);
      const sx = Math.round(px - r);
      const sy = Math.round(py - r);
      try {
        const edge = ctx.getImageData(Math.max(0, Math.min(c.width - 1, Math.floor(px))), Math.max(0, Math.min(c.height - 1, Math.floor(py))), 1, 1).data;
        const id = ctx.getImageData(Math.max(0, sx), Math.max(0, sy), Math.min(s, c.width), Math.min(s, c.height));
        const d = id.data;
        // Fase E: tolerance follows the options bar (default 24 * 2 = 48, same as before).
        const tol = Math.max(4, Math.min(160, useProStore.getState().selTolerance * 2));
        for (let i = 0; i < d.length; i += 4) {
          const dr = Math.abs(d[i] - edge[0]);
          const dg = Math.abs(d[i + 1] - edge[1]);
          const db = Math.abs(d[i + 2] - edge[2]);
          if ((dr + dg + db) / 3 < tol) d[i + 3] = 0;
        }
        ctx.putImageData(id, Math.max(0, sx), Math.max(0, sy));
      } catch { /* ignore edges */ }
    }
    markDirty();
    lastPos.current = { x, y };
  }

  // Magic Eraser: one-click flood erase with tolerance.
  // Photo-editing tool by design: works on the resolved active layer with
  // lock/visibility guard, respects the active selection, pushes history
  // only when pixels actually changed, and reports empty clicks.
  function magicEraseAt(x: number, y: number, forceId?: string) {
    const st = useEditorStore.getState();
    const aid = forceId ?? st.activeLayerId ?? activeLayerId;
    if (!aid) return;
    const meta = st.layers.find((l) => l.id === aid);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    // plan3 Fase 0: the paper is never editable, not even by photo erasers.
    if (meta.kind === "background") {
      notify("Background paper is protected. Paint on a new layer to edit it.");
      return;
    }
    const c = layerManager.ensure(aid, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const snap = layerManager.snapshot(aid);
    try {
      const W = c.width;
      const H = c.height;
      const ix = Math.max(0, Math.min(W - 1, Math.floor(x)));      const iy = Math.max(0, Math.min(H - 1, Math.floor(y)));
      const img = ctx.getImageData(0, 0, W, H);
      const d = img.data;
      const start = (iy * W + ix) * 4;
      const sr = d[start];
      const sg = d[start + 1];
      const sb = d[start + 2];
      // Fase E: tolerance follows the options bar (default 24 * 4/3 = 32, same as before).
      const tol = Math.max(4, Math.min(160, (useProStore.getState().selTolerance * 4) / 3));
      const selActive = hasSelection();
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
          const px = p % W;
          const py = Math.floor(p / W);
          if (selActive && !inSel(px, py)) continue;
          d[idx + 3] = 0;
          n++;
          if (px > 0) stack.push(p - 1);
          if (px < W - 1) stack.push(p + 1);
          if (py > 0) stack.push(p - W);
          if (py < H - 1) stack.push(p + W);
        }
      }
      if (n === 0) {
        notify("Nothing to erase here. Try a flatter area.");
        lastPos.current = { x, y };
        return;
      }
      ctx.putImageData(img, 0, 0);
      if (snap) st.pushHistory({ label: "Magic erase", layerId: aid, snapshot: snap });
      st.markDirty();
      bumpHistogram();
    } catch { /* ignore */ }
    lastPos.current = { x, y };
  }

  // History Brush: paint back from stroke-start snapshot (or last undo entry).
  // Art variant adds hue jitter for a stylized look.
  // Optimized: the source snapshot is pre-rendered to a canvas once per stroke
  // (historyCanvas) and dab tiles use the pooled scratch canvas.
  function historyBrushTo(x: number, y: number, art: boolean, forceId?: string) {
    const aid = forceId ?? useEditorStore.getState().activeLayerId ?? activeLayerId;
    if (!aid) return;
    const src = historySource.current;
    if (!src) return;
    let full = historyCanvas.current;
    if (!full || full.width !== src.width || full.height !== src.height) {
      try {
        full = document.createElement("canvas");
        full.width = src.width;
        full.height = src.height;
        const sd = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
        full.getContext("2d")!.putImageData(sd, 0, 0);
        historyCanvas.current = full;
      } catch {
        return;
      }
    }
    const c = layerManager.ensure(aid, doc.width, doc.height);
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
      if (!inSel(px, py)) continue;
      const s = Math.max(1, Math.round(r * 2));
      const sx = Math.max(0, Math.min(src.width - s, px - Math.round(r)));
      const sy = Math.max(0, Math.min(src.height - s, py - Math.round(r)));
      const tmp = getScratch(s, s);
      try {
        const tctx = tmp.getContext("2d")!;
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
      releaseScratch(tmp);
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Color Replacement: shift hue toward brush color, keep luminance.
  function colorReplaceTo(x: number, y: number, forceId?: string) {
    const aid = forceId ?? useEditorStore.getState().activeLayerId ?? activeLayerId;
    if (!aid) return;
    const c = layerManager.ensure(aid, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const last = lastPos.current ?? { x, y };
    const r = Math.max(1, brushSize / 2);
    const strength = brushOpacity / 100;
    const fr = parseInt(brushColor.slice(1, 3), 16);
    const fg = parseInt(brushColor.slice(3, 5), 16);
    const fb = parseInt(brushColor.slice(5, 7), 16);
    for (const { px, py } of dabPath(last.x, last.y, x, y)) {
      if (!inSel(px, py)) continue;
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
  function mixerBrushTo(x: number, y: number, forceId?: string) {
    const aid = forceId ?? useEditorStore.getState().activeLayerId ?? activeLayerId;
    if (!aid) return;
    pickSmudgeColor({ x, y });
    const c = layerManager.ensure(aid, doc.width, doc.height);
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

  // Pattern Stamp: weave stamped with brush color tint.
  // Manual 2026: dots/stripes/grid variants for textile/poster work.
  // Tile cache is keyed per (size, color, kind) instead of rebuilt per dab.
  const patternCache = useRef(new Map<string, HTMLCanvasElement>());
  function patternStampTo(x: number, y: number, kind: "checker" | "dots" | "stripes" | "grid" = "checker") {
    if (!activeLayerId) return;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    const last = lastPos.current ?? { x, y };
    const s = Math.max(8, Math.round(brushSize));
    const key = `${s}|${brushColor}|${kind}`;
    let pat = patternCache.current.get(key);
    if (!pat) {
      pat = patternTile(kind, s, brushColor);
      if (patternCache.current.size > 12) patternCache.current.clear();
      patternCache.current.set(key, pat);
    }
    ctx.save();
    ctx.globalAlpha = brushOpacity / 100;
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / Math.max(1, s * 0.3)));
    for (let i = 0; i <= steps; i++) {
      const px = last.x + (dx * i) / steps;
      const py = last.y + (dy * i) / steps;
      if (!inSel(px, py)) continue;
      ctx.drawImage(pat, px - s / 2, py - s / 2, s, s);
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Overlay Brush (soft light): paint contrast/light with overlay blend.
  function overlayBrushTo(x: number, y: number, forceId?: string) {
    const aid = forceId ?? useEditorStore.getState().activeLayerId ?? activeLayerId;
    if (!aid) return;
    const st = useEditorStore.getState();
    const meta = st.layers.find((l) => l.id === aid);
    if (!meta || meta.locked || !meta.visible) return;
    const last = lastPos.current ?? { x, y };
    const c = layerManager.ensure(aid, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.5 * (brushOpacity / 100) + 0.05;
    const sp = brushSprite(brushSize, 0, brushColor);
    stampLine(ctx, sp, brushSize, last.x, last.y, x, y, true);
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Clone stamp: Alt+click sets the source, paint to copy.
  // Bug fix: snapshot source per stroke so overlapping copy never smears.
  function cloneTo(x: number, y: number) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const src = useProStore.getState().cloneSource;
    if (!src) {
      setCursor("Alt-click to set source");
      return;
    }
    if (!cloneOrigin.current) cloneOrigin.current = { x, y };
    const ox = cloneOrigin.current.x - src.x;
    const oy = cloneOrigin.current.y - src.y;
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    if (!(cloneTo as unknown as { _src?: HTMLCanvasElement; _id?: string })._src || (cloneTo as unknown as { _id?: string })._id !== activeLayerId) {
      const snap = document.createElement("canvas");
      snap.width = c.width;
      snap.height = c.height;
      snap.getContext("2d")!.drawImage(c, 0, 0);
      (cloneTo as unknown as { _src?: HTMLCanvasElement })._src = snap;
      (cloneTo as unknown as { _id?: string })._id = activeLayerId;
    }
    const srcCanvas = (cloneTo as unknown as { _src?: HTMLCanvasElement })._src ?? c;
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
      if (!inSel(px, py)) continue;
      ctx.drawImage(srcCanvas, px - ox - r, py - oy - r, r * 2, r * 2, px - r, py - r, r * 2, r * 2);
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // ===== Retouch pro engine (dodge/burn/sponge/blur/sharpen/smudge/heal) =====
  function dabPath(x0: number, y0: number, x1: number, y1: number, spacingPct = 22): { px: number; py: number }[] {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const sp = Math.max(1, Math.min(200, spacingPct));
    const steps = Math.max(1, Math.floor(dist / Math.max(1, brushSize * (sp / 100))));
    const pts: { px: number; py: number }[] = [];
    for (let i = 0; i <= steps; i++) pts.push({ px: x0 + (dx * i) / steps, py: y0 + (dy * i) / steps });
    return pts;
  }

  function retouchTo(x: number, y: number, mode: RetouchMode) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const last = lastPos.current ?? { x, y };
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const edSt = useEditorStore.getState();
    const flowMul = Math.max(1, Math.min(100, edSt.brushFlow ?? 100)) / 100;
    // plan3 Fase 8-10: manual-variant fingerprint so aliased tools differ.
    const tweak = RETOUCH_TWEAK[edSt.tool as ToolId] ?? {};
    const twStrength = Math.max(0.2, Math.min(2, tweak.strengthMul ?? 1));
    const twRadius = Math.max(0.5, Math.min(2, tweak.radiusMul ?? 1));
    const strength = (brushOpacity / 100) * flowMul * twStrength;
    const r = Math.max(1, (brushSize / 2) * twRadius);
    for (const { px, py } of dabPath(last.x, last.y, x, y, edSt.brushSpacing ?? 22)) {
      if (!inSel(px, py)) continue;
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
          const hs = useProStore.getState().healSource;
          const ox = mode === "heal-source" && hs ? px - hs.x : 0;
          const oy = mode === "heal-source" && hs ? py - hs.y : 0;
          const tmp = getScratch(s, s);
          const tctx = tmp.getContext("2d")!;
          // Low-spec guard: CSS blur with r>48 is extremely slow per dab.
          // Use cheap downscale-upscale blur approximation for large brushes.
          if (r > 48) {
            const ds = Math.max(8, Math.round(s / 4));
            const tiny = getScratch(ds, ds);
            const ictx = tiny.getContext("2d")!;
            if (mode === "heal-source" && hs) ictx.drawImage(c, sx - Math.round(ox), sy - Math.round(oy), s, s, 0, 0, ds, ds);
            else ictx.drawImage(c, sx, sy, s, s, 0, 0, ds, ds);
            tctx.imageSmoothingEnabled = true;
            tctx.drawImage(tiny, 0, 0, s, s);
            releaseScratch(tiny);
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
          releaseScratch(tmp);
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
            const tmp = getScratch(s, s);
            tmp.getContext("2d")!.putImageData(id, 0, 0);
            ctx.save();
            ctx.globalAlpha = 0.9 * strength + 0.1;
            ctx.drawImage(tmp, sx + mvx, sy + mvy, s, s, sx, sy, s, s);
            ctx.restore();
            releaseScratch(tmp);
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
          const tmp = getScratch(s, s);
          const tctx = tmp.getContext("2d")!;
          tctx.filter = `blur(${Math.max(2, r / 2)}px)`;
          tctx.drawImage(c, sx, sy, s, s, 0, 0, s, s);
          tctx.filter = "none";
          ctx.save();
          ctx.globalAlpha = 0.9 * strength + 0.1;
          ctx.drawImage(tmp, sx, sy);
          ctx.restore();
          releaseScratch(tmp);
        } else if (mode === "smudge") {
          const col = smudgeColor.current ?? brushColor;
          ctx.save();
          ctx.globalAlpha = 0.28 * strength + 0.08;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(px, py, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (
          mode === "exposure" || mode === "warmth" || mode === "fade" ||
          mode === "contrast" || mode === "posterize" || mode === "threshold" ||
          mode === "hue" || mode === "invert" || mode === "desat" ||
          mode === "grain" || mode === "pixelate" || mode === "vignette" ||
          mode === "highlights" || mode === "shadows" || mode === "temp" ||
          mode === "tint" || mode === "clarity" || mode === "dehaze" ||
          mode === "saturate" || mode === "levels" ||
          mode === "grain-remove" || mode === "sharpen-more" || mode === "blur-more" ||
          mode === "tilt" || mode === "lens" || mode === "motion" ||
          mode === "dust" || mode === "wrinkle" || mode === "blemish" ||
          mode === "sky" || mode === "skin" || mode === "object" || mode === "surface" ||
          mode === "sepia" || mode === "bw" || mode === "filmfade" ||
          mode === "splittone" || mode === "hdr" ||
          mode === "mole" || mode === "acne" || mode === "scarfade" ||
          mode === "shine" || mode === "pores" || mode === "tanline" ||
          mode === "veins" || mode === "chapped" || mode === "strayhair" ||
          mode === "flyaway" || mode === "pricetag" || mode === "tourist" ||
          mode === "wire" || mode === "trash" || mode === "reflection" ||
          mode === "glare" || mode === "shadowlift" || mode === "fogcut" ||
          mode === "grainmatch" || mode === "texturecopy" || mode === "fabric" ||
          mode === "glass" || mode === "chrome" || mode === "rustspot" ||
          mode === "dodgemid" || mode === "dodgedetail" || mode === "burnedge" ||
          mode === "burndepth" || mode === "spongewarm" || mode === "spongecool" ||
          mode === "vibrskin" || mode === "vibrfoliage" || mode === "tempsunset" ||
          mode === "temparctic" || mode === "tintcinema" || mode === "clarityskin" ||
          mode === "claritydetail" || mode === "dehazesky" || mode === "dehazeportrait" ||
          mode === "grainpush" || mode === "grainpull" || mode === "fadeblacks" ||
          mode === "fadewhites" || mode === "splitgold" ||
          mode === "tiltstrong" || mode === "blurzoom" || mode === "blurspin" ||
          mode === "blurfrosted" || mode === "blurmosaic" || mode === "halofix" ||
          mode === "sharpenprint" || mode === "sharpenscreen" || mode === "claritystruct" ||
          mode === "denoiseluma" || mode === "denoisechroma" || mode === "grain35" ||
          mode === "grain120" || mode === "grainpush2" || mode === "lensswirl" ||
          mode === "lensbubble" || mode === "motionzoom" || mode === "motionspin"
        ) {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          const amt = 0.45 * strength + 0.1;
          const cx = s / 2;
          for (let yy = 0; yy < s; yy++) {
            for (let xx = 0; xx < s; xx++) {
              const i = (yy * s + xx) * 4;
              const dx = (xx - cx) / Math.max(1, cx);
              const dy = (yy - cx) / Math.max(1, cx);
              const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
              const fall = Math.max(0, 1 - dist);
              const k = amt * (0.35 + 0.65 * fall);
              const R = d[i];
              const G = d[i + 1];
              const B = d[i + 2];
              if (mode === "exposure") {
                d[i] = Math.max(0, Math.min(255, R + 42 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + 42 * k));
                d[i + 2] = Math.max(0, Math.min(255, B + 42 * k));
              } else if (mode === "warmth") {
                d[i] = Math.max(0, Math.min(255, R + 30 * k));
                d[i + 2] = Math.max(0, Math.min(255, B - 30 * k));
              } else if (mode === "fade") {
                d[i] = Math.round(R + (128 - R) * 0.5 * k);
                d[i + 1] = Math.round(G + (128 - G) * 0.5 * k);
                d[i + 2] = Math.round(B + (128 - B) * 0.5 * k);
              } else if (mode === "contrast") {
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.6 * k)));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.6 * k)));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.6 * k)));
              } else if (mode === "posterize") {
                const lv = 4;
                const step = 255 / (lv - 1);
                d[i] = Math.round(Math.round((R / 255) * (lv - 1)) * step * k + R * (1 - k));
                d[i + 1] = Math.round(Math.round((G / 255) * (lv - 1)) * step * k + G * (1 - k));
                d[i + 2] = Math.round(Math.round((B / 255) * (lv - 1)) * step * k + B * (1 - k));
              } else if (mode === "threshold") {
                const y = 0.299 * R + 0.587 * G + 0.114 * B;
                const v = y >= 128 ? 255 : 0;
                d[i] = Math.round(R + (v - R) * k);
                d[i + 1] = Math.round(G + (v - G) * k);
                d[i + 2] = Math.round(B + (v - B) * k);
              } else if (mode === "hue") {
                d[i] = Math.round(R + (G - R) * 0.6 * k);
                d[i + 1] = Math.round(G + (B - G) * 0.6 * k);
                d[i + 2] = Math.round(B + (R - B) * 0.6 * k);
              } else if (mode === "invert") {
                d[i] = Math.round(R + (255 - R - R) * k);
                d[i + 1] = Math.round(G + (255 - G - G) * k);
                d[i + 2] = Math.round(B + (255 - B - B) * k);
              } else if (mode === "desat") {
                const y = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
                d[i] = Math.round(R + (y - R) * k);
                d[i + 1] = Math.round(G + (y - G) * k);
                d[i + 2] = Math.round(B + (y - B) * k);
              } else if (mode === "grain") {
                const n = ((xx * 73 + yy * 149 + Math.round(px + py)) % 29) - 14;
                d[i] = Math.max(0, Math.min(255, R + n * k * 2));
                d[i + 1] = Math.max(0, Math.min(255, G + n * k * 2));
                d[i + 2] = Math.max(0, Math.min(255, B + n * k * 2));
              } else if (mode === "pixelate") {
                const cell = Math.max(2, Math.round(3 + 5 * fall));
                const bx = xx - (xx % cell);
                const by = yy - (yy % cell);
                const bi = (by * s + bx) * 4;
                d[i] = Math.round(R + (d[bi] - R) * k);
                d[i + 1] = Math.round(G + (d[bi + 1] - G) * k);
                d[i + 2] = Math.round(B + (d[bi + 2] - B) * k);
              } else if (mode === "vignette") {
                const dk = 1 - 0.55 * k * dist;
                d[i] = Math.max(0, Math.min(255, R * dk));
                d[i + 1] = Math.max(0, Math.min(255, G * dk));
                d[i + 2] = Math.max(0, Math.min(255, B * dk));
              } else if (mode === "highlights") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (lum - 0.55) / 0.45);
                d[i] = Math.max(0, Math.min(255, R + 38 * k * w));
                d[i + 1] = Math.max(0, Math.min(255, G + 38 * k * w));
                d[i + 2] = Math.max(0, Math.min(255, B + 38 * k * w));
              } else if (mode === "shadows") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (0.45 - lum) / 0.45);
                d[i] = Math.max(0, Math.min(255, R + 44 * k * w));
                d[i + 1] = Math.max(0, Math.min(255, G + 44 * k * w));
                d[i + 2] = Math.max(0, Math.min(255, B + 44 * k * w));
              } else if (mode === "temp") {
                d[i] = Math.max(0, Math.min(255, R + 26 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + 6 * k));
                d[i + 2] = Math.max(0, Math.min(255, B - 26 * k));
              } else if (mode === "tint") {
                d[i] = Math.max(0, Math.min(255, R + 12 * k));
                d[i + 1] = Math.max(0, Math.min(255, G - 14 * k));
                d[i + 2] = Math.max(0, Math.min(255, B + 12 * k));
              } else if (mode === "clarity" || mode === "levels") {
                const f = 1 + (mode === "clarity" ? 0.7 : 0.9) * k;
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * f));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * f));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * f));
              } else if (mode === "dehaze") {
                d[i] = Math.max(0, Math.min(255, R + (R - 128) * 0.5 * k - 8 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + (G - 128) * 0.5 * k - 8 * k));
                d[i + 2] = Math.max(0, Math.min(255, B + (B - 128) * 0.5 * k + 6 * k));
              } else if (mode === "saturate") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, avg + (R - avg) * (1 + 0.8 * k)));
                d[i + 1] = Math.max(0, Math.min(255, avg + (G - avg) * (1 + 0.8 * k)));
                d[i + 2] = Math.max(0, Math.min(255, avg + (B - avg) * (1 + 0.8 * k)));
              } else if (mode === "grain-remove" || mode === "skin" || mode === "wrinkle") {
                const avg = (R + G + B) / 3;
                const f = mode === "skin" ? 0.7 : mode === "wrinkle" ? 0.5 : 0.6;
                d[i] = Math.round(R + (avg - R) * f * k);
                d[i + 1] = Math.round(G + (avg - G) * f * k);
                d[i + 2] = Math.round(B + (avg - B) * f * k);
              } else if (mode === "surface") {
                // Edge-aware smooth: 3x3 average, blend weight collapses near edges.
                let sr = 0;
                let sg = 0;
                let sb = 0;
                let mn = 255;
                let mx = 0;
                for (let oy = -1; oy <= 1; oy++) {
                  for (let ox = -1; ox <= 1; ox++) {
                    const cx2 = Math.min(s - 1, Math.max(0, xx + ox));
                    const cy2 = Math.min(s - 1, Math.max(0, yy + oy));
                    const j = (cy2 * s + cx2) * 4;
                    sr += d[j];
                    sg += d[j + 1];
                    sb += d[j + 2];
                    const lum = (d[j] + d[j + 1] + d[j + 2]) / 3;
                    if (lum < mn) mn = lum;
                    if (lum > mx) mx = lum;
                  }
                }
                const edge = mx - mn;
                const wgt = edge < 28 ? k : k * Math.max(0, 1 - (edge - 28) / 60);
                d[i] = Math.round(R + (sr / 9 - R) * wgt);
                d[i + 1] = Math.round(G + (sg / 9 - G) * wgt);
                d[i + 2] = Math.round(B + (sb / 9 - B) * wgt);
              } else if (mode === "sharpen-more" || mode === "blemish") {
                const avg = (R + G + B) / 3;
                const amt2 = (mode === "blemish" ? 0.5 : 0.8) * k + 0.15;
                d[i] = Math.max(0, Math.min(255, R + (R - avg) * amt2));
                d[i + 1] = Math.max(0, Math.min(255, G + (G - avg) * amt2));
                d[i + 2] = Math.max(0, Math.min(255, B + (B - avg) * amt2));
              } else if (mode === "blur-more" || mode === "tilt" || mode === "lens") {
                const avg = (R + G + B) / 3;
                const f = mode === "lens" ? 0.75 : 0.55;
                d[i] = Math.round(R + (avg - R) * f * k);
                d[i + 1] = Math.round(G + (avg - G) * f * k);
                d[i + 2] = Math.round(B + (avg - B) * f * k);
              } else if (mode === "motion") {
                const shift = Math.round(2 * k * fall) || 1;
                const bi2 = Math.max(0, i - shift * 4);
                d[i] = Math.round(R * (1 - k * 0.5) + d[bi2] * k * 0.5);
                d[i + 1] = Math.round(G * (1 - k * 0.5) + d[bi2 + 1] * k * 0.5);
                d[i + 2] = Math.round(B * (1 - k * 0.5) + d[bi2 + 2] * k * 0.5);
              } else if (mode === "dust" || mode === "sky" || mode === "object") {
                // sky/object behave like soft content fill: pull toward local average
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.45 * k + 6 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.45 * k + 6 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.45 * k + 6 * k);
              } else if (mode === "sepia") {
                const y = 0.299 * R + 0.587 * G + 0.114 * B;
                d[i] = Math.round(R + (Math.min(255, y * 1.07 + 18) - R) * k);
                d[i + 1] = Math.round(G + (Math.min(255, y * 0.86 + 12) - G) * k);
                d[i + 2] = Math.round(B + (Math.min(255, y * 0.62 + 6) - B) * k);
              } else if (mode === "bw") {
                const y = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
                d[i] = Math.round(R + (y - R) * Math.min(1, k * 1.6));
                d[i + 1] = Math.round(G + (y - G) * Math.min(1, k * 1.6));
                d[i + 2] = Math.round(B + (y - B) * Math.min(1, k * 1.6));
              } else if (mode === "filmfade") {
                d[i] = Math.round(R + (128 - R) * 0.35 * k + 10 * k);
                d[i + 1] = Math.round(G + (128 - G) * 0.35 * k + 8 * k);
                d[i + 2] = Math.round(B + (128 - B) * 0.35 * k + 4 * k);
              } else if (mode === "splittone") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const cool = (1 - lum) * k;
                const warm = lum * k;
                d[i] = Math.max(0, Math.min(255, R - 14 * cool + 18 * warm));
                d[i + 1] = Math.max(0, Math.min(255, G - 4 * cool + 6 * warm));
                d[i + 2] = Math.max(0, Math.min(255, B + 16 * cool - 10 * warm));
              } else if (mode === "hdr") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.9 * k) + (R - avg) * 0.3 * k));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.9 * k) + (G - avg) * 0.3 * k));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.9 * k) + (B - avg) * 0.3 * k));
              } else if (mode === "mole") {
                const avg = (R + G + B) / 3;
                const f = 0.85 * k + 0.1;
                d[i] = Math.round(R + (avg - R) * f);
                d[i + 1] = Math.round(G + (avg - G) * f);
                d[i + 2] = Math.round(B + (avg - B) * f);
              } else if (mode === "acne") {
                const red = R - (G + B) / 2;
                const rk = Math.max(0, Math.min(1, red / 60)) * k;
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * (0.4 * k + 0.6 * rk));
                d[i + 1] = Math.round(G + (avg - G) * 0.4 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.4 * k);
              } else if (mode === "scarfade") {
                const bi = Math.max(0, i - 4);
                d[i] = Math.round(R * (1 - 0.5 * k) + d[bi] * 0.5 * k);
                d[i + 1] = Math.round(G * (1 - 0.5 * k) + d[bi + 1] * 0.5 * k);
                d[i + 2] = Math.round(B * (1 - 0.5 * k) + d[bi + 2] * 0.5 * k);
              } else if (mode === "shine") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (lum - 0.7) / 0.3);
                const dk = 1 - 0.35 * k * w;
                d[i] = Math.max(0, Math.min(255, R * dk + 128 * (1 - dk) * 0.4));
                d[i + 1] = Math.max(0, Math.min(255, G * dk + 128 * (1 - dk) * 0.4));
                d[i + 2] = Math.max(0, Math.min(255, B * dk + 128 * (1 - dk) * 0.4));
              } else if (mode === "pores") {
                const avg = (R + G + B) / 3;
                const dev = Math.abs(R - avg) + Math.abs(G - avg) + Math.abs(B - avg);
                const w = Math.max(0, 1 - dev / 45);
                d[i] = Math.round(R + (avg - R) * 0.75 * k * w);
                d[i + 1] = Math.round(G + (avg - G) * 0.75 * k * w);
                d[i + 2] = Math.round(B + (avg - B) * 0.75 * k * w);
              } else if (mode === "tanline") {
                const orange = Math.max(0, (R - B) / 60);
                const w = Math.max(0, Math.min(1, orange)) * k;
                d[i] = Math.max(0, Math.min(255, R - 22 * w));
                d[i + 1] = Math.max(0, Math.min(255, G - 6 * w));
                d[i + 2] = Math.max(0, Math.min(255, B + 14 * w));
              } else if (mode === "veins") {
                const reddish = R > 120 && R > G * 1.15 && R > B * 1.15 ? 1 : 0;
                const w = reddish * k;
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.65 * w);
                d[i + 1] = Math.round(G + (avg - G) * 0.3 * w);
                d[i + 2] = Math.round(B + (avg - B) * 0.3 * w);
              } else if (mode === "chapped") {
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.4 * k + 8 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.4 * k + 2 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.4 * k);
              } else if (mode === "strayhair") {
                const dark = Math.max(0, (90 - (R + G + B) / 3) / 90);
                const w = dark * k;
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg + 24 - R) * 0.7 * w);
                d[i + 1] = Math.round(G + (avg + 24 - G) * 0.7 * w);
                d[i + 2] = Math.round(B + (avg + 24 - B) * 0.7 * w);
              } else if (mode === "flyaway") {
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.5 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.5 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.5 * k);
                const n = ((xx * 31 + yy * 57) % 13) - 6;
                d[i] = Math.max(0, Math.min(255, d[i] + n * k * 0.6));
                d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * k * 0.6));
                d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * k * 0.6));
              } else if (mode === "pricetag" || mode === "tourist" || mode === "wire" || mode === "trash") {
                const f = mode === "wire" ? 0.55 : mode === "pricetag" ? 0.7 : 0.6;
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * f * k + 10 * k);
                d[i + 1] = Math.round(G + (avg - G) * f * k + 10 * k);
                d[i + 2] = Math.round(B + (avg - B) * f * k + 10 * k);
              } else if (mode === "reflection") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (lum - 0.5) / 0.5) * k;
                d[i] = Math.max(0, Math.min(255, R - 30 * w));
                d[i + 1] = Math.max(0, Math.min(255, G - 30 * w));
                d[i + 2] = Math.max(0, Math.min(255, B - 30 * w));
                const avg2 = (d[i] + d[i + 1] + d[i + 2]) / 3;
                d[i] = Math.round(d[i] + (avg2 - d[i]) * 0.25 * w);
                d[i + 1] = Math.round(d[i + 1] + (avg2 - d[i + 1]) * 0.25 * w);
                d[i + 2] = Math.round(d[i + 2] + (avg2 - d[i + 2]) * 0.25 * w);
              } else if (mode === "glare") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (lum - 0.6) / 0.4) * k;
                d[i] = Math.max(0, Math.min(255, R - 52 * w));
                d[i + 1] = Math.max(0, Math.min(255, G - 52 * w));
                d[i + 2] = Math.max(0, Math.min(255, B - 52 * w));
              } else if (mode === "shadowlift") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (0.35 - lum) / 0.35) * k;
                d[i] = Math.max(0, Math.min(255, R + 52 * w));
                d[i + 1] = Math.max(0, Math.min(255, G + 52 * w));
                d[i + 2] = Math.max(0, Math.min(255, B + 52 * w));
              } else if (mode === "fogcut") {
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.45 * k) - 6 * k));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.45 * k) - 6 * k));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.45 * k) + 4 * k));
              } else if (mode === "grainmatch") {
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.35 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.35 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.35 * k);
                const n = ((xx * 73 + yy * 149) % 23) - 11;
                d[i] = Math.max(0, Math.min(255, d[i] + n * k * 1.4));
                d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * k * 1.4));
                d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * k * 1.4));
              } else if (mode === "texturecopy") {
                const lv = 6;
                const step = 255 / (lv - 1);
                d[i] = Math.round(Math.round((R / 255) * (lv - 1)) * step * 0.7 * k + R * (1 - 0.7 * k));
                d[i + 1] = Math.round(Math.round((G / 255) * (lv - 1)) * step * 0.7 * k + G * (1 - 0.7 * k));
                d[i + 2] = Math.round(Math.round((B / 255) * (lv - 1)) * step * 0.7 * k + B * (1 - 0.7 * k));
              } else if (mode === "fabric") {
                const weave = ((xx + yy) % 2 === 0 ? 1 : -1) * 7 * k;
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, R + (avg - R) * 0.3 * k + weave));
                d[i + 1] = Math.max(0, Math.min(255, G + (avg - G) * 0.3 * k + weave));
                d[i + 2] = Math.max(0, Math.min(255, B + (avg - B) * 0.3 * k + weave));
              } else if (mode === "glass") {
                d[i] = Math.max(0, Math.min(255, R - 8 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + 2 * k));
                d[i + 2] = Math.max(0, Math.min(255, B + 18 * k));
                const avg = (R + G + B) / 3;
                d[i] = Math.round(d[i] + (avg - d[i]) * 0.2 * k);
                d[i + 1] = Math.round(d[i + 1] + (avg - d[i + 1]) * 0.2 * k);
                d[i + 2] = Math.round(d[i + 2] + (avg - d[i + 2]) * 0.2 * k);
              } else if (mode === "chrome") {
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.8 * k)));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.8 * k)));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.8 * k)));
                const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
                const y = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
                d[i] = Math.round(d[i] + (y - d[i]) * 0.25 * k + (avg - d[i]) * 0.1);
                d[i + 1] = Math.round(d[i + 1] + (y - d[i + 1]) * 0.25 * k);
                d[i + 2] = Math.round(d[i + 2] + (y - d[i + 2]) * 0.25 * k);
              } else if (mode === "rustspot") {
                const orange = Math.max(0, Math.min(1, ((R - G) + (R - B)) / 120)) * k;
                const y = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
                d[i] = Math.round(R + (y - R) * 0.7 * orange);
                d[i + 1] = Math.round(G + (y - G) * 0.7 * orange);
                d[i + 2] = Math.round(B + (y - B) * 0.7 * orange);
              } else if (mode === "dodgemid") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, 1 - Math.abs(lum - 0.5) * 2.4);
                d[i] = Math.max(0, Math.min(255, R + 40 * k * w));
                d[i + 1] = Math.max(0, Math.min(255, G + 40 * k * w));
                d[i + 2] = Math.max(0, Math.min(255, B + 40 * k * w));
              } else if (mode === "dodgedetail") {
                const avg = (R + G + B) / 3;
                const dev = Math.abs(R - avg) + Math.abs(G - avg) + Math.abs(B - avg);
                const w = Math.max(0, Math.min(1, dev / 40)) * k;
                d[i] = Math.max(0, Math.min(255, R + 26 * w));
                d[i + 1] = Math.max(0, Math.min(255, G + 26 * w));
                d[i + 2] = Math.max(0, Math.min(255, B + 26 * w));
              } else if (mode === "burnedge") {
                const dk = 1 - 0.4 * k * dist;
                d[i] = Math.max(0, Math.min(255, R * dk));
                d[i + 1] = Math.max(0, Math.min(255, G * dk));
                d[i + 2] = Math.max(0, Math.min(255, B * dk));
              } else if (mode === "burndepth") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (0.5 - lum) / 0.5);
                const dk = 1 - 0.4 * k * w;
                d[i] = Math.max(0, Math.min(255, R * dk));
                d[i + 1] = Math.max(0, Math.min(255, G * dk));
                d[i + 2] = Math.max(0, Math.min(255, B * dk));
              } else if (mode === "spongewarm") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, avg + (R - avg) * (1 + 0.7 * k) + 10 * k));
                d[i + 1] = Math.max(0, Math.min(255, avg + (G - avg) * (1 + 0.7 * k)));
                d[i + 2] = Math.max(0, Math.min(255, avg + (B - avg) * (1 + 0.7 * k) - 12 * k));
              } else if (mode === "spongecool") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, avg + (R - avg) * (1 + 0.7 * k) - 10 * k));
                d[i + 1] = Math.max(0, Math.min(255, avg + (G - avg) * (1 + 0.7 * k)));
                d[i + 2] = Math.max(0, Math.min(255, avg + (B - avg) * (1 + 0.7 * k) + 12 * k));
              } else if (mode === "vibrskin") {
                const skin = R > 110 && R > G + 12 && G > B ? 1 : 0;
                const avg = (R + G + B) / 3;
                const mx = Math.max(R, G, B);
                const mn = Math.min(R, G, B);
                const sat = mx - mn;
                const w = (1 - skin) * Math.max(0, 1 - sat / 90);
                d[i] = Math.max(0, Math.min(255, avg + (R - avg) * (1 + 0.5 * k * w)));
                d[i + 1] = Math.max(0, Math.min(255, avg + (G - avg) * (1 + 0.5 * k * w)));
                d[i + 2] = Math.max(0, Math.min(255, avg + (B - avg) * (1 + 0.5 * k * w)));
              } else if (mode === "vibrfoliage") {
                const green = G > R && G >= B ? 1 : 0;
                const avg = (R + G + B) / 3;
                const boost = 1 + (0.9 * green + 0.25) * k;
                d[i] = Math.max(0, Math.min(255, avg + (R - avg) * boost));
                d[i + 1] = Math.max(0, Math.min(255, avg + (G - avg) * boost));
                d[i + 2] = Math.max(0, Math.min(255, avg + (B - avg) * boost));
              } else if (mode === "tempsunset") {
                d[i] = Math.max(0, Math.min(255, R + 34 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + 8 * k));
                d[i + 2] = Math.max(0, Math.min(255, B - 30 * k));
              } else if (mode === "temparctic") {
                d[i] = Math.max(0, Math.min(255, R - 26 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + 2 * k));
                d[i + 2] = Math.max(0, Math.min(255, B + 30 * k));
              } else if (mode === "tintcinema") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const sh = (1 - lum) * k;
                const hi = lum * k;
                d[i] = Math.max(0, Math.min(255, R - 16 * sh + 20 * hi));
                d[i + 1] = Math.max(0, Math.min(255, G + 10 * sh + 8 * hi));
                d[i + 2] = Math.max(0, Math.min(255, B + 18 * sh - 12 * hi));
              } else if (mode === "clarityskin") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 - 0.35 * k)));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 - 0.35 * k)));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 - 0.35 * k)));
                d[i] = Math.round(d[i] + (avg - d[i]) * 0.2 * k);
                d[i + 1] = Math.round(d[i + 1] + (avg - d[i + 1]) * 0.2 * k);
                d[i + 2] = Math.round(d[i + 2] + (avg - d[i + 2]) * 0.2 * k);
              } else if (mode === "claritydetail") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 1.1 * k) + (R - avg) * 0.2 * k));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 1.1 * k) + (G - avg) * 0.2 * k));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 1.1 * k) + (B - avg) * 0.2 * k));
              } else if (mode === "dehazesky") {
                d[i] = Math.max(0, Math.min(255, R + (R - 128) * 0.5 * k - 10 * k));
                d[i + 1] = Math.max(0, Math.min(255, G + (G - 128) * 0.5 * k - 6 * k));
                d[i + 2] = Math.max(0, Math.min(255, B + (B - 128) * 0.5 * k + 16 * k));
              } else if (mode === "dehazeportrait") {
                const skin = R > 110 && R > G + 12 && G > B ? 1 : 0;
                const w = 1 - 0.55 * skin;
                d[i] = Math.max(0, Math.min(255, R + (R - 128) * 0.4 * k * w - 4 * k * w));
                d[i + 1] = Math.max(0, Math.min(255, G + (G - 128) * 0.4 * k * w - 4 * k * w));
                d[i + 2] = Math.max(0, Math.min(255, B + (B - 128) * 0.4 * k * w + 2 * k * w));
              } else if (mode === "grainpush") {
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.5 * k)));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.5 * k)));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.5 * k)));
                const n = ((xx * 53 + yy * 97) % 31) - 15;
                d[i] = Math.max(0, Math.min(255, d[i] + n * k * 1.6));
                d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * k * 1.6));
                d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * k * 1.6));
              } else if (mode === "grainpull") {
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.55 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.55 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.55 * k);
                d[i] = Math.round(d[i] + (128 - d[i]) * 0.2 * k);
                d[i + 1] = Math.round(d[i + 1] + (128 - d[i + 1]) * 0.2 * k);
                d[i + 2] = Math.round(d[i + 2] + (128 - d[i + 2]) * 0.2 * k);
              } else if (mode === "fadeblacks") {
                d[i] = Math.round(R + (34 - R) * 0.5 * k * (R < 90 ? 1 : 0.2));
                d[i + 1] = Math.round(G + (34 - G) * 0.5 * k * (G < 90 ? 1 : 0.2));
                d[i + 2] = Math.round(B + (34 - B) * 0.5 * k * (B < 90 ? 1 : 0.2));
              } else if (mode === "fadewhites") {
                d[i] = Math.round(R + (228 - R) * 0.5 * k * (R > 165 ? 1 : 0.2));
                d[i + 1] = Math.round(G + (228 - G) * 0.5 * k * (G > 165 ? 1 : 0.2));
                d[i + 2] = Math.round(B + (228 - B) * 0.5 * k * (B > 165 ? 1 : 0.2));
              } else if (mode === "splitgold") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const sh = (1 - lum) * k;
                const hi = lum * k;
                d[i] = Math.max(0, Math.min(255, R + 26 * sh + 10 * hi));
                d[i + 1] = Math.max(0, Math.min(255, G + 8 * sh - 2 * hi));
                d[i + 2] = Math.max(0, Math.min(255, B - 22 * sh - 6 * hi));
              } else if (mode === "tiltstrong") {
                const vfall = Math.min(1, Math.abs(yy - cx) / Math.max(1, cx));
                const avg = (R + G + B) / 3;
                const f = 0.85 * k * vfall;
                d[i] = Math.round(R + (avg - R) * f);
                d[i + 1] = Math.round(G + (avg - G) * f);
                d[i + 2] = Math.round(B + (avg - B) * f);
              } else if (mode === "blurzoom") {
                const zx = cx + (xx - cx) * 0.82;
                const zy = cx + (yy - cx) * 0.82;
                const six = Math.max(0, Math.min(s - 1, Math.round(zx)));
                const siy = Math.max(0, Math.min(s - 1, Math.round(zy)));
                const bi = (siy * s + six) * 4;
                d[i] = Math.round(R + (d[bi] - R) * 0.65 * k);
                d[i + 1] = Math.round(G + (d[bi + 1] - G) * 0.65 * k);
                d[i + 2] = Math.round(B + (d[bi + 2] - B) * 0.65 * k);
              } else if (mode === "blurspin") {
                const ang = 0.35 * k * fall + 0.05;
                const six = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * Math.cos(ang) - (yy - cx) * Math.sin(ang))));
                const siy = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * Math.sin(ang) + (yy - cx) * Math.cos(ang))));
                const bi = (siy * s + six) * 4;
                d[i] = Math.round(R + (d[bi] - R) * 0.6 * k);
                d[i + 1] = Math.round(G + (d[bi + 1] - G) * 0.6 * k);
                d[i + 2] = Math.round(B + (d[bi + 2] - B) * 0.6 * k);
              } else if (mode === "blurfrosted") {
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.7 * k + 14 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.7 * k + 14 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.7 * k + 14 * k);
              } else if (mode === "blurmosaic") {
                const cell = Math.max(4, Math.round(6 + 8 * fall));
                const bx = xx - (xx % cell);
                const by = yy - (yy % cell);
                const bi = (by * s + bx) * 4;
                d[i] = Math.round(R + (d[bi] - R) * 0.85 * k);
                d[i + 1] = Math.round(G + (d[bi + 1] - G) * 0.85 * k);
                d[i + 2] = Math.round(B + (d[bi + 2] - B) * 0.85 * k);
              } else if (mode === "halofix") {
                const avg = (R + G + B) / 3;
                const dev = R - avg;
                const over = Math.abs(dev) > 48 ? 1 : 0;
                d[i] = Math.round(R - dev * 0.55 * k * over);
                d[i + 1] = Math.round(G - (G - avg) * 0.55 * k * over);
                d[i + 2] = Math.round(B - (B - avg) * 0.55 * k * over);
              } else if (mode === "sharpenprint") {
                const avg = (R + G + B) / 3;
                const amt2 = 0.9 * k + 0.2;
                d[i] = Math.max(0, Math.min(255, R + (R - avg) * amt2));
                d[i + 1] = Math.max(0, Math.min(255, G + (G - avg) * amt2));
                d[i + 2] = Math.max(0, Math.min(255, B + (B - avg) * amt2));
                d[i] = Math.max(0, Math.min(255, 128 + (d[i] - 128) * (1 + 0.2 * k)));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (d[i + 1] - 128) * (1 + 0.2 * k)));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (d[i + 2] - 128) * (1 + 0.2 * k)));
              } else if (mode === "sharpenscreen") {
                const avg = (R + G + B) / 3;
                const amt2 = 0.35 * k + 0.05;
                d[i] = Math.max(0, Math.min(255, R + (R - avg) * amt2));
                d[i + 1] = Math.max(0, Math.min(255, G + (G - avg) * amt2));
                d[i + 2] = Math.max(0, Math.min(255, B + (B - avg) * amt2));
              } else if (mode === "claritystruct") {
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.7 * k) + (R - avg) * 0.45 * k));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.7 * k) + (G - avg) * 0.45 * k));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.7 * k) + (B - avg) * 0.45 * k));
              } else if (mode === "denoiseluma") {
                const y = 0.299 * R + 0.587 * G + 0.114 * B;
                const avg = (R + G + B) / 3 || 1;
                const ny = y + (avg - y) * 0.7 * k;
                const f = avg > 0 ? ny / avg : 1;
                d[i] = Math.max(0, Math.min(255, R * f));
                d[i + 1] = Math.max(0, Math.min(255, G * f));
                d[i + 2] = Math.max(0, Math.min(255, B * f));
              } else if (mode === "denoisechroma") {
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (avg - R) * 0.8 * k);
                d[i + 1] = Math.round(G + (avg - G) * 0.8 * k);
                d[i + 2] = Math.round(B + (avg - B) * 0.8 * k);
              } else if (mode === "grain35") {
                const n = ((xx * 37 + yy * 91 + Math.round(px)) % 25) - 12;
                d[i] = Math.max(0, Math.min(255, R + n * k * 1.8));
                d[i + 1] = Math.max(0, Math.min(255, G + n * k * 1.8));
                d[i + 2] = Math.max(0, Math.min(255, B + n * k * 1.8));
              } else if (mode === "grain120") {
                const n = ((xx * 17 + yy * 41 + Math.round(py)) % 13) - 6;
                d[i] = Math.max(0, Math.min(255, R + n * k));
                d[i + 1] = Math.max(0, Math.min(255, G + n * k));
                d[i + 2] = Math.max(0, Math.min(255, B + n * k));
              } else if (mode === "grainpush2") {
                const n = ((xx * 67 + yy * 131 + Math.round(px + py)) % 41) - 20;
                d[i] = Math.max(0, Math.min(255, 128 + (R - 128) * (1 + 0.4 * k) + n * k * 2));
                d[i + 1] = Math.max(0, Math.min(255, 128 + (G - 128) * (1 + 0.4 * k) + n * k * 2));
                d[i + 2] = Math.max(0, Math.min(255, 128 + (B - 128) * (1 + 0.4 * k) + n * k * 2));
              } else if (mode === "lensswirl") {
                const ang = 0.5 * k * fall;
                const six = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * Math.cos(ang) - (yy - cx) * Math.sin(ang))));
                const siy = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * Math.sin(ang) + (yy - cx) * Math.cos(ang))));
                const bi = (siy * s + six) * 4;
                const avg = (R + G + B) / 3;
                d[i] = Math.round(R + (d[bi] - R) * 0.5 * k + (R - avg) * 0.15 * k);
                d[i + 1] = Math.round(G + (d[bi + 1] - G) * 0.5 * k + (G - avg) * 0.15 * k);
                d[i + 2] = Math.round(B + (d[bi + 2] - B) * 0.5 * k + (B - avg) * 0.15 * k);
              } else if (mode === "lensbubble") {
                const lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
                const w = Math.max(0, (lum - 0.55) / 0.45);
                const avg = (R + G + B) / 3;
                d[i] = Math.max(0, Math.min(255, R + (avg - R) * 0.4 * k + 30 * k * w));
                d[i + 1] = Math.max(0, Math.min(255, G + (avg - G) * 0.4 * k + 30 * k * w));
                d[i + 2] = Math.max(0, Math.min(255, B + (avg - B) * 0.4 * k + 30 * k * w));
              } else if (mode === "motionzoom") {
                const six = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * 0.9)));
                const siy = Math.max(0, Math.min(s - 1, Math.round(cx + (yy - cx) * 0.9)));
                const bi3 = (siy * s + six) * 4;
                d[i] = Math.round(R * (1 - k * 0.55) + d[bi3] * k * 0.55);
                d[i + 1] = Math.round(G * (1 - k * 0.55) + d[bi3 + 1] * k * 0.55);
                d[i + 2] = Math.round(B * (1 - k * 0.55) + d[bi3 + 2] * k * 0.55);
              } else if (mode === "motionspin") {
                const ang = 0.22 * k + 0.03;
                const six = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * Math.cos(ang) - (yy - cx) * Math.sin(ang))));
                const siy = Math.max(0, Math.min(s - 1, Math.round(cx + (xx - cx) * Math.sin(ang) + (yy - cx) * Math.cos(ang))));
                const bi = (siy * s + six) * 4;
                d[i] = Math.round(R * (1 - k * 0.55) + d[bi] * k * 0.55);
                d[i + 1] = Math.round(G * (1 - k * 0.55) + d[bi + 1] * k * 0.55);
                d[i + 2] = Math.round(B * (1 - k * 0.55) + d[bi + 2] * k * 0.55);
              }
            }
          }
          ctx.putImageData(id, sx, sy);
        }
      } catch {
        /* ignore edges */
      }
    }
    lastPos.current = { x, y };
    markDirty();
  }

  // Real pixel distort: twirl/pinch/ripple/wave/zigzag/spherize/crystal + gallery II.
  // Operates on a dab-size block via offscreen rotate/scale/offset, visible and distinct.
  function distortTo(x: number, y: number, kind: DistortKind) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const last = lastPos.current ?? { x, y };
    const c = layerManager.ensure(activeLayerId, doc.width, doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const strength = brushOpacity / 100;
    const r = Math.max(4, brushSize / 2);
    for (const { px, py } of dabPath(last.x, last.y, x, y)) {
      if (!inSel(px, py)) continue;
      const s = Math.round(r * 2);
      const sx = Math.round(px - r);
      const sy = Math.round(py - r);
      if (sx < 0 || sy < 0 || sx + s > c.width || sy + s > c.height) continue;
      try {
        const tmp = getScratch(s, s);
        const tctx = tmp.getContext("2d")!;
        tctx.drawImage(c, sx, sy, s, s, 0, 0, s, s);
        ctx.save();
        ctx.clearRect(sx, sy, s, s);
        if (kind === "twirl" || kind === "twirl-ccw") {
          const ang = (kind === "twirl" ? 1 : -1) * (0.25 * strength + 0.08);
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tmp, -s / 2, -s / 2, s, s);
        } else if (kind === "pinch" || kind === "spherize") {
          const f = kind === "pinch" ? 1 - 0.18 * strength : 1 + 0.18 * strength;
          const dw = Math.max(2, s * f);
          const dh = Math.max(2, s * f);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tmp, px - dw / 2, py - dh / 2, dw, dh, sx, sy, s, s);
        } else if (kind === "ripple" || kind === "wave" || kind === "zigzag") {
          const amp = (kind === "zigzag" ? 6 : 4) * strength + 1;
          const freq = kind === "wave" ? 0.25 : 0.4;
          for (let yy = 0; yy < s; yy += 2) {
            const off =
              kind === "zigzag"
                ? ((yy % 8 < 4 ? 1 : -1) * amp) / 2
                : Math.sin(yy * freq) * amp;
            ctx.drawImage(tmp, 0, yy, s, 2, sx + off, sy + yy, s, 2);
          }
        } else if (kind === "crystal") {
          const cell = Math.max(3, Math.round(4 + 6 * strength));
          const small = getScratch(Math.max(1, Math.round(s / cell)), Math.max(1, Math.round(s / cell)));
          const dw2 = small.width;
          const dh2 = small.height;
          small.getContext("2d")!.drawImage(tmp, 0, 0, dw2, dh2);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(small, 0, 0, dw2, dh2, sx, sy, s, s);
          ctx.imageSmoothingEnabled = true;
          releaseScratch(small);
        } else if (kind === "bulge" || kind === "dent") {
          // Radial magnify (bulge) or minify (dent) around the dab center.
          const dir = kind === "bulge" ? 1 : -1;
          const f = 1 + dir * 0.22 * strength;
          const dw = Math.max(2, s * f);
          const dh = Math.max(2, s * f);
          ctx.globalAlpha = 0.95;
          if (dir > 0) ctx.drawImage(tmp, 0, 0, s, s, px - dw / 2, py - dh / 2, dw, dh);
          else ctx.drawImage(tmp, px - dw / 2, py - dh / 2, dw, dh, sx, sy, s, s);
        } else if (kind === "squeeze" || kind === "stretch") {
          // Horizontal squeeze vs stretch, vertical compensates opposite.
          const f = kind === "squeeze" ? 1 - 0.2 * strength : 1 + 0.2 * strength;
          const dw = Math.max(2, s * f);
          const dh = Math.max(2, s / f);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tmp, 0, 0, s, s, px - dw / 2, py - dh / 2, dw, dh);
        } else if (kind === "swirltight") {
          const ang = 0.55 * strength + 0.15;
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tmp, -s / 2, -s / 2, s, s);
        } else if (kind === "wavesbig" || kind === "ripplebig") {
          const amp = (kind === "wavesbig" ? 10 : 7) * strength + 2;
          const freq = kind === "wavesbig" ? 0.18 : 0.3;
          for (let yy = 0; yy < s; yy += 2) {
            const off = Math.sin(yy * freq) * amp;
            ctx.drawImage(tmp, 0, yy, s, 2, sx + off, sy + yy, s, 2);
          }
        } else if (kind === "glass") {
          // Refraction: offset rows by a smooth pseudo-random wobble.
          for (let yy = 0; yy < s; yy += 2) {
            const off = Math.round(Math.sin(yy * 0.55) * 3 * strength + Math.cos(yy * 0.21) * 2 * strength);
            ctx.drawImage(tmp, 0, yy, s, 2, sx + off, sy + yy, s, 2);
          }
        } else if (kind === "heat") {
          // Heat haze: vertical shimmer growing toward dab edges.
          for (let xx = 0; xx < s; xx += 2) {
            const edge = Math.abs(xx - s / 2) / (s / 2);
            const off = Math.round(Math.sin(xx * 0.7) * 4 * strength * edge);
            ctx.drawImage(tmp, xx, 0, 2, s, sx + xx, sy + off, 2, s);
          }
        } else if (kind === "melt") {
          // Gravity drip: lower columns stretch downward smoothly.
          for (let xx = 0; xx < s; xx += 2) {
            const drop = Math.round(Math.abs(Math.sin(xx * 0.35)) * 8 * strength);
            if (drop > 0) ctx.drawImage(tmp, xx, s - drop, 2, drop, sx + xx, sy + s - drop, 2, drop);
          }
        } else if (kind === "flag") {
          // Waving flag: horizontal sine with vertical amplitude envelope.
          for (let xx = 0; xx < s; xx += 2) {
            const env = Math.sin((xx / s) * Math.PI);
            const off = Math.round(Math.sin(xx * 0.4) * 6 * strength * env);
            ctx.drawImage(tmp, xx, 0, 2, s, sx + xx, sy + off, 2, s);
          }
        } else if (kind === "arctop" || kind === "arcbottom") {
          // Arc bend: rows shift horizontally along a parabola.
          const dir = kind === "arctop" ? -1 : 1;
          for (let yy = 0; yy < s; yy += 2) {
            const t = yy / s;
            const off = Math.round(dir * (t * t) * 14 * strength);
            ctx.drawImage(tmp, 0, yy, s, 2, sx + off, sy + yy, s, 2);
          }
        } else if (kind === "perspective") {
          // Slant shear toward a vanishing corner; Transform panel does full perspective.
          const slant = 0.22 * strength;
          ctx.translate(px, py);
          ctx.transform(1, 0, slant, 1, 0, 0);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(tmp, -s / 2, -s / 2, s, s);
        } else {
          // Defensive: unknown kinds restore pixels instead of leaving a hole.
          ctx.globalAlpha = 1;
          ctx.drawImage(tmp, 0, 0);
        }
        ctx.restore();
        releaseScratch(tmp);
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
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Paint bucket fill", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const ix = Math.max(0, Math.min(c.width - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(c.height - 1, Math.floor(y)));
    // If a selection exists, fill the selection with color (fast, Photoshop-style fill selection)
    // Bug fix: old code filled live layer then destination-in = erased everything outside.
    try {
      const selOn = isPointInSelection(ix, iy);
      if (hasSelection() && selOn) {
        const sel = selectionMaskCanvas();
        if (sel) {
          const tmp = document.createElement("canvas");
          tmp.width = c.width;
          tmp.height = c.height;
          const tctx = tmp.getContext("2d")!;
          tctx.globalAlpha = st.brushOpacity / 100;
          tctx.fillStyle = st.brushColor;
          tctx.fillRect(0, 0, tmp.width, tmp.height);
          tctx.globalCompositeOperation = "destination-in";
          tctx.globalAlpha = 1;
          tctx.drawImage(sel, 0, 0);
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.drawImage(tmp, 0, 0);
          ctx.restore();
          st.markDirty();
          useProStore.getState().bumpHistogram();
          return;
        }
      }
    } catch {
      /* fall through to flood fill */
    }
    // OOM guard: visited W*H bytes can be 64MB+ on 8K docs. Fall back to selection-safe solid.
    if (c.width * c.height > 9_000_000) {
      notify("Layer too large for flood fill. Used solid selection-safe fill instead.");
      fillSolidLayer();
      return;
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
      // Fase E: tolerance follows the options bar (default 24 * 1.75 = 42, same as before).
      const tol = Math.max(4, Math.min(160, useProStore.getState().selTolerance * 1.75));
      const contiguous = useProStore.getState().fillContiguous;
      // Snapshot the selection mask once: per-pixel isPointInSelection() would
      // cost a 1x1 getImageData for every visited pixel.
      let selData: Uint8ClampedArray | null = null;
      let selW = 0;
      let selH = 0;
      const selActive = hasSelection();
      if (selActive) {
        try {
          const sel = selectionMaskCanvas();
          if (sel) {
            selW = sel.width;
            selH = sel.height;
            selData = sel.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, selW, selH).data;
          }
        } catch {
          selData = null;
        }
      }
      const visited = new Uint8Array(W * H);
      const stack: number[] = [iy * W + ix];
      visited[iy * W + ix] = 1;
      let filled = 0;
      if (!contiguous) {
        // Global fill (Fase E toggle): every similar color in the whole
        // layer, still selection-aware and capped like the flood path.
        for (let yy = 0; yy < H && filled < 900000; yy++) {
          for (let xx = 0; xx < W && filled < 900000; xx++) {
            const o = (yy * W + xx) * 4;
            if (Math.abs(d[o] - sr) + Math.abs(d[o + 1] - sg) + Math.abs(d[o + 2] - sb) > tol * 3) continue;
            if (selData) {
              if (xx >= selW || yy >= selH || selData[(yy * selW + xx) * 4 + 3] <= 10) continue;
            }
            d[o] = fr;
            d[o + 1] = fg;
            d[o + 2] = fb;
            d[o + 3] = 255;
            filled++;
          }
        }
        ctx.putImageData(img, 0, 0);
        st.markDirty();
        useProStore.getState().bumpHistogram();
        setCursor(`Filled ${filled} px`);
        return;
      }
      while (stack.length && filled < 900000) {
        const cur = stack.pop()!;
        const cx = cur % W;
        const cy = Math.floor(cur / W);
        const o = cur * 4;
        const dr = Math.abs(d[o] - sr);
        const dg = Math.abs(d[o + 1] - sg);
        const db = Math.abs(d[o + 2] - sb);
        if (dr + dg + db > tol * 3) continue;
        if (selData) {
          if (cx < 0 || cy < 0 || cx >= selW || cy >= selH || selData[(cy * selW + cx) * 4 + 3] <= 10) continue;
        }
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
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    const cur = st.tool as string;
    if (snap) st.pushHistory({ label: cur === "pen-free" ? "Freeform pen" : cur === "line-arrow" ? "Arrow line" : tool === "pen" ? "Pen stroke" : "Line", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const ps = penStyleOf(st.tool);
    ctx.save();
    ctx.globalAlpha = st.brushOpacity / 100;
    ctx.strokeStyle = st.brushColor;
    ctx.fillStyle = st.brushColor;
    ctx.lineWidth = Math.max(1, (cur === "pen-free" ? st.brushSize / 6 : st.brushSize / 4) * ps.widthMul);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (ps.dashed) ctx.setLineDash([Math.max(4, st.brushSize / 2), Math.max(3, st.brushSize / 3)]);
    if (ps.glow) {
      ctx.shadowColor = st.brushColor;
      ctx.shadowBlur = st.brushSize;
    }
    // Store the path for the Paths tab before rasterizing.
    try {
      useProStore.getState().addPath({ name: `${cur} path`, kind: cur === "line" || cur === "line-arrow" ? "line" : "pen", points: [{ x: Math.round(x0), y: Math.round(y0) }, { x: Math.round(x1), y: Math.round(y1) }] });
    } catch { /* paths optional */ }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (cur === "line" || cur === "line-arrow" || cur === "pen-arrow-both") {
      ctx.lineTo(x1, y1);
    } else if (cur === "pen-free") {
      // Manual freehand: slight mid wobble for organic ink feel.
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      ctx.quadraticCurveTo(mx, my, x1, y1);
    } else {
      const mx = (x0 + x1) / 2;
      ctx.quadraticCurveTo(x0, y0, mx, (y0 + y1) / 2);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    const arrowAt = (ax: number, ay: number, ang: number) => {
      const L = Math.max(10, st.brushSize * 0.9 * ps.widthMul);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - L * Math.cos(ang - 0.42), ay - L * Math.sin(ang - 0.42));
      ctx.lineTo(ax - L * Math.cos(ang + 0.42), ay - L * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    };
    if (cur === "line-arrow") {
      // Manual arrow head at end point.
      arrowAt(x1, y1, Math.atan2(y1 - y0, x1 - x0));
    } else if (cur === "line-arrow-both" || cur === "pen-arrow-both") {
      arrowAt(x1, y1, Math.atan2(y1 - y0, x1 - x0));
      arrowAt(x0, y0, Math.atan2(y0 - y1, x0 - x1));
    }
    ctx.restore();
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  function applyCrop() {
    const st = useEditorStore.getState();
    if (!cropDrag) return;
    const curTool = st.tool as string;
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
      if (snap) st.pushHistory({ label: curTool === "crop-straighten" ? "Straighten crop" : `Crop ${curTool}`, layerId: l.id, snapshot: snap });
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
    if (curTool === "crop-straighten") st.setViewRotate(0);
    if (curTool === "perspective-crop") notify("Perspective Crop applied as rect crop. Adjust corners further in Transform panel.");
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
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Radial gradient", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const [stop0, stop1] = gradEnds();
    const rad = Math.max(c.width, c.height) * 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, stop0);
    g.addColorStop(1, stop1);
    // Bug fix: paint via temp so selection never erases outside pixels.
    const sel = selectionMaskCanvas();
    const hasSel = sel && hasSelection();
    if (!hasSel) {
      ctx.save();
      ctx.globalAlpha = st.brushOpacity / 100;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    } else {
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      const tctx = tmp.getContext("2d")!;
      tctx.globalAlpha = st.brushOpacity / 100;
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.globalCompositeOperation = "destination-in";
      tctx.globalAlpha = 1;
      tctx.drawImage(sel!, 0, 0);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    }
    if (gradDitherOn()) applyDitherToLayer(id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  // Manual 2026: solid / clear / diamond fills. All undoable, selection-safe.
  function fillSolidLayer() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Solid fill", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      const tctx = tmp.getContext("2d")!;
      tctx.globalAlpha = st.brushOpacity / 100;
      tctx.fillStyle = st.brushColor;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.globalCompositeOperation = "destination-in";
      tctx.globalAlpha = 1;
      tctx.drawImage(sel, 0, 0);
      ctx.save();
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = st.brushOpacity / 100;
      ctx.fillStyle = st.brushColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    }
    st.markDirty();
    useProStore.getState().bumpHistogram();
    setCursor(`Solid ${st.brushColor}`);
  }

  function clearLayerToTransparent() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: meta.kind === "background" ? "Clear to background" : "Clear fill", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    // plan3 Fase 0/12: clearing the paper refills the background color
    // (Photoshop Delete semantics) instead of punching transparency holes.
    const paperFill = meta.kind === "background" ? st.bgColor || "#ffffff" : null;
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      if (paperFill) {
        const tmp = document.createElement("canvas");
        tmp.width = c.width;
        tmp.height = c.height;
        const tctx = tmp.getContext("2d")!;
        tctx.globalAlpha = st.brushOpacity / 100;
        tctx.fillStyle = paperFill;
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.globalCompositeOperation = "destination-in";
        tctx.globalAlpha = 1;
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
    } else if (paperFill) {
      ctx.save();
      ctx.globalAlpha = st.brushOpacity / 100;
      ctx.fillStyle = paperFill;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    } else {
      ctx.clearRect(0, 0, c.width, c.height);
    }
    st.markDirty();
    useProStore.getState().bumpHistogram();
    setCursor(paperFill ? `Paper ${paperFill}` : "Cleared");
  }

  function applyDiamondGradient(x: number, y: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Diamond gradient", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    // Diamond = linear diagonal from click to bottom-right, fixed 45deg manual look.
    const x1 = Math.min(c.width, x + Math.max(c.width, c.height) * 0.5);
    const y1 = Math.min(c.height, y + Math.max(c.width, c.height) * 0.5);
    const [stop0, stop1] = gradEnds();
    const g = ctx.createLinearGradient(x, y, x1, y1);
    g.addColorStop(0, stop0);
    g.addColorStop(1, stop1);
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      const tctx = tmp.getContext("2d")!;
      tctx.globalAlpha = st.brushOpacity / 100;
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.globalCompositeOperation = "destination-in";
      tctx.globalAlpha = 1;
      tctx.drawImage(sel, 0, 0);
      ctx.save();
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = st.brushOpacity / 100;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    }
    if (gradDitherOn()) applyDitherToLayer(id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
    setCursor("Diamond gradient");
  }

  // Shared selection-safe painter: draws a full-layer paint fn, clipped to selection.
  // dither: run the anti-banding grain pass inside the same history entry.
  function paintFullLayer(label: string, paint: (g: CanvasRenderingContext2D, W: number, H: number) => void, dither = false) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label, layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      const tctx = tmp.getContext("2d")!;
      tctx.save();
      tctx.globalAlpha = st.brushOpacity / 100;
      paint(tctx, tmp.width, tmp.height);
      tctx.restore();
      tctx.globalCompositeOperation = "destination-in";
      tctx.globalAlpha = 1;
      tctx.drawImage(sel, 0, 0);
      ctx.save();
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = st.brushOpacity / 100;
      paint(ctx, c.width, c.height);
      ctx.restore();
    }
    if (dither && gradDitherOn()) applyDitherToLayer(id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
    setCursor(label);
  }

  // Final stop pair writer. The pair already encodes transparency and
  // direction (see gradEnds), so both ends are painted verbatim.
  function gradStops(g: CanvasGradient, stop0: string, stop1: string) {
    g.addColorStop(0, stop0);
    g.addColorStop(1, stop1);
  }

  // Stop pair for CanvasGradient ends. stop0 goes at offset 0, stop1 at
  // offset 1. Never parsed as hex downstream, safe to be rgba.
  function gradEnds(): [string, string] {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const base = st.brushColor;
    const tgt = pro.gradTo === "white" ? "#ffffff" : pro.gradTo === "black" ? "#000000" : "transparent";
    if (tgt === "transparent") {
      return pro.gradReverse ? [withAlpha(base, 0), base] : [base, withAlpha(base, 0)];
    }
    return pro.gradReverse ? [tgt, base] : [base, tgt];
  }

  // Deterministic grain pass that kills gradient banding (Fase E dither toggle).
  // Runs inside the same history entry as the gradient, so undo stays single-step.
  function applyDitherToLayer(id: string) {
    try {
      const c = layerManager.ensure(id, doc.width, doc.height);
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      let s = 1234567;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const n = (s % 11) - 5;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
      ctx.putImageData(img, 0, 0);
    } catch {
      /* ignore */
    }
  }

  function gradDitherOn(): boolean {
    return useProStore.getState().gradDither;
  }

  function applyConicGradient(x: number, y: number) {
    const st = useEditorStore.getState();
    const base = st.brushColor;
    const [stop0, stop1] = gradEnds();
    const clearEnd = stop0.startsWith("rgba") ? 0 : stop1.startsWith("rgba") ? 1 : -1;
    paintFullLayer("Conic gradient", (g, W, H) => {
      // Angular sweep approximation: 72 wedges around the click point.
      const steps = 72;
      for (let k = 0; k < steps; k++) {
        const a0 = (k / steps) * Math.PI * 2;
        const a1 = ((k + 1) / steps) * Math.PI * 2;
        const t = k / (steps - 1);
        g.fillStyle =
          clearEnd === 1 ? withAlpha(base, 1 - t) : clearEnd === 0 ? withAlpha(base, t) : mixHex(stop0, stop1, t);
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, Math.max(W, H), a0, a1 + 0.02);
        g.closePath();
        g.fill();
      }
    }, true);
  }

  function withAlpha(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
  }

  function mixHex(a: string, b: string, t: number): string {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `rgb(${m[0]},${m[1]},${m[2]})`;
  }

  function applyReflectedGradient(x: number, y: number) {
    const st = useEditorStore.getState();
    const base = st.brushColor;
    const [stop0, stop1] = gradEnds();
    const clearEnd = stop0.startsWith("rgba") ? 0 : stop1.startsWith("rgba") ? 1 : -1;
    paintFullLayer("Reflected gradient", (g, W, H) => {
      const half = Math.max(W, H) * 0.5;
      const lg = g.createLinearGradient(x - half, y, x + half, y);
      if (clearEnd >= 0) {
        lg.addColorStop(0, withAlpha(base, 0));
        lg.addColorStop(0.5, base);
        lg.addColorStop(1, withAlpha(base, 0));
      } else {
        lg.addColorStop(0, stop1);
        lg.addColorStop(0.5, stop0);
        lg.addColorStop(1, stop1);
      }
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
    }, true);
  }

  function applyNoiseGradient(x: number, y: number) {
    const [stop0, stop1] = gradEnds();
    paintFullLayer("Noise gradient", (g, W, H) => {
      const lg = g.createLinearGradient(x, y, x + Math.max(W, H) * 0.6, y);
      gradStops(lg, stop0, stop1);
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      // Deterministic dither kills banding.
      const id = g.getImageData(0, 0, W, H);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (((i / 4) * 73) % 17) - 8;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
      g.putImageData(id, 0, 0);
    }, true);
  }

  function applyDiamondSoftGradient(x: number, y: number) {
    const st = useEditorStore.getState();
    const base = st.brushColor;
    const [stop0, stop1] = gradEnds();
    const clearEnd = stop0.startsWith("rgba") ? 0 : stop1.startsWith("rgba") ? 1 : -1;
    const br = parseInt(base.slice(1, 3), 16);
    const bg = parseInt(base.slice(3, 5), 16);
    const bb = parseInt(base.slice(5, 7), 16);
    const s0 = clearEnd < 0 ? [parseInt(stop0.slice(1, 3), 16), parseInt(stop0.slice(3, 5), 16), parseInt(stop0.slice(5, 7), 16)] : [br, bg, bb];
    const s1 = clearEnd < 0 ? [parseInt(stop1.slice(1, 3), 16), parseInt(stop1.slice(3, 5), 16), parseInt(stop1.slice(5, 7), 16)] : [br, bg, bb];
    paintFullLayer("Soft diamond gradient", (g, W, H) => {
      const img = g.createImageData(W, H);
      const d = img.data;
      const maxD = (Math.abs(W) + Math.abs(H)) / 2 || 1;
      for (let yy = 0; yy < H; yy++) {
        for (let xx = 0; xx < W; xx++) {
          const t = Math.min(1, (Math.abs(xx - x) + Math.abs(yy - y)) / maxD);
          const e = t * t * (3 - 2 * t);
          const i = (yy * W + xx) * 4;
          d[i] = Math.round(s0[0] + (s1[0] - s0[0]) * e);
          d[i + 1] = Math.round(s0[1] + (s1[1] - s0[1]) * e);
          d[i + 2] = Math.round(s0[2] + (s1[2] - s0[2]) * e);
          const a = clearEnd === 1 ? 1 - e : clearEnd === 0 ? e : 1;
          d[i + 3] = Math.round(255 * a * (st.brushOpacity / 100));
        }
      }
      g.putImageData(img, 0, 0);
    }, true);
  }

  function fillBackgroundLayer() {
    const st = useEditorStore.getState();
    const bg = st.bgColor || "#ffffff";
    paintFullLayer("Background fill", (g, W, H) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
    });
    setCursor(`Background ${bg}`);
  }

  function fillPatternNewLayer() {
    const st = useEditorStore.getState();
    const motif = useProStore.getState().patternMotif;
    const s = Math.max(16, Math.round(st.brushSize * 2));
    paintFullLayer(`Pattern fill (${motif})`, (g, W, H) => {
      const tile = patternTile(motif, s, st.brushColor);
      const pat = g.createPattern(tile, "repeat");
      if (pat) {
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
      }
    });
  }

  // Shared motif tile builder used by the stamp engine and pattern fills.
  function patternTile(motif: "checker" | "dots" | "stripes" | "grid", s: number, color: string): HTMLCanvasElement {
    const tile = document.createElement("canvas");
    tile.width = s;
    tile.height = s;
    const t = tile.getContext("2d")!;
    if (motif === "dots") {
      t.fillStyle = "#ffffff";
      t.fillRect(0, 0, s, s);
      t.fillStyle = color;
      const cell = Math.max(4, Math.round(s / 4));
      for (let yy = cell / 2; yy < s; yy += cell) {
        for (let xx = cell / 2; xx < s; xx += cell) {
          t.beginPath();
          t.arc(xx, yy, Math.max(1, cell * 0.28), 0, Math.PI * 2);
          t.fill();
        }
      }
    } else if (motif === "stripes") {
      t.fillStyle = "#ffffff";
      t.fillRect(0, 0, s, s);
      t.fillStyle = color;
      const cell = Math.max(3, Math.round(s / 6));
      for (let xx = 0; xx < s; xx += cell * 2) {
        t.globalAlpha = 0.9;
        t.fillRect(xx, 0, cell, s);
      }
      t.globalAlpha = 1;
    } else if (motif === "grid") {
      t.fillStyle = "#ffffff";
      t.fillRect(0, 0, s, s);
      t.strokeStyle = color;
      t.globalAlpha = 0.9;
      t.lineWidth = Math.max(1, Math.round(s / 24));
      const cell = Math.max(4, Math.round(s / 4));
      t.beginPath();
      for (let v = 0; v <= s; v += cell) {
        t.moveTo(v + 0.5, 0);
        t.lineTo(v + 0.5, s);
        t.moveTo(0, v + 0.5);
        t.lineTo(s, v + 0.5);
      }
      t.stroke();
      t.globalAlpha = 1;
    } else {
      t.fillStyle = "#ffffff";
      t.fillRect(0, 0, s, s);
      t.fillStyle = color;
      const cell = Math.max(3, Math.round(s / 6));
      for (let yy = 0; yy < s; yy += cell) {
        for (let xx = 0; xx < s; xx += cell) {
          t.globalAlpha = 0.85;
          if (((xx + yy) / cell) % 2 === 0) t.fillRect(xx, yy, cell, cell);
        }
      }
      t.globalAlpha = 1;
    }
    return tile;
  }

  function fillContentClick(x: number, y: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Content fill click", layerId: id, snapshot: snap });
    lastPos.current = { x, y };
    captureStrokeSel();
    retouchTo(x, y, "content-fill");
    st.markDirty();
    bumpHistogram();
  }

  function fillHistoryClick(x: number, y: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) {
      st.pushHistory({ label: "History fill click", layerId: id, snapshot: snap });
      historySource.current = snap;
      historyCanvas.current = null;
    }
    lastPos.current = { x, y };
    captureStrokeSel();
    historyBrushTo(x, y, false, id);
    st.markDirty();
    bumpHistogram();
  }

  function fillTransparentProtect() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Protect fill", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    try {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      const fr = parseInt(st.brushColor.slice(1, 3), 16);
      const fg = parseInt(st.brushColor.slice(3, 5), 16);
      const fb = parseInt(st.brushColor.slice(5, 7), 16);
      const a = st.brushOpacity / 100;
      const sel = selectionMaskCanvas();
      const useSel = sel && hasSelection() ? sel.getContext("2d")!.getImageData(0, 0, c.width, c.height).data : null;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        if (useSel && useSel[i + 3] < 10) continue;
        d[i] = Math.round(d[i] + (fr - d[i]) * a);
        d[i + 1] = Math.round(d[i + 1] + (fg - d[i + 1]) * a);
        d[i + 2] = Math.round(d[i + 2] + (fb - d[i + 2]) * a);
      }
      ctx.putImageData(img, 0, 0);
    } catch { /* ignore */ }
    st.markDirty();
    useProStore.getState().bumpHistogram();
    setCursor("Protected fill");
  }

  function fillGlobalAt(x: number, y: number) {
    // Global (non-contiguous) fill: every similar pixel on the layer.
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const comp = getCompositeCanvas();
    if (!comp) {
      floodFillAt(x, y);
      return;
    }
    try {
      const ix = Math.max(0, Math.min(comp.width - 1, Math.floor(x)));
      const iy = Math.max(0, Math.min(comp.height - 1, Math.floor(y)));
      const d = comp.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1).data;
      const hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const full = comp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, comp.width, comp.height);
      colorRangeSelection(comp.width, comp.height, full, hex, 24);
      floodFillAt(x, y);
      setCursor(`Global fill ${hex}`);
    } catch {
      floodFillAt(x, y);
    }
  }

  function applyGradient(x0: number, y0: number, x1: number, y1: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Gradient", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    const [stop0, stop1] = gradEnds();
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, stop0);
    g.addColorStop(1, stop1);
    // Bug fix: selection-safe via temp (was destination-in on live layer = erased outside).
    const sel = selectionMaskCanvas();
    if (sel && hasSelection()) {
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      const tctx = tmp.getContext("2d")!;
      tctx.globalAlpha = st.brushOpacity / 100;
      tctx.fillStyle = g;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.globalCompositeOperation = "destination-in";
      tctx.globalAlpha = 1;
      tctx.drawImage(sel, 0, 0);
      ctx.save();
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = st.brushOpacity / 100;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    }
    if (gradDitherOn()) applyDitherToLayer(id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  // Enter applies crop, Esc cancels. Active for all crop preset tools.
  useEffect(() => {
    if (!isCrop || !cropDrag) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") applyCrop();
      if (e.key === "Escape") setCropDrag(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, cropDrag, isCrop]);

  // Eyedropper: pick color from the composite then return to brush.
  function pickColor(p: { x: number; y: number }) {
    const pro = useProStore.getState();
    const ix = Math.max(0, Math.floor(p.x));
    const iy = Math.max(0, Math.floor(p.y));
    try {
      let d: Uint8ClampedArray | null = null;
      // Fase E sample mode: current layer only, or the full composite.
      if (pro.sampleMode === "current") {
        const aid = useEditorStore.getState().activeLayerId;
        const c = aid ? layerManager.get(aid) : null;
        if (c && ix < c.width && iy < c.height) {
          d = c.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1).data;
        }
      }
      if (!d) {
        const comp = getCompositeCanvas();
        if (!comp) return;
        const cx = Math.max(0, Math.min(comp.width - 1, ix));
        const cy = Math.max(0, Math.min(comp.height - 1, iy));
        d = comp.getContext("2d", { willReadFrequently: true })!.getImageData(cx, cy, 1, 1).data;
      }
      const hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const st = useEditorStore.getState();
      st.setBrush({ color: hex });
      if (st.tool === "eyedropper") st.setTool("brush");
      setCursor(`Color ${hex}`);
    } catch {
      /* ignore */
    }
  }

  function handleWandClick(p: { x: number; y: number }, forceMode?: SelCombineMode) {
    const comp = getCompositeCanvas();
    if (!comp) return;
    try {
      const id = comp
        .getContext("2d", { willReadFrequently: true })!
        .getImageData(0, 0, comp.width, comp.height);
      const pro = useProStore.getState();
      const tol = pro.selTolerance;
      wandFromImage(comp.width, comp.height, id, p.x, p.y, tol, forceMode ?? pro.selMode);
      const feather = pro.selFeather;
      if (feather > 0) featherSelection(feather);
      setAnts((a) => a + 1);
    } catch {
      /* ignore */
    }
  }

  function createTextLayer(
    p: { x: number; y: number },
    presetText?: string,
    vertical = false,
    fx:
      | "none"
      | "outline"
      | "glow"
      | "shadow"
      | "arc"
      | "3d"
      | "neon"
      | "gradient"
      | "typewriter"
      | "blocky"
      | "condensed"
      | "expanded"
      | "emboss"
      | "engrave"
      | "chrome"
      | "fire"
      | "ice"
      | "retro" = "none",
  ) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const fxName = fx === "none" ? "Text" : `Text ${fx}`;
    const l = makeLayer(`${fxName} ${st.layers.length + 1}`);
    (l as unknown as { kind: string }).kind = "text";
    layerManager.ensure(l.id, doc.width, doc.height);
    // Fase E: new text layers inherit the top bar text defaults.
    const td = pro.textDefaults;
    const spec = {
      text: presetText ?? "Edit text in panel",
      fontFamily: fx === "typewriter" ? "monospace" : td.fontFamily,
      fontSize: td.fontSize,
      color: fx === "outline" ? "#2f7cf6" : td.color,
      bold: td.bold,
      italic: td.italic,
      tracking: fx === "blocky" ? 6 : td.tracking,
      leading: td.leading,
      // plan3 Fase 14: anchor + effect travel with the spec so panel/top-bar
      // edits re-render the same look at the same position.
      fx,
      x: Math.round(p.x),
      y: Math.round(p.y),
    };
    if (vertical && !presetText) spec.text = spec.text.split("").join("\n");
    if (fx === "arc" && !presetText) spec.text = "ARC TEXT";
    if (fx === "3d" && !presetText) spec.text = "3D TEXT";
    if (fx === "neon" && !presetText) spec.text = "NEON";
    if (fx === "gradient" && !presetText) spec.text = "GRADIENT";
    if (fx === "typewriter" && !presetText) spec.text = "Typewriter text";
    if (fx === "blocky" && !presetText) spec.text = "BLOCKY";
    if (fx === "condensed" && !presetText) spec.text = "Condensed";
    if (fx === "expanded" && !presetText) spec.text = "Expanded";
    if (fx === "emboss" && !presetText) spec.text = "EMBOSS";
    if (fx === "engrave" && !presetText) spec.text = "ENGRAVE";
    if (fx === "chrome" && !presetText) spec.text = "CHROME";
    if (fx === "fire" && !presetText) spec.text = "FIRE";
    if (fx === "ice" && !presetText) spec.text = "ICE";
    if (fx === "retro" && !presetText) spec.text = "RETRO";
    pro.setTextSpec(l.id, spec);
    const c = layerManager.ensure(l.id, doc.width, doc.height);
    // plan3 Fase 14: single shared fx renderer (see textShape.renderTextFxToLayer).
    renderTextFxToLayer(c, spec, fx, Math.round(p.x), Math.round(p.y));
    st.addLayer({ ...l, kind: "text" });
    st.setActiveLayer(l.id);
    lastPaintRef.current = l.id;
    pro.ensureTransform(l.id);
    if (fx === "condensed") pro.updateTransform(l.id, { scaleX: 0.8 });
    if (fx === "expanded") pro.updateTransform(l.id, { scaleX: 1.25 });
    markDirty();
  }

  function createShapeLayer(
    kind:
      | "rect"
      | "ellipse"
      | "polygon"
      | "triangle"
      | "line"
      | "star"
      | "arrow"
      | "custom"
      | "rounded"
      | "diamond"
      | "heart"
      | "hexagon"
      | "burst"
      | "donut"
      | "chevron"
      | "moon"
      | "cross"
      | "plus"
      | "trapezoid"
      | "trapezoid-wide"
      | "parallelogram"
      | "pentagon"
      | "octagon"
      | "shield"
      | "badge"
      | "ribbon"
      | "cloud"
      | "speech"
      | "gear"
      | "drop"
      | "leaf"
      | "lightning"
      | "crown"
      | "pin"
      | "ticket",
    sides = 6,
    namePrefix?: string,
  ) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const l = makeLayer(`${namePrefix ?? "Shape"} ${st.layers.length + 1}`);
    layerManager.ensure(l.id, doc.width, doc.height);
    const isFrame = namePrefix === "Frame";
    const isArtboard = namePrefix === "Artboard";
    // Fase E: new shapes inherit the top bar shape defaults.
    const sd = pro.shapeDefaults;
    const spec = {
      kind,
      fill: isFrame ? "rgba(47,124,246,0.08)" : isArtboard ? "#ffffff" : sd.fill,
      stroke: isFrame ? "#2f7cf6" : sd.stroke,
      strokeWidth: isFrame || isArtboard ? 2 : sd.strokeWidth,
      sides: kind === "triangle" ? 3 : kind === "hexagon" ? 6 : kind === "star" ? 5 : sides,
      rotation: 0,
    };
    pro.setShapeSpec(l.id, spec);
    renderShapeToLayer(layerManager.ensure(l.id, doc.width, doc.height), spec);
    st.addLayer({ ...l, kind: "shape" });
    st.setActiveLayer(l.id);
    lastPaintRef.current = l.id;
    pro.ensureTransform(l.id);
    markDirty();
  }

  // Clone variants: mirror / rotate / soft source sampling.
  // Manual 2026: soft = 60 percent opacity clone. Uses snapshot source to avoid self-feedback smear.
  function cloneToVariant(x: number, y: number, variant: "normal" | "mirror" | "rotate" | "soft") {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const src = useProStore.getState().cloneSource;
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
    // Snapshot once per stroke so overlapping source/dest never smears.
    if (!(cloneToVariant as unknown as { _src?: HTMLCanvasElement; _id?: string })._src || (cloneToVariant as unknown as { _id?: string })._id !== activeLayerId) {
      const snap = document.createElement("canvas");
      snap.width = c.width;
      snap.height = c.height;
      snap.getContext("2d")!.drawImage(c, 0, 0);
      (cloneToVariant as unknown as { _src?: HTMLCanvasElement })._src = snap;
      (cloneToVariant as unknown as { _id?: string })._id = activeLayerId;
    }
    const srcCanvas = (cloneToVariant as unknown as { _src?: HTMLCanvasElement })._src ?? c;
    ctx.save();
    ctx.globalAlpha = variant === "soft" ? (brushOpacity / 100) * 0.6 : brushOpacity / 100;
    for (let i = 0; i <= steps; i++) {
      const px = last.x + (dx * i) / steps;
      const py = last.y + (dy * i) / steps;
      if (!inSel(px, py)) continue;
      const sx = px - ox;
      const sy = py - oy;
      if (variant === "normal" || variant === "soft") {
        ctx.drawImage(srcCanvas, sx - r, sy - r, r * 2, r * 2, px - r, py - r, r * 2, r * 2);
      } else {
        const s = Math.max(2, Math.round(r * 2));
        const tmp = getScratch(s, s);
        const tctx = tmp.getContext("2d")!;
        tctx.drawImage(srcCanvas, sx - r, sy - r, s, s, 0, 0, s, s);
        ctx.save();
        ctx.translate(px, py);
        if (variant === "mirror") ctx.scale(-1, 1);
        else ctx.rotate(Math.PI / 2);
        ctx.drawImage(tmp, -r, -r, r * 2, r * 2);
        ctx.restore();
        releaseScratch(tmp);
      }
    }
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  function applyPenCurved(x0: number, y0: number, x1: number, y1: number) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    const meta = st.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const snap = layerManager.snapshot(id);
    if (snap) st.pushHistory({ label: "Curvature pen", layerId: id, snapshot: snap });
    const c = layerManager.ensure(id, st.doc.width, st.doc.height);
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.globalAlpha = st.brushOpacity / 100;
    ctx.strokeStyle = st.brushColor;
    ctx.lineWidth = Math.max(1, st.brushSize / 4);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const bend = Math.hypot(x1 - x0, y1 - y0) * 0.25;
    // S-curve: two cubic segments with opposite control offsets
    ctx.bezierCurveTo(mx - bend, y0, mx + bend, y1, x1, y1);
    ctx.stroke();
    void my;
    ctx.restore();
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  // AI Assist: real offline approximations using existing stores (never dead).
  function aiAssist(kind: string, p: { x: number; y: number }) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    if (kind === "ai-subject" || kind === "ai-bg-remove") {
      const comp = getCompositeCanvas();
      if (!comp) return;
      try {
        const id = comp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, comp.width, comp.height);
        const tol = Math.max(pro.selTolerance, 30);
        wandFromImage(comp.width, comp.height, id, p.x, p.y, tol, pro.selMode);
        expandContractSelection(3);
        if (pro.selFeather > 0) featherSelection(pro.selFeather);
        setAnts((a) => a + 1);
        if (kind === "ai-bg-remove" && st.activeLayerId) {
          pro.ensureMask(st.activeLayerId);
          pro.updateMask(st.activeLayerId, { enabled: true, hasMask: true });
          notify("BG Remove: subject selected + mask added. Paint mask to refine, Delete to clear.");
        } else {
          notify("AI Subject: subject selected from click point.");
        }
        window.dispatchEvent(new Event("avero:selection-changed"));
      } catch {
        /* ignore */
      }
      return;
    }
    if (kind === "ai-upscale") {
      const w = Math.min(16384, st.doc.width * 2);
      const h = Math.min(16384, st.doc.height * 2);
      if (w === st.doc.width && h === st.doc.height) {
        notify("Document is already at maximum size (16384px).");
        return;
      }
      // snapshot every layer so upscale stays undoable
      st.layers.forEach((l) => {
        const snap = layerManager.snapshot(l.id);
        if (snap) st.pushHistory({ label: "Upscale 2x", layerId: l.id, snapshot: snap });
      });
      st.layers.forEach((l) => {
        const c = layerManager.get(l.id);
        if (!c) return;
        const tmp = document.createElement("canvas");
        tmp.width = c.width;
        tmp.height = c.height;
        tmp.getContext("2d")!.drawImage(c, 0, 0);
        c.width = w;
        c.height = h;
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        g.drawImage(tmp, 0, 0, w, h);
        // keep layer mask aligned with the new size
        const mc = layerManager.getMask(l.id);
        if (mc) {
          const mtmp = document.createElement("canvas");
          mtmp.width = mc.width;
          mtmp.height = mc.height;
          mtmp.getContext("2d")!.drawImage(mc, 0, 0);
          mc.width = w;
          mc.height = h;
          mc.getContext("2d")!.drawImage(mtmp, 0, 0, w, h);
        }
      });
      st.setDocSize(w, h);
      notify(`Upscaled 2x to ${w}x${h}. Undo restores every layer.`);
      return;
    }
    if (kind === "ai-denoise") {
      pro.addFilter("reduceNoise");
      notify("AI Denoise: Reduce-Noise filter added (tune in Filter panel).");
      return;
    }
    if (kind === "ai-colorize") {
      pro.addAdjustment("vibrance");
      pro.addAdjustment("colorLookup");
      notify("AI Color: Vibrance + Color Lookup added.");
      return;
    }
    if (kind === "ai-sky") {
      pro.addAdjustment("hueSaturation");
      pro.addAdjustment("brightnessContrast");
      notify("Sky Enhance: Hue/Sat + Brightness/Contrast added.");
    }
  }

  function pinSampler(p: { x: number; y: number }, avg: boolean, size = 5) {
    const comp = getCompositeCanvas();
    if (!comp) return;
    try {
      const g = comp.getContext("2d", { willReadFrequently: true })!;
      let hex = "#000000";
      if (!avg) {
        const ix = Math.max(0, Math.min(comp.width - 1, Math.floor(p.x)));
        const iy = Math.max(0, Math.min(comp.height - 1, Math.floor(p.y)));
        const d = g.getImageData(ix, iy, 1, 1).data;
        hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      } else {
        // Bug fix: average sampler now also sets brush color (was readout-only, felt dead).
        const s = Math.max(3, Math.min(21, Math.round(size)));
        const ix = Math.max(0, Math.min(comp.width - s, Math.floor(p.x - s / 2)));
        const iy = Math.max(0, Math.min(comp.height - s, Math.floor(p.y - s / 2)));
        const id = g.getImageData(ix, iy, s, s);
        let r = 0;
        let gg = 0;
        let b = 0;
        for (let i = 0; i < id.data.length; i += 4) {
          r += id.data[i];
          gg += id.data[i + 1];
          b += id.data[i + 2];
        }
        const n = id.data.length / 4;
        hex = `#${[Math.round(r / n), Math.round(gg / n), Math.round(b / n)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      }
      useEditorStore.getState().setBrush({ color: hex });
      useProStore.getState().addSampler({ x: Math.round(p.x), y: Math.round(p.y), color: hex });
      setCursor(`Sampler ${hex}`);
    } catch {
      /* ignore */
    }
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
          if ((tool === "select-polygon" || tool === "magnetic-lasso" || tool === "lasso-straight") && lassoPts.length > 2) {
            drawLassoSelection(doc.width, doc.height, lassoPts);
            if (tool === "magnetic-lasso") expandContractSelection(2);
            const feather = useProStore.getState().selFeather;
            if (feather > 0) featherSelection(feather);
            setLassoPts([]);
            window.dispatchEvent(new Event("avero:selection-changed"));
          }
          if (tool === "rotate-view") {
            setViewRotate(0);
            setCursor("Rotate reset 0deg");
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
          if (e.button === 2) return;
          if (e.button === 1 || tool === "pan" || tool === "hand") {
            panning.current = { sx: e.clientX, sy: e.clientY, px: panX, py: panY };
            return;
          }
          const p = toDocCoords(e);
          if (tool === "rotate-view") {
            rotateStart.current = { x: e.clientX, rot: useEditorStore.getState().viewRotate };
            panning.current = null;
            return;
          }
          if (tool === "direct-select") {
            // Direct: drag horizontally to rotate the active shape/vector layer.
            const st = useEditorStore.getState();
            const id = st.activeLayerId;
            if (!id) return;
            const spec = useProStore.getState().shapeSpecs[id];
            const meta = st.layers.find((l) => l.id === id);
            if (!spec || !meta || (meta.kind !== "shape" && meta.kind !== "text")) {
              notify("Direct Selection: select a Shape or Text layer first, then drag to rotate it.");
              return;
            }
            if (meta.locked || !meta.visible) {
              notify("Active layer is locked or hidden. Unlock it first.");
              return;
            }
            directStart.current = { x: e.clientX, rotation: spec.rotation, layerId: id };
            return;
          }
          if (tool === "move" || tool === "path-select" || tool === "move-auto" || tool === "transform-free" || tool === "align-center") {
            if (tool === "align-center") {
              const st = useEditorStore.getState();
              const id = st.activeLayerId;
              if (!id) {
                notify("Align Center: no active layer.");
                return;
              }
              const meta = st.layers.find((l) => l.id === id);
              if (!meta || meta.locked || !meta.visible) {
                notify("Active layer is locked or hidden. Unlock it first.");
                return;
              }
              const snap = layerManager.snapshot(id);
              useProStore.getState().ensureTransform(id);
              if (snap) st.pushHistory({ label: "Align center", layerId: id, snapshot: snap });
              useProStore.getState().updateTransform(id, { x: 0, y: 0 });
              setCursor("Centered 0,0");
              markDirty();
              bumpHistogram();
              return;
            }
            if (tool === "move-auto") {
              // Manual auto-pick: topmost visible unlocked layer with opaque pixel at click.
              const st = useEditorStore.getState();
              const ordered = [...st.layers].reverse();
              let picked: string | null = null;
              for (const l of ordered) {
                if (!l.visible || l.locked) continue;
                const c = layerManager.get(l.id);
                if (!c) continue;
                const ix = Math.floor(p.x);
                const iy = Math.floor(p.y);
                if (ix < 0 || iy < 0 || ix >= c.width || iy >= c.height) continue;
                try {
                  const a = c.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1).data[3];
                  if (a > 8) {
                    picked = l.id;
                    break;
                  }
                } catch { /* try next */ }
              }
              if (picked && picked !== st.activeLayerId) {
                st.setActiveLayer(picked);
                const nm = st.layers.find((l) => l.id === picked)?.name ?? picked;
                setCursor(`Auto ${nm}`);
              } else if (!picked) {
                setCursor("Auto: empty area");
              }
              // fall through to drag with (possibly new) active layer
            }
            if (tool === "transform-free") {
              const st = useEditorStore.getState();
              const id = st.activeLayerId;
              if (id) useProStore.getState().ensureTransform(id);
            }
            if (tool === "path-select") {
              const st = useEditorStore.getState();
              const vec = [...st.layers].reverse().find((l) => l.kind === "shape" || l.kind === "text");
              if (vec && vec.id !== st.activeLayerId) st.setActiveLayer(vec.id);
              else if (!vec) {
                notify("Path Selection: no vector/text layer yet. Draw a shape or add text first.");
                return;
              }
            }
            // Fase 3 (plan3): move-family tools refuse locked/hidden layers here,
            // single choke point covering move, path-select, move-auto and
            // transform-free (guide dragging above needs no layer).
            {
              const st = useEditorStore.getState();
              const aid2 = st.activeLayerId;
              const meta2 = aid2 ? st.layers.find((l) => l.id === aid2) : undefined;
              if (!aid2 || !meta2) {
                notify("Move: no active layer.");
                return;
              }
              if (meta2.locked || !meta2.visible) {
                notify("Active layer is locked or hidden. Unlock it first.");
                return;
              }
            }
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
          if (tool === "select-rect" || tool === "select-ellipse" || tool === "single-row" || tool === "single-column" || tool === "select-square" || tool === "select-circle" || tool === "select-stadium" || tool === "select-crosshair") {
            if (tool === "single-row") setSelDrag({ x0: 0, y0: p.y, x1: doc.width, y1: p.y + 1 });
            else if (tool === "single-column") setSelDrag({ x0: p.x, y0: 0, x1: p.x + 1, y1: doc.height });
            else setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "select-feather" || tool === "select-border" || tool === "select-feather-2" || tool === "select-feather-4" || tool === "select-feather-12") {
            if (!hasSelection()) {
              notify("No selection to adjust. Drag a marquee or lasso first.");
              return;
            }
            const f = tool === "select-feather-2" ? 2 : tool === "select-feather-4" ? 4 : tool === "select-feather-12" ? 12 : 6;
            if (tool === "select-border") {
              expandContractSelection(-4);
              featherSelection(2);
              setCursor("Border smoothed");
              notify("Border smoothed: contracted 4px + feather 2px.");
            } else {
              featherSelection(f);
              setCursor(`Feathered ${f}px`);
              notify(`Feathered selection ${f}px.`);
            }
            setAnts((a) => a + 1);
            window.dispatchEvent(new Event("avero:selection-changed"));
            return;
          }
          if (tool === "select-grow-2" || tool === "select-grow-8" || tool === "select-border-4" || tool === "select-border-12") {
            if (!hasSelection()) {
              notify("No selection to adjust. Drag a marquee or lasso first.");
              return;
            }
            const d = tool === "select-grow-2" ? 2 : tool === "select-grow-8" ? 8 : tool === "select-border-4" ? -4 : -12;
            expandContractSelection(d);
            if (tool === "select-border-4" || tool === "select-border-12") featherSelection(2);
            setCursor(d > 0 ? `Grown ${d}px` : `Border ${d}px`);
            setAnts((a) => a + 1);
            window.dispatchEvent(new Event("avero:selection-changed"));
            return;
          }
          if (tool === "select-last") {
            if (restoreLastSelection()) {
              setCursor("Last selection restored");
              notify("Last selection restored.");
              setAnts((a) => a + 1);
              window.dispatchEvent(new Event("avero:selection-changed"));
            } else {
              notify("No previous selection stored yet.");
            }
            return;
          }
          if (tool === "select-inverse-click") {
            inverseSelection();
            setCursor("Selection inverted");
            setAnts((a) => a + 1);
            window.dispatchEvent(new Event("avero:selection-changed"));
            return;
          }
          if (tool === "sky-select" || tool === "background-select" || tool === "focus-select") {
            try {
              if (tool === "sky-select") {
                drawRectSelection(doc.width, doc.height, { x: 0, y: 0, w: doc.width, h: Math.round(doc.height * 0.62) }, useProStore.getState().selMode);
                featherSelection(8);
                setCursor("Sky selected");
              } else if (tool === "focus-select") {
                const w = doc.width * 0.7;
                const h = doc.height * 0.7;
                drawEllipseSelection(doc.width, doc.height, { x: (doc.width - w) / 2, y: (doc.height - h) / 2, w, h }, useProStore.getState().selMode);
                featherSelection(6);
                setCursor("Focus selected");
              } else {
                // background-select: manual corner tone pick
                const comp = getCompositeCanvas();
                if (comp) {
                  const id = comp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, comp.width, comp.height);
                  const pro2 = useProStore.getState();
                  wandFromImage(comp.width, comp.height, id, 5, 5, pro2.selTolerance, pro2.selMode);
                  expandContractSelection(2);
                  setCursor("Background selected");
                }
              }
              setAnts((a) => a + 1);
              window.dispatchEvent(new Event("avero:selection-changed"));
            } catch { /* ignore */ }
            return;
          }
          if (tool === "guide-clear") {
            useProStore.getState().clearGuides();
            setCursor("Guides cleared");
            notify("All guides cleared.");
            return;
          }
          if (tool === "grid-toggle") {
            useProStore.getState().toggleGrid();
            setCursor(useProStore.getState().showGrid ? "Grid ON" : "Grid OFF");
            return;
          }
          if ((CROP_OVERLAY_TOOLS as Partial<Record<string, CropOverlayKind>>)[tool as string]) {
            const ov = (CROP_OVERLAY_TOOLS as Record<string, CropOverlayKind>)[tool as string];
            useProStore.getState().setCropOverlay(ov);
            setCursor(`Overlay ${ov}`);
            notify(`Crop overlay: ${ov}. Drag with the Crop tool to compose.`);
            useEditorStore.getState().setTool("crop");
            return;
          }
          if (tool === "guide-mid") {
            const pro = useProStore.getState();
            pro.addGuide("h", Math.round(doc.height / 2));
            pro.addGuide("v", Math.round(doc.width / 2));
            if (!pro.showGuides) pro.toggleGuides();
            setCursor("Center guides added");
            notify("Center guides added.");
            return;
          }
          if (tool === "guide-thirds") {
            const pro = useProStore.getState();
            [1 / 3, 2 / 3].forEach((f) => {
              pro.addGuide("h", Math.round(doc.height * f));
              pro.addGuide("v", Math.round(doc.width * f));
            });
            if (!pro.showGuides) pro.toggleGuides();
            setCursor("Thirds guides added");
            notify("Rule-of-thirds guides added.");
            return;
          }
          if (tool === "guide-clear-one") {
            const pro = useProStore.getState();
            let bi = -1;
            let bk: "h" | "v" = "v";
            let bd = Infinity;
            pro.guidesV.forEach((g, i) => {
              const d = Math.abs(p.x - g);
              if (d < bd) { bd = d; bi = i; bk = "v"; }
            });
            pro.guidesH.forEach((g, i) => {
              const d = Math.abs(p.y - g);
              if (d < bd) { bd = d; bi = i; bk = "h"; }
            });
            if (bi >= 0 && bd < 25) {
              pro.removeGuide(bk, bi);
              setCursor("Guide removed");
            } else if (bi >= 0) {
              notify("Click closer to a guide to remove it.");
            } else {
              notify("No guides to remove.");
            }
            return;
          }
          if (tool === "grid-pixel") {
            const pro = useProStore.getState();
            pro.setGridSize(8);
            if (!pro.showGrid) pro.toggleGrid();
            setCursor("Pixel grid 8px");
            notify("Pixel grid on (8px). Zoom to 800% for 1px cells.");
            return;
          }
          if (tool === "measure-dpi") {
            const mp = ((doc.width * doc.height) / 1000000).toFixed(1);
            const a4 = Math.min(doc.width / 2480, doc.height / 3508);
            const letter = Math.min(doc.width / 2550, doc.height / 3300);
            setCursor(`${doc.width}x${doc.height}`);
            notify(`Doc ${doc.width}x${doc.height} (${mp} MP). Prints sharp at A4 x${a4.toFixed(2)}, Letter x${letter.toFixed(2)}.`);
            return;
          }
          if (tool === "note-color") {
            const colors = ["#d9a441", "#2f7cf6", "#7ad69e", "#e5534b"];
            const pro = useProStore.getState();
            const next = colors[pro.notes.length % colors.length];
            const t = await askText("Add Note", "Note text:", "");
            if (t) {
              pro.addNote({ x: Math.round(p.x), y: Math.round(p.y), text: t, color: next });
              setCursor("Color note added");
            }
            return;
          }
          if (tool === "count-auto") {
            // Auto-count high-contrast blobs on the composite.
            const comp = getCompositeCanvas();
            if (comp) {
              try {
                const g = comp.getContext("2d", { willReadFrequently: true })!;
                const step = 6;
                const tw = Math.ceil(comp.width / step);
                const th = Math.ceil(comp.height / step);
                const id = g.getImageData(0, 0, comp.width, comp.height);
                const d = id.data;
                const mask = new Uint8Array(tw * th);
                for (let yy = 0; yy < th; yy++) {
                  for (let xx = 0; xx < tw; xx++) {
                    const i = (Math.min(comp.height - 1, yy * step) * comp.width + Math.min(comp.width - 1, xx * step)) * 4;
                    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
                    mask[yy * tw + xx] = lum > 200 ? 1 : 0;
                  }
                }
                const seen = new Uint8Array(tw * th);
                const pro = useProStore.getState();
                pro.clearCounts();
                let n = 0;
                for (let s = 0; s < tw * th && n < 99; s++) {
                  if (!mask[s] || seen[s]) continue;
                  n++;
                  const stack = [s];
                  seen[s] = 1;
                  let sx = 0;
                  let sy = 0;
                  let cnt = 0;
                  while (stack.length) {
                    const q = stack.pop()!;
                    const qx = q % tw;
                    const qy = Math.floor(q / tw);
                    sx += qx;
                    sy += qy;
                    cnt++;
                    const nb = [q - 1, q + 1, q - tw, q + tw];
                    for (const m of nb) {
                      if (m < 0 || m >= tw * th || seen[m] || !mask[m]) continue;
                      if (Math.abs((m % tw) - qx) + Math.abs(Math.floor(m / tw) - qy) > 1) continue;
                      seen[m] = 1;
                      stack.push(m);
                    }
                  }
                  const scale = doc.width / comp.width;
                  pro.addCount({ x: Math.round((sx / cnt) * step * scale), y: Math.round((sy / cnt) * step * scale), n });
                }
                setCountN(n);
                setCursor(n > 0 ? `Counted ${n} blobs` : "No bright blobs found");
                notify(n > 0 ? `Auto-counted ${n} bright regions.` : "No bright regions found. Try a higher-contrast area.");
              } catch { /* ignore */ }
            }
            return;
          }
          if (tool === "sampler-3x3" || tool === "sampler-11x11") {
            pinSampler(p, true, tool === "sampler-3x3" ? 3 : 11);
            return;
          }
          if (tool === "zoom-marquee") {
            setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "rotate-15") {
            const cur = useEditorStore.getState().viewRotate;
            const snapped = Math.round((cur + 15) / 15) * 15;
            setViewRotate(snapped);
            setCursor(`Rotate ${snapped}deg`);
            return;
          }
          if (tool === "fill-solid" || tool === "fill-clear" || tool === "gradient-diamond" ||
            tool === "gradient-conic" || tool === "gradient-diamond-soft" || tool === "gradient-reflected" ||
            tool === "gradient-noise" || tool === "fill-foreground" || tool === "fill-background" ||
            tool === "fill-pattern-new" || tool === "fill-content-click" || tool === "fill-history-click" ||
            tool === "fill-transparent-protect" || tool === "bucket-contiguous" || tool === "bucket-global") {
            if (tool === "gradient-diamond") {
              applyDiamondGradient(p.x, p.y);
            } else if (tool === "gradient-conic") {
              applyConicGradient(p.x, p.y);
            } else if (tool === "gradient-diamond-soft") {
              applyDiamondSoftGradient(p.x, p.y);
            } else if (tool === "gradient-reflected") {
              applyReflectedGradient(p.x, p.y);
            } else if (tool === "gradient-noise") {
              applyNoiseGradient(p.x, p.y);
            } else if (tool === "fill-solid" || tool === "fill-foreground") {
              fillSolidLayer();
            } else if (tool === "fill-background") {
              fillBackgroundLayer();
            } else if (tool === "fill-pattern-new") {
              fillPatternNewLayer();
            } else if (tool === "fill-content-click") {
              fillContentClick(p.x, p.y);
            } else if (tool === "fill-history-click") {
              fillHistoryClick(p.x, p.y);
            } else if (tool === "fill-transparent-protect") {
              fillTransparentProtect();
            } else if (tool === "bucket-global") {
              fillGlobalAt(p.x, p.y);
            } else if (tool === "bucket-contiguous") {
              floodFillAt(p.x, p.y);
            } else {
              clearLayerToTransparent();
            }
            return;
          }
          if (tool === "gradient-fg-transparent") {
            useProStore.getState().setGradTo("transparent");
            useEditorStore.getState().setTool("gradient");
            setCursor("FG to transparent ready: drag to paint");
            notify("Gradient preset: foreground to transparent. Drag on canvas.");
            return;
          }
          if (tool === "select-polygon" || tool === "lasso-straight") {
            setLassoPts((pts) => {
              let pt = { x: p.x, y: p.y };
              // Straight lasso: Shift snaps each edge to 45 degrees.
              if (tool === "lasso-straight" && e.shiftKey && pts.length > 0) {
                const prev = pts[pts.length - 1];
                const dx = pt.x - prev.x;
                const dy = pt.y - prev.y;
                const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                const len = Math.hypot(dx, dy);
                pt = { x: prev.x + Math.cos(ang) * len, y: prev.y + Math.sin(ang) * len };
              }
              return [...pts.slice(-800), pt];
            });
            return;
          }
          if (tool === "wand-flood") {
            handleWandClick(p);
            try {
              const { expandContractSelection } = await import("../engine/selection");
              // Flood: max tolerance sweep plus grow for full-region capture.
              expandContractSelection(6);
              window.dispatchEvent(new Event("avero:selection-changed"));
              setCursor("Flood selected");
            } catch { /* ignore */ }
            return;
          }
          if (tool === "range-skin" || tool === "range-sky" || tool === "range-greens") {
            const comp = getCompositeCanvas();
            if (comp) {
              try {
                const id = comp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, comp.width, comp.height);
                const pro3 = useProStore.getState();
                const seed = tool === "range-skin" ? "#c8966e" : tool === "range-sky" ? "#5a8fd0" : "#4d8a3f";
                colorRangeSelection(comp.width, comp.height, id, seed, Math.max(pro3.selTolerance, 34), pro3.selMode);
                const feather = pro3.selFeather;
                if (feather > 0) featherSelection(feather);
                setCursor(tool === "range-skin" ? "Skin tones selected" : tool === "range-sky" ? "Sky tones selected" : "Greens selected");
                setAnts((a) => a + 1);
                window.dispatchEvent(new Event("avero:selection-changed"));
              } catch { /* ignore */ }
            }
            return;
          }
          if (tool === "quick-select" || tool === "object-select") {
            handleWandClick(p);
            quickLast.current = { x: p.x, y: p.y };
            try {
              const { expandContractSelection } = await import("../engine/selection");
              expandContractSelection(tool === "object-select" ? Math.max(2, Math.round(brushSize / 6)) : Math.max(1, Math.round(brushSize / 8)));
              window.dispatchEvent(new Event("avero:selection-changed"));
            } catch { /* ignore */ }
            return;
          }
          if (tool === "frame" || tool === "artboard") {
            setShapeDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind: tool === "frame" ? "frame" : "artboard" });
            return;
          }
          if (tool === "slice") {
            setSliceDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "slice-select") {
            const pro = useProStore.getState();
            const hit = [...pro.slices].reverse().find(
              (s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h,
            );
            if (hit) {
              pro.setActiveSlice(hit.id);
              sliceMove.current = { id: hit.id, dx: hit.x - p.x, dy: hit.y - p.y, sx: p.x, sy: p.y };
              setCursor(`Slice ${hit.name}`);
            } else {
              pro.setActiveSlice(null);
              setSliceDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
              notify("Slice Select: click a slice to select it, or drag to create a new one.");
            }
            return;
          }
          if (isEyedropper) {
            if (tool === "color-sampler") {
              pinSampler(p, false);
              return;
            }
            if (tool === "sampler-avg") {
              pinSampler(p, true);
              return;
            }
            pickColor(p);
            return;
          }
          if (isClone) {
            if (e.altKey) {
              useProStore.getState().setCloneSource({ x: p.x, y: p.y });
              cloneOrigin.current = null;
              setCursor(`Source ${Math.round(p.x)}, ${Math.round(p.y)}`);
              return;
            }
            if (!useProStore.getState().cloneSource && !cloneHintShown.current) {
              cloneHintShown.current = true;
              notify("Clone: Alt-click the photo first to set the source, then paint.");
            }
            if (tool === "pattern-fill") {
              // fill active layer with the motif picker pattern tinted by brush color
              const st = useEditorStore.getState();
              const id = st.activeLayerId;
              if (!id) return;
              const meta = st.layers.find((l) => l.id === id);
              if (!meta || meta.locked || !meta.visible) {
                notify("Active layer is locked or hidden. Unlock it first.");
                return;
              }
              const motif = useProStore.getState().patternMotif;
              const snap = layerManager.snapshot(id);
              if (snap) st.pushHistory({ label: `Pattern fill (${motif})`, layerId: id, snapshot: snap });
              const c = layerManager.ensure(id, st.doc.width, st.doc.height);
              const g = c.getContext("2d")!;
              const s = Math.max(8, Math.round(brushSize));
              const pat = patternTile(motif, s, brushColor);
              g.save();
              g.globalAlpha = brushOpacity / 100;
              const pattern = g.createPattern(pat, "repeat");
              if (pattern) {
                g.fillStyle = pattern;
                g.fillRect(0, 0, c.width, c.height);
              }
              // respect active selection: keep fill inside it
              try {
                const sel = selectionMaskCanvas();
                if (sel && hasSelection()) {
                  g.globalCompositeOperation = "destination-in";
                  g.globalAlpha = 1;
                  g.drawImage(sel, 0, 0);
                }
              } catch { /* ignore */ }
              g.restore();
              st.markDirty();
              bumpHistogram();
              return;
            }
            const snap = layerManager.snapshot(activeLayerId ?? "");
            if (snap && activeLayerId) {
              pushHistory({ label: tool === "clone-mirror" ? "Mirror clone" : tool === "clone-rotate" ? "Rotate clone" : tool === "clone-soft" ? "Soft clone" : "Clone stamp", layerId: activeLayerId, snapshot: snap });
            }
            setIsPainting(true);
            lastPos.current = null;
            cloneOrigin.current = null;
            captureStrokeSel();
            if (tool === "clone-mirror") cloneToVariant(p.x, p.y, "mirror");
            else if (tool === "clone-rotate") cloneToVariant(p.x, p.y, "rotate");
            else if (tool === "clone-soft") cloneToVariant(p.x, p.y, "soft");
            else if (tool === "pattern-dots") patternStampTo(p.x, p.y, "dots");
            else cloneTo(p.x, p.y);
            return;
          }
          if (tool === "select-lasso" || tool === "magnetic-lasso") {
            setLassoPts([{ x: p.x, y: p.y }]);
            return;
          }
          if (tool === "select-rounded") {
            setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "wand" || tool === "wand-plus" || tool === "wand-minus") {
            handleWandClick(p);
            try {
              if (tool === "wand-plus") expandContractSelection(2);
              if (tool === "wand-minus") expandContractSelection(-2);
              window.dispatchEvent(new Event("avero:selection-changed"));
            } catch { /* ignore */ }
            return;
          }
          if (tool === "select-grow" || tool === "select-shrink") {
            if (!hasSelection()) {
              notify("No selection to adjust. Drag a marquee or lasso first.");
              return;
            }
            expandContractSelection(tool === "select-grow" ? 4 : -4);
            setAnts((a) => a + 1);
            window.dispatchEvent(new Event("avero:selection-changed"));
            setCursor(tool === "select-grow" ? "Grown +4px" : "Shrunk -4px");
            return;
          }
          if (tool === "color-range") {
            const comp = getCompositeCanvas();
            if (comp) {
              try {
                const ix = Math.max(0, Math.min(comp.width - 1, Math.floor(p.x)));
                const iy = Math.max(0, Math.min(comp.height - 1, Math.floor(p.y)));
                const d = comp.getContext("2d", { willReadFrequently: true })!.getImageData(ix, iy, 1, 1).data;
                const hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
                const id = comp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, comp.width, comp.height);
                const pro4 = useProStore.getState();
                colorRangeSelection(comp.width, comp.height, id, hex, pro4.selTolerance, pro4.selMode);
                setCursor(`Range ${hex}`);
                window.dispatchEvent(new Event("avero:selection-changed"));
              } catch { /* ignore */ }
            }
            return;
          }
          if (tool === "select-subject" || tool === "ai-subject" || tool === "ai-bg-remove") {
            if (tool === "ai-subject" || tool === "ai-bg-remove") {
              aiAssist(tool, p);
              return;
            }
            // Manual subject: wand from CLICK point (not center), then expand + feather.
            // Bug fix: previously always used center, ignoring where user clicked.
            const comp = getCompositeCanvas();
            if (comp) {
              try {
                const id = comp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, comp.width, comp.height);
                const pro5 = useProStore.getState();
                wandFromImage(comp.width, comp.height, id, p.x, p.y, Math.max(pro5.selTolerance, 30), pro5.selMode);
                expandContractSelection(3);
                const feather = pro5.selFeather;
                if (feather > 0) featherSelection(feather);
                setAnts((a) => a + 1);
                window.dispatchEvent(new Event("avero:selection-changed"));
              } catch { /* ignore */ }
            }
            return;
          }
          if (
            tool === "text" || tool === "text-vertical" ||
            tool === "text-outline" || tool === "text-glow" || tool === "text-shadow" || tool === "text-arc" ||
            tool === "text-3d" || tool === "text-neon" || tool === "text-gradient" ||
            tool === "text-typewriter" || tool === "text-blocky" || tool === "text-condensed" ||
            tool === "text-expanded" || tool === "text-emboss" || tool === "text-engrave" ||
            tool === "text-chrome" || tool === "text-fire" || tool === "text-ice" || tool === "text-retro"
          ) {
            if (tool === "text-outline") createTextLayer(p, undefined, false, "outline");
            else if (tool === "text-glow") createTextLayer(p, undefined, false, "glow");
            else if (tool === "text-shadow") createTextLayer(p, undefined, false, "shadow");
            else if (tool === "text-arc") createTextLayer(p, undefined, false, "arc");
            else if (tool === "text-3d") createTextLayer(p, undefined, false, "3d");
            else if (tool === "text-neon") createTextLayer(p, undefined, false, "neon");
            else if (tool === "text-gradient") createTextLayer(p, undefined, false, "gradient");
            else if (tool === "text-typewriter") createTextLayer(p, undefined, false, "typewriter");
            else if (tool === "text-blocky") createTextLayer(p, undefined, false, "blocky");
            else if (tool === "text-condensed") createTextLayer(p, undefined, false, "condensed");
            else if (tool === "text-expanded") createTextLayer(p, undefined, false, "expanded");
            else if (tool === "text-emboss") createTextLayer(p, undefined, false, "emboss");
            else if (tool === "text-engrave") createTextLayer(p, undefined, false, "engrave");
            else if (tool === "text-chrome") createTextLayer(p, undefined, false, "chrome");
            else if (tool === "text-fire") createTextLayer(p, undefined, false, "fire");
            else if (tool === "text-ice") createTextLayer(p, undefined, false, "ice");
            else if (tool === "text-retro") createTextLayer(p, undefined, false, "retro");
            else createTextLayer(p, undefined, tool === "text-vertical");
            return;
          }
          if (tool === "note") {
            const t = await askText("Add Note", "Note text:", "");
            if (t) {
              useProStore.getState().addNote({ x: Math.round(p.x), y: Math.round(p.y), text: t });
              setCursor(`Note added`);
            }
            return;
          }
          if (tool === "count") {
            const pro = useProStore.getState();
            // Bug fix: use max+1 so cleared/reordered counts never duplicate numbers.
            const n = pro.counts.reduce((m, c) => Math.max(m, c.n), 0) + 1;
            pro.addCount({ x: Math.round(p.x), y: Math.round(p.y), n });
            setCountN(n);
            setCursor(`Count ${n} at ${Math.round(p.x)}, ${Math.round(p.y)}`);
            return;
          }
          if (tool === "snap-toggle") {
            useProStore.getState().toggleSnap();
            setCursor(useProStore.getState().snapEnabled ? "Snap ON" : "Snap OFF");
            return;
          }
          if (tool === "zoom-fit" || tool === "zoom-100" || tool === "zoom-200" || tool === "zoom-400" || tool === "zoom-50" || tool === "zoom-800" || tool === "rotate-reset") {
            if (tool === "zoom-fit") window.dispatchEvent(new Event("avero:fit-zoom"));
            else if (tool === "zoom-100") setZoom(100);
            else if (tool === "zoom-200") setZoom(200);
            else if (tool === "zoom-400") setZoom(400);
            else if (tool === "zoom-50") setZoom(50);
            else if (tool === "zoom-800") setZoom(800);
            else if (tool === "rotate-reset") {
              setViewRotate(0);
              setCursor("Rotate reset 0deg");
            }
            else setZoom(400);
            return;
          }
          if (tool === "ai-upscale" || tool === "ai-denoise" || tool === "ai-colorize" || tool === "ai-sky") {
            aiAssist(tool, p);
            return;
          }
          if (isShapeTool) {
            const kind = (SHAPE_KIND_OF as Record<string, string>)[tool] ?? "rect";
            setShapeDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind });
            return;
          }
          if (tool === "ruler" || tool === "measure-angle" || tool === "measure-area" || tool === "protractor" || tool === "ruler-triple") {
            if (tool === "ruler-triple" && tripleChain.current) {
              setMeasureDrag({ x0: tripleChain.current.x, y0: tripleChain.current.y, x1: p.x, y1: p.y });
            } else {
              setMeasureDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            }
            return;
          }
          if (tool === "fill" || tool === "content-fill") {
            if (tool === "content-fill") {
              // Bug fix: allow drag painting for content-fill (was click-only, felt dead).
              const st0 = useEditorStore.getState();
              const snap0 = layerManager.snapshot(activeLayerId ?? "");
              if (snap0 && activeLayerId) pushHistory({ label: "Content fill", layerId: activeLayerId, snapshot: snap0 });
              setIsPainting(true);
              lastPos.current = null;
              captureStrokeSel();
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
          if (tool === "pen" || tool === "line" || tool === "pen-free" || tool === "line-arrow" ||
            tool === "pen-thin" || tool === "pen-medium" || tool === "pen-bold" ||
            tool === "pen-dashed" || tool === "pen-arrow-both" || tool === "pen-glow") {
            setPenDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "curvature-pen") {
            setPenDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          const rm = retouchModeOf(tool);
          const dk = distortOf(tool);
          const distortLegacy = tool === "liquify" || tool === "warp";
          const isToneLegacy = tool === "dodge" || tool === "burn" || tool === "sponge" || tool === "vibrance-brush";
          const isDetailLegacy = tool === "blur" || tool === "blur-iris" || tool === "sharpen" || tool === "sharpen-edge" || tool === "smudge" || tool === "noise-reduction";
          if (
            isBrush ||
            isEraser ||
            isToneLegacy ||
            isDetailLegacy ||
            distortLegacy ||
            isHeal ||
            rm !== null ||
            dk !== null
          ) {
            // Keep scribbles erasable: paint-family strokes on a photo layer go
            // to a fresh transparent paint layer above it, so the eraser removes
            // only strokes, never the photo underneath. plan3 Fase 0 extends the
            // same rule to background paper: strokes must never fuse with the
            // paper or the eraser would punch holes into the canvas itself.
            let strokeLayerId = activeLayerId;
            const strokeMeta = strokeLayerId
              ? useEditorStore.getState().layers.find((l) => l.id === strokeLayerId)
              : undefined;
            if (
              isBrush &&
              strokeLayerId &&
              needsFreshPaintLayer(strokeMeta?.kind, layerManager.isPhotoLayer(strokeLayerId))
            ) {
              const st = useEditorStore.getState();
              const l = makeLayer(`Paint ${st.layers.length}`);
              layerManager.ensure(l.id, st.doc.width, st.doc.height);
              useProStore.getState().ensureTransform(l.id);
              st.addLayer(l);
              st.setActiveLayer(l.id);
              strokeLayerId = l.id;
              lastPaintRef.current = l.id;
              if (!paintLayerToastShown.current) {
                paintLayerToastShown.current = true;
                notify("Painting on a new transparent layer. The paper and photos stay protected.");
              }
            }
            // Eraser targets the created item, never the background photo.
            // Paint-type erasers resolve through resolveEraserTarget (plan2 Fase B):
            // photo layers are never touched; null aborts the stroke safely.
            if (isPaintEraser(tool as ToolId)) {
              const st = useEditorStore.getState();
              const targetId = resolveEraserTarget({
                activeId: strokeLayerId,
                layers: st.layers,
                lastPaintId: lastPaintRef.current,
                isPhoto: (id) => layerManager.isPhotoLayer(id),
                hasCanvas: (id) => !!layerManager.get(id),
              });
              if (!targetId) {
                notify("Nothing safely erasable here. Paint a stroke first, or use Background / Magic Eraser for photos.");
                return;
              }
              if (targetId !== strokeLayerId) {
                st.setActiveLayer(targetId);
                strokeLayerId = targetId;
                const nm = st.layers.find((l) => l.id === targetId)?.name ?? targetId;
                setCursor(`Erasing ${nm}`);
              }
            }
            // One-time hint for heal tools (cursor text alone is missed).
            if (needsHealSource && !useProStore.getState().healSource && !healHintShown.current && !e.altKey) {
              healHintShown.current = true;
              notify("Healing: Alt-click a clean area first to set the source, then paint over the spot.");
            }
            const snap = layerManager.snapshot(strokeLayerId ?? "");
            const maskSnap = paintMask ? layerManager.snapshotMask(strokeLayerId ?? "") : null;
            if (snap && strokeLayerId) {
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
                "exposure-brush": "Exposure brush",
                "warmth-brush": "Warmth brush",
                "fade-brush": "Fade brush",
                "contrast-brush": "Contrast brush",
                "posterize-brush": "Posterize brush",
                "threshold-brush": "Threshold brush",
                "hue-brush": "Hue brush",
                "invert-brush": "Invert brush",
                "desat-brush": "Desaturate brush",
                "grain-brush": "Grain brush",
                "pixelate-brush": "Pixelate brush",
                "vignette-brush": "Vignette brush",
              };
              pushHistory({
                label: paintMask ? "Paint mask" : (labels[tool] ?? tool),
                layerId: strokeLayerId,
                snapshot: snap,
                maskSnapshot: maskSnap,
              });
            }
            setIsPainting(true);
            lastPos.current = null;
            captureStrokeSel();
            if (tool === "smudge" || distortLegacy || dk !== null) pickSmudgeColor(p);
            // Alt sets heal source for healing-brush / patch (does not paint)
            if (needsHealSource && e.altKey) {
              useProStore.getState().setHealSource({ x: p.x, y: p.y });
              setCursor(`Heal source ${Math.round(p.x)}, ${Math.round(p.y)}`);
              setIsPainting(false);
              return;
            }
            // capture history source BEFORE this stroke mutates pixels
            if (tool === "history-brush" || tool === "art-history-brush") {
              historySource.current = snap ?? null;
            }
            if (dk !== null) {
              distortTo(p.x, p.y, dk);
            } else if (isBrush || isEraser) {
              paintTo(p.x, p.y, isEraser, strokeLayerId ?? undefined);
            } else if (rm !== null) {
              retouchTo(p.x, p.y, rm);
            } else if (tool === "spot-heal") {
              retouchTo(p.x, p.y, "heal");
            } else {
              const legacy = (distortLegacy ? "smudge" : tool) as RetouchMode;
              retouchTo(p.x, p.y, legacy);
            }
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
          if (rotateStart.current && tool === "rotate-view") {
            const dx = e.clientX - rotateStart.current.x;
            setViewRotate(rotateStart.current.rot + dx * 0.4);
            return;
          }
          if (directStart.current && tool === "direct-select") {
            const dx = e.clientX - directStart.current.x;
            const pro = useProStore.getState();
            const cur = pro.shapeSpecs[directStart.current.layerId];
            if (cur) {
              const next = { ...cur, rotation: directStart.current.rotation + dx * 0.5 };
              pro.setShapeSpec(directStart.current.layerId, next);
              const c = layerManager.get(directStart.current.layerId);
              if (c) renderShapeToLayer(c, next);
              markDirty();
            }
            return;
          }
          if (sliceMove.current && (tool === "slice-select" || tool === "slice")) {
            const pro = useProStore.getState();
            const s = pro.slices.find((x) => x.id === sliceMove.current!.id);
            if (s) pro.updateSlice(s.id, { x: Math.round(p.x + sliceMove.current.dx), y: Math.round(p.y + sliceMove.current.dy) });
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
            // enforce aspect lock for preset crops
            const ratio = (CROP_RATIOS as Record<string, number | null>)[tool] ?? null;
            if (ratio) {
              const w = p.x - cropDrag.x0;
              let h = p.y - cropDrag.y0;
              const ah = Math.abs(w) / ratio;
              h = Math.sign(h || 1) * ah;
              setCropDrag({ ...cropDrag, x1: cropDrag.x0 + w, y1: cropDrag.y0 + h });
            } else {
              setCropDrag({ ...cropDrag, x1: p.x, y1: p.y });
            }
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
            // Bug fix: single-row/col are click tools, ignore drag updates so preview stays 1px.
            if (tool === "single-row" || tool === "single-column") return;
            // Manual 2026: square lock for select-square.
            // plan3 Fase 2.2: Shift locks ellipse to a circle, as usage promises.
            if (tool === "select-square" || tool === "select-circle" || (tool === "select-ellipse" && e.shiftKey)) {
              const w = p.x - selDrag.x0;
              const h = p.y - selDrag.y0;
              const m = Math.max(Math.abs(w), Math.abs(h));
              setSelDrag({ ...selDrag, x1: selDrag.x0 + Math.sign(w || 1) * m, y1: selDrag.y0 + Math.sign(h || 1) * m });
              return;
            }
            // Crosshair: symmetric drag around the start point.
            if (tool === "select-crosshair") {
              const w = p.x - selDrag.x0;
              const h = p.y - selDrag.y0;
              setSelDrag({ x0: selDrag.x0, y0: selDrag.y0, x1: selDrag.x0 + w * 2, y1: selDrag.y0 + h * 2 });
              return;
            }
            setSelDrag({ ...selDrag, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "select-lasso" || tool === "magnetic-lasso") {
            if (lassoPts.length > 0 && e.buttons === 1) {
              setLassoPts((pts) => [...pts.slice(-800), { x: p.x, y: p.y }]);
            }
            return;
          }
          // plan3 Fase 3.5: quick/object-select paints while dragging (brush
          // behavior per usage text). Drag dabs force-add so the stroke
          // accumulates instead of replacing; throttled by distance.
          if (tool === "quick-select" || tool === "object-select") {
            if (e.buttons === 1) {
              const last = quickLast.current;
              const step = Math.max(8, brushSize / 4);
              if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= step) {
                quickLast.current = { x: p.x, y: p.y };
                handleWandClick(p, "add");
                try {
                  expandContractSelection(tool === "object-select" ? Math.max(2, Math.round(brushSize / 6)) : Math.max(1, Math.round(brushSize / 8)));
                  window.dispatchEvent(new Event("avero:selection-changed"));
                  setCursor(tool === "object-select" ? "Object painted" : "Subject painted");
                } catch { /* ignore */ }
              }
            }
            return;
          }
          if (measureDrag) {
            setMeasureDrag({ ...measureDrag, x1: p.x, y1: p.y });
            return;
          }
          if (penDrag) {
            let x1 = p.x;
            let y1 = p.y;
            if ((tool === "line" || tool === "line-arrow") && e.shiftKey) {
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
          if (sliceDrag) {
            setSliceDrag({ ...sliceDrag, x1: p.x, y1: p.y });
            return;
          }
          if (shapeDrag) {
            // shift locks square for rect/ellipse-like shapes
            let x1 = p.x;
            let y1 = p.y;
            if (e.shiftKey && (shapeDrag.kind === "rect" || shapeDrag.kind === "ellipse" || shapeDrag.kind === "rounded" || shapeDrag.kind === "donut" || shapeDrag.kind === "star" || shapeDrag.kind === "polygon" || shapeDrag.kind === "pentagon" || shapeDrag.kind === "octagon" || shapeDrag.kind === "plus" || shapeDrag.kind === "cross" || shapeDrag.kind === "badge" || shapeDrag.kind === "chevron")) {
              const w = Math.abs(x1 - shapeDrag.x0);
              const h = Math.abs(y1 - shapeDrag.y0);
              const m = Math.max(w, h);
              x1 = shapeDrag.x0 + Math.sign(x1 - shapeDrag.x0 || 1) * m;
              y1 = shapeDrag.y0 + Math.sign(y1 - shapeDrag.y0 || 1) * m;
            }
            setShapeDrag({ ...shapeDrag, x1, y1 });
            return;
          }
          if (isPainting) {
            const rm2 = retouchModeOf(tool);
            const dk2 = distortOf(tool);
            if (isClone) {
              if (tool === "clone-mirror") cloneToVariant(p.x, p.y, "mirror");
              else if (tool === "clone-rotate") cloneToVariant(p.x, p.y, "rotate");
              else if (tool === "clone-soft") cloneToVariant(p.x, p.y, "soft");
              else if (tool === "texture-stamp" || tool === "pattern-stamp") patternStampTo(p.x, p.y, tool === "pattern-stamp" ? useProStore.getState().patternMotif : "checker");
              else if (tool === "pattern-dots") patternStampTo(p.x, p.y, "dots");
              else if (tool === "pattern-fill") { /* click-only, ignore drag */ }
              else cloneTo(p.x, p.y);
            } else if (isBrush || isEraser) paintTo(p.x, p.y, isEraser);
            else if (dk2 !== null) distortTo(p.x, p.y, dk2);
            else if (rm2 !== null) retouchTo(p.x, p.y, rm2);
            else if (tool === "smudge" || tool === "liquify" || tool === "warp") {
              retouchTo(p.x, p.y, "smudge");
            } else {
              const legacyList = ["dodge", "burn", "sponge", "blur", "sharpen", "spot-heal", "content-fill"] as const;
              if ((legacyList as readonly string[]).includes(tool)) {
                retouchTo(p.x, p.y, tool as RetouchMode);
              }
            }
          }
        }}
        onMouseUp={(e) => {
          if (penDrag) {
            const dx = penDrag.x1 - penDrag.x0;
            const dy = penDrag.y1 - penDrag.y0;
            if (Math.hypot(dx, dy) > 3) {
              if (tool === "curvature-pen") applyPenCurved(penDrag.x0, penDrag.y0, penDrag.x1, penDrag.y1);
              else applyPenLine(penDrag.x0, penDrag.y0, penDrag.x1, penDrag.y1);
            }
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
            // Fase E unit: px mentah, in/cm pada 96 DPI. Live dari top bar.
            const unit = useProStore.getState().measureUnit;
            const fmt = (px: number) =>
              unit === "in" ? `${(px / 96).toFixed(2)} in` : unit === "cm" ? `${((px / 96) * 2.54).toFixed(2)} cm` : `${px.toFixed(1)} px`;
            const fmtArea = (px2: number) =>
              unit === "in" ? `${(px2 / (96 * 96)).toFixed(2)} sq in` : unit === "cm" ? `${((px2 / (96 * 96)) * 6.4516).toFixed(2)} sq cm` : `${(px2 / 1000).toFixed(1)}k px`;
            if (dist > 1) {
              const label =
                tool === "measure-area"
                  ? `${fmt(Math.abs(dx))}x${fmt(Math.abs(dy))} area ${fmtArea(Math.abs(dx * dy))}`
                  : tool === "measure-angle" || tool === "protractor" || tool === "ruler-triple"
                    ? `Angle ${ang.toFixed(1)} deg (${fmt(Math.abs(dx))} x ${fmt(Math.abs(dy))})`
                    : `${fmt(dist)} | ${ang.toFixed(1)} deg`;
              setCursor(tool === "measure-area" ? `Area ${label}` : tool === "measure-angle" || tool === "protractor" || tool === "ruler-triple" ? label : `Distance ${label}`);
              useProStore.getState().addMeasure({ x0: Math.round(measureDrag.x0), y0: Math.round(measureDrag.y0), x1: Math.round(measureDrag.x1), y1: Math.round(measureDrag.y1), label });
              // Triple ruler chains: next segment starts where this one ended.
              if (tool === "ruler-triple") tripleChain.current = { x: measureDrag.x1, y: measureDrag.y1 };
              else tripleChain.current = null;
            } else {
              tripleChain.current = null;
            }
            setMeasureDrag(null);
          }
          if (guideDrag.current) guideDrag.current = null;
          if (rotateStart.current) rotateStart.current = null;
          if (directStart.current) {
            directStart.current = null;
            markDirty();
          }
          if (sliceMove.current) sliceMove.current = null;
          if (sliceDrag) {
            const x = Math.min(sliceDrag.x0, sliceDrag.x1);
            const y = Math.min(sliceDrag.y0, sliceDrag.y1);
            const w = Math.abs(sliceDrag.x1 - sliceDrag.x0);
            const h = Math.abs(sliceDrag.y1 - sliceDrag.y0);
            if (w > 8 && h > 8) {
              useProStore.getState().addSlice({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), name: `Slice ${useProStore.getState().slices.length + 1}` });
              setCursor(`Slice ${Math.round(w)}x${Math.round(h)}`);
            }
            setSliceDrag(null);
          }
          if (selDrag) {
            const r = {
              x: selDrag.x0,
              y: selDrag.y0,
              w: selDrag.x1 - selDrag.x0,
              h: selDrag.y1 - selDrag.y0,
            };
            const pro = useProStore.getState();
            // Fase E combine mode: bar buttons set selMode, Shift/Alt override per stroke.
            const combineMode = e.shiftKey ? "add" : e.altKey ? "subtract" : pro.selMode;
            if (tool === "zoom-marquee") {
              // Zoom the viewport to fit the dragged rect.
              const rw = Math.abs(r.w);
              const rh = Math.abs(r.h);
              if (rw > 8 && rh > 8) {
                const wrap = wrapRef.current;
                if (wrap) {
                  const rect = wrap.getBoundingClientRect();
                  const z = Math.max(10, Math.min(3200, Math.min((rect.width - 80) / rw, (rect.height - 80) / rh) * 100));
                  setZoom(z);
                  const s = z / 100;
                  const dw = doc.width * s;
                  const dh = doc.height * s;
                  const cx = Math.min(r.x, r.x + r.w) + rw / 2;
                  const cy = Math.min(r.y, r.y + r.h) + rh / 2;
                  setPan(rect.width / 2 - (rect.width - dw) / 2 - cx * s, rect.height / 2 - (rect.height - dh) / 2 - cy * s);
                  setCursor(`Zoom ${Math.round(z)}%`);
                }
              }
              setSelDrag(null);
              return;
            }
            if (tool === "single-row") {
              drawRectSelection(doc.width, doc.height, { x: 0, y: Math.round(r.y), w: doc.width, h: 1 }, combineMode);
            } else if (tool === "single-column") {
              drawRectSelection(doc.width, doc.height, { x: Math.round(r.x), y: 0, w: 1, h: doc.height }, combineMode);
            } else if (tool === "select-crosshair") {
              // Symmetric about the start point: mirror the drag vector.
              const w = selDrag.x1 - selDrag.x0;
              const h = selDrag.y1 - selDrag.y0;
              if (Math.abs(w) > 4 && Math.abs(h) > 4) {
                drawRectSelection(doc.width, doc.height, { x: selDrag.x0 - w, y: selDrag.y0 - h, w: w * 2, h: h * 2 }, combineMode);
                if (pro.selFeather > 0) featherSelection(pro.selFeather);
              }
            } else if (Math.abs(r.w) > 4 && Math.abs(r.h) > 4) {
              if (tool === "select-ellipse" || tool === "select-circle") drawEllipseSelection(doc.width, doc.height, r, combineMode);
              else if (tool === "select-rounded") drawRoundedRectSelection(doc.width, doc.height, r, 24, combineMode);
              else if (tool === "select-stadium") drawRoundedRectSelection(doc.width, doc.height, r, 9999, combineMode);
              else if (tool === "select-square") {
                // Square lock: equal sides keep the drag direction.
                const side = Math.max(Math.abs(r.w), Math.abs(r.h));
                const sq = {
                  x: r.x,
                  y: r.y,
                  w: (r.w < 0 ? -1 : 1) * side,
                  h: (r.h < 0 ? -1 : 1) * side,
                };
                drawRectSelection(doc.width, doc.height, sq, combineMode);
              } else drawRectSelection(doc.width, doc.height, r, combineMode);
              if (pro.selFeather > 0) featherSelection(pro.selFeather);
            }
            setSelDrag(null);
            window.dispatchEvent(new Event("avero:selection-changed"));
          }
          if (
            lassoPts.length > 2 &&
            (tool === "select-lasso" || tool === "select-polygon" || tool === "magnetic-lasso" || tool === "lasso-straight")
          ) {
            const lassoMode = e.shiftKey ? "add" : e.altKey ? "subtract" : useProStore.getState().selMode;
            drawLassoSelection(doc.width, doc.height, lassoPts, lassoMode);
            if (tool === "magnetic-lasso") {
              expandContractSelection(2);
              const f = useProStore.getState().selFeather;
              if (f > 0) featherSelection(f);
            }
            setLassoPts([]);
            window.dispatchEvent(new Event("avero:selection-changed"));
          } else if (tool === "select-lasso" || tool === "select-polygon" || tool === "magnetic-lasso" || tool === "lasso-straight") {
            if (tool === "select-lasso" || tool === "magnetic-lasso") setLassoPts([]);
            // polygon keeps points until double-click closes
          }
          if (shapeDrag) {
            const w = Math.abs(shapeDrag.x1 - shapeDrag.x0);
            const h = Math.abs(shapeDrag.y1 - shapeDrag.y0);
            if (w > 6 && h > 6) {
              const kind = shapeDrag.kind;
              const map: Record<string, "rect" | "ellipse" | "polygon" | "triangle" | "line" | "star" | "arrow" | "custom" | "rounded" | "diamond" | "heart" | "hexagon" | "burst" | "donut" | "chevron" | "moon" | "cross" | "plus" | "trapezoid" | "trapezoid-wide" | "parallelogram" | "pentagon" | "octagon" | "shield" | "badge" | "ribbon" | "cloud" | "speech" | "gear" | "drop" | "leaf" | "lightning" | "crown" | "pin" | "ticket"> = {
                rect: "rect",
                ellipse: "ellipse",
                triangle: "triangle",
                polygon: "polygon",
                line: "line",
                custom: "custom",
                star: "star",
                arrow: "arrow",
                rounded: "rounded",
                diamond: "diamond",
                heart: "heart",
                hexagon: "hexagon",
                burst: "burst",
                donut: "donut",
                chevron: "chevron",
                moon: "moon",
                cross: "cross",
                plus: "plus",
                trapezoid: "trapezoid",
                "trapezoid-wide": "trapezoid-wide",
                parallelogram: "parallelogram",
                pentagon: "pentagon",
                octagon: "octagon",
                shield: "shield",
                badge: "badge",
                ribbon: "ribbon",
                cloud: "cloud",
                speech: "speech",
                gear: "gear",
                drop: "drop",
                leaf: "leaf",
                lightning: "lightning",
                crown: "crown",
                pin: "pin",
                ticket: "ticket",
                frame: "rect",
                artboard: "rect",
              };
              const sk = map[kind] ?? "rect";
              const sides = kind === "triangle" ? 3 : kind === "star" ? 5 : kind === "pentagon" ? 5 : kind === "hexagon" ? 6 : kind === "octagon" ? 8 : 6;
              if (kind === "frame") createShapeLayer("rect", 4, "Frame");
              else if (kind === "artboard") {
                createShapeLayer("rect", 4, "Artboard");
                // plan3 Fase 1.2: canvas-drawn artboards register in the
                // ArtboardPanel store with the actual drag rect.
                try {
                  const ax = Math.round(Math.min(shapeDrag.x0, shapeDrag.x1));
                  const ay = Math.round(Math.min(shapeDrag.y0, shapeDrag.y1));
                  const aw = Math.max(1, Math.round(Math.abs(shapeDrag.x1 - shapeDrag.x0)));
                  const ah = Math.max(1, Math.round(Math.abs(shapeDrag.y1 - shapeDrag.y0)));
                  const absStore = useArtboardStore.getState();
                  absStore.add("Custom");
                  const last = absStore.boards[absStore.boards.length - 1];
                  if (last) absStore.update(last.id, { x: ax, y: ay, w: aw, h: ah, preset: "Custom" });
                } catch {
                  /* artboard registration is best-effort */
                }
              }
              else if (sk === "triangle") createShapeLayer("triangle", 3);
              else createShapeLayer(sk, sides);
              // Bug fix: precise size + center. Base shape in renderShapeToLayer is
              // rw=min(W,H)*0.5, rh=min(W,H)*0.34 centered. Old code used w/W which shrank shapes.
              const st = useEditorStore.getState();
              const nid = st.activeLayerId;
              if (nid) {
                const base = Math.min(doc.width, doc.height);
                const baseW = base * 1.0;
                const baseH = base * 0.68;
                const cx = (Math.min(shapeDrag.x0, shapeDrag.x1) + Math.max(shapeDrag.x0, shapeDrag.x1)) / 2;
                const cy = (Math.min(shapeDrag.y0, shapeDrag.y1) + Math.max(shapeDrag.y0, shapeDrag.y1)) / 2;
                useProStore.getState().updateTransform(nid, {
                  x: cx - doc.width / 2,
                  y: cy - doc.height / 2,
                  scaleX: Math.max(0.05, w / Math.max(1, baseW)),
                  scaleY: Math.max(0.05, h / Math.max(1, baseH)),
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
          quickLast.current = null;
          // Fase E Aligned toggle: aligned keeps the clone offset across
          // strokes, non-aligned restarts it every stroke like the old code.
          if (!useProStore.getState().cloneAligned) cloneOrigin.current = null;
          // clear per-stroke clone snapshot so next stroke re-captures fresh pixels
          try {
            (cloneToVariant as unknown as { _src?: HTMLCanvasElement | null; _id?: string | null })._src = null;
            (cloneToVariant as unknown as { _src?: HTMLCanvasElement | null; _id?: string | null })._id = null;
            (cloneTo as unknown as { _src?: HTMLCanvasElement | null; _id?: string | null })._src = null;
            (cloneTo as unknown as { _src?: HTMLCanvasElement | null; _id?: string | null })._id = null;
          } catch { /* ignore */ }
          clearStrokeSel();
          if (isPainting) bumpHistogram();
        }}
        onMouseLeave={() => {
          setIsPainting(false);
          lastPos.current = null;
          panning.current = null;
          quickLast.current = null;
          moveDrag.current = null;
          if (!useProStore.getState().cloneAligned) cloneOrigin.current = null;
          smudgeColor.current = null;
          rotateStart.current = null;
          directStart.current = null;
          sliceMove.current = null;
          clearStrokeSel();
          setRing(null);
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            cursor:
              tool === "pan" || tool === "hand"
                ? "grab"
                : tool === "rotate-view"
                  ? "ew-resize"
                  : tool === "text" || tool === "text-vertical" || tool === "text-outline" || tool === "text-glow" || tool === "text-shadow" || tool === "text-arc" || tool === "text-3d" || tool === "text-neon" || tool === "text-gradient"
                    ? "text"
                    : tool === "move" || tool === "path-select" || tool === "direct-select" || tool === "move-auto" || tool === "transform-free"
                      ? "move"
                      : "crosshair",
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
        {/* Bottom-left HUD: position, tool, layer and status info */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[70%] items-center gap-2 overflow-hidden rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-2.5 py-1.5 font-mono text-[10px] text-[#a7a7b0]">
          <span className="shrink-0 rounded bg-[#2f7cf6] px-1.5 py-0.5 font-semibold text-white">{TOOL_LABEL[tool] ?? tool}</span>
          <span className="shrink-0 tabular-nums">{cursor}</span>
          <span className="shrink-0 text-[#3a3a41]">|</span>
          <span className="shrink-0 tabular-nums">
            {doc.width} x {doc.height}
          </span>
          {(() => {
            const al = layers.find((l) => l.id === activeLayerId);
            return al ? (
              <>
                <span className="shrink-0 text-[#3a3a41]">|</span>
                <span className="truncate text-white" title={`Active layer: ${al.name} (${al.kind}, ${al.opacity}%, ${al.blendMode})`}>
                  {al.name}
                </span>
                <span className="shrink-0 tabular-nums text-[#6e6e78]">{al.opacity}%</span>
              </>
            ) : null;
          })()}
          {hasSelection() && (
            <>
              <span className="text-[#3a3a41]">|</span>
              <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-0.5 text-[#d9a441]">Selection</span>
            </>
          )}
          {countN > 0 && (
            <>
              <span className="text-[#3a3a41]">|</span>
              <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-0.5 text-white">Count {countN}</span>
            </>
          )}
          {paintMask && (
            <>
              <span className="text-[#3a3a41]">|</span>
              <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-0.5 text-[#8fb6f5]">Mask</span>
            </>
          )}
          {Math.round(viewRotate) !== 0 && (
            <>
              <span className="text-[#3a3a41]">|</span>
              <button
                onClick={() => setViewRotate(0)}
                className="pointer-events-auto shrink-0 rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-0.5 tabular-nums text-[#d9a441] hover:text-white"
                title="View rotated. Click to reset to 0deg."
              >
                {Math.round(viewRotate)}deg reset
              </button>
            </>
          )}
        </div>

        {/* Bottom-right zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-0.5 overflow-hidden rounded-md border border-[#2c2c31] bg-[#1c1c1f] p-1">
          <button
            onClick={() => setZoom(Math.max(1, zoom - 25))}
            className="grid h-6 w-6 place-items-center rounded text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
            title="Zoom out (Ctrl+-)"
          >
            -
          </button>
          <button
            onClick={() => setZoom(100)}
            className="min-w-[46px] rounded px-1 py-0.5 font-mono text-[10px] tabular-nums text-white hover:bg-[#232327]"
            title="Zoom 100% (Ctrl+1)"
          >
            {zoom}%
          </button>
          <button
            onClick={() => setZoom(Math.min(400, zoom + 25))}
            className="grid h-6 w-6 place-items-center rounded text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
            title="Zoom in (Ctrl++)"
          >
            +
          </button>
          <span className="mx-0.5 h-4 w-px bg-[#2c2c31]" />
          <button
            onClick={() => window.dispatchEvent(new Event("avero:fit-zoom"))}
            className="rounded px-2 py-0.5 font-mono text-[10px] text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
            title="Fit to screen"
          >
            Fit
          </button>
        </div>
        <Navigator wrapW={viewSize.w} wrapH={viewSize.h} />
        {dragging && (
          <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-lg border border-dashed border-[#2f7cf6] bg-[#101012]">
            <div className="rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-4 py-2 text-[12px] text-white">
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
          <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-4 py-2 text-center text-[12px] text-[#c9c9d1]">
            <span className="font-semibold text-white">Drag image here</span> to start, or press{" "}
            <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-0.5 font-mono text-[11px]">Ctrl+K</span>{" "}
            then Open image
          </div>
        )}
      </div>
    </div>
  );
}
