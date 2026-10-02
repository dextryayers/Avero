import type { LayerEffects } from "../stores/useEditorStore";

// Layer FX render engine: drop shadow, outer glow, inner glow and outline
// stroke, composited per layer in the CanvasArea render loop. Direct effects
// (shadow, glow) ride the canvas shadow pipeline for free; temp effects
// (stroke, inner glow) pre-compose into a pooled scratch canvas so the main
// loop stays allocation-free.

const pool: HTMLCanvasElement[] = [];

function acquire(w: number, h: number): HTMLCanvasElement {
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    if (c.width === w && c.height === h) {
      pool.splice(i, 1);
      const g = c.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.filter = "none";
      g.shadowColor = "transparent";
      g.shadowBlur = 0;
      g.shadowOffsetX = 0;
      g.shadowOffsetY = 0;
      g.clearRect(0, 0, w, h);
      return c;
    }
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function releaseFxCanvas(c: HTMLCanvasElement): void {
  if (pool.length < 6) pool.push(c);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** True when drop shadow and/or outer glow are on (direct shadow pipeline). */
export function hasDirectFx(fx: LayerEffects | undefined): boolean {
  if (!fx) return false;
  return !!fx.dropShadow?.enabled || !!fx.outerGlow?.enabled;
}

/** True when stroke and/or inner glow are on (needs a pre-composed temp). */
export function hasTempFx(fx: LayerEffects | undefined): boolean {
  if (!fx) return false;
  return !!fx.stroke?.enabled || !!fx.innerGlow?.enabled;
}

function withAlpha(hex: string, opacityPct: number): string {
  const a = clamp01(opacityPct / 100);
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/**
 * Configure the canvas shadow pipeline for drop shadow / outer glow.
 * Drop shadow wins when both are on (a single shadow slot exists).
 * Call inside save()/restore() — restore clears the shadow state.
 */
export function applyShadowFx(ctx: CanvasRenderingContext2D, fx: LayerEffects | undefined): void {
  const ds = fx?.dropShadow;
  const og = fx?.outerGlow;
  if (ds?.enabled) {
    ctx.shadowColor = withAlpha(ds.color, ds.opacity);
    ctx.shadowBlur = Math.max(0, Math.min(120, ds.blur));
    ctx.shadowOffsetX = Math.max(-200, Math.min(200, ds.dx));
    ctx.shadowOffsetY = Math.max(-200, Math.min(200, ds.dy));
  } else if (og?.enabled) {
    ctx.shadowColor = withAlpha(og.color, og.opacity);
    ctx.shadowBlur = Math.max(0, Math.min(120, og.blur));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

/** Solid silhouette of src in a flat color (for strokes and glow shapes). */
function silhouette(w: number, h: number, src: HTMLCanvasElement, color: string, opacityPct: number): HTMLCanvasElement {
  const c = acquire(w, h);
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.globalAlpha = clamp01(opacityPct / 100);
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  return c;
}

const RING: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Pre-compose stroke halo + inner glow around src into a pooled canvas.
 * Caller must releaseFxCanvas() the result when done.
 */
export function buildFxCanvas(
  src: HTMLCanvasElement,
  fx: LayerEffects,
  w: number,
  h: number,
): HTMLCanvasElement | null {
  const st = fx.stroke;
  const ig = fx.innerGlow;
  if ((!st?.enabled && !ig?.enabled) || w < 1 || h < 1) return null;
  const out = acquire(w, h);
  const g = out.getContext("2d")!;
  // 1. Stroke halo behind everything: 8-way silhouette stamp.
  if (st?.enabled && st.width > 0) {
    const sil = silhouette(w, h, src, st.color, st.opacity);
    const r = Math.max(1, Math.min(64, Math.round(st.width)));
    for (const [dx, dy] of RING) g.drawImage(sil, dx * r, dy * r);
    releaseFxCanvas(sil);
  }
  // 2. The layer itself.
  g.drawImage(src, 0, 0);
  // 3. Inner glow: blurred silhouette clipped inside the artwork.
  // The blur is applied at draw time (filter + source-atop), so no canvas
  // ever draws onto itself. save/restore resets filter and composite mode.
  if (ig?.enabled) {
    const glow = silhouette(w, h, src, ig.color, ig.opacity);
    g.save();
    try {
      g.filter = `blur(${Math.max(0, Math.min(60, ig.blur))}px)`;
    } catch {
      /* filter unsupported — unblurred glow still reads fine */
    }
    g.globalCompositeOperation = "source-atop";
    g.drawImage(glow, 0, 0);
    g.restore();
    releaseFxCanvas(glow);
  }
  return out;
}
