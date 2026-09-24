export function clampZoom(z: number) {
  return Math.min(3200, Math.max(10, Math.round(z)));
}

// Hitung ukuran canvas tampil agar fit ke viewport dengan padding.
export function fitZoom(docW: number, docH: number, viewW: number, viewH: number) {
  if (docW <= 0 || docH <= 0 || viewW <= 0 || viewH <= 0) return 100;
  const zx = (viewW / docW) * 100;
  const zy = (viewH / docH) * 100;
  return Math.floor(Math.min(zx, zy, 100));
}

export function canvasToScreen(
  cx: number,
  cy: number,
  zoom: number,
  panX: number,
  panY: number,
  originX: number,
  originY: number
) {
  const s = zoom / 100;
  return { x: originX + panX + cx * s, y: originY + panY + cy * s };
}
