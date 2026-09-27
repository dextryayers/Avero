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

export type ShapeKind =
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
  | "donut";

export interface ShapeSpec {
  kind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  sides: number; // untuk polygon
  rotation: number;
}

function starPath(ctx: CanvasRenderingContext2D, rw: number, rh: number, points = 5) {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * rw * r;
    const py = Math.sin(a) * rh * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function burstPath(ctx: CanvasRenderingContext2D, rw: number, rh: number, spikes = 12) {
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 1 : 0.78;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * rw * r;
    const py = Math.sin(a) * rh * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, rw: number, rh: number) {
  const w = rw * 2;
  const h = rh * 2;
  ctx.moveTo(0, h * 0.35);
  ctx.bezierCurveTo(w * 0.55, -h * 0.15, w * 0.32, -h * 0.55, 0, -h * 0.18);
  ctx.bezierCurveTo(-w * 0.32, -h * 0.55, -w * 0.55, -h * 0.15, 0, h * 0.35);
  ctx.closePath();
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
  } else if (spec.kind === "rounded") {
    const r = Math.min(rw, rh) * 0.35;
    // rounded rect path
    ctx.moveTo(-rw + r, -rh);
    ctx.lineTo(rw - r, -rh);
    ctx.quadraticCurveTo(rw, -rh, rw, -rh + r);
    ctx.lineTo(rw, rh - r);
    ctx.quadraticCurveTo(rw, rh, rw - r, rh);
    ctx.lineTo(-rw + r, rh);
    ctx.quadraticCurveTo(-rw, rh, -rw, rh - r);
    ctx.lineTo(-rw, -rh + r);
    ctx.quadraticCurveTo(-rw, -rh, -rw + r, -rh);
    ctx.closePath();
  } else if (spec.kind === "diamond") {
    ctx.moveTo(0, -rh);
    ctx.lineTo(rw, 0);
    ctx.lineTo(0, rh);
    ctx.lineTo(-rw, 0);
    ctx.closePath();
  } else if (spec.kind === "triangle") {
    ctx.moveTo(0, -rh);
    ctx.lineTo(rw, rh);
    ctx.lineTo(-rw, rh);
    ctx.closePath();
  } else if (spec.kind === "line") {
    ctx.moveTo(-rw, 0);
    ctx.lineTo(rw, 0);
    // stroke-only line: fill would close the path, so handle separately
    ctx.strokeStyle = spec.stroke !== "transparent" ? spec.stroke : spec.fill;
    const lw = Math.max(2, spec.strokeWidth || 3);
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
    return;
  } else if (spec.kind === "star") {
    starPath(ctx, rw, rh, 5);
  } else if (spec.kind === "arrow") {
    // block arrow pointing right
    ctx.moveTo(-rw, -rh * 0.45);
    ctx.lineTo(rw * 0.35, -rh * 0.45);
    ctx.lineTo(rw * 0.35, -rh);
    ctx.lineTo(rw, 0);
    ctx.lineTo(rw * 0.35, rh);
    ctx.lineTo(rw * 0.35, rh * 0.45);
    ctx.lineTo(-rw, rh * 0.45);
    ctx.closePath();
  } else if (spec.kind === "heart") {
    heartPath(ctx, rw, rh);
  } else if (spec.kind === "hexagon") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * rw;
      const py = Math.sin(a) * rh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (spec.kind === "burst") {
    burstPath(ctx, rw, rh, 12);
  } else if (spec.kind === "donut") {
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.moveTo(rw * 0.55, 0);
    ctx.ellipse(0, 0, rw * 0.55, rh * 0.55, 0, 0, Math.PI * 2, true);
    // even-odd fill for hole
    ctx.fill("evenodd");
    if (spec.strokeWidth > 0) ctx.stroke();
    ctx.restore();
    return;
  } else if (spec.kind === "custom") {
    // decorative wave ribbon
    ctx.moveTo(-rw, rh * 0.3);
    ctx.bezierCurveTo(-rw * 0.4, -rh, rw * 0.4, rh, rw, -rh * 0.3);
    ctx.lineTo(rw, rh * 0.5);
    ctx.bezierCurveTo(rw * 0.4, rh * 1.1, -rw * 0.4, -rh * 0.2, -rw, rh);
    ctx.closePath();
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
