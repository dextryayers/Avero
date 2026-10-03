// Shared export format catalog for the dedicated Export page.
// Canvas-native formats encode in the browser (fast, no IPC bloat).
// Rust formats travel as PNG bytes through cmd_export_pixels and come back
// as real files in their own container (proven by convert_bytes tests).

export type ExportFormatGroup = "Universal" | "Pro & Print" | "Vector" | "Project";

export interface ExportFormatMeta {
  id: string;
  label: string;
  desc: string;
  group: ExportFormatGroup;
  alpha: boolean;
  quality: boolean;
  rust: boolean;
}

export const EXPORT_FORMATS: ExportFormatMeta[] = [
  { id: "png", label: "PNG", desc: "Lossless, transparent", group: "Universal", alpha: true, quality: false, rust: false },
  { id: "jpg", label: "JPG", desc: "Small photo, no alpha", group: "Universal", alpha: false, quality: true, rust: false },
  { id: "jpeg", label: "JPEG", desc: "Same as JPG", group: "Universal", alpha: false, quality: true, rust: false },
  { id: "webp", label: "WEBP", desc: "Modern, small", group: "Universal", alpha: true, quality: true, rust: false },
  { id: "bmp", label: "BMP", desc: "Uncompressed bitmap", group: "Universal", alpha: false, quality: false, rust: true },
  { id: "tiff", label: "TIFF", desc: "Print and archive", group: "Universal", alpha: true, quality: false, rust: true },
  { id: "gif", label: "GIF", desc: "Static, 256 colors", group: "Universal", alpha: true, quality: false, rust: true },
  { id: "tga", label: "TGA", desc: "Game and video frames", group: "Pro & Print", alpha: true, quality: false, rust: true },
  { id: "qoi", label: "QOI", desc: "Fast lossless", group: "Pro & Print", alpha: true, quality: false, rust: true },
  { id: "pnm", label: "PNM", desc: "Netpbm portable", group: "Pro & Print", alpha: false, quality: false, rust: true },
  { id: "hdr", label: "HDR", desc: "Radiance map", group: "Pro & Print", alpha: false, quality: false, rust: true },
  { id: "exr", label: "EXR", desc: "VFX float frames", group: "Pro & Print", alpha: true, quality: false, rust: true },
  { id: "ff", label: "FF", desc: "Farbfeld lossless", group: "Pro & Print", alpha: true, quality: false, rust: true },
  { id: "ico", label: "ICO", desc: "Icon, auto 256px", group: "Pro & Print", alpha: true, quality: false, rust: true },
  { id: "svg", label: "SVG", desc: "Vector wrapper", group: "Vector", alpha: true, quality: false, rust: false },
  { id: "avx", label: "AVX", desc: "Full project, layers kept", group: "Project", alpha: true, quality: false, rust: false },
];

export function formatMeta(id: string): ExportFormatMeta {
  return EXPORT_FORMATS.find((f) => f.id === id) ?? EXPORT_FORMATS[0];
}

/** Opaque outputs that need alpha flattened (mirrors Rust needs_flatten). */
export function needsMatteFor(id: string): boolean {
  return id === "jpg" || id === "jpeg" || id === "bmp";
}

/** Formats with a meaningful quality slider. */
export function usesQualityFor(id: string): boolean {
  return id === "jpg" || id === "jpeg" || id === "webp";
}

/** Rough output size for the UI estimate. Never used for decisions. */
export function estimateBytes(id: string, w: number, h: number, quality: number): number {
  const px = Math.max(1, w) * Math.max(1, h);
  switch (id) {
    case "png":
      return px * 1.1;
    case "bmp":
      return px * 3 + 54;
    case "svg":
      return px * 1.4;
    case "tiff":
      return px * 2.2;
    case "tga":
    case "ff":
      return px * 4;
    case "qoi":
      return px * 2;
    case "pnm":
      return px * 3 + 64;
    case "hdr":
    case "exr":
      return px * 4 + 1024;
    case "gif":
      return px * 0.5;
    case "ico":
      return 256 * 256 * 4;
    case "avx":
      return px * 1.1;
    default:
      return px * 0.28 * (quality / 90);
  }
}

export function formatBytes(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
