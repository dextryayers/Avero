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

export type NewStickerCategory = "marks" | "badges" | "frames" | "labels" | "nature" | "fx" | "poster" | "social";

export type StickerFxKind =
  | "sunburst" | "lens-flare" | "bokeh" | "grain" | "vignette" | "streak"
  | "glow-orb" | "sparkle-spray" | "haze" | "duotone" | "edge-burn" | "beam"
  | "confetti" | "starfield" | "rainbow-rings" | "dots-fade" | "plus-field" | "grain-fine"
  | "leak" | "prism" | "checker-fade" | "wave-band" | "ring-burst" | "spotlight";

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
    case "confetti": {
      const rand = mulberry32(hashSeed("fx:confetti"));
      for (let i = 0; i < 14; i++) {
        const x = (0.1 + rand() * 0.8) * s;
        const y = (0.1 + rand() * 0.8) * s;
        const w = s * (0.025 + rand() * 0.03);
        const h = s * (0.04 + rand() * 0.04);
        g.save();
        g.translate(x, y);
        g.rotate(rand() * Math.PI);
        g.fillStyle = i % 3 === 2 ? "rgba(255,255,255,0.9)" : rgba(r, gg, b, 0.85);
        g.fillRect(-w / 2, -h / 2, w, h);
        g.restore();
      }
      break;
    }
    case "starfield": {
      const rand = mulberry32(hashSeed("fx:starfield"));
      for (let i = 0; i < 22; i++) {
        const x = (0.06 + rand() * 0.88) * s;
        const y = (0.06 + rand() * 0.88) * s;
        const rad = s * (0.008 + rand() * 0.022);
        dot(x / s, y / s, rad / s, 0.3 + rand() * 0.6);
      }
      for (let i = 0; i < 4; i++) {
        const x = (0.2 + rand() * 0.6) * s;
        const y = (0.2 + rand() * 0.6) * s;
        const a = s * 0.035;
        g.strokeStyle = rgba(255, 255, 255, 0.8);
        g.lineWidth = Math.max(1.5, s * 0.01);
        g.beginPath();
        g.moveTo(x - a, y);
        g.lineTo(x + a, y);
        g.moveTo(x, y - a);
        g.lineTo(x, y + a);
        g.stroke();
      }
      break;
    }
    case "rainbow-rings": {
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.strokeStyle = rgba(r, gg, b, 0.6 - i * 0.09);
        g.lineWidth = Math.max(2, s * 0.022);
        g.arc(s / 2, s / 2, s * (0.1 + i * 0.08), 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case "dots-fade": {
      const rand = mulberry32(hashSeed("fx:dots-fade"));
      const n = 9;
      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++) {
          const x = ((gx + 0.5) / n) * s;
          const y = ((gy + 0.5) / n) * s;
          const dist = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
          if (dist > 1) continue;
          const rad = Math.max(0.6, s * 0.028 * (1 - dist * 0.8) + rand() * s * 0.004);
          dot(x / s, y / s, rad / s, 0.75);
        }
      }
      break;
    }
    case "plus-field": {
      const n = 4;
      g.strokeStyle = rgba(r, gg, b, 0.8);
      g.lineWidth = Math.max(2, s * 0.02);
      g.lineCap = "round";
      const a = s * 0.045;
      g.beginPath();
      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++) {
          const x = ((gx + 0.5) / n) * s;
          const y = ((gy + 0.5) / n) * s;
          g.moveTo(x - a, y);
          g.lineTo(x + a, y);
          g.moveTo(x, y - a);
          g.lineTo(x, y + a);
        }
      }
      g.stroke();
      break;
    }
    case "grain-fine": {
      const rand = mulberry32(hashSeed("fx:grain-fine"));
      for (let i = 0; i < Math.round(s * s * 0.16); i++) {
        const x = Math.floor(rand() * s);
        const y = Math.floor(rand() * s);
        const light = rand() > 0.5;
        g.fillStyle = light ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
        g.fillRect(x, y, 1, 1);
      }
      break;
    }
    case "leak": {
      const grad = g.createRadialGradient(s * 0.85, s * 0.1, 0, s * 0.85, s * 0.1, s * 0.9);
      grad.addColorStop(0, rgba(r, gg, b, 0.55));
      grad.addColorStop(1, rgba(r, gg, b, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case "prism": {
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.16);
      g.lineTo(s * 0.82, s * 0.72);
      g.lineTo(s * 0.18, s * 0.72);
      g.closePath();
      g.strokeStyle = rgba(r, gg, b, 0.9);
      g.lineWidth = Math.max(2, s * 0.03);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.18, s * 0.56);
      g.lineTo(s * 0.82, s * 0.56);
      g.strokeStyle = rgba(r, gg, b, 0.55);
      g.lineWidth = Math.max(1.5, s * 0.018);
      g.stroke();
      break;
    }
    case "checker-fade": {
      const n = 8;
      const cell = s / n;
      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++) {
          if ((gx + gy) % 2 !== 0) continue;
          const cx = (gx + 0.5) * cell;
          const cy = (gy + 0.5) * cell;
          const dist = Math.hypot(cx - s / 2, cy - s / 2) / (s / 2);
          if (dist > 1) continue;
          g.fillStyle = rgba(r, gg, b, 0.7 * (1 - dist * 0.75));
          g.fillRect(gx * cell, gy * cell, cell, cell);
        }
      }
      break;
    }
    case "wave-band": {
      g.strokeStyle = rgba(r, gg, b, 0.7);
      g.lineWidth = Math.max(2, s * 0.025);
      g.beginPath();
      for (let row = 0; row < 3; row++) {
        const yBase = s * (0.3 + row * 0.2);
        for (let x = 0; x <= s; x += 6) {
          const y = yBase + Math.sin((x / s) * Math.PI * 2) * s * 0.04;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
      }
      g.stroke();
      break;
    }
    case "ring-burst": {
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.strokeStyle = rgba(r, gg, b, 0.55 - i * 0.06);
        g.lineWidth = Math.max(1.5, s * 0.014);
        g.arc(s / 2, s / 2, s * (0.07 + i * 0.065), 0, Math.PI * 2);
        g.stroke();
      }
      dot(0.5, 0.5, 0.04, 0.8);
      break;
    }
    case "spotlight": {
      const grad = g.createRadialGradient(s * 0.5, s * 0.16, 0, s * 0.5, s * 0.16, s * 0.55);
      grad.addColorStop(0, rgba(r, gg, b, 0.6));
      grad.addColorStop(1, rgba(r, gg, b, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
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
  spec("sticker-confetti", "Confetti", "fx", [], "confetti"),
  spec("sticker-starfield", "Starfield", "fx", [], "starfield"),
  spec("sticker-rainbow-rings", "Rainbow Rings", "fx", [], "rainbow-rings"),
  spec("sticker-dots-fade", "Dots Fade", "fx", [], "dots-fade"),
  spec("sticker-plus-field", "Plus Field", "fx", [], "plus-field"),
  spec("sticker-grain-fine", "Fine Grain", "fx", [], "grain-fine"),
  spec("sticker-leak", "Light Leak", "fx", [], "leak"),
  spec("sticker-prism", "Prism", "fx", [], "prism"),
  spec("sticker-checker-fade", "Checker Fade", "fx", [], "checker-fade"),
  spec("sticker-wave-band", "Wave Band", "fx", [], "wave-band"),
  spec("sticker-ring-burst", "Ring Burst", "fx", [], "ring-burst"),
  spec("sticker-spotlight", "Spotlight", "fx", [], "spotlight"),
  // Poster builders (24): callouts, rules, seals and ornaments for posters
  spec("sticker-burst-big", "Big Burst", "poster", [{ op: "burst", cx: 50, cy: 50, ro: 38, ri: 24, n: 16 }]),
  spec("sticker-seal-double", "Double Seal", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    { op: "ring", cx: 50, cy: 50, r: 22, w: 4 },
  ]),
  spec("sticker-ribbon-split", "Split Ribbon", "poster", [
    { op: "poly", pts: [[8, 36], [46, 36], [36, 50], [46, 64], [8, 64], [18, 50]] },
    { op: "poly", pts: [[92, 36], [54, 36], [64, 50], [54, 64], [92, 64], [82, 50]] },
  ]),
  spec("sticker-price-circle", "Price Circle", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 6 },
    { op: "burst", cx: 50, cy: 50, ro: 14, ri: 8, n: 8 },
  ]),
  spec("sticker-tag-wide", "Wide Tag", "poster", [
    { op: "poly", pts: [[12, 32], [68, 32], [88, 50], [68, 68], [12, 68]] },
    { op: "cut", cx: 22, cy: 50, r: 5 },
  ]),
  spec("sticker-rule-double", "Double Rule", "poster", [L(16, 42, 84, 42, 6), L(16, 58, 84, 58, 6)]),
  spec("sticker-rule-dotted", "Dotted Rule", "poster", [
    D(14, 50, 3.5), D(23, 50, 3.5), D(32, 50, 3.5), D(41, 50, 3.5), D(50, 50, 3.5),
    D(59, 50, 3.5), D(68, 50, 3.5), D(77, 50, 3.5), D(86, 50, 3.5),
  ]),
  spec("sticker-rule-zigzag", "Zigzag Rule", "poster", [
    L(14, 60, 30, 40, 6), L(30, 40, 46, 60, 6), L(46, 60, 62, 40, 6), L(62, 40, 78, 60, 6),
  ]),
  spec("sticker-arrow-divider", "Arrow Divider", "poster", [
    L(12, 50, 88, 50, 5),
    { op: "poly", pts: [[88, 50], [74, 42], [74, 58]] },
  ]),
  spec("sticker-corner-flourish", "Corner Flourish", "poster", [
    L(30, 48, 30, 30, 6), L(30, 30, 48, 30, 6), D(30, 56, 3.5),
    L(70, 48, 70, 30, 6), L(70, 30, 52, 30, 6), D(70, 56, 3.5),
    L(30, 52, 30, 70, 6), L(30, 70, 48, 70, 6), D(30, 44, 3.5),
    L(70, 52, 70, 70, 6), L(70, 70, 52, 70, 6), D(70, 44, 3.5),
  ]),
  spec("sticker-photo-corners", "Photo Corners", "poster", [
    { op: "poly", pts: [[16, 16], [34, 16], [16, 34]] },
    { op: "poly", pts: [[84, 16], [66, 16], [84, 34]] },
    { op: "poly", pts: [[16, 84], [34, 84], [16, 66]] },
    { op: "poly", pts: [[84, 84], [66, 84], [84, 66]] },
  ]),
  spec("sticker-shield-mini", "Mini Shield", "poster", [
    { op: "poly", pts: [[50, 26], [66, 32], [66, 50], [50, 72], [34, 50], [34, 32]] },
  ]),
  spec("sticker-check-seal", "Check Seal", "poster", [
    { op: "burst", cx: 50, cy: 50, ro: 30, ri: 22, n: 12 },
    L(40, 52, 47, 59, 6),
    L(47, 59, 61, 42, 6),
  ]),
  spec("sticker-cross-seal", "Cross Seal", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 6 },
    L(40, 40, 60, 60, 7),
    L(60, 40, 40, 60, 7),
  ]),
  spec("sticker-step-four", "Step Four", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    D(38, 38, 5.5), D(62, 38, 5.5), D(38, 62, 5.5), D(62, 62, 5.5),
  ]),
  spec("sticker-step-five", "Step Five", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    D(38, 38, 5.5), D(62, 38, 5.5), D(50, 50, 5.5), D(38, 62, 5.5), D(62, 62, 5.5),
  ]),
  spec("sticker-step-six", "Step Six", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    D(38, 34, 5), D(62, 34, 5), D(38, 50, 5), D(62, 50, 5), D(38, 66, 5), D(62, 66, 5),
  ]),
  spec("sticker-quote-big", "Big Quote", "poster", [
    L(52, 30, 34, 50, 8), L(34, 50, 52, 70, 8),
    L(74, 30, 56, 50, 8), L(56, 50, 74, 70, 8),
  ]),
  spec("sticker-frame-double", "Double Frame", "poster", [
    { op: "rect", x: 20, y: 20, w: 60, h: 60, fill: false, wgt: 6 },
    { op: "rect", x: 30, y: 30, w: 40, h: 40, fill: false, wgt: 4 },
  ]),
  spec("sticker-rosette", "Rosette", "poster", [
    { op: "burst", cx: 50, cy: 42, ro: 26, ri: 18, n: 10 },
    { op: "poly", pts: [[40, 62], [60, 62], [56, 84], [50, 76], [44, 84]] },
  ]),
  spec("sticker-divider-dots", "Dot Divider", "poster", [
    D(20, 50, 3.5), D(30, 50, 3.5), D(40, 50, 3.5), D(50, 50, 3.5), D(60, 50, 3.5), D(70, 50, 3.5), D(80, 50, 3.5),
  ]),
  spec("sticker-frame-rings", "Ring Frame", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 34, w: 5 },
    { op: "ring", cx: 50, cy: 50, r: 24, w: 4 },
  ]),
  spec("sticker-banner-tall", "Tall Banner", "poster", [
    { op: "poly", pts: [[34, 12], [66, 12], [66, 72], [50, 60], [34, 72]] },
  ]),
  spec("sticker-sparkle-ring", "Sparkle Ring", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 26, w: 5 },
    { op: "burst", cx: 50, cy: 14, ro: 8, ri: 3, n: 4 },
    { op: "burst", cx: 86, cy: 50, ro: 8, ri: 3, n: 4 },
    { op: "burst", cx: 50, cy: 86, ro: 8, ri: 3, n: 4 },
    { op: "burst", cx: 14, cy: 50, ro: 8, ri: 3, n: 4 },
  ]),
  // Social contact minis (12)
  spec("sticker-envelope", "Envelope", "social", [
    { op: "rect", x: 22, y: 34, w: 56, h: 32, rr: 4, fill: false, wgt: 7 },
    L(22, 34, 50, 56, 6),
    L(50, 56, 78, 34, 6),
  ]),
  spec("sticker-phone", "Phone", "social", [
    { op: "rect", x: 34, y: 20, w: 32, h: 60, rr: 8, fill: false, wgt: 7 },
    L(44, 28, 56, 28, 5),
    D(50, 70, 4),
  ]),
  spec("sticker-clock", "Clock", "social", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    L(50, 50, 50, 30, 6),
    L(50, 50, 64, 58, 6),
    D(50, 50, 4),
  ]),
  spec("sticker-globe", "Globe", "social", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 6 },
    L(50, 20, 50, 80, 5),
    L(20, 50, 80, 50, 5),
  ]),
  spec("sticker-camera", "Camera", "social", [
    { op: "rect", x: 22, y: 36, w: 56, h: 34, rr: 6, fill: false, wgt: 7 },
    { op: "poly", pts: [[36, 36], [36, 28], [48, 28], [48, 36]], fill: false, wgt: 6 },
    D(50, 53, 9),
  ]),
  spec("sticker-music", "Music Note", "social", [
    D(38, 68, 9),
    L(47, 68, 47, 26, 6),
    { op: "poly", pts: [[47, 26], [65, 34], [47, 44]] },
  ]),
  spec("sticker-hash", "Hash", "social", [
    L(40, 28, 36, 72, 6), L(60, 28, 56, 72, 6),
    L(28, 44, 72, 40, 6), L(28, 60, 72, 56, 6),
  ]),
  spec("sticker-share", "Share", "social", [
    D(30, 50, 8), D(70, 34, 8), D(70, 66, 8),
    L(30, 50, 70, 34, 6), L(30, 50, 70, 66, 6),
  ]),
  spec("sticker-chat-dots", "Chat Dots", "social", [
    { op: "rect", x: 24, y: 30, w: 52, h: 32, rr: 10, fill: false, wgt: 6 },
    D(40, 46, 4), D(52, 46, 4), D(64, 46, 4),
  ]),
  spec("sticker-play", "Play", "social", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 6 },
    { op: "poly", pts: [[44, 34], [44, 66], [68, 50]] },
  ]),
  spec("sticker-mic", "Mic", "social", [
    { op: "rect", x: 42, y: 20, w: 16, h: 30, rr: 8 },
    L(50, 50, 50, 72, 6),
    L(38, 72, 62, 72, 6),
  ]),
  spec("sticker-qr", "QR Frame", "social", [
    { op: "rect", x: 22, y: 22, w: 22, h: 22, fill: false, wgt: 6 },
    { op: "rect", x: 56, y: 22, w: 22, h: 22, fill: false, wgt: 6 },
    { op: "rect", x: 22, y: 56, w: 22, h: 22, fill: false, wgt: 6 },
    D(66, 66, 4), D(78, 56, 4), D(56, 78, 4),
  ]),
  // Marks wave 2: directions and punctuation (12)
  spec("sticker-arrow-up", "Arrow Up", "marks", [
    L(50, 76, 50, 28, 8),
    { op: "poly", pts: [[50, 28], [36, 46], [64, 46]] },
  ]),
  spec("sticker-arrow-down", "Arrow Down", "marks", [
    L(50, 24, 50, 72, 8),
    { op: "poly", pts: [[50, 72], [36, 54], [64, 54]] },
  ]),
  spec("sticker-arrow-left", "Arrow Left", "marks", [
    L(72, 50, 28, 50, 8),
    { op: "poly", pts: [[28, 50], [46, 36], [46, 64]] },
  ]),
  spec("sticker-double-arrow", "Double Arrow", "marks", [
    L(24, 38, 76, 38, 7),
    { op: "poly", pts: [[76, 38], [64, 29], [64, 47]] },
    L(76, 62, 24, 62, 7),
    { op: "poly", pts: [[24, 62], [36, 53], [36, 71]] },
  ]),
  spec("sticker-curved-arrow", "Curved Arrow", "marks", [
    { op: "poly", pts: [[24, 66], [30, 40], [52, 30], [72, 34]], fill: false, wgt: 8 },
    { op: "poly", pts: [[72, 34], [58, 32], [68, 46]] },
  ]),
  spec("sticker-shuffle", "Shuffle Mark", "marks", [
    { op: "poly", pts: [[24, 34], [56, 34], [76, 58]], fill: false, wgt: 7 },
    { op: "poly", pts: [[24, 66], [56, 66], [76, 42]], fill: false, wgt: 7 },
    D(80, 50, 4),
  ]),
  spec("sticker-asterisk", "Asterisk Mark", "marks", [
    L(50, 22, 50, 78, 8), L(26, 36, 74, 64, 8), L(74, 36, 26, 64, 8),
  ]),
  spec("sticker-at-sign", "At Sign", "marks", [
    { op: "ring", cx: 50, cy: 50, r: 26, w: 7 },
    D(50, 50, 8),
    L(68, 40, 68, 66, 6),
  ]),
  spec("sticker-percent", "Percent Mark", "marks", [
    D(34, 34, 10), D(66, 66, 10), L(72, 28, 28, 72, 8),
  ]),
  spec("sticker-exclaim", "Exclaim Mark", "marks", [
    L(50, 24, 50, 58, 9), D(50, 72, 7),
  ]),
  spec("sticker-question", "Question Mark", "marks", [
    { op: "poly", pts: [[38, 38], [50, 26], [64, 32], [62, 46], [50, 52]], fill: false, wgt: 9 },
    D(50, 70, 7),
  ]),
  spec("sticker-undo", "Undo Mark", "marks", [
    L(74, 38, 42, 38, 8), L(42, 38, 42, 64, 8),
    { op: "poly", pts: [[42, 64], [31, 53], [53, 53]] },
  ]),
  // Badges wave 2: currency seals and shields (12)
  spec("sticker-dollar-seal", "Dollar Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    L(50, 32, 50, 68, 6), L(40, 42, 60, 42, 5), L(40, 58, 60, 58, 5),
  ]),
  spec("sticker-euro-seal", "Euro Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    { op: "poly", pts: [[62, 36], [44, 36], [40, 50], [44, 64], [62, 64]], fill: false, wgt: 6 },
    L(38, 50, 56, 50, 5),
  ]),
  spec("sticker-info-seal", "Info Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    D(50, 32, 5), L(50, 44, 50, 66, 7),
  ]),
  spec("sticker-minus-seal", "Minus Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    L(36, 50, 64, 50, 7),
  ]),
  spec("sticker-x-seal", "X Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    L(41, 41, 59, 59, 7), L(59, 41, 41, 59, 7),
  ]),
  spec("sticker-help-seal", "Help Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    { op: "poly", pts: [[43, 44], [50, 37], [57, 40], [55, 47], [50, 49]], fill: false, wgt: 6 },
    D(50, 60, 4.5),
  ]),
  spec("sticker-ticket-trio", "Triple Ticket", "badges", [
    { op: "rect", x: 16, y: 38, w: 20, h: 24, rr: 3 },
    { op: "rect", x: 40, y: 38, w: 20, h: 24, rr: 3 },
    { op: "rect", x: 64, y: 38, w: 20, h: 24, rr: 3 },
  ]),
  spec("sticker-ticket-tall", "Tall Ticket", "badges", [
    { op: "rect", x: 34, y: 18, w: 32, h: 64 },
    { op: "cut", cx: 50, cy: 18, r: 6 },
    { op: "cut", cx: 50, cy: 82, r: 6 },
  ]),
  spec("sticker-ticket-slash", "Slash Ticket", "badges", [
    { op: "rect", x: 20, y: 34, w: 60, h: 32, rr: 4 },
    L(64, 28, 36, 72, 6),
  ]),
  spec("sticker-goal-seal", "Goal Seal", "badges", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 7 },
    { op: "ring", cx: 50, cy: 50, r: 18, w: 5 },
    D(50, 50, 5),
  ]),
  spec("sticker-shield-band", "Shield Band", "badges", [
    { op: "poly", pts: [[50, 18], [72, 28], [72, 50], [50, 80], [28, 50], [28, 28]] },
    L(34, 46, 66, 46, 6),
  ]),
  spec("sticker-shield-star", "Shield Star", "badges", [
    { op: "poly", pts: [[50, 18], [72, 28], [72, 50], [50, 80], [28, 50], [28, 28]] },
    { op: "burst", cx: 50, cy: 48, ro: 12, ri: 6, n: 5 },
  ]),
  // Frames wave 2: panels and columns (12)
  spec("sticker-group-frame", "Group Frame", "frames", [
    { op: "rect", x: 18, y: 30, w: 44, h: 40, fill: false, wgt: 6 },
    { op: "rect", x: 38, y: 24, w: 44, h: 40, fill: false, wgt: 6 },
  ]),
  spec("sticker-panel-frame", "Panel Frame", "frames", [
    { op: "rect", x: 20, y: 20, w: 60, h: 60, fill: false, wgt: 6 },
    L(20, 44, 80, 44, 4),
  ]),
  spec("sticker-gallery-frame", "Gallery Frame", "frames", [
    { op: "rect", x: 16, y: 28, w: 20, h: 44, fill: false, wgt: 5 },
    { op: "rect", x: 40, y: 28, w: 20, h: 44, fill: false, wgt: 5 },
    { op: "rect", x: 64, y: 28, w: 20, h: 44, fill: false, wgt: 5 },
  ]),
  spec("sticker-trio-columns", "Trio Columns", "frames", [
    { op: "rect", x: 22, y: 26, w: 14, h: 48 },
    { op: "rect", x: 43, y: 26, w: 14, h: 48 },
    { op: "rect", x: 64, y: 26, w: 14, h: 48 },
  ]),
  spec("sticker-quad-columns", "Quad Columns", "frames", [
    { op: "rect", x: 18, y: 30, w: 10, h: 40 },
    { op: "rect", x: 34, y: 30, w: 10, h: 40 },
    { op: "rect", x: 50, y: 30, w: 10, h: 40 },
    { op: "rect", x: 66, y: 30, w: 10, h: 40 },
  ]),
  spec("sticker-pip-frame", "Pip Frame", "frames", [
    { op: "rect", x: 16, y: 24, w: 68, h: 52, fill: false, wgt: 6 },
    { op: "rect", x: 58, y: 58, w: 20, h: 14 },
  ]),
  spec("sticker-trio-rows", "Trio Rows", "frames", [
    { op: "rect", x: 22, y: 26, w: 56, h: 10 },
    { op: "rect", x: 22, y: 45, w: 56, h: 10 },
    { op: "rect", x: 22, y: 64, w: 56, h: 10 },
  ]),
  spec("sticker-combine-frame", "Combine Frame", "frames", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 5 },
    { op: "rect", x: 20, y: 20, w: 60, h: 60, fill: false, wgt: 4 },
  ]),
  spec("sticker-split-frame", "Split Frame", "frames", [
    { op: "rect", x: 20, y: 20, w: 60, h: 60, fill: false, wgt: 6 },
    L(50, 20, 50, 80, 5),
  ]),
  spec("sticker-app-frame", "App Frame", "frames", [
    { op: "rect", x: 24, y: 20, w: 52, h: 60, rr: 8, fill: false, wgt: 6 },
    L(36, 32, 64, 32, 4),
    D(50, 68, 3.5),
  ]),
  spec("sticker-side-frame", "Side Frame", "frames", [
    { op: "rect", x: 20, y: 20, w: 60, h: 60, fill: false, wgt: 6 },
    { op: "rect", x: 20, y: 20, w: 16, h: 60 },
  ]),
  spec("sticker-bottom-frame", "Bottom Frame", "frames", [
    { op: "rect", x: 20, y: 20, w: 60, h: 60, fill: false, wgt: 6 },
    { op: "rect", x: 20, y: 58, w: 60, h: 22 },
  ]),
  // Labels wave 2: bookmarks and shop tags (12)
  spec("sticker-bookmark-plus", "Bookmark Plus", "labels", [
    { op: "poly", pts: [[36, 20], [64, 20], [64, 76], [50, 64], [36, 76]] },
    L(50, 38, 50, 54, 5), L(42, 46, 58, 46, 5),
  ]),
  spec("sticker-bookmark-check", "Bookmark Check", "labels", [
    { op: "poly", pts: [[36, 20], [64, 20], [64, 76], [50, 64], [36, 76]] },
    L(43, 48, 49, 54, 5), L(49, 54, 59, 40, 5),
  ]),
  spec("sticker-bookmark-wide", "Wide Bookmark", "labels", [
    { op: "poly", pts: [[26, 24], [74, 24], [74, 72], [50, 58], [26, 72]] },
    D(50, 44, 6),
  ]),
  spec("sticker-bookmark-mini", "Mini Bookmark", "labels", [
    { op: "poly", pts: [[40, 28], [60, 28], [60, 68], [50, 60], [40, 68]] },
  ]),
  spec("sticker-percent-square", "Percent Square", "labels", [
    { op: "rect", x: 26, y: 26, w: 48, h: 48, rr: 8, fill: false, wgt: 6 },
    D(42, 42, 6), D(58, 58, 6), L(62, 38, 38, 62, 6),
  ]),
  spec("sticker-percent-circle", "Percent Circle", "labels", [
    { op: "ring", cx: 50, cy: 50, r: 30, w: 6 },
    D(40, 40, 6), D(60, 60, 6), L(62, 38, 38, 62, 6),
  ]),
  spec("sticker-cash-label", "Cash Label", "labels", [
    { op: "rect", x: 18, y: 34, w: 64, h: 32, rr: 4 },
    D(50, 50, 9),
  ]),
  spec("sticker-receipt", "Receipt Slip", "labels", [
    { op: "poly", pts: [[32, 16], [68, 16], [68, 78], [60, 70], [52, 78], [44, 70], [36, 78], [32, 70]] },
    L(40, 30, 60, 30, 4), L(40, 40, 60, 40, 4),
  ]),
  spec("sticker-wallet", "Wallet Card", "labels", [
    { op: "rect", x: 20, y: 32, w: 60, h: 36, rr: 6 },
    { op: "rect", x: 52, y: 44, w: 22, h: 12, rr: 3 },
    D(62, 50, 3),
  ]),
  spec("sticker-shop-bag", "Shop Bag", "labels", [
    { op: "poly", pts: [[32, 36], [68, 36], [64, 78], [36, 78]] },
    { op: "ring", cx: 50, cy: 32, r: 10, w: 5 },
  ]),
  spec("sticker-cart", "Cart", "labels", [
    { op: "poly", pts: [[28, 40], [72, 40], [64, 72], [36, 72]] },
    L(28, 40, 22, 30, 5),
    D(42, 80, 5), D(60, 80, 5),
  ]),
  spec("sticker-storefront", "Storefront", "labels", [
    { op: "poly", pts: [[20, 40], [80, 40], [72, 28], [28, 28]] },
    { op: "rect", x: 24, y: 40, w: 52, h: 36 },
    L(50, 40, 50, 76, 5),
  ]),
  // Nature wave 2: critters and trail gear (16)
  spec("sticker-snail", "Snail", "nature", [
    { op: "ring", cx: 50, cy: 54, r: 20, w: 7 },
    { op: "ring", cx: 50, cy: 54, r: 10, w: 5 },
    { op: "poly", pts: [[66, 60], [84, 52], [84, 66]] },
    L(70, 44, 76, 34, 4),
  ]),
  spec("sticker-worm", "Worm Crawl", "nature", [
    { op: "poly", pts: [[22, 62], [38, 50], [54, 58], [70, 46], [84, 52]], fill: false, wgt: 9 },
    D(80, 44, 4),
  ]),
  spec("sticker-pack", "Trail Pack", "nature", [
    { op: "rect", x: 32, y: 34, w: 36, h: 44, rr: 10 },
    { op: "rect", x: 42, y: 24, w: 16, h: 12, rr: 4 },
    L(32, 50, 68, 50, 4),
  ]),
  spec("sticker-trail-map", "Trail Map", "nature", [
    { op: "rect", x: 24, y: 20, w: 52, h: 60, rr: 4, fill: false, wgt: 6 },
    { op: "poly", pts: [[30, 66], [44, 54], [40, 42], [56, 34], [62, 24]], fill: false, wgt: 5 },
    D(62, 24, 5), D(30, 66, 5),
  ]),
  spec("sticker-carrot", "Carrot", "nature", [
    { op: "poly", pts: [[50, 30], [62, 34], [54, 78], [46, 78], [38, 34]] },
    L(50, 30, 50, 18, 5), L(50, 30, 40, 22, 4), L(50, 30, 60, 22, 4),
  ]),
  spec("sticker-salad-bowl", "Salad Bowl", "nature", [
    { op: "poly", pts: [[26, 52], [74, 52], [66, 76], [34, 76]] },
    D(40, 42, 7), D(52, 38, 7), D(62, 44, 7),
  ]),
  spec("sticker-fish-side", "Fish Side", "nature", [
    { op: "poly", pts: [[18, 52], [52, 34], [52, 70]] },
    { op: "poly", pts: [[52, 52], [74, 38], [74, 66]] },
    D(30, 48, 3.5),
  ]),
  spec("sticker-mouse", "Mouse", "nature", [
    D(46, 56, 16), D(66, 40, 10),
    { op: "poly", pts: [[60, 32], [64, 22], [70, 32]] },
    L(62, 68, 84, 68, 4),
  ]),
  spec("sticker-city-rat", "City Rat", "nature", [
    { op: "poly", pts: [[24, 60], [56, 44], [56, 72]] },
    { op: "poly", pts: [[30, 44], [34, 32], [40, 44]] },
    L(56, 58, 84, 58, 4),
    D(34, 54, 3),
  ]),
  spec("sticker-cone-zone", "Cone Zone", "nature", [
    { op: "poly", pts: [[40, 34], [60, 34], [56, 72], [44, 72]] },
    { op: "rect", x: 36, y: 26, w: 28, h: 8 },
    L(44, 48, 56, 48, 4),
  ]),
  spec("sticker-dot-beetle", "Dot Beetle", "nature", [
    D(50, 52, 20),
    L(50, 32, 50, 72, 5),
    D(42, 46, 4), D(58, 46, 4), D(42, 60, 4), D(58, 60, 4),
    L(38, 30, 32, 22, 4), L(62, 30, 68, 22, 4),
  ]),
  spec("sticker-axe", "Trail Axe", "nature", [
    L(38, 78, 62, 30, 7),
    { op: "poly", pts: [[62, 30], [78, 26], [74, 44], [60, 44]] },
  ]),
  spec("sticker-anvil", "Anvil", "nature", [
    { op: "poly", pts: [[24, 36], [76, 36], [68, 48], [56, 48], [56, 68], [44, 68], [44, 48], [32, 48]] },
    { op: "rect", x: 36, y: 68, w: 28, h: 8 },
  ]),
  spec("sticker-shovel", "Dig Shovel", "nature", [
    L(58, 22, 42, 58, 7),
    { op: "poly", pts: [[42, 58], [30, 64], [38, 80], [50, 72]] },
  ]),
  spec("sticker-pickaxe", "Pick Axe", "nature", [
    L(50, 78, 50, 34, 7),
    { op: "poly", pts: [[50, 34], [24, 40], [24, 30], [50, 24]] },
    { op: "poly", pts: [[50, 34], [76, 40], [76, 30], [50, 24]] },
  ]),
  spec("sticker-tractor", "Field Tractor", "nature", [
    { op: "rect", x: 30, y: 48, w: 26, h: 20, rr: 3 },
    { op: "poly", pts: [[38, 48], [38, 32], [54, 32], [54, 48]] },
    L(62, 32, 62, 44, 4),
    D(34, 74, 9), D(62, 76, 6),
  ]),
  // Poster wave 2: steps, bells and stage (16)
  spec("sticker-step-one", "Step One", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    D(50, 50, 6),
  ]),
  spec("sticker-step-two", "Step Two", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    D(40, 50, 5.5), D(60, 50, 5.5),
  ]),
  spec("sticker-step-three", "Step Three", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    D(36, 50, 5), D(50, 50, 5), D(64, 50, 5),
  ]),
  spec("sticker-chime", "Chime Bell", "poster", [
    { op: "poly", pts: [[50, 26], [66, 58], [34, 58]] },
    D(50, 68, 6), D(50, 20, 4),
  ]),
  spec("sticker-ring-bell", "Ring Bell", "poster", [
    { op: "poly", pts: [[32, 58], [32, 48], [68, 48], [68, 58]] },
    L(50, 48, 50, 28, 6),
    D(50, 24, 5), D(50, 66, 5),
  ]),
  spec("sticker-send-note", "Send Note", "poster", [
    { op: "poly", pts: [[18, 54], [82, 38], [54, 50], [46, 68]] },
    L(54, 50, 82, 38, 4),
  ]),
  spec("sticker-air-signal", "Air Signal", "poster", [
    { op: "ring", cx: 50, cy: 56, r: 14, w: 5 },
    { op: "ring", cx: 50, cy: 56, r: 26, w: 4 },
    D(50, 56, 5),
  ]),
  spec("sticker-stage-mic", "Stage Mic", "poster", [
    D(50, 32, 13),
    L(50, 45, 50, 66, 7),
    { op: "poly", pts: [[50, 66], [38, 80], [62, 80]] },
  ]),
  spec("sticker-love-day", "Love Day", "poster", [
    D(38, 42, 13), D(62, 42, 13),
    { op: "poly", pts: [[25, 49], [75, 49], [50, 78]] },
    D(50, 28, 4),
  ]),
  spec("sticker-loud-day", "Loud Day", "poster", [
    { op: "poly", pts: [[30, 44], [30, 60], [58, 68], [58, 36]] },
    L(58, 36, 74, 30, 6),
    L(40, 60, 40, 74, 5),
  ]),
  spec("sticker-flag-day", "Flag Day", "poster", [
    L(34, 20, 34, 80, 6),
    { op: "poly", pts: [[34, 24], [66, 24], [60, 36], [66, 48], [34, 48]] },
  ]),
  spec("sticker-drum-kit", "Drum Kit", "poster", [
    { op: "poly", pts: [[30, 52], [70, 52], [64, 74], [36, 74]] },
    L(36, 44, 28, 30, 5), L(64, 44, 72, 30, 5),
    D(50, 44, 4),
  ]),
  spec("sticker-guitar-pick", "Guitar Pick", "poster", [
    { op: "poly", pts: [[50, 22], [72, 50], [50, 80], [28, 50]] },
    D(50, 52, 6),
  ]),
  spec("sticker-piano-keys", "Piano Keys", "poster", [
    { op: "rect", x: 20, y: 36, w: 60, h: 28 },
    L(32, 36, 32, 64, 4), L(44, 36, 44, 64, 4), L(56, 36, 56, 64, 4),
    { op: "rect", x: 34, y: 36, w: 8, h: 16 },
    { op: "rect", x: 50, y: 36, w: 8, h: 16 },
  ]),
  spec("sticker-vinyl", "Vinyl Record", "poster", [
    { op: "ring", cx: 50, cy: 50, r: 32, w: 6 },
    { op: "ring", cx: 50, cy: 50, r: 20, w: 4 },
    D(50, 50, 8),
    { op: "cut", cx: 50, cy: 50, r: 2.5 },
  ]),
  spec("sticker-song-note", "Song Note", "poster", [
    D(36, 66, 8), D(64, 66, 8),
    L(44, 66, 44, 28, 6), L(72, 66, 72, 28, 6),
    L(44, 28, 72, 36, 6),
  ]),
  // Social wave 2: calls, mail and presence (16)
  spec("sticker-bell-dot", "Bell Dot", "social", [
    { op: "poly", pts: [[50, 24], [64, 58], [36, 58]] },
    D(50, 68, 6), D(72, 30, 5),
  ]),
  spec("sticker-bell-echo", "Echo Bell", "social", [
    { op: "poly", pts: [[50, 24], [64, 58], [36, 58]] },
    D(50, 68, 6),
    L(26, 44, 20, 36, 5), L(74, 44, 80, 36, 5),
  ]),
  spec("sticker-call-in", "Incoming Call", "social", [
    { op: "poly", pts: [[30, 30], [40, 30], [44, 44], [56, 44], [60, 30], [70, 30], [66, 58], [58, 70], [42, 70], [34, 58]] },
    L(30, 22, 24, 16, 4), L(70, 22, 76, 16, 4),
  ]),
  spec("sticker-call-off", "Muted Call", "social", [
    { op: "poly", pts: [[30, 32], [40, 32], [44, 46], [56, 46], [60, 32], [70, 32], [66, 60], [58, 72], [42, 72], [34, 60]] },
    L(28, 28, 72, 72, 7),
  ]),
  spec("sticker-mail-check", "Mail Check", "social", [
    { op: "rect", x: 22, y: 34, w: 56, h: 32, rr: 4, fill: false, wgt: 6 },
    L(22, 34, 50, 56, 6),
    L(50, 56, 78, 34, 6),
    L(42, 52, 48, 58, 5), L(48, 58, 60, 42, 5),
  ]),
  spec("sticker-mailbox", "Mailbox", "social", [
    { op: "rect", x: 30, y: 44, w: 40, h: 28, rr: 4 },
    L(50, 44, 50, 30, 6),
    D(50, 26, 5),
    L(36, 72, 64, 72, 5),
  ]),
  spec("sticker-inbox-tray", "Inbox Tray", "social", [
    { op: "poly", pts: [[20, 40], [80, 40], [72, 72], [28, 72]] },
    { op: "rect", x: 38, y: 48, w: 24, h: 10 },
  ]),
  spec("sticker-archive-box", "Archive Box", "social", [
    { op: "rect", x: 24, y: 36, w: 52, h: 32, rr: 3 },
    { op: "rect", x: 24, y: 36, w: 52, h: 10 },
    L(50, 46, 50, 58, 4),
  ]),
  spec("sticker-cloud-up", "Cloud Upload", "social", [
    D(40, 54, 12), D(54, 48, 15), D(66, 56, 10),
    { op: "rect", x: 30, y: 54, w: 44, h: 12 },
    L(50, 60, 50, 36, 6),
    { op: "poly", pts: [[50, 36], [42, 46], [58, 46]] },
  ]),
  spec("sticker-user-search", "User Search", "social", [
    D(42, 38, 12),
    { op: "poly", pts: [[24, 72], [24, 62], [60, 62], [60, 72]] },
    { op: "ring", cx: 66, cy: 60, r: 12, w: 5 },
    L(74, 68, 82, 76, 5),
  ]),
  spec("sticker-link-chain", "Link Chain", "social", [
    { op: "ring", cx: 38, cy: 50, r: 13, w: 6 },
    { op: "ring", cx: 62, cy: 50, r: 13, w: 6 },
  ]),
  spec("sticker-signal-full", "Full Signal", "social", [
    { op: "rect", x: 28, y: 58, w: 8, h: 14 },
    { op: "rect", x: 40, y: 50, w: 8, h: 22 },
    { op: "rect", x: 52, y: 42, w: 8, h: 30 },
    { op: "rect", x: 64, y: 34, w: 8, h: 38 },
  ]),
  spec("sticker-battery-full", "Full Battery", "social", [
    { op: "rect", x: 24, y: 38, w: 48, h: 24, rr: 4, fill: false, wgt: 6 },
    { op: "rect", x: 28, y: 42, w: 36, h: 16 },
    { op: "rect", x: 74, y: 44, w: 6, h: 12 },
  ]),
  spec("sticker-video-cam", "Video Cam", "social", [
    { op: "rect", x: 22, y: 38, w: 40, h: 26, rr: 5 },
    { op: "poly", pts: [[62, 46], [80, 38], [80, 70], [62, 62]] },
    D(32, 51, 4),
  ]),
  spec("sticker-voicemail", "Voicemail", "social", [
    { op: "rect", x: 22, y: 38, w: 56, h: 28, rr: 6, fill: false, wgt: 6 },
    D(38, 52, 6), D(62, 52, 6),
    L(44, 52, 56, 52, 5),
  ]),
  spec("sticker-cctv", "Watch Cam", "social", [
    { op: "rect", x: 42, y: 20, w: 16, h: 6 },
    L(50, 36, 50, 24, 5),
    { op: "poly", pts: [[30, 36], [70, 36], [64, 54], [36, 54]] },
    D(50, 62, 7),
  ]),
];
