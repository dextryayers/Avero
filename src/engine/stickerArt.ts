// Professional sticker art engine (plan7): vector stamps plus FX overlays,
// zero emoji. Specs live in asset space (0 to 100 square) so art stays
// crisp at any sticker size. The painter renders with the brush color plus
// the signature white halo and soft shadow, so decals read on any photo.
// Pure validation plus a seeded random keep every asset unit tested and
// every procedural thumb matching its placed result.

export type StickerShape =
  | { op: "dot"; cx: number; cy: number; r: number }
  | { op: "ring"; cx: number; cy: number; r: number; w: number }
  | { op: "rect"; x: number; y: number; w: number; h: number; rr?: number; fill?: boolean; wgt?: number }
  | { op: "poly"; pts: [number, number][]; fill?: boolean; wgt?: number }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; w: number }
  | { op: "burst"; cx: number; cy: number; ro: number; ri: number; n: number; fill?: boolean; wgt?: number }
  | { op: "cut"; cx: number; cy: number; r: number };

export type NewStickerCategory = "marks" | "badges" | "frames" | "labels" | "nature" | "fx";

export type StickerFxKind =
  | "sunburst" | "lens-flare" | "bokeh" | "grain" | "vignette" | "streak"
  | "glow-orb" | "sparkle-spray" | "haze" | "duotone" | "edge-burn" | "beam";

export interface StickerArtSpec {
  /** Stable legacy id, reused unchanged so registry and docs never churn. */
  id: string;
  label: string;
  category: NewStickerCategory;
  /** Vector shapes for stamps. Empty when fx carries the asset. */
  shapes: StickerShape[];
  /** Procedural overlay kind for FX assets. Painters land in plan7 Phase 2. */
  fx?: StickerFxKind;
}

