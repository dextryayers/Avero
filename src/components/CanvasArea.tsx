import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
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
import { makeLayer } from "../stores/useEditorStore";

export function getCompositeCanvas(): HTMLCanvasElement | null {
  return (window as any).__avero_comp ?? null;
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
  const [lassoPts, setLassoPts] = useState<{ x: number; y: number }[]>([]);
  const [ants, setAnts] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const moveDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const spriteCache = useRef(new Map<string, HTMLCanvasElement>());
  const cloneRef = useRef<{ x: number; y: number } | null>(null);
  const cloneOrigin = useRef<{ x: number; y: number } | null>(null);
  const [penDrag, setPenDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const smudgeColor = useRef<string | null>(null);

  const doc = useEditorStore((s) => s.doc);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId ?? s.layers[s.layers.length - 1]?.id);
  const tool = useEditorStore((s) => s.tool);
  // normalisasi tool lengkap ke perilaku dasar agar ringan dan proper, tanpa duplikasi logic
  const isBrush = tool === "brush" || tool === "pencil" || tool === "mixer-brush" || tool === "history-brush" || tool === "art-history-brush" || tool === "color-replacement";
  const isEraser = tool === "eraser" || tool === "background-eraser" || tool === "magic-eraser";
  const isHeal = tool === "spot-heal" || tool === "healing-brush" || tool === "patch" || tool === "red-eye" || tool === "content-move";
  const isClone = tool === "clone" || tool === "healing-brush" || tool === "patch" || tool === "pattern-stamp";
  const isEyedropper = tool === "eyedropper" || tool === "color-sampler";
  const isCrop = tool === "crop" || tool === "frame";
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
  const snapEnabled = useProStore((s) => s.snapEnabled);

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
    // deps render komposit disengaja
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height]);

  // Tombol Fit di status bar memicu event ini
  useEffect(() => {
    window.addEventListener("avero:fit-zoom", fitToView);
    return () => window.removeEventListener("avero:fit-zoom", fitToView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag and drop file gambar dari Explorer langsung jadi layer
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const bmp = await createImageBitmap(f);
      const st = useEditorStore.getState();
      st.openDocument(f.name, bmp.width, bmp.height, null, f.size);
      // thumb recent dari bitmap (kecil), full hanya bila file di bawah 2MB
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
        /* abaikan */
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
      /* abaikan file tak terbaca */
    }
  }

  // Marching ants animation
  useEffect(() => {
    if (!hasSelection()) return;
    const t = setInterval(() => setAnts((a) => (a + 1) % 24), 80);
    return () => clearInterval(t);
  }, [layers, zoom, panX, panY, adjustments, filters, selDrag, lassoPts]);

  // Render komposit non-destructive
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
    ctx.fillStyle = "#161618";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const s = zoom / 100;
    const dw = doc.width * s;
    const dh = doc.height * s;
    const ox = (rect.width - dw) / 2 + panX;
    const oy = (rect.height - dh) / 2 + panY;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#232323";
    ctx.fillRect(ox, oy, dw, dh);
    ctx.restore();

    // 1. Komposit layer ke offscreen doc-size
    const comp = document.createElement("canvas");
    comp.width = Math.max(1, doc.width);
    comp.height = Math.max(1, doc.height);
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
      // clipping mask sederhana: jika clipped, potong dengan alpha layer di bawah
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
        /* abaikan */
      }
    }

    // 3. Adjustments berurutan
    adjustments.forEach((adj) => {
      if (!adj.enabled || adj.opacity <= 0) return;
      try {
        const id = cctx.getImageData(0, 0, comp.width, comp.height);
        const copy = new ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
        applyAdjustmentToImageData(copy, adj);
        const alpha = adj.opacity / 100;
        if (alpha >= 1) {
          cctx.putImageData(copy, 0, 0);
        } else {
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
        /* abaikan */
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
      /* abaikan */
    }

    (window as any).__avero_comp = filtered;

    // 6. Gambar ke layar
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
      // redupkan luar seleksi
      ctx.beginPath();
      ctx.rect(ox, oy, dw, dh);
      ctx.rect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fill("evenodd");
      // marching ants dari mask bounding via drawImage + dashed stroke rect aproksimasi
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -ants;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      // gambar outline mask yang di-scale
      const tmp = document.createElement("canvas");
      tmp.width = sel.width;
      tmp.height = sel.height;
      const tctx = tmp.getContext("2d")!;
      tctx.drawImage(sel, 0, 0);
      // trace tepi kasar: gunakan rect seleksi drag jika ada, jika tidak full mask outline via shadow
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
      ctx.stroke();
      ctx.restore();
    }

    // 7b. Grid pro ala Photoshop
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

    // 9. Crop preview: gelapkan luar area + bingkai
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
    // deps render komposit disengaja
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

  // Brush engine: sprite radial sesuai hardness, di-stamp sepanjang stroke.
  // Hardness 100 = cakram solid, 0 = gaussian lembut.
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
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.globalAlpha = (erase ? 100 : brushOpacity) / 100;
    const sp = brushSprite(brushSize, brushHardness, erase ? "#000000" : brushColor);
    stampLine(ctx, sp, brushSize, last.x, last.y, x, y, true);
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
  }

  // Clone stamp: Alt+klik tentukan sumber, lukis untuk salin.
  function cloneTo(x: number, y: number) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
    const src = cloneRef.current;
    if (!src) {
      setCursor("Alt+klik tentukan sumber");
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

  function retouchTo(x: number, y: number, mode: "dodge" | "burn" | "sponge" | "blur" | "sharpen" | "heal" | "smudge") {
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
        } else if (mode === "blur" || mode === "heal") {
          const tmp = document.createElement("canvas");
          tmp.width = s;
          tmp.height = s;
          const tctx = tmp.getContext("2d")!;
          tctx.filter = `blur(${Math.max(1, r / 3)}px)`;
          tctx.drawImage(c, sx, sy, s, s, 0, 0, s, s);
          tctx.filter = "none";
          ctx.save();
          ctx.globalAlpha = mode === "heal" ? 0.85 * strength + 0.15 : 0.55 * strength + 0.1;
          ctx.drawImage(tmp, sx, sy);
          ctx.restore();
        } else if (mode === "sharpen") {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          const amt = 0.35 * strength + 0.1;
          for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
            d[i] = Math.max(0, Math.min(255, d[i] + (d[i] - avg) * amt));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (d[i + 1] - avg) * amt));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (d[i + 2] - avg) * amt));
          }
          ctx.putImageData(id, sx, sy);
        } else if (mode === "sponge") {
          const id = ctx.getImageData(sx, sy, s, s);
          const d = id.data;
          const amt = 0.25 * strength + 0.05;
          for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
            d[i] = Math.max(0, Math.min(255, avg + (d[i] - avg) * (1 + amt)));
            d[i + 1] = Math.max(0, Math.min(255, avg + (d[i + 1] - avg) * (1 + amt)));
            d[i + 2] = Math.max(0, Math.min(255, avg + (d[i + 2] - avg) * (1 + amt)));
          }
          ctx.putImageData(id, sx, sy);
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
        /* abaikan tepi */
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
      /* abaikan */
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
    // Jika ada seleksi, isi seleksi dengan warna (cepat, ala Photoshop fill selection)
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
    // Flood fill toleran sederhana
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
      /* abaikan */
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
    // snapshot semua layer agar crop bisa di-undo per layer
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
      // transform di-reset karena origin dokumen berubah
      useProStore.getState().updateTransform(l.id, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    });
    st.setDocSize(w, h);
    clearSelectionMask();
    st.markDirty();
    setCropDrag(null);
    useProStore.getState().bumpHistogram();
    fitToView();
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
    // hormati seleksi: potong ke mask seleksi
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

  // Enter terapkan crop, Esc batal. Hanya saat tool crop aktif.
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

  // Eyedropper: ambil warna dari komposit lalu kembali ke brush.
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
      setCursor(`Warna ${hex}`);
    } catch {
      /* abaikan */
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
      /* abaikan */
    }
  }

  function createTextLayer(p: { x: number; y: number }) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const l = makeLayer(`Text ${st.layers.length + 1}`);
    (l as any).kind = "text";
    layerManager.ensure(l.id, doc.width, doc.height);
    const spec = {
      text: "Edit teks di panel",
      fontFamily: "Inter",
      fontSize: Math.max(24, Math.round(doc.width / 24)),
      color: "#ffffff",
      bold: true,
      italic: false,
      tracking: 0,
      leading: 1.25,
    };
    pro.setTextSpec(l.id, spec);
    const c = layerManager.ensure(l.id, doc.width, doc.height);
    renderTextToLayer(c, spec, Math.round(p.x), Math.round(p.y));
    st.addLayer({ ...l, kind: "text" });
    pro.ensureTransform(l.id);
    markDirty();
  }

  function createShapeLayer(kind: "rect" | "ellipse" | "polygon") {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const l = makeLayer(`Shape ${st.layers.length + 1}`);
    layerManager.ensure(l.id, doc.width, doc.height);
    const spec = {
      kind,
      fill: "#2f7cf6",
      stroke: "#ffffff",
      strokeWidth: 3,
      sides: 6,
      rotation: 0,
    };
    pro.setShapeSpec(l.id, spec);
    renderShapeToLayer(layerManager.ensure(l.id, doc.width, doc.height), spec);
    st.addLayer({ ...l, kind: "shape" });
    pro.ensureTransform(l.id);
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#161618]">
      {showRulers && (
        <div className="flex h-7 shrink-0 items-stretch border-b border-[#2c2c31] bg-[#1c1c1f] text-[10px] text-[#a7a7b0]">
          <div className="grid w-10 shrink-0 place-items-center border-r border-[#2c2c31] font-mono text-[#8fb6f5]">px</div>
          <div className="flex flex-1 items-center gap-3 overflow-x-auto px-3 font-mono">
            <span className="whitespace-nowrap text-white">
              W {doc.width} × H {doc.height} {paintMask ? "• paint MASK" : ""}
            </span>
            <span className="whitespace-nowrap">
              Zoom {zoom}% • Adj {adjustments.filter((a) => a.enabled).length} • Flt{" "}
              {filters.filter((f) => f.enabled).length} • {color.workingSpace}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => useProStore.getState().toggleGrid()}
                title="Toggle grid"
                className={`rounded px-1.5 py-0.5 ${showGrid ? "bg-[#2f7cf6] text-white" : "hover:bg-white/10 hover:text-white"}`}
              >
                Grid
              </button>
              <button
                onClick={() => useProStore.getState().toggleSnap()}
                title="Toggle snap (Alt tahan untuk bypass)"
                className={`rounded px-1.5 py-0.5 ${snapEnabled ? "bg-[#2f7cf6] text-white" : "hover:bg-white/10 hover:text-white"}`}
              >
                Snap
              </button>
              <button
                onClick={() => useProStore.getState().toggleGuides()}
                title="Toggle guides"
                className={`rounded px-1.5 py-0.5 ${showGuides ? "bg-[#2f7cf6] text-white" : "hover:bg-white/10 hover:text-white"}`}
              >
                Guides
              </button>
            </span>
          </div>
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
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            setZoom(zoom + (delta > 0 ? 10 : -10));
          } else if (e.shiftKey) {
            setPan(panX - e.deltaY, panY);
          } else {
            setPan(panX - e.deltaX, panY - e.deltaY);
          }
        }}
        onMouseDown={(e) => {
          if (e.button === 1 || tool === "pan") {
            panning.current = { sx: e.clientX, sy: e.clientY, px: panX, py: panY };
            return;
          }
          const p = toDocCoords(e);
          if (tool === "move") {
            // dahulukan drag guide ala Photoshop bila kena garis
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
          if (tool === "select-rect" || tool === "select-ellipse" || tool === "select-polygon" || tool === "quick-select" || tool === "single-row" || tool === "single-column" || tool === "object-select") {
            // single row/column: 1px strip
            if (tool === "single-row") setSelDrag({ x0: 0, y0: p.y, x1: doc.width, y1: p.y + 1 });
            else if (tool === "single-column") setSelDrag({ x0: p.x, y0: 0, x1: p.x + 1, y1: doc.height });
            else setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (tool === "slice" || tool === "slice-select" || tool === "artboard") {
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
              setCursor(`Sumber ${Math.round(p.x)}, ${Math.round(p.y)}`);
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
          if (tool === "text") {
            createTextLayer(p);
            return;
          }
          if (tool === "shape-rect") {
            createShapeLayer("rect");
            return;
          }
          if (tool === "shape-ellipse") {
            createShapeLayer("ellipse");
            return;
          }
          if (tool === "shape-polygon" || tool === "shape-line" || tool === "shape-custom") {
            createShapeLayer("polygon");
            return;
          }
          if (tool === "fill") {
            floodFillAt(p.x, p.y);
            return;
          }
          if (tool === "pen" || tool === "line" || tool === "curvature-pen") {
            setPenDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            return;
          }
          if (
            isBrush ||
            isEraser ||
            tool === "dodge" ||
            tool === "burn" ||
            tool === "sponge" ||
            tool === "blur" ||
            tool === "sharpen" ||
            tool === "smudge" ||
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
            if (tool === "smudge") pickSmudgeColor(p);
            if (isBrush || isEraser) paintTo(p.x, p.y, isEraser);
            else
              retouchTo(
                p.x,
                p.y,
                tool as "dodge" | "burn" | "sponge" | "blur" | "sharpen" | "smudge" | "heal",
              );
            if (isHeal) retouchTo(p.x, p.y, "heal");
            setCursor(`${Math.round(p.x)}, ${Math.round(p.y)}`);
          }
          if (tool === "zoom") {
            setZoom(e.altKey ? zoom - 25 : zoom + 25);
          }
        }}
        onMouseMove={(e) => {
          const p = toDocCoords(e);
          setCursor(`${Math.round(p.x)}, ${Math.round(p.y)}`);
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
            // Snap ala Photoshop: ke guides + grid + center dokumen
            if (pro0.snapEnabled && !e.altKey) {
              const thr = 10 / s + 3;
              let nx = moveDrag.current.ox + dx;
              let ny = moveDrag.current.oy + dy;
              // snap ke guides (posisi layer center)
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
              // snap ke grid
              if (pro0.showGrid) {
                const gs = pro0.gridSize;
                const sx = Math.round(cx / gs) * gs;
                const sy = Math.round(cy / gs) * gs;
                if (Math.abs(cx - sx) < thr) nx = sx - doc.width / 2;
                if (Math.abs(cy - sy) < thr) ny = sy - doc.height / 2;
              }
              // snap ke tengah dokumen
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
              // kunci sudut 45 derajat
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
          if (isPainting) {
            if (isClone) cloneTo(p.x, p.y);
            else if (isBrush || isEraser) paintTo(p.x, p.y, isEraser);
            else if (tool === "smudge") {
              retouchTo(p.x, p.y, "smudge");
            } else if (
              tool === "dodge" ||
              tool === "burn" ||
              tool === "sponge" ||
              tool === "blur" ||
              tool === "sharpen" ||
              isHeal
            ) {
              retouchTo(p.x, p.y, isHeal ? "heal" : tool);
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
          if (lassoPts.length > 2 && tool === "select-lasso") {
            drawLassoSelection(doc.width, doc.height, lassoPts);
            setLassoPts([]);
          } else if (tool === "select-lasso") {
            setLassoPts([]);
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
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            cursor:
              tool === "pan"
                ? "grab"
                : tool === "brush" ||
                    tool === "eraser" ||
                    tool === "clone" ||
                    tool === "eyedropper" ||
                    tool === "spot-heal" ||
                    tool === "blur" ||
                    tool === "sharpen" ||
                    tool === "smudge" ||
                    tool === "dodge" ||
                    tool === "burn" ||
                    tool === "sponge" ||
                    tool === "fill" ||
                    tool === "pen" ||
                    tool === "line"
                  ? "crosshair"
                  : tool === "select-rect" ||
                      tool === "select-ellipse" ||
                      tool === "select-lasso" ||
                      tool === "wand"
                    ? "crosshair"
                    : "default",
          }}
        />
        <ToolOptionsBar onApplyCrop={applyCrop} onCancelCrop={() => setCropDrag(null)} />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white/80">
          {cursor} • {tool} • {Math.ceil(doc.width / 256) * Math.ceil(doc.height / 256)} tiles
          {hasSelection() ? " • SEL" : ""}
        </div>
        {dragging && (
          <div className="pointer-events-none absolute inset-4 grid place-items-center rounded-lg border-2 border-dashed border-[#2f7cf6] bg-[#2f7cf6]/10">
            <div className="rounded bg-black/70 px-4 py-2 text-[13px] text-white">
              Lepaskan untuk membuka gambar
            </div>
          </div>
        )}
        {isFresh && !dragging && (
          <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-lg bg-black/65 px-4 py-2.5 text-center text-[12px] text-[#c9c9d1]">
            <span className="font-semibold text-white">Seret gambar ke sini</span> untuk mulai, atau
            tekan{" "}
            <span className="rounded bg-[#2c2c31] px-1.5 py-0.5 font-mono text-[11px]">Ctrl+K</span>{" "}
            lalu Open image
          </div>
        )}
      </div>
    </div>
  );
}
