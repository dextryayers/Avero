// Fase 2.4: Render text dan shape vector ke layer raster.

export interface TextSpec {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  tracking: number; // px antar huruf
  leading: number; // line height multiplier
}

export function renderTextToLayer(canvas: HTMLCanvasElement, spec: TextSpec, x = 60, y = 120) {
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const style = `${spec.italic ? "italic " : ""}${spec.bold ? "700 " : "400 "}${spec.fontSize}px "${spec.fontFamily}", system-ui, sans-serif`;
  ctx.font = style;
  ctx.fillStyle = spec.color;
  ctx.textBaseline = "top";
  // tracking manual per karakter untuk akurasi
  const lines = spec.text.split("\n");
  let cy = y;
  const lh = spec.fontSize * spec.leading;
  lines.forEach((line) => {
    let cx = x;
    for (const ch of line) {
      ctx.fillText(ch, cx, cy);
      cx += ctx.measureText(ch).width + spec.tracking;
    }
    cy += lh;
  });
  ctx.restore();
}

export type ShapeKind = "rect" | "ellipse" | "polygon";

export interface ShapeSpec {
  kind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  sides: number; // untuk polygon
  rotation: number;
}

export function renderShapeToLayer(canvas: HTMLCanvasElement, spec: ShapeSpec) {
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const rw = Math.min(w, h) * 0.5;
  const rh = Math.min(w, h) * 0.34;
  ctx.fillStyle = spec.fill;
  ctx.strokeStyle = spec.stroke;
  ctx.lineWidth = spec.strokeWidth;
  ctx.translate(cx, cy);
  ctx.rotate((spec.rotation * Math.PI) / 180);
  ctx.beginPath();
  if (spec.kind === "rect") {
    ctx.rect(-rw, -rh, rw * 2, rh * 2);
  } else if (spec.kind === "ellipse") {
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  } else {
    const n = Math.max(3, Math.min(12, Math.round(spec.sides)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * rw;
      const py = Math.sin(a) * rh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ctx.fill();
  if (spec.strokeWidth > 0) ctx.stroke();
  ctx.restore();
}