function num(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Structural validation for one asset. Empty array means clean. */
export function validateStickerArt(shapes: StickerShape[]): string[] {
  const bad: string[] = [];
  if (!Array.isArray(shapes) || shapes.length === 0) return ["empty shapes"];
  if (shapes.length > 24) bad.push("too many shapes");
  const inRange = (v: number) => v >= -20 && v <= 120;
  shapes.forEach((sh, i) => {
    const tag = `shape ${i} (${(sh as StickerShape).op})`;
    switch (sh.op) {
      case "dot":
        if (!num(sh.cx) || !num(sh.cy) || !num(sh.r) || sh.r <= 0) bad.push(`${tag}: bad circle`);
        else if (!inRange(sh.cx) || !inRange(sh.cy)) bad.push(`${tag}: off canvas`);
        break;
      case "ring":
        if (!num(sh.cx) || !num(sh.cy) || !num(sh.r) || !num(sh.w) || sh.r <= 0 || sh.w <= 0) bad.push(`${tag}: bad ring`);
        else if (!inRange(sh.cx) || !inRange(sh.cy)) bad.push(`${tag}: off canvas`);
        break;
      case "rect":
        if (!num(sh.x) || !num(sh.y) || !num(sh.w) || !num(sh.h) || sh.w <= 0 || sh.h <= 0) bad.push(`${tag}: bad rect`);
        else {
          if (!inRange(sh.x) || !inRange(sh.y)) bad.push(`${tag}: off canvas`);
          if (sh.rr !== undefined && (!num(sh.rr) || sh.rr < 0 || sh.rr > Math.min(sh.w, sh.h) / 2)) bad.push(`${tag}: bad radius`);
          if (sh.wgt !== undefined && (!num(sh.wgt) || sh.wgt <= 0)) bad.push(`${tag}: bad weight`);
        }
        break;
      case "poly":
        if (!Array.isArray(sh.pts) || sh.pts.length < 3 || sh.pts.length > 32) bad.push(`${tag}: bad points`);
        else if (!sh.pts.every((p) => Array.isArray(p) && num(p[0]) && num(p[1]) && inRange(p[0]) && inRange(p[1]))) bad.push(`${tag}: bad points`);
        else if (sh.wgt !== undefined && (!num(sh.wgt) || sh.wgt <= 0)) bad.push(`${tag}: bad weight`);
        break;
      case "line":
        if (!num(sh.x1) || !num(sh.y1) || !num(sh.x2) || !num(sh.y2) || !num(sh.w) || sh.w <= 0) bad.push(`${tag}: bad line`);
        else if (!inRange(sh.x1) || !inRange(sh.y1) || !inRange(sh.x2) || !inRange(sh.y2)) bad.push(`${tag}: off canvas`);
        break;
      case "burst":
        if (!num(sh.cx) || !num(sh.cy) || !num(sh.ro) || !num(sh.ri) || sh.ro <= sh.ri || sh.ri <= 0) bad.push(`${tag}: bad burst radii`);
        else if (!Number.isInteger(sh.n) || sh.n < 3 || sh.n > 24) bad.push(`${tag}: bad burst points`);
        else if (!inRange(sh.cx) || !inRange(sh.cy)) bad.push(`${tag}: off canvas`);
        else if (sh.wgt !== undefined && (!num(sh.wgt) || sh.wgt <= 0)) bad.push(`${tag}: bad weight`);
        break;
      case "cut":
        if (!num(sh.cx) || !num(sh.cy) || !num(sh.r) || sh.r <= 0) bad.push(`${tag}: bad cut`);
        else if (!inRange(sh.cx) || !inRange(sh.cy)) bad.push(`${tag}: off canvas`);
        break;
      default:
        bad.push(`${tag}: unknown op`);
        break;
    }
  });
  if (!shapes.some((sh) => sh.op !== "cut")) bad.push("no drawable shape");
  return bad;
}

/** FNV-1a hash to seed procedural FX so thumbs match placed results. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic random in [0, 1) for seeded procedural art. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parse #rrggbb (with or without hash) for procedural FX mixing. */
export function parseHexColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [47, 124, 246];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

/**
 * Procedural FX overlays (plan7 Phase 2): light and atmosphere assets
 * painted in tile space with transparency preserved, so they grade content
 * below instead of covering it. Seeded per kind, so grid thumbs match
 * placed results exactly at any size (positions are size fractions).
 */
export function paintStickerFx(
  g: CanvasRenderingContext2D,
  kind: StickerFxKind,
  color: string,
  sizePx: number,
): void {
  const s = Math.max(16, Math.round(sizePx));
  const [r, gg, b] = parseHexColor(color);
  const rand = mulberry32(hashSeed(`fx:${kind}`));
  g.clearRect(0, 0, s, s);
  g.save();
  g.lineJoin = "round";
  g.lineCap = "round";
  const dot = (x: number, y: number, rad: number, alpha: number, shade?: [number, number, number]) => {
    const [cr, cg, cb] = shade ?? [r, gg, b];
    g.beginPath();
    g.fillStyle = rgba(cr, cg, cb, alpha);
    g.arc(x * s, y * s, Math.max(0.5, rad * s), 0, Math.PI * 2);
    g.fill();
  };
  switch (kind) {
    case "sunburst": {
      g.strokeStyle = rgba(r, gg, b, 0.9);
      g.lineWidth = Math.max(2, s * 0.022);
      g.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI * 2 * i) / 24;
        const long = i % 2 === 0;
        const r0 = (long ? 0.1 : 0.24) * s;
        const r1 = (long ? 0.48 : 0.4) * s;
        g.moveTo(0.5 * s + Math.cos(a) * r0, 0.5 * s + Math.sin(a) * r0);
        g.lineTo(0.5 * s + Math.cos(a) * r1, 0.5 * s + Math.sin(a) * r1);
      }
      g.stroke();
      dot(0.5, 0.5, 0.07, 0.95);
      break;
    }
    case "lens-flare": {
      const discs: [number, number, number, number][] = [
        [0.3, 0.64, 0.1, 0.5],
        [0.43, 0.53, 0.07, 0.55],
        [0.55, 0.43, 0.05, 0.6],
        [0.67, 0.33, 0.035, 0.65],
        [0.78, 0.24, 0.025, 0.7],
      ];
      for (const [x, y, rad, a] of discs) dot(x, y, rad, a);
      dot(0.5, 0.5, 0.09, 0.9, [255, 255, 255]);
      break;
    }
    case "bokeh": {
      for (let i = 0; i < 14; i++) {
        const x = 0.08 + rand() * 0.84;
        const y = 0.08 + rand() * 0.84;
        const rad = 0.02 + rand() * 0.045;
        if (i % 3 === 2) {
          g.beginPath();
          g.strokeStyle = rgba(r, gg, b, 0.5);
          g.lineWidth = Math.max(1.5, s * 0.012);
          g.arc(x * s, y * s, rad * s, 0, Math.PI * 2);
          g.stroke();
        } else {
          dot(x, y, rad, 0.25 + rand() * 0.35);
        }
      }
      break;
    }
    case "grain": {
      const img = g.createImageData(s, s);
      const d = img.data;
      const cx = s / 2;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const dist = Math.hypot(x - cx, y - cx) / (s / 2);
          if (rand() > Math.max(0.06, 0.5 - dist * 0.45)) continue;
          const light = rand() > 0.4;
          const idx = (y * s + x) * 4;
          const v = light ? 255 : 0;
          d[idx] = v;
          d[idx + 1] = v;
          d[idx + 2] = v;
          d[idx + 3] = Math.round(115);
        }
      }
      g.putImageData(img, 0, 0);
      break;
    }
    case "vignette": {
      const grad = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.72);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.62)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case "streak": {
      g.save();
      g.translate(s / 2, s / 2);
      g.rotate(-Math.PI / 6);
      const grad = g.createLinearGradient(-s * 0.2, 0, s * 0.2, 0);
      grad.addColorStop(0, rgba(r, gg, b, 0));
      grad.addColorStop(0.5, rgba(r, gg, b, 0.55));
      grad.addColorStop(1, rgba(r, gg, b, 0));
      g.fillStyle = grad;
      g.fillRect(-s * 0.2, -s, s * 0.4, s * 2);
      g.restore();
      break;
    }
    case "glow-orb": {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.48);
      grad.addColorStop(0, rgba(r, gg, b, 0.85));
      grad.addColorStop(0.55, rgba(r, gg, b, 0.35));
      grad.addColorStop(1, rgba(r, gg, b, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case "sparkle-spray": {
      for (let i = 0; i < 10; i++) {
        const x = 0.12 + rand() * 0.76;
        const y = 0.12 + rand() * 0.76;
        const a = (0.02 + rand() * 0.035) * s;
        g.strokeStyle = rgba(r, gg, b, 0.85);
        g.lineWidth = Math.max(1.5, s * 0.012);
        g.beginPath();
        g.moveTo(x * s - a, y * s);
        g.lineTo(x * s + a, y * s);
        g.moveTo(x * s, y * s - a);
        g.lineTo(x * s, y * s + a);
        g.stroke();
      }
      dot(0.5, 0.5, 0.05, 0.9);
      break;
    }
    case "haze": {
      const grad = g.createLinearGradient(0, s * 0.28, 0, s * 0.72);
      grad.addColorStop(0, rgba(r, gg, b, 0));
      grad.addColorStop(0.5, rgba(r, gg, b, 0.35));
      grad.addColorStop(1, rgba(r, gg, b, 0));
      g.fillStyle = grad;
      g.fillRect(0, s * 0.28, s, s * 0.44);
      break;
    }
    case "duotone": {
      g.fillStyle = rgba(r, gg, b, 0.28);
      g.fillRect(0, 0, s, s);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(s, 0);
      g.lineTo(0, s);
      g.closePath();
      g.fillStyle = rgba(r, gg, b, 0.28);
      g.fill();
      break;
    }
    case "edge-burn": {
      // Burns stay black by design: they darken photo edges like a lens.
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.lineWidth = Math.max(4, s * 0.08);
      g.strokeRect(0, 0, s, s);
      g.strokeStyle = "rgba(0,0,0,0.3)";
      g.lineWidth = Math.max(2, s * 0.03);
      const inset = s * 0.09;
      g.strokeRect(inset, inset, s - inset * 2, s - inset * 2);
      break;
    }
    case "beam": {
      const grad = g.createLinearGradient(s * 0.32, 0, s * 0.68, 0);
      grad.addColorStop(0, rgba(r, gg, b, 0));
      grad.addColorStop(0.5, rgba(r, gg, b, 0.5));
      grad.addColorStop(1, rgba(r, gg, b, 0));
      g.fillStyle = grad;
      g.fillRect(s * 0.32, 0, s * 0.36, s);
      break;
    }
    default:
      break;
  }
  g.restore();
}

