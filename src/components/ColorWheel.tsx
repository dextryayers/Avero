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

// Affinity-style colour wheel: hue ring outside, saturation/lightness square
// inside. Writes the shared brush color live; markers follow brushColor.
export default function ColorWheel({ size = 172 }: { size?: number }) {
  const brushColor = useEditorStore((s) => s.brushColor);
  const setBrush = useEditorStore((s) => s.setBrush);
  const ringRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLCanvasElement>(null);
  const dragMode = useRef<"hue" | "sl" | null>(null);

  const [r, g, b] = hexToRgb(brushColor);
  const [h, s, l] = rgbToHsl(r, g, b);

  const ringOuter = size / 2;
  const ringWidth = Math.max(12, size * 0.09);
  const ringInner = ringOuter - ringWidth;
  const boxSide = Math.floor(ringInner * Math.SQRT2);
  const boxX = (size - boxSide) / 2;
  const boxY = (size - boxSide) / 2;

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

  // Paint the SL square whenever hue changes.
  useEffect(() => {
    const c = boxRef.current;
    if (!c) return;
    c.width = boxSide;
    c.height = boxSide;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(boxSide, boxSide);
    for (let yy = 0; yy < boxSide; yy++) {
      for (let xx = 0; xx < boxSide; xx++) {
        const ss = (xx / Math.max(1, boxSide - 1)) * 100;
        const ll = 100 - (yy / Math.max(1, boxSide - 1)) * 100;
        const [rr, gg, bb] = hslToRgb(h, ss, ll);
        const idx = (yy * boxSide + xx) * 4;
        img.data[idx] = rr;
        img.data[idx + 1] = gg;
        img.data[idx + 2] = bb;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, boxSide]);

  const pickAt = (clientX: number, clientY: number, el: HTMLCanvasElement, mode: "hue" | "sl") => {
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
      // Box canvas is exactly the SL square: coordinates are box pixels.
      const scale = boxSide / Math.max(1, rect.width);
      const px = (clientX - rect.left) * scale;
      const py = (clientY - rect.top) * scale;
      const ns = Math.max(0, Math.min(100, Math.round((px / Math.max(1, boxSide - 1)) * 100)));
      const nl = Math.max(0, Math.min(100, Math.round(100 - (py / Math.max(1, boxSide - 1)) * 100)));
      const [nr, ng, nb] = hslToRgb(h, ns, nl);
      setBrush({ color: rgbToHex(nr, ng, nb) });
    }
  };

  const hueAng = (((h + 90) % 360) * Math.PI) / 180;
  const hueX = size / 2 + Math.cos(hueAng) * ((ringOuter + ringInner) / 2);
  const hueY = size / 2 + Math.sin(hueAng) * ((ringOuter + ringInner) / 2);
  const slX = boxX + (s / 100) * (boxSide - 1);
  const slY = boxY + (1 - l / 100) * (boxSide - 1);

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
        const mode = dist >= ringInner - 4 ? "hue" : "sl";
        dragMode.current = mode;
        el.setPointerCapture?.(e.pointerId);
        const target = mode === "hue" ? ringRef.current! : boxRef.current!;
        pickAt(e.clientX, e.clientY, target, mode);
      }}
      onPointerMove={(e) => {
        if (!e.buttons || !dragMode.current) return;
        const el = dragMode.current === "hue" ? ringRef.current! : boxRef.current!;
        if (el) pickAt(e.clientX, e.clientY, el, dragMode.current);
      }}
      onPointerUp={() => {
        dragMode.current = null;
      }}
    >
      <canvas ref={ringRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={boxRef}
        className="absolute"
        style={{ left: boxX, top: boxY, width: boxSide, height: boxSide }}
      />
      <div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: hueX, top: hueY }}
      />
      <div
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow"
        style={{ left: slX, top: slY }}
      />
    </div>
  );
}
