// Phase 2.4: render text and vector shapes to a raster layer.

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
  // manual per-character tracking for accuracy
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
  | "ticket";

export interface ShapeSpec {
  kind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  sides: number; // polygon sides
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
  } else if (spec.kind === "chevron") {
    // bold chevron pointing right
    ctx.moveTo(-rw, -rh);
    ctx.lineTo(rw * 0.15, 0);
    ctx.lineTo(-rw, rh);
    ctx.lineTo(-rw * 0.25, rh);
    ctx.lineTo(rw * 0.9, 0);
    ctx.lineTo(-rw * 0.25, -rh);
    ctx.closePath();
  } else if (spec.kind === "moon") {
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
    ctx.moveTo(rw * 0.35, -rh * 0.8);
    ctx.ellipse(rw * 0.35, 0, rw * 0.75, rh * 0.8, 0, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    if (spec.strokeWidth > 0) ctx.stroke();
    ctx.restore();
    return;
  } else if (spec.kind === "cross") {
    const t = Math.min(rw, rh) * 0.32;
    ctx.moveTo(-t, -rh);
    ctx.lineTo(t, -rh);
    ctx.lineTo(t, -t);
    ctx.lineTo(rw, -t);
    ctx.lineTo(rw, t);
    ctx.lineTo(t, t);
    ctx.lineTo(t, rh);
    ctx.lineTo(-t, rh);
    ctx.lineTo(-t, t);
    ctx.lineTo(-rw, t);
    ctx.lineTo(-rw, -t);
    ctx.lineTo(-t, -t);
    ctx.closePath();
  } else if (spec.kind === "plus") {
    const t = Math.min(rw, rh) * 0.28;
    ctx.moveTo(-t, -rh);
    ctx.lineTo(t, -rh);
    ctx.lineTo(t, -t);
    ctx.lineTo(rw, -t);
    ctx.lineTo(rw, t);
    ctx.lineTo(t, t);
    ctx.lineTo(t, rh);
    ctx.lineTo(-t, rh);
    ctx.lineTo(-t, t);
    ctx.lineTo(-rw, t);
    ctx.lineTo(-rw, -t);
    ctx.lineTo(-t, -t);
    ctx.closePath();
  } else if (spec.kind === "trapezoid") {
    ctx.moveTo(-rw * 0.7, -rh);
    ctx.lineTo(rw * 0.7, -rh);
    ctx.lineTo(rw, rh);
    ctx.lineTo(-rw, rh);
    ctx.closePath();
  } else if (spec.kind === "trapezoid-wide") {
    ctx.moveTo(-rw * 0.45, -rh);
    ctx.lineTo(rw * 0.45, -rh);
    ctx.lineTo(rw, rh);
    ctx.lineTo(-rw, rh);
    ctx.closePath();
  } else if (spec.kind === "parallelogram") {
    ctx.moveTo(-rw * 0.6, -rh);
    ctx.lineTo(rw, -rh);
    ctx.lineTo(rw * 0.6, rh);
    ctx.lineTo(-rw, rh);
    ctx.closePath();
  } else if (spec.kind === "pentagon") {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * rw;
      const py = Math.sin(a) * rh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (spec.kind === "octagon") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * rw;
      const py = Math.sin(a) * rh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (spec.kind === "shield") {
    ctx.moveTo(0, rh);
    ctx.lineTo(-rw * 0.85, rh * 0.25);
    ctx.lineTo(-rw * 0.85, -rh * 0.7);
    ctx.quadraticCurveTo(-rw * 0.4, -rh, 0, -rh * 0.72);
    ctx.quadraticCurveTo(rw * 0.4, -rh, rw * 0.85, -rh * 0.7);
    ctx.lineTo(rw * 0.85, rh * 0.25);
    ctx.closePath();
  } else if (spec.kind === "badge") {
    // seal with ribbon tails
    burstPath(ctx, rw * 0.72, rh * 0.62, 10);
    ctx.moveTo(-rw * 0.5, rh * 0.45);
    ctx.lineTo(-rw * 0.72, rh);
    ctx.lineTo(-rw * 0.36, rh * 0.88);
    ctx.lineTo(-rw * 0.14, rh);
    ctx.closePath();
    ctx.moveTo(rw * 0.5, rh * 0.45);
    ctx.lineTo(rw * 0.72, rh);
    ctx.lineTo(rw * 0.36, rh * 0.88);
    ctx.lineTo(rw * 0.14, rh);
    ctx.closePath();
  } else if (spec.kind === "ribbon") {
    ctx.moveTo(-rw, -rh * 0.55);
    ctx.lineTo(rw * 0.7, -rh * 0.55);
    ctx.lineTo(rw, 0);
    ctx.lineTo(rw * 0.7, rh * 0.55);
    ctx.lineTo(-rw, rh * 0.55);
    ctx.lineTo(-rw * 0.72, 0);
    ctx.closePath();
  } else if (spec.kind === "cloud") {
    ctx.arc(-rw * 0.45, rh * 0.15, rh * 0.55, 0, Math.PI * 2);
    ctx.moveTo(rw * 0.1 + rw * 0.4, rh * 0.1);
    ctx.arc(rw * 0.1, rh * 0.1, rw * 0.4, 0, Math.PI * 2);
    ctx.moveTo(rw * 0.55 + rw * 0.32, rh * 0.28);
    ctx.arc(rw * 0.55, rh * 0.28, rw * 0.32, 0, Math.PI * 2);
    ctx.closePath();
  } else if (spec.kind === "speech") {
    // rounded bubble with tail
    const r = Math.min(rw, rh) * 0.25;
    ctx.moveTo(-rw + r, -rh);
    ctx.lineTo(rw - r, -rh);
    ctx.quadraticCurveTo(rw, -rh, rw, -rh + r);
    ctx.lineTo(rw, rh * 0.55);
    ctx.quadraticCurveTo(rw, rh * 0.72, rw - r, rh * 0.72);
    ctx.lineTo(-rw * 0.1, rh * 0.72);
    ctx.lineTo(-rw * 0.35, rh);
    ctx.lineTo(-rw * 0.42, rh * 0.72);
    ctx.lineTo(-rw + r, rh * 0.72);
    ctx.quadraticCurveTo(-rw, rh * 0.72, -rw, rh * 0.55);
    ctx.lineTo(-rw, -rh + r);
    ctx.quadraticCurveTo(-rw, -rh, -rw + r, -rh);
    ctx.closePath();
  } else if (spec.kind === "gear") {
    // 8-tooth gear ring
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const major = i % 2 === 0;
      const rr = major ? 1 : 0.82;
      const a0 = (i / (teeth * 2)) * Math.PI * 2;
      const a1 = ((i + 0.5) / (teeth * 2)) * Math.PI * 2;
      const x0 = Math.cos(a0) * rw * rr;
      const y0 = Math.sin(a0) * rh * rr;
      const x1 = Math.cos(a1) * rw * rr;
      const y1 = Math.sin(a1) * rh * rr;
      if (i === 0) ctx.moveTo(x0, y0);
      else ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.closePath();
  } else if (spec.kind === "drop") {
    ctx.moveTo(0, -rh);
    ctx.bezierCurveTo(rw * 0.9, -rh * 0.1, rw * 0.75, rh * 0.6, 0, rh);
    ctx.bezierCurveTo(-rw * 0.75, rh * 0.6, -rw * 0.9, -rh * 0.1, 0, -rh);
    ctx.closePath();
  } else if (spec.kind === "leaf") {
    ctx.moveTo(0, -rh);
    ctx.quadraticCurveTo(rw, -rh * 0.35, rw * 0.55, rh * 0.7);
    ctx.quadraticCurveTo(0, rh, -rw * 0.55, rh * 0.7);
    ctx.quadraticCurveTo(-rw, -rh * 0.35, 0, -rh);
    ctx.closePath();
  } else if (spec.kind === "lightning") {
    ctx.moveTo(rw * 0.15, -rh);
    ctx.lineTo(-rw * 0.45, rh * 0.25);
    ctx.lineTo(-rw * 0.02, rh * 0.25);
    ctx.lineTo(-rw * 0.15, rh);
    ctx.lineTo(rw * 0.45, -rh * 0.25);
    ctx.lineTo(rw * 0.02, -rh * 0.25);
    ctx.closePath();
  } else if (spec.kind === "crown") {
    ctx.moveTo(-rw, rh * 0.7);
    ctx.lineTo(-rw, -rh * 0.35);
    ctx.lineTo(-rw * 0.5, rh * 0.05);
    ctx.lineTo(0, -rh * 0.7);
    ctx.lineTo(rw * 0.5, rh * 0.05);
    ctx.lineTo(rw, -rh * 0.35);
    ctx.lineTo(rw, rh * 0.7);
    ctx.closePath();
  } else if (spec.kind === "pin") {
    // map pin: circle head plus tail
    ctx.arc(0, -rh * 0.25, Math.min(rw, rh) * 0.55, 0, Math.PI * 2);
    ctx.moveTo(Math.min(rw, rh) * 0.32, rh * 0.05);
    ctx.lineTo(0, rh);
    ctx.lineTo(-Math.min(rw, rh) * 0.32, rh * 0.05);
    ctx.closePath();
  } else if (spec.kind === "ticket") {
    const r = Math.min(rw, rh) * 0.3;
    ctx.moveTo(-rw + r, -rh * 0.7);
    ctx.lineTo(rw - r, -rh * 0.7);
    ctx.quadraticCurveTo(rw, -rh * 0.7, rw, -rh * 0.4);
    ctx.lineTo(rw, -r * 0.4);
    ctx.arc(rw, 0, r * 0.4, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(rw, rh * 0.4);
    ctx.quadraticCurveTo(rw, rh * 0.7, rw - r, rh * 0.7);
    ctx.lineTo(-rw + r, rh * 0.7);
    ctx.quadraticCurveTo(-rw, rh * 0.7, -rw, rh * 0.4);
    ctx.lineTo(-rw, r * 0.4);
    ctx.arc(-rw, 0, r * 0.4, Math.PI / 2, Math.PI * 1.5, true);
    ctx.lineTo(-rw, -rh * 0.4);
    ctx.quadraticCurveTo(-rw, -rh * 0.7, -rw + r, -rh * 0.7);
    ctx.closePath();
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
