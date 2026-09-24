import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { fitZoom } from "../engine/canvasMath";

export default function CanvasArea() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState("0, 0");
  const [isPainting, setIsPainting] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const spaceDown = useRef(false);
  const panning = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const doc = useEditorStore((s) => s.doc);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId ?? s.layers[s.layers.length - 1]?.id);
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

  // Pastikan tiap layer punya offscreen canvas sesuai ukuran dokumen
  useEffect(() => {
    layers.forEach((l) => layerManager.ensure(l.id, doc.width, doc.height));
  }, [layers, doc.width, doc.height]);

  // Event gambar hasil open dari TitleBar / CommandPalette
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
        // paksa render ulang via zoom tick
        const z = useEditorStore.getState().zoom;
        useEditorStore.getState().setZoom(z);
      };
      img.src = detail.dataUrl;
    }
    window.addEventListener("psd:opened-image", onOpened);
    return () => window.removeEventListener("psd:opened-image", onOpened);
  }, []);

  // Fit saat dokumen berubah ukuran dan viewport siap
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const z = fitZoom(doc.width, doc.height, r.width - 80, r.height - 80);
    setZoom(Math.max(10, Math.min(100, z)));
    setPan(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height]);

  // Render komposit tiap ada perubahan
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
    ctx.clearRect(0, 0, rect.width, rect.height);

    // background gelap
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const s = zoom / 100;
    const dw = doc.width * s;
    const dh = doc.height * s;
    const ox = (rect.width - dw) / 2 + panX;
    const oy = (rect.height - dh) / 2 + panY;

    // shadow dokumen
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#232323";
    ctx.fillRect(ox, oy, dw, dh);
    ctx.restore();

    // gambar tiap layer dari bawah ke atas (index 0 paling bawah)
    layers.forEach((l) => {
      if (!l.visible) return;
      const lc = layerManager.get(l.id);
      if (!lc) return;
      ctx.save();
      ctx.globalAlpha = l.opacity / 100;
      ctx.globalCompositeOperation =
        l.blendMode === "normal" ? "source-over" : (l.blendMode as GlobalCompositeOperation);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(lc, ox, oy, dw, dh);
      // highlight active layer border
      if (l.id === activeLayerId) {
        ctx.strokeStyle = "rgba(10,132,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox, oy, dw, dh);
      }
      ctx.restore();
    });

    // grid halus saat zoom besar
    if (zoom >= 400) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      const step = s;
      ctx.beginPath();
      for (let x = ox; x <= ox + dw; x += step) {
        ctx.moveTo(x, oy);
        ctx.lineTo(x, oy + dh);
      }
      for (let y = oy; y <= oy + dh; y += step) {
        ctx.moveTo(ox, y);
        ctx.lineTo(ox + dw, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [layers, activeLayerId, doc.width, doc.height, zoom, panX, panY, isPainting]);

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

  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      setZoom(zoom + (delta > 0 ? 10 : -10));
    } else if (e.shiftKey) {
      setPan(panX - e.deltaY, panY);
    } else {
      // scroll biasa = pan vertikal, geser horizontal jika deltaX
      setPan(panX - e.deltaX, panY - e.deltaY);
    }
  }

  function paintTo(x: number, y: number, erase: boolean) {
    if (!activeLayerId) return;
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || meta.locked || !meta.visible) return;
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

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[#141414]">
      {showRulers && (
        <div className="flex h-6 shrink-0 items-stretch border-b border-[#3e3e42] bg-[#252526] text-[10px] text-[#a0a0a0]">
          <div className="grid w-6 place-items-center border-r border-[#3e3e42]">px</div>
          <div className="flex flex-1 items-center justify-between px-3 font-mono">
            <span>W {doc.width}</span>
            <span>H {doc.height}</span>
            <span>Zoom {zoom}%</span>
          </div>
        </div>
      )}

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (e.button === 1 || tool === "pan" || spaceDown.current) {
            panning.current = { sx: e.clientX, sy: e.clientY, px: panX, py: panY };
            return;
          }
          if (tool === "brush" || tool === "eraser") {
            const p = toDocCoords(e);
            // snapshot untuk undo sekali per stroke
            const snap = layerManager.snapshot(activeLayerId ?? "");
            if (snap && activeLayerId) {
              pushHistory({
                label: tool === "brush" ? "Brush stroke" : "Eraser",
                layerId: activeLayerId,
                snapshot: snap,
              });
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
              panning.current.py + (e.clientY - panning.current.sy),
            );
            return;
          }
          if (isPainting) {
            paintTo(p.x, p.y, tool === "eraser");
          }
        }}
        onMouseUp={() => {
          setIsPainting(false);
          lastPos.current = null;
          panning.current = null;
        }}
        onMouseLeave={() => {
          setIsPainting(false);
          lastPos.current = null;
          panning.current = null;
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
                  : "default",
          }}
        />
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white/80">
          {cursor} • {tool} • {Math.ceil(doc.width / 256) * Math.ceil(doc.height / 256)} tiles
        </div>
      </div>
    </div>
  );
}
