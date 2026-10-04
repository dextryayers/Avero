// Render budget math (plan6 Phase 8): pure helpers behind the lightweight story.
// Pixel math assumes 4 bytes per pixel (RGBA8). No DOM access, no GPU access,
// fully unit tested. Budgets keep 4K documents smooth on eco devices and let
// strong devices unlock larger tiles.

export const BYTES_PER_PIXEL = 4;
export const BYTES_PER_MB = 1024 * 1024;
/** Area above which tiled processing replaces full frame processing. */
export const TILE_AREA_THRESHOLD = 2048 * 2048;

/** Pixels inside one square tile. */
export function tilePixels(tile: number): number {
  const t = Math.max(1, Math.floor(tile));
  return t * t;
}

/** RAM in MB for one RGBA8 tile. tile 512 costs exactly 1 MB. */
export function tileRamMB(tile: number): number {
  return (tilePixels(tile) * BYTES_PER_PIXEL) / BYTES_PER_MB;
}

/** RAM in MB for a full RGBA8 document frame. */
export function estimateDocMB(width: number, height: number): number {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  return (w * h * BYTES_PER_PIXEL) / BYTES_PER_MB;
}

/** True when the frame is large enough to require tiled processing. */
export function shouldTile(width: number, height: number, threshold: number = TILE_AREA_THRESHOLD): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  return width * height > threshold;
}

/** Grid of tiles covering a W by H frame with a square tile size. */
export function tileGrid(width: number, height: number, tile: number): { cols: number; rows: number; count: number } {
  const t = Math.max(1, Math.floor(tile));
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const cols = Math.ceil(w / t);
  const rows = Math.ceil(h / t);
  return { cols, rows, count: cols * rows };
}

/** Clamp device pixel ratio into (0, cap]. Non finite input falls back to 1. */
export function clampDpr(dpr: number, cap: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  if (!Number.isFinite(cap) || cap <= 0) return 1;
  return Math.min(dpr, cap);
}

/**
 * Tile size policy shared by backends: huge textures stream in 1024px tiles,
 * mid range uses 512px, small or unknown hardware stays at 256px.
 * Backends may pin a size for their own fast path; this is the guide value.
 */
export function pickTileSize(maxTexture: number): 256 | 512 | 1024 {
  if (!Number.isFinite(maxTexture) || maxTexture <= 0) return 256;
  if (maxTexture >= 8192) return 1024;
  if (maxTexture >= 2048) return 512;
  return 256;
}
