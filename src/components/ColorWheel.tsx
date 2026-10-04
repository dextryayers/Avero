import { useEffect, useRef } from "react";
import { useEditorStore } from "../stores/useEditorStore";

// HSL math shared by the Colour studio view (unit-tested below via color.test).
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const mx = Math.max(rn, gn, bn);
  const mn = Math.min(rn, gn, bn);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === rn) h = ((gn - bn) / d) % 6;
    else if (mx === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = Math.max(0, Math.min(1, s / 100));
  const ln = Math.max(0, Math.min(1, l / 100));
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const chan = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [Math.round(chan(hn + 1 / 3) * 255), Math.round(chan(hn) * 255), Math.round(chan(hn - 1 / 3) * 255)];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = Math.max(0, Math.min(1, s / 100));
  const vn = Math.max(0, Math.min(1, v / 100));
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0: r = vn; g = t; b = p; break;
    case 1: r = q; g = vn; b = p; break;
    case 2: r = p; g = vn; b = t; break;
    case 3: r = p; g = q; b = vn; break;
    case 4: r = t; g = p; b = vn; break;
    default: r = vn; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const mx = Math.max(rn, gn, bn);
  const mn = Math.min(rn, gn, bn);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === rn) h = ((gn - bn) / d) % 6;
    else if (mx === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = mx === 0 ? 0 : d / mx;
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(mx * 100)];
}

export interface TriVertices {
  ex: number;
  ey: number;
  wx: number;
  wy: number;
  bx: number;
  by: number;
}

/** Right facing SV triangle vertices for a widget of side `size`: apex east
 * carries pure hue, top west is white, bottom west is black. */
export function triVertices(size: number, radius: number): TriVertices {
  const cx = size / 2;
  const cy = size / 2;
  const h = (radius * Math.sqrt(3)) / 2;
  return { ex: cx + radius, ey: cy, wx: cx - radius / 2, wy: cy - h, bx: cx - radius / 2, by: cy + h };
}

/** Barycentric weights (apex, white, black) for a point, clamped inside. */
export function triWeights(px: number, py: number, v: TriVertices): [number, number, number] {
  const d = (v.wy - v.by) * (v.ex - v.bx) + (v.bx - v.wx) * (v.ey - v.by);
  if (d === 0) return [0, 0, 1];
  let wE = ((v.wy - v.by) * (px - v.bx) + (v.bx - v.wx) * (py - v.by)) / d;
  let wW = ((v.by - v.ey) * (px - v.bx) + (v.ex - v.bx) * (py - v.by)) / d;
  let wB = 1 - wE - wW;
  wE = Math.max(0, wE);
  wW = Math.max(0, wW);
  wB = Math.max(0, wB);
  const sum = wE + wW + wB || 1;
  return [wE / sum, wW / sum, wB / sum];
}

/** SV fractions (0..1) for a widget point inside the triangle. */
export function triSV(px: number, py: number, v: TriVertices): { s: number; v: number } {
  const [wE, wW] = triWeights(px, py, v);
  const vv = Math.max(0, Math.min(1, wE + wW));
  const ss = vv <= 1e-6 ? 0 : Math.max(0, Math.min(1, wE / vv));
  return { s: ss, v: vv };
}

/** Widget point for SV fractions inside the triangle. */
export function triPoint(s: number, v: TriVertices, vv: number): { x: number; y: number } {
  const sc = Math.max(0, Math.min(1, s));
  const vc = Math.max(0, Math.min(1, vv));
  const wE = sc * vc;
  const wW = (1 - sc) * vc;
  const wB = 1 - vc;
  return {
    x: wE * v.ex + wW * v.wx + wB * v.bx,
    y: wE * v.ey + wW * v.wy + wB * v.by,
  };
}