/** Single entry for grid thumbs and placement: vector or FX by spec. */
export function paintStickerArt(
  g: CanvasRenderingContext2D,
  spec: Pick<StickerArtSpec, "shapes" | "fx">,
  color: string,
  sizePx: number,
): void {
  if (spec.fx) paintStickerFx(g, spec.fx, color, sizePx);
  else drawStickerVector(g, spec.shapes, color, sizePx);
}
/** True when the string holds an emoji presentation character. */
export function containsEmoji(s: string): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{FE00}-\u{FE0F}]/u.test(s);
}

function tracePath(g: CanvasRenderingContext2D, pts: [number, number][], k: number): void {
  pts.forEach(([x, y], i) => {
    if (i === 0) g.moveTo(x * k, y * k);
    else g.lineTo(x * k, y * k);
  });
  g.closePath();
}

function burstPath(g: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number, n: number, k: number): void {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (Math.PI * i) / n - Math.PI / 2;
    const x = (cx + Math.cos(a) * r) * k;
    const y = (cy + Math.sin(a) * r) * k;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function roundedRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rr: number, k: number): void {
  const r = Math.min(rr, w / 2, h / 2);
  g.beginPath();
  g.moveTo((x + r) * k, y * k);
  g.lineTo((x + w - r) * k, y * k);
  g.quadraticCurveTo((x + w) * k, y * k, (x + w) * k, (y + r) * k);
  g.lineTo((x + w) * k, (y + h - r) * k);
  g.quadraticCurveTo((x + w) * k, (y + h) * k, (x + w - r) * k, (y + h) * k);
  g.lineTo((x + r) * k, (y + h) * k);
  g.quadraticCurveTo(x * k, (y + h) * k, x * k, (y + h - r) * k);
  g.lineTo(x * k, (y + r) * k);
  g.quadraticCurveTo(x * k, y * k, (x + r) * k, y * k);
  g.closePath();
}

