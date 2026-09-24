import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { fitZoom } from "../engine/canvasMath";
import {
  clearSelectionMask,
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
import { makeLayer } from "../stores/useEditorStore";

export function getCompositeCanvas(): HTMLCanvasElement | null {
  return (window as any).__psd_comp ?? null;
}

export default function CanvasArea() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState("0, 0");
  const [isPainting, setIsPainting] = useState(false);
  const [selDrag, setSelDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [lassoPts, setLassoPts] = useState<{ x: number; y: number }[]>([]);
  const [ants, setAnts] = useState(0);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const moveDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const doc = useEditorStore((s) => s.doc);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId =
    useEditorStore((s) => s.activeLayerId ?? s.layers[s.layers.length - 1]?.id);
  const tool = useEditorStore((s) => s.tool);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
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

  useEffect(() => {
    layers.forEach((l) => layerManager.ensure(l.id, doc.width, doc.height));
  }, [layers, doc.width, doc.height]);

  useEffect(() => {
    function onOpened(e: Event) {
      const detail = (e as CustomEvent).detail as { dataUrl: string; w: number; h: number };
      const id =
        useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
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
    window.addEventListener("psd:opened-image", onOpened);
    return () => window.removeEventListener("psd:opened-image", onOpened);
  }, []);

  useEffect(() => {
    clearSelectionMask();
  }, [doc.width, doc.height]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const z = fitZoom(doc.width, doc.height, r.width - 80, r.height - 80);
    setZoom(Math.max(10, Math.min(100, z)));
    setPan(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height]);

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
    ctx.fillStyle = "#141414";
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
        !!m?.hasMask && !!m?.enabled
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

    (window as any).__psd_comp = filtered;

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
      ctx.fillStyle = "#0a84ff";
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
      ctx.strokeStyle = "#0a84ff";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function paintTo(x: number, y: number, erase: boolean) {
    if (!activeLayerId) return;
    if (!isPointInSelection(x, y)) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;

    // Mode paint mask
    const m = masks[activeLayerId];
    if (paintMask && m?.hasMask) {
      const mc = layerManager.ensureMask(activeLayerId, doc.width, doc.height);
      const ctx = mc.getContext("2d")!;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = erase ? "#000000" : "#ffffff";
      ctx.globalAlpha = brushOpacity / 100;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const last = lastPos.current;
      ctx.beginPath();
      if (last) {
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.1, y + 0.1);
      }
      ctx.stroke();
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
    ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const last = lastPos.current;
    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1);
    }
    ctx.stroke();
    ctx.restore();
    lastPos.current = { x, y };
    markDirty();
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
    const spec = { text: "Edit teks di panel", fontFamily: "Inter", fontSize: Math.max(24, Math.round(doc.width / 24)), color: "#ffffff", bold: true, italic: false, tracking: 0, leading: 1.25 };
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
    const spec = { kind, fill: "#0a84ff", stroke: "#ffffff", strokeWidth: 3, sides: 6, rotation: 0 };
    pro.setShapeSpec(l.id, spec);
    renderShapeToLayer(layerManager.ensure(l.id, doc.width, doc.height), spec);
    st.addLayer({ ...l, kind: "shape" });
    pro.ensureTransform(l.id);
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#141414]">
      {showRulers && (
        <div className="flex h-6 shrink-0 items-stretch border-b border-[#3e3e42] bg-[#252526] text-[10px] text-[#a0a0a0]">
          <div className="grid w-6 place-items-center border-r border-[#3e3e42]">px</div>
          <div className="flex flex-1 items-center justify-between px-3 font-mono">
            <span>
              W {doc.width} {paintMask ? "• paint MASK" : ""}
            </span>
            <span>H {doc.height}</span>
            <span>
              Zoom {zoom}% • Adj {adjustments.filter((a) => a.enabled).length} • Flt{" "}
              {filters.filter((f) => f.enabled).length} • {color.workingSpace}
            </span>
          </div>
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden"
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
            const t = transforms[activeLayerId ?? ""];
            moveDrag.current = { sx: e.clientX, sy: e.clientY, ox: t?.x ?? 0, oy: t?.y ?? 0 };
            return;
          }
          if (tool === "select-rect") {
            setSelDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
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
          if (tool === "brush" || tool === "eraser") {
            const snap = layerManager.snapshot(activeLayerId ?? "");
            if (snap && activeLayerId) {
              pushHistory({
                label: paintMask ? "Paint mask" : tool === "brush" ? "Brush stroke" : "Eraser",
                layerId: activeLayerId,
                snapshot: snap,
              });
              if (paintMask) {
                const mc = layerManager.getMask(activeLayerId);
                if (mc) {
                  try {
                    const mctx = mc.getContext("2d", { willReadFrequently: true })!;
                    const mid = mctx.getImageData(0, 0, mc.width, mc.height);
                    (window as any).__mask_snap = { id: activeLayerId, data: mid };
                  } catch {
                    /* abaikan */
                  }
                }
              }
            }
            setIsPainting(true);
            lastPos.current = null;
            paintTo(p.x, p.y, tool === "eraser");
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
              panning.current.py + (e.clientY - panning.current.sy)
            );
            return;
          }
          if (moveDrag.current && activeLayerId) {
            const s = zoom / 100;
            const dx = (e.clientX - moveDrag.current.sx) / s;
            const dy = (e.clientY - moveDrag.current.sy) / s;
            useProStore.getState().ensureTransform(activeLayerId);
            useProStore
              .getState()
              .updateTransform(activeLayerId, { x: moveDrag.current.ox + dx, y: moveDrag.current.oy + dy });
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
          if (isPainting) {
            paintTo(p.x, p.y, tool === "eraser");
          }
        }}
        onMouseUp={() => {
          if (selDrag) {
            const r = {
              x: selDrag.x0,
              y: selDrag.y0,
              w: selDrag.x1 - selDrag.x0,
              h: selDrag.y1 - selDrag.y0,
            };
            if (Math.abs(r.w) > 4 && Math.abs(r.h) > 4) {
              drawRectSelection(doc.width, doc.height, r);
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
          if (isPainting) bumpHistogram();
        }}
        onMouseLeave={() => {
          setIsPainting(false);
          lastPos.current = null;
          panning.current = null;
          moveDrag.current = null;
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            cursor:
              tool === "pan"
                ? "grab"
                : tool === "brush" || tool === "eraser"
                  ? "crosshair"
                  : tool === "select-rect" || tool === "select-lasso"
                    ? "crosshair"
                    : "default",
          }}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white/80">
          {cursor} • {tool} • {Math.ceil(doc.width / 256) * Math.ceil(doc.height / 256)} tiles
          {hasSelection() ? " • SEL" : ""}
        </div>
      </div>
    </div>
  );
}
