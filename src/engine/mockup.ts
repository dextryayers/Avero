// Fase 5.5: Mockup warp perspektif.
// Hitung homografi dari rect sumber ke quad tujuan, terapkan via sampling invers.

export interface Quad {
  x0: number; y0: number;
  x1: number; y1: number;
  x2: number; y2: number;
  x3: number; y3: number;
}

function homography(srcW: number, srcH: number, q: Quad): number[] {
  // Selesaikan H 3x3 dengan DLT 4 titik (sumber rect -> quad).
  const src = [
    [0, 0], [srcW, 0], [srcW, srcH], [0, srcH],
  ];
  const dst = [
    [q.x0, q.y0], [q.x1, q.y1], [q.x2, q.y2], [q.x3, q.y3],
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solve8(A, b);
}

function solve8(A: number[][], b: number[]): number[] {
  // Eliminasi Gauss 8x8
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const h = M.map((row, i) => row[n] / (M[i][i] || 1e-9));
  return [...h, 1];
}

export function warpToQuad(src: HTMLCanvasElement, dstW: number, dstH: number, q: Quad): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(dstW));
  out.height = Math.max(1, Math.round(dstH));
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const simg = sctx.getImageData(0, 0, src.width, src.height);
  const octx = out.getContext("2d")!;
  const oid = octx.createImageData(out.width, out.height);
  const H = homography(src.width, src.height, q);
  // invers H untuk sampling
  const [a, b, c, d, e, f, g, h] = H;
  const det = a * (e * 1 - f * h) - b * (d * 1 - f * g) + c * (d * h - e * g);
  const inv = [
    (e - f * h) / det, (c * h - b) / det, (b * f - c * e) / det,
    (f * g - d) / det, (a - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  const sd = simg.data;
  const od = oid.data;
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const w = inv[6] * x + inv[7] * y + inv[8];
      const sx = (inv[0] * x + inv[1] * y + inv[2]) / w;
      const sy = (inv[3] * x + inv[4] * y + inv[5]) / w;
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      const o = (y * out.width + x) * 4;
      if (ix < 0 || iy < 0 || ix >= src.width || iy >= src.height) {
        od[o + 3] = 0;
        continue;
      }
      const si = (iy * src.width + ix) * 4;
      od[o] = sd[si];
      od[o + 1] = sd[si + 1];
      od[o + 2] = sd[si + 2];
      od[o + 3] = sd[si + 3];
    }
  }
  octx.putImageData(oid, 0, 0);
  return out;
}

// Deteksi quad otomatis sederhana: area kontras terbesar di tengah.
export function autoQuad(w: number, h: number): Quad {
  return {
    x0: w * 0.24, y0: h * 0.3,
    x1: w * 0.76, y1: h * 0.24,
    x2: w * 0.8, y2: h * 0.78,
    x3: w * 0.2, y3: h * 0.72,
  };
}