function drawOne(g: CanvasRenderingContext2D, sh: StickerShape, k: number, haloWidth: number, halo: boolean): void {
  const lw = (w: number) => (halo ? w + haloWidth : w);
  switch (sh.op) {
    case "dot":
      g.beginPath();
      g.arc(sh.cx * k, sh.cy * k, sh.r * k, 0, Math.PI * 2);
      g.fill();
      if (halo) {
        g.lineWidth = haloWidth * k;
        g.stroke();
      }
      break;
    case "cut":
      g.save();
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      g.arc(sh.cx * k, sh.cy * k, sh.r * k, 0, Math.PI * 2);
      g.fill();
      g.restore();
      break;
    case "ring":
      g.beginPath();
      g.arc(sh.cx * k, sh.cy * k, sh.r * k, 0, Math.PI * 2);
      g.lineWidth = lw(sh.w) * k;
      g.stroke();
      break;
    case "rect": {
      const fill = sh.fill !== false;
      const rr = sh.rr ?? 0;
      if (rr > 0) roundedRectPath(g, sh.x, sh.y, sh.w, sh.h, rr, k);
      else {
        g.beginPath();
        g.rect(sh.x * k, sh.y * k, sh.w * k, sh.h * k);
      }
      if (fill) g.fill();
      if (!fill || halo) {
        g.lineWidth = lw(sh.wgt ?? 7) * k;
        g.stroke();
      }
      break;
    }
    case "poly":
      g.beginPath();
      tracePath(g, sh.pts, k);
      if (sh.fill !== false) g.fill();
      if (sh.fill === false || halo) {
        g.lineWidth = lw(sh.wgt ?? 7) * k;
        g.stroke();
      }
      break;
    case "line":
      g.beginPath();
      g.moveTo(sh.x1 * k, sh.y1 * k);
      g.lineTo(sh.x2 * k, sh.y2 * k);
      g.lineWidth = lw(sh.w) * k;
      g.stroke();
      break;
    case "burst":
      burstPath(g, sh.cx, sh.cy, sh.ro, sh.ri, sh.n, k);
      if (sh.fill !== false) g.fill();
      if (sh.fill === false || halo) {
        g.lineWidth = lw(sh.wgt ?? 7) * k;
        g.stroke();
      }
      break;
    default:
      break;
  }
}

