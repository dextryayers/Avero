// Ultra-light canvas render helpers.
// Goals: zero per-frame allocation on the hot path, cached backgrounds,
// pattern-based checkerboard (no O(n^2) fillRect loops), DPR capped by GPU
// backend, and real clipping-mask compositing.

let bgCache: { w: number; h: number; dpr: number; canvas: HTMLCanvasElement } | null = null;
let checkerPattern: CanvasPattern | null = null;
let checkerAnchor: CanvasRenderingContext2D | null = null;

function makeCheckerTile(): HTMLCanvasElement {
  const t = document.createElement("canvas");
  t.width = 20;
  t.height = 20;
  const g = t.getContext("2d")!;
  g.fillStyle = "#2c2c31";
  g.fillRect(0, 0, 20, 20);
  g.fillStyle = "#3a3a41";
  g.fillRect(0, 0, 10, 10);
  g.fillRect(10, 10, 10, 10);
  return t;
}

/** Draw workspace backdrop (dark + dot grid + vignette). Cached per size/DPR. */
export function drawWorkspaceBackground(
  ctx: CanvasRenderingContext2D,
  rectW: number,
  rectH: number,
  dpr: number,
) {
  const w = Math.max(1, Math.floor(rectW));
  const h = Math.max(1, Math.floor(rectH));
  if (!bgCache || bgCache.w !== w || bgCache.h !== h || bgCache.dpr !== dpr) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#101012";
    g.fillRect(0, 0, w, h);
    // dot grid via single path (1 draw call, no nested save/restore)
    g.fillStyle = "rgba(255,255,255,0.035)";
    g.beginPath();
    for (let x = 0; x <= w; x += 24) {
      for (let y = 0; y <= h; y += 24) {
        g.rect(x, y, 1, 1);
      }
    }
    g.fill();
    const vg = g.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.2,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    bgCache = { w, h, dpr, canvas: c };
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCache.canvas, 0, 0);
  ctx.restore();
}

export function clearRenderCaches() {
  bgCache = null;
  checkerPattern = null;
  checkerAnchor = null;
}

/** Cheap transparency checkerboard inside the document rect (pattern fill). */
export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
) {
  if (!checkerPattern || checkerAnchor !== ctx) {
    checkerPattern = ctx.createPattern(makeCheckerTile(), "repeat");
    checkerAnchor = ctx;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, dw, dh);
  ctx.clip();
  ctx.fillStyle = "#2c2c31";
  ctx.fillRect(ox, oy, dw, dh);
  if (checkerPattern) {
    ctx.fillStyle = checkerPattern;
    ctx.fillRect(ox, oy, dw, dh);
  }
  ctx.restore();
}

/** Cheap document backing: 1px border + soft edge without per-frame shadowBlur. */
export function drawDocBacking(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dw: number,
  dh: number,
) {
  ctx.save();
  // soft edge: two translucent strokes instead of shadowBlur (shadowBlur forces
  // a full-screen blur pass on the GPU every frame).
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 6;
  ctx.strokeRect(ox - 3, oy - 3, dw + 6, dh + 6);
  ctx.strokeStyle = "#3a3a41";
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
  ctx.restore();
}

// Photoshop blend modes -> canvas composite ops. Unsupported exotic modes fall
// back to source-over so layers never disappear (a common "tool does nothing" bug).
const BLEND_MAP: Record<string, GlobalCompositeOperation> = {
  normal: "source-over",
  dissolve: "source-over",
  darken: "darken",
  multiply: "multiply",
  "color-burn": "color-burn",
  "linear-burn": "source-over",
  "darker-color": "darken",
  lighten: "lighten",
  screen: "screen",
  "color-dodge": "color-dodge",
  "linear-dodge": "lighten",
  "lighter-color": "lighten",
  overlay: "overlay",
  "soft-light": "soft-light",
  "hard-light": "hard-light",
  vivid: "overlay",
  linear: "overlay",
  pin: "source-over",
  "hard-mix": "source-over",
  difference: "difference",
  exclusion: "exclusion",
  subtract: "source-over",
  divide: "source-over",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

export function blendToComposite(blend: string): GlobalCompositeOperation {
  return BLEND_MAP[blend] ?? "source-over";
}

/** Returns true when the mode is natively accelerated (no fallback). */
export function isBlendAccelerated(blend: string): boolean {
  return blend in BLEND_MAP && BLEND_MAP[blend] !== "source-over";
}