// Affinity-style colour wheel: hue ring outside, modern right facing SV
// triangle inside. Writes the shared brush color live; markers follow brushColor.
export default function ColorWheel({ size = 172 }: { size?: number }) {
  const brushColor = useEditorStore((s) => s.brushColor);
  const setBrush = useEditorStore((s) => s.setBrush);
  const ringRef = useRef<HTMLCanvasElement>(null);
  const triRef = useRef<HTMLCanvasElement>(null);
  const dragMode = useRef<"hue" | "sv" | null>(null);

  const [r, g, b] = hexToRgb(brushColor);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [, ss, vs] = rgbToHsv(r, g, b);

  const ringOuter = size / 2;
  const ringWidth = Math.max(12, size * 0.09);
  const ringInner = ringOuter - ringWidth;
  const triR = Math.max(24, ringInner - 6);
  const tri = triVertices(size, triR);

  // Paint the hue ring once (hue-independent).
  useEffect(() => {
    const c = ringRef.current;
    if (!c) return;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 360; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${i},100%,50%)`;
      ctx.lineWidth = ringWidth + 1;
      const a0 = ((i - 90) * Math.PI) / 180;
      const a1 = ((i + 1 - 90) * Math.PI) / 180;
      ctx.arc(size / 2, size / 2, (ringOuter + ringInner) / 2, a0, a1);
      ctx.stroke();
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // Paint the SV triangle whenever hue changes. Pixels outside the
  // triangle stay transparent so the dark widget shows through.
  useEffect(() => {
    const c = triRef.current;
    if (!c) return;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const v = triVertices(size, Math.max(24, size / 2 - Math.max(12, size * 0.09) - 6));
    const img = ctx.createImageData(size, size);
    const minX = Math.max(0, Math.floor(Math.min(v.ex, v.wx, v.bx)));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(v.ex, v.wx, v.bx)));
    const minY = Math.max(0, Math.floor(Math.min(v.ey, v.wy, v.by)));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(v.ey, v.wy, v.by)));
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const [wE, wW] = triWeights(xx + 0.5, yy + 0.5, v);
        if (wE <= 0 && wW <= 0) continue;
        const vv = wE + wW;
        const ss = vv <= 1e-6 ? 0 : wE / vv;
        const [rr, gg, bb] = hsvToRgb(h, ss * 100, vv * 100);
        const idx = (yy * size + xx) * 4;
        img.data[idx] = rr;
        img.data[idx + 1] = gg;
        img.data[idx + 2] = bb;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, size]);

  const pickAt = (clientX: number, clientY: number, el: HTMLCanvasElement, mode: "hue" | "sv") => {
    const rect = el.getBoundingClientRect();
    if (mode === "hue") {
      // Ring canvas spans the whole widget: coordinates are widget pixels.
      const scale = size / Math.max(1, rect.width);
      const px = (clientX - rect.left) * scale;
      const py = (clientY - rect.top) * scale;
      const ang = (Math.atan2(py - size / 2, px - size / 2) * 180) / Math.PI + 90;
      const nh = Math.round(((ang % 360) + 360) % 360);
      const [nr, ng, nb] = hslToRgb(nh, s, l);
      setBrush({ color: rgbToHex(nr, ng, nb) });
    } else {
      // Triangle canvas spans the whole widget: coordinates are widget pixels.
      const scale = size / Math.max(1, rect.width);
      const px = (clientX - rect.left) * scale;
      const py = (clientY - rect.top) * scale;
      const v = triVertices(size, triR);
      const { s: ns, v: nv } = triSV(px, py, v);
      const [nr, ng, nb] = hsvToRgb(h, ns * 100, nv * 100);
      setBrush({ color: rgbToHex(nr, ng, nb) });
    }
  };

  const hueAng = (((h + 90) % 360) * Math.PI) / 180;
  const hueX = size / 2 + Math.cos(hueAng) * ((ringOuter + ringInner) / 2);
  const hueY = size / 2 + Math.sin(hueAng) * ((ringOuter + ringInner) / 2);
  const svPt = triPoint(ss / 100, tri, vs / 100);

  return (
    <div
      className="relative mx-auto touch-none select-none"
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const dist = Math.hypot(cx - size / 2, cy - size / 2);
        const mode = dist >= ringInner - 4 ? "hue" : "sv";
        dragMode.current = mode;
        el.setPointerCapture?.(e.pointerId);
        const target = mode === "hue" ? ringRef.current! : triRef.current!;
        pickAt(e.clientX, e.clientY, target, mode);
      }}
      onPointerMove={(e) => {
        if (!e.buttons || !dragMode.current) return;
        const el = dragMode.current === "hue" ? ringRef.current! : triRef.current!;
        if (el) pickAt(e.clientX, e.clientY, el, dragMode.current);
      }}
      onPointerUp={() => {
        dragMode.current = null;
      }}
    >
      <canvas ref={ringRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={triRef} className="absolute inset-0 h-full w-full" />
      <div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: hueX, top: hueY }}
      />
      <div
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow"
        style={{ left: svPt.x, top: svPt.y }}
      />
    </div>
  );
}
