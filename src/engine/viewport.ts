// Viewport math for the Navigator minimap (Photoshop Navigator / Figma minimap).
// Pure functions so the pan/zoom mapping is unit-testable. All coordinates in
// document pixels unless noted. Mirrors CanvasArea.toDocCoords convention:
//   screenX = docX * s + ox,  ox = (wrapW - docW * s) / 2 + panX

export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function viewportRect(
  wrapW: number,
  wrapH: number,
  docW: number,
  docH: number,
  zoom: number,
  panX: number,
  panY: number,
): ViewRect {
  const s = Math.max(0.01, zoom / 100);
  const dw = docW * s;
  const dh = docH * s;
  const ox = (wrapW - dw) / 2 + panX;
  const oy = (wrapH - dh) / 2 + panY;
  const x0 = Math.max(0, Math.min(docW, -ox / s));
  const x1 = Math.max(0, Math.min(docW, (wrapW - ox) / s));
  const y0 = Math.max(0, Math.min(docH, -oy / s));
  const y1 = Math.max(0, Math.min(docH, (wrapH - oy) / s));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// Pan offsets that center document point (dx, dy) in a wrap of wrapW x wrapH.
export function panForCenter(
  wrapW: number,
  wrapH: number,
  docW: number,
  docH: number,
  zoom: number,
  dx: number,
  dy: number,
): { panX: number; panY: number } {
  const s = Math.max(0.01, zoom / 100);
  const dw = docW * s;
  const dh = docH * s;
  return {
    panX: wrapW / 2 - dx * s - (wrapW - dw) / 2,
    panY: wrapH / 2 - dy * s - (wrapH - dh) / 2,
  };
}

// Fit a docW x docH document into maxW x maxH keeping aspect. Returns thumb size.
export function fitThumb(docW: number, docH: number, maxW: number, maxH: number): { w: number; h: number } {
  const k = Math.min(maxW / Math.max(1, docW), maxH / Math.max(1, docH));
  return { w: Math.max(8, Math.round(docW * k)), h: Math.max(8, Math.round(docH * k)) };
}