/**
 * Paint one vector asset tile with the brush color plus the signature
 * white halo and soft shadow, so decals read on any background.
 */
export function drawStickerVector(
  g: CanvasRenderingContext2D,
  shapes: StickerShape[],
  color: string,
  sizePx: number,
): void {
  const s = Math.max(16, Math.round(sizePx));
  const k = s / 100;
  const hw = s * 0.075;
  g.clearRect(0, 0, s, s);
  g.save();
  g.lineJoin = "round";
  g.lineCap = "round";
  // Halo pass carries the drop shadow, like the legacy glyph painter.
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = Math.max(2, s * 0.03);
  g.shadowOffsetY = Math.max(1, s * 0.012);
  g.strokeStyle = "#ffffff";
  g.fillStyle = "#ffffff";
  for (const sh of shapes) drawOne(g, sh, k, hw, true);
  g.restore();
  g.save();
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = color;
  g.fillStyle = color;
  for (const sh of shapes) drawOne(g, sh, k, hw, false);
  g.restore();
}

// ---------------------------------------------------------------------------
// Frozen catalog (plan7 Phase 0.2): all 72 legacy ids mapped to professional
// assets. Ids never change, labels carry the new meaning. Stamp categories
// hold vector shapes, FX entries hold a procedural kind (painters land in
// Phase 2) with empty shapes.
// ---------------------------------------------------------------------------

function spec(id: string, label: string, category: NewStickerCategory, shapes: StickerShape[], fx?: StickerFxKind): StickerArtSpec {
  return fx ? { id, label, category, shapes, fx } : { id, label, category, shapes };
}

const L = (x1: number, y1: number, x2: number, y2: number, w: number): StickerShape => ({ op: "line", x1, y1, x2, y2, w });
const D = (cx: number, cy: number, r: number): StickerShape => ({ op: "dot", cx, cy, r });

