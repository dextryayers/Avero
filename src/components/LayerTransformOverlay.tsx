import { useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { transformedBox, resizeAboutAnchor, rotateAboutContentCenter, type ContentRect, type LayerTransform, type ResizeHandle } from "../engine/layerBounds";

interface Props {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  viewW: number;
  viewH: number;
  docW: number;
  docH: number;
  zoom: number;
  panX: number;
  panY: number;
  content: ContentRect;
  transform: LayerTransform;
  layerId: string;
}

type HandleKind = ResizeHandle;

const BLUE = "#2f7cf6";

function normDeg(d: number): number {
  let r = d % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
}

/**
 * Canva style transform box: blue edge lines, 8 corner and edge handles for
 * resizing, and a black rotate button centered above the box for free rotation.
 * All edits are non destructive through the transforms store, same as the
 * Transform panel.
 */
export default function LayerTransformOverlay(p: Props) {
  const { wrapRef, viewW, viewH, docW, docH, zoom, panX, panY, content, transform, layerId } = p;
  const [dragging, setDragging] = useState<null | { kind: string }>(null);
  const drag = useRef<{
    mode: "move" | "resize" | "rotate";
    handle?: HandleKind;
    startClientX: number;
    startClientY: number;
    startT: LayerTransform;
    startCenterDoc: { x: number; y: number };
    startAngleDeg: number;
  } | null>(null);

  const s = zoom / 100;
  if (s <= 0 || viewW < 10 || viewH < 10) return null;
  if (!content || content.w < 2 || content.h < 2) return null;

  const box = transformedBox(content, docW, docH, transform);
  const ox = (viewW - docW * s) / 2 + panX;
  const oy = (viewH - docH * s) / 2 + panY;
  const cxS = ox + box.cx * s;
  const cyS = oy + box.cy * s;
  const wS = Math.max(12, box.w * s);
  const hS = Math.max(12, box.h * s);

  // Hide a box that covers the whole document, such as paper. The parent
  // already filters background layers, this is only extra protection.
  if (wS < 14 || hS < 14) return null;

  function wrapRect(): DOMRect | null {
    try {
      return wrapRef.current?.getBoundingClientRect() ?? null;
    } catch {
      return null;
    }
  }

  function docFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = wrapRect();
    if (!r) return null;
    const relX = clientX - r.left;
    const relY = clientY - r.top;
    return { x: (relX - ox) / s, y: (relY - oy) / s };
  }

  function centerScreen(): { x: number; y: number } | null {
    const r = wrapRect();
    if (!r) return null;
    return { x: r.left + cxS, y: r.top + cyS };
  }

  function endDrag() {
    drag.current = null;
    setDragging(null);
    window.removeEventListener("mousemove", onWinMove);
    window.removeEventListener("mouseup", onWinUp);
    try {
      useEditorStore.getState().markDirty();
    } catch {
      /* ignore */
    }
  }

  function onWinMove(ev: MouseEvent) {
    const d = drag.current;
    if (!d) return;
    const pro = useProStore.getState();
    pro.ensureTransform(layerId);
    if (d.mode === "move") {
      const dx = (ev.clientX - d.startClientX) / s;
      const dy = (ev.clientY - d.startClientY) / s;
      pro.updateTransform(layerId, { x: d.startT.x + dx, y: d.startT.y + dy });
      return;
    }
    if (d.mode === "rotate") {
      const c = centerScreen();
      if (!c) return;
      const ang = (Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180) / Math.PI;
      let delta = ang - d.startAngleDeg;
      // Wrap delta to -180..180 so it does not jump across 180deg.
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      let next = d.startT.rotation + delta;
      if (ev.shiftKey) next = Math.round(next / 15) * 15;
      // Spin in place: compensate translation so the content center stays
      // pixel fixed instead of orbiting the document center.
      const spun = rotateAboutContentCenter(content, docW, docH, d.startT, normDeg(next));
      pro.updateTransform(layerId, spun);
      return;
    }
    // Resize: exact opposite-corner anchoring in doc space. The dragged edge
    // lands under the pointer, the anchor never moves, scales stay positive.
    const dd = docFromClient(ev.clientX, ev.clientY);
    if (!dd) return;
    const h = d.handle!;
    const lockAspect = ev.shiftKey && (h === "nw" || h === "ne" || h === "sw" || h === "se");
    const next = resizeAboutAnchor(content, docW, docH, d.startT, h, dd, lockAspect);
    pro.updateTransform(layerId, next);
  }

  function onWinUp() {
    endDrag();
  }

  function begin(d: NonNullable<typeof drag.current>) {
    drag.current = d;
    setDragging({ kind: d.mode });
    window.addEventListener("mousemove", onWinMove);
    window.addEventListener("mouseup", onWinUp);
  }

  const handleBase: React.CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    background: "#ffffff",
    border: `2px solid ${BLUE}`,
    borderRadius: 999,
    boxShadow: "0 1px 6px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.35)",
    zIndex: 3,
  };

  const handles: { k: HandleKind; style: React.CSSProperties; cursor: string; title: string }[] = [
    { k: "nw", style: { left: -7, top: -7 }, cursor: "nwse-resize", title: "Drag a corner to resize (Shift locks aspect)" },
    { k: "ne", style: { right: -7, top: -7 }, cursor: "nesw-resize", title: "Drag a corner to resize (Shift locks aspect)" },
    { k: "sw", style: { left: -7, bottom: -7 }, cursor: "nesw-resize", title: "Drag a corner to resize (Shift locks aspect)" },
    { k: "se", style: { right: -7, bottom: -7 }, cursor: "nwse-resize", title: "Drag a corner to resize (Shift locks aspect)" },
    { k: "n", style: { left: "50%", top: -7, transform: "translateX(-50%)" }, cursor: "ns-resize", title: "Drag the top or bottom edge for height" },
    { k: "s", style: { left: "50%", bottom: -7, transform: "translateX(-50%)" }, cursor: "ns-resize", title: "Drag the top or bottom edge for height" },
    { k: "w", style: { left: -7, top: "50%", transform: "translateY(-50%)" }, cursor: "ew-resize", title: "Drag the left or right edge for width" },
    { k: "e", style: { right: -7, top: "50%", transform: "translateY(-50%)" }, cursor: "ew-resize", title: "Drag the left or right edge for width" },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden={false}
    >
      <div
        data-testid="layer-transform-box"
        className="pointer-events-auto absolute"
        style={{
          left: cxS - wS / 2,
          top: cyS - hS / 2,
          width: wS,
          height: hS,
          transform: `rotate(${box.rotation}deg)`,
          transformOrigin: "center",
          cursor: dragging?.kind === "move" ? "grabbing" : "move",
        }}
        title="Press and drag inside the image to move it. Click another image to select it."
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          const pro = useProStore.getState();
          pro.ensureTransform(layerId);
          const cur = pro.transforms[layerId] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
          begin({
            mode: "move",
            startClientX: e.clientX,
            startClientY: e.clientY,
            startT: { ...cur },
            startCenterDoc: { x: box.cx, y: box.cy },
            startAngleDeg: 0,
          });
        }}
      >
        {/* blue edge lines */}
        <div
          className="absolute inset-0"
          style={{ border: `1.5px solid ${BLUE}`, boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 12px rgba(47,124,246,0.25)" }}
        />
        {/* connector to the rotate button */}
        <div
          className="absolute left-1/2"
          style={{
            top: -32,
            width: 1.5,
            height: 26,
            background: BLUE,
            transform: "translateX(-50%)",
          }}
        />
        {/* black rotate button centered on the top edge */}
        <button
          data-testid="layer-rotate-handle"
          title="Drag to rotate the image (Shift snaps to 15 deg)"
          aria-label="Rotate image"
          className="absolute grid place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7cf6]"
          style={{
            left: "50%",
            top: -58,
            width: 28,
            height: 28,
            transform: `translateX(-50%) rotate(${-box.rotation}deg)`,
            background: "#111114",
            border: `1.5px solid ${BLUE}`,
            boxShadow: "0 2px 10px rgba(0,0,0,0.65), 0 0 8px rgba(47,124,246,0.35)",
            cursor: "grab",
            zIndex: 4,
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            const c = centerScreen();
            if (!c) return;
            const pro = useProStore.getState();
            pro.ensureTransform(layerId);
            const cur = pro.transforms[layerId] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
            const ang = (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;
            begin({
              mode: "rotate",
              startClientX: e.clientX,
              startClientY: e.clientY,
              startT: { ...cur },
              startCenterDoc: { x: box.cx, y: box.cy },
              startAngleDeg: ang,
            });
          }}
        >
          <RotateCw size={14} color="#fff" strokeWidth={2.5} />
        </button>
        {/* 8 resize handles */}
        {handles.map((hh) => (
          <div
            key={hh.k}
            data-testid={`layer-handle-${hh.k}`}
            title={hh.title}
            style={{ ...handleBase, ...hh.style, cursor: hh.cursor }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              const pro = useProStore.getState();
              pro.ensureTransform(layerId);
              const cur = pro.transforms[layerId] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
              begin({
                mode: "resize",
                handle: hh.k,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startT: { ...cur },
                startCenterDoc: { x: box.cx, y: box.cy },
                startAngleDeg: 0,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