export const STICKER_V2: StickerArtSpec[] = [
  // Marks and Arrows (14)
  spec("sticker-smile", "Check", "marks", [L(28, 54, 44, 70, 9), L(44, 70, 74, 30, 9)]),
  spec("sticker-laugh", "Cross Mark", "marks", [L(30, 30, 70, 70, 9), L(70, 30, 30, 70, 9)]),
  spec("sticker-wink", "Arrow Right", "marks", [
    L(18, 50, 70, 50, 8),
    { op: "poly", pts: [[70, 50], [54, 36], [54, 64]] },
  ]),
  spec("sticker-cool", "Arrow Diagonal", "marks", [
    L(24, 76, 66, 34, 8),
    { op: "poly", pts: [[66, 34], [48, 34], [66, 52]] },
  ]),
  spec("sticker-party-face", "Plus", "marks", [L(50, 26, 50, 74, 9), L(26, 50, 74, 50, 9)]),
  spec("sticker-heart-eyes", "Minus", "marks", [L(28, 50, 72, 50, 9)]),
  spec("sticker-star-struck", "Star", "marks", [{ op: "burst", cx: 50, cy: 50, ro: 34, ri: 14, n: 5 }]),
  spec("sticker-sleepy", "Burst Seal", "marks", [{ op: "burst", cx: 50, cy: 50, ro: 38, ri: 30, n: 16 }]),
  spec("sticker-clown", "Target", "marks", [{ op: "ring", cx: 50, cy: 50, r: 30, w: 7 }, D(50, 50, 6)]),
  spec("sticker-robot", "Cursor", "marks", [
    { op: "poly", pts: [[37, 16], [37, 72], [51, 60], [59, 74], [63, 59], [77, 55]] },
  ]),
  spec("sticker-alien", "Map Pin", "marks", [
    D(50, 34, 15),
    { op: "poly", pts: [[37, 44], [63, 44], [50, 78]] },
  ]),
  spec("sticker-ghost", "Bolt", "marks", [
    { op: "poly", pts: [[56, 14], [32, 56], [48, 56], [44, 86], [68, 44], [52, 44]] },
  ]),
  spec("sticker-thumbs-up", "Chevron Right", "marks", [L(40, 28, 62, 50, 9), L(62, 50, 40, 72, 9)]),
  spec("sticker-ok-hand", "Bullseye", "marks", [{ op: "ring", cx: 50, cy: 50, r: 22, w: 8 }, D(50, 50, 10)]),
  // Badges and Seals (12)
  spec("sticker-peace", "Seal", "badges", [{ op: "ring", cx: 50, cy: 50, r: 30, w: 7 }, { op: "burst", cx: 50, cy: 50, ro: 16, ri: 10, n: 8 }]),
  spec("sticker-pray", "Medal", "badges", [
    D(50, 28, 12),
    { op: "poly", pts: [[40, 38], [60, 38], [56, 72], [50, 64], [44, 72]] },
  ]),
  spec("sticker-clap", "Crown", "badges", [
    { op: "poly", pts: [[24, 68], [28, 36], [40, 52], [50, 30], [60, 52], [72, 36], [76, 68]] },
    { op: "rect", x: 24, y: 68, w: 52, h: 8 },
  ]),
  spec("sticker-wave", "Ticket", "badges", [
    { op: "rect", x: 18, y: 34, w: 64, h: 32 },
    { op: "cut", cx: 18, cy: 50, r: 6 },
    { op: "cut", cx: 82, cy: 50, r: 6 },
  ]),
  spec("sticker-rock-on", "Shield", "badges", [
    { op: "poly", pts: [[50, 16], [74, 28], [74, 52], [50, 84], [26, 52], [26, 28]] },
  ]),
  spec("sticker-love-you", "Key", "badges", [
    { op: "ring", cx: 50, cy: 32, r: 14, w: 7 },
    L(50, 46, 50, 76, 7),
    L(50, 62, 60, 62, 6),
  ]),
  spec("sticker-red-heart", "Heart", "badges", [
    D(37, 40, 14),
    D(63, 40, 14),
    { op: "poly", pts: [[23, 48], [77, 48], [50, 80]] },
  ]),
  spec("sticker-sparkles", "Sparkle", "badges", [{ op: "burst", cx: 50, cy: 50, ro: 34, ri: 8, n: 4 }]),
  spec("sticker-star", "Award Star", "badges", [
    { op: "burst", cx: 50, cy: 50, ro: 30, ri: 13, n: 5 },
    { op: "ring", cx: 50, cy: 50, r: 40, w: 5 },
  ]),
  spec("sticker-fire", "Verified", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 28, w: 8 },
    L(40, 52, 47, 59, 6),
    L(47, 59, 61, 42, 6),
  ]),
  spec("sticker-lightning", "Padlock", "badges", [
    { op: "rect", x: 34, y: 46, w: 32, h: 30, rr: 6 },
    { op: "ring", cx: 50, cy: 38, r: 12, w: 7 },
  ]),
  spec("sticker-hundred", "Postmark", "badges", [
    { op: "rect", x: 24, y: 24, w: 52, h: 52, rr: 10 },
    { op: "cut", cx: 50, cy: 50, r: 9 },
  ]),
  // Frames and Shapes (12)
  spec("sticker-party-popper", "Speech Bubble", "frames", [
    { op: "rect", x: 20, y: 28, w: 60, h: 36, rr: 12 },
    { op: "poly", pts: [[36, 64], [30, 84], [50, 64]] },
  ]),
  spec("sticker-balloon", "Round Frame", "frames", [{ op: "rect", x: 18, y: 22, w: 64, h: 56, rr: 14, fill: false, wgt: 7 }]),
  spec("sticker-crown", "Circle Frame", "frames", [{ op: "ring", cx: 50, cy: 50, r: 32, w: 7 }]),
  spec("sticker-gem", "Stub Ticket", "frames", [
    { op: "rect", x: 20, y: 36, w: 60, h: 28, rr: 4 },
    { op: "cut", cx: 20, cy: 50, r: 5 },
    { op: "cut", cx: 80, cy: 50, r: 5 },
  ]),
  spec("sticker-trophy", "Tag", "frames", [
    { op: "poly", pts: [[28, 28], [66, 28], [80, 50], [66, 72], [28, 72]] },
    { op: "cut", cx: 38, cy: 50, r: 6 },
  ]),
  spec("sticker-medal", "Ribbon Banner", "frames", [
    { op: "poly", pts: [[16, 36], [84, 36], [72, 50], [84, 64], [16, 64], [28, 50]] },
  ]),
  spec("sticker-rocket", "Corner Brackets", "frames", [
    L(22, 48, 22, 28, 7), L(22, 28, 42, 28, 7),
    L(78, 48, 78, 28, 7), L(78, 28, 58, 28, 7),
    L(22, 52, 22, 72, 7), L(22, 72, 42, 72, 7),
    L(78, 52, 78, 72, 7), L(78, 72, 58, 72, 7),
  ]),
  spec("sticker-gift", "Instant Frame", "frames", [
    { op: "rect", x: 24, y: 18, w: 52, h: 56, rr: 4, fill: false, wgt: 8 },
    D(50, 62, 5),
  ]),
  spec("sticker-cat", "Divider", "frames", [L(16, 50, 84, 50, 6), D(50, 50, 8)]),
  spec("sticker-dog", "Corner Ticks", "frames", [
    L(20, 20, 30, 30, 6), L(80, 20, 70, 30, 6),
    L(20, 80, 30, 70, 6), L(80, 80, 70, 70, 6),
  ]),
  spec("sticker-fox", "Underline", "frames", [
    L(20, 62, 68, 62, 6),
    { op: "poly", pts: [[68, 62], [56, 54], [56, 70]] },
  ]),
  spec("sticker-panda", "Measure Bar", "frames", [
    { op: "rect", x: 20, y: 44, w: 60, h: 12 },
    L(20, 38, 20, 62, 5),
    L(80, 38, 80, 62, 5),
  ]),
  // Labels and Callouts (12)
  spec("sticker-frog", "Price Tag", "labels", [
    { op: "poly", pts: [[30, 26], [68, 26], [82, 50], [68, 74], [30, 74]] },
    { op: "cut", cx: 40, cy: 50, r: 6 },
  ]),
  spec("sticker-monkey", "Sale Burst", "labels", [{ op: "burst", cx: 50, cy: 50, ro: 34, ri: 20, n: 10 }]),
  spec("sticker-lion", "Step One", "labels", [{ op: "ring", cx: 50, cy: 50, r: 30, w: 7 }, D(50, 50, 8)]),
  spec("sticker-tiger", "Step Two", "labels", [{ op: "ring", cx: 50, cy: 50, r: 30, w: 7 }, D(40, 50, 6), D(60, 50, 6)]),
  spec("sticker-unicorn", "Step Three", "labels", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    D(40, 44, 6),
    D(60, 44, 6),
    D(50, 60, 6),
  ]),
  spec("sticker-chick", "Quote Marks", "labels", [
    D(38, 38, 9),
    D(62, 38, 9),
    L(38, 47, 32, 64, 7),
    L(62, 47, 56, 64, 7),
  ]),
  spec("sticker-penguin", "Caution", "labels", [
    { op: "poly", pts: [[50, 22], [78, 72], [22, 72]], fill: false, wgt: 8 },
    D(50, 60, 5),
  ]),
  spec("sticker-butterfly", "Ruler", "labels", [
    L(16, 50, 84, 50, 5),
    L(26, 44, 26, 56, 4),
    L(38, 44, 38, 56, 4),
    L(50, 44, 50, 56, 4),
    L(62, 44, 62, 56, 4),
    L(74, 44, 74, 56, 4),
  ]),
  spec("sticker-ladybug", "North Arrow", "labels", [
    { op: "ring", cx: 50, cy: 52, r: 28, w: 6 },
    { op: "poly", pts: [[50, 24], [62, 52], [50, 46], [38, 52]] },
  ]),
  spec("sticker-bee", "Redaction Bar", "labels", [{ op: "rect", x: 18, y: 40, w: 64, h: 20, rr: 4 }]),
  spec("sticker-pizza", "Approved", "labels", [
    { op: "rect", x: 24, y: 30, w: 52, h: 40, rr: 10, fill: false, wgt: 7 },
    L(38, 52, 46, 60, 6),
    L(46, 60, 62, 40, 6),
  ]),
  spec("sticker-burger", "Mini Burst", "labels", [{ op: "burst", cx: 50, cy: 50, ro: 24, ri: 16, n: 8 }]),
  // Nature Pro (10)
  spec("sticker-sunflower", "Sun Disc", "nature", [
    D(50, 50, 24),
    L(80, 50, 88, 50, 5), L(71.2, 71.2, 76.9, 76.9, 5),
    L(50, 80, 50, 88, 5), L(28.8, 71.2, 23.1, 76.9, 5),
    L(20, 50, 12, 50, 5), L(28.8, 28.8, 23.1, 23.1, 5),
    L(50, 20, 50, 12, 5), L(71.2, 28.8, 76.9, 23.1, 5),
  ]),
  spec("sticker-rose", "Moon Crescent", "nature", [D(50, 50, 28), { op: "cut", cx: 60, cy: 40, r: 24 }]),
  spec("sticker-cactus", "Cloud Outline", "nature", [
    { op: "ring", cx: 38, cy: 55, r: 16, w: 6 },
    { op: "ring", cx: 55, cy: 45, r: 20, w: 6 },
    { op: "ring", cx: 68, cy: 58, r: 13, w: 6 },
    L(32, 68, 70, 68, 6),
  ]),
  spec("sticker-mushroom", "Flow Lines", "nature", [L(25, 35, 75, 35, 6), L(25, 50, 75, 50, 6), L(25, 65, 75, 65, 6)]),
  spec("sticker-sun", "Geometric Snowflake", "nature", [
    L(50, 18, 50, 82, 5), L(25.8, 36, 74.2, 64, 5), L(25.8, 64, 74.2, 36, 5),
    { op: "ring", cx: 50, cy: 50, r: 8, w: 5 },
  ]),
  spec("sticker-rainbow", "Mountain Ridge", "nature", [
    { op: "poly", pts: [[14, 72], [36, 36], [52, 58], [66, 30], [86, 72]], fill: false, wgt: 7 },
  ]),
  spec("sticker-cloud", "Rain", "nature", [
    D(35, 38, 6), D(50, 30, 6), D(65, 40, 6),
    L(35, 47, 35, 59, 5), L(50, 39, 50, 51, 5), L(65, 49, 65, 61, 5),
  ]),
  spec("sticker-snowflake", "Leaf Vein", "nature", [
    { op: "poly", pts: [[50, 18], [72, 50], [50, 82], [28, 50]], fill: false, wgt: 7 },
    L(50, 24, 50, 76, 5),
  ]),
  spec("sticker-ocean-wave", "Lightning Fork", "nature", [
    { op: "poly", pts: [[56, 16], [40, 48], [52, 48], [44, 84], [66, 44], [54, 44]], fill: false, wgt: 7 },
  ]),
  spec("sticker-clover", "Clover", "nature", [
    D(50, 30, 11), D(70, 50, 11), D(50, 70, 11), D(30, 50, 11), L(50, 70, 50, 88, 6),
  ]),
  // Light and FX (12, procedural painters land in Phase 2)
  spec("sticker-fries", "Sunburst", "fx", [], "sunburst"),
  spec("sticker-taco", "Lens Flare", "fx", [], "lens-flare"),
  spec("sticker-sushi", "Bokeh Field", "fx", [], "bokeh"),
  spec("sticker-donut", "Film Grain", "fx", [], "grain"),
  spec("sticker-cupcake", "Vignette", "fx", [], "vignette"),
  spec("sticker-ice-cream", "Light Streak", "fx", [], "streak"),
  spec("sticker-candy", "Glow Orb", "fx", [], "glow-orb"),
  spec("sticker-lollipop", "Sparkle Spray", "fx", [], "sparkle-spray"),
  spec("sticker-coffee", "Haze Band", "fx", [], "haze"),
  spec("sticker-bubble-tea", "Duotone Wash", "fx", [], "duotone"),
  spec("sticker-strawberry", "Edge Burn", "fx", [], "edge-burn"),
  spec("sticker-watermelon", "Soft Beam", "fx", [], "beam"),
];
