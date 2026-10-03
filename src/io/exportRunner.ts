import { save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { exportImageSmart, saveAvxProject, writeTextFile, type ExportFormat } from "./projectIo";
import { exportPixels, isTauri } from "./nativeEngine";
import { showError, showMessage } from "../ui/notify";
import { needsMatteFor } from "./exportFormats";

export interface ImageExportOpts {
  format: string;
  quality: number;
  scale: number;
  matte: "none" | "white" | "black";
  fileName: string;
  onStage?: (msg: string) => void;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

// Single export flow used by the dedicated Export page.
// UX contract (user request): picking a format + pressing Export ALWAYS opens
// the native file manager (save dialog) so the user chooses exactly where the
// file lands. No silent writes, no wasted encode on cancel — destination first,
// heavy render second. After success the file is revealed in the file manager.
export async function runImageExport(opts: ImageExportOpts): Promise<string | null> {
  const fmt = opts.format.toLowerCase();
  const rawName = opts.fileName.trim() || "Untitled";
  // Sanitize like Word: strip characters the OS forbids in file names.
  const cleanName = rawName.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 80) || "Untitled";

  if (fmt === "avx") {
    // .avx always opens the file manager (Save As) defaulting to Name.avx.
    // Filter label is exactly "Avero Project Design" so the dialog shows the
    // real product type; the saved file renders with the authentic Avero icon
    // in Explorer via the registered ProgID.
    const p = await saveAvxProject(true, opts.onStage);
    if (p) {
      await showMessage(`Saved Avero Project Design: ${p}`);
      // Hand the file to the user in their file manager.
      try {
        await revealItemInDir(p);
      } catch {
        /* reveal is a bonus; the save is the deliverable */
      }
    }
    return p;
  }

  const effMatte = needsMatteFor(fmt) && opts.matte === "none" ? "white" : opts.matte;
  const ext = fmt === "jpeg" ? "jpeg" : fmt;
  const fileName = `${cleanName}.${ext}`;

  if (!isTauri()) {
    if (fmt !== "png" && fmt !== "jpg" && fmt !== "jpeg" && fmt !== "webp" && fmt !== "svg") {
      await showMessage("This format requires the desktop app. PNG is used instead in the web preview.");
      const png = await exportImageSmart(
        { format: "png", quality: opts.quality, scale: opts.scale, matte: effMatte, fileName: cleanName } as { format: ExportFormat; quality: number; scale: number; matte: "none" | "white" | "black"; fileName: string },
        opts.onStage,
      );
      triggerDownload(png.dataUrl, `${cleanName}.png`);
      return `${cleanName}.png`;
    }
    const smart = await exportImageSmart(
      { format: fmt as ExportFormat, quality: opts.quality, scale: opts.scale, matte: effMatte, fileName: cleanName },
      opts.onStage,
    );
    triggerDownload(smart.dataUrl, fileName);
    return fileName;
  }

  const path = await save({
    defaultPath: fileName,
    title: `Export .${ext.toUpperCase()} — choose where to save`,
    filters: [{ name: `${ext.toUpperCase()} Image (*.${ext})`, extensions: [ext] }],
  });
  if (!path) return null;

  try {
    opts.onStage?.("Rendering canvas");
    if (fmt === "svg") {
      const smart = await exportImageSmart(
        { format: "svg" as ExportFormat, quality: opts.quality, scale: opts.scale, matte: effMatte, fileName: cleanName },
        opts.onStage,
      );
      const text = new TextDecoder().decode(dataUrlToBytes(smart.dataUrl));
      await writeTextFile(path, text);
      await showMessage(`Exported ${cleanName}.svg → ${path}`);
      try {
        await revealItemInDir(path);
      } catch {
        /* reveal is a bonus */
      }
      return path;
    }
    if (fmt === "png" || fmt === "jpg" || fmt === "jpeg" || fmt === "webp") {
      const { rustSaveDataUrl } = await import("./tauriIo");
      const smart = await exportImageSmart(
        { format: fmt as ExportFormat, quality: opts.quality, scale: opts.scale, matte: effMatte, fileName: cleanName },
        opts.onStage,
      );
      opts.onStage?.("Writing file");
      await rustSaveDataUrl(smart.dataUrl, path);
      await showMessage(`Exported ${cleanName}.${ext} → ${path}`);
      try {
        await revealItemInDir(path);
      } catch {
        /* reveal is a bonus */
      }
      return path;
    }
    // Rust encoder formats: lossless PNG bytes in, real container out.
    const png = await exportImageSmart(
      { format: "png", quality: 100, scale: opts.scale, matte: effMatte, fileName: cleanName },
      opts.onStage,
    );
    opts.onStage?.(`Encoding ${ext.toUpperCase()} in the native engine`);
    const matteRgb: [number, number, number] =
      effMatte === "black" ? [0, 0, 0] : [255, 255, 255];
    const report = await exportPixels(dataUrlToBytes(png.dataUrl), fmt, Math.max(1, Math.min(100, Math.round(opts.quality))), matteRgb, path);
    opts.onStage?.("Writing file");
    void report;
    await showMessage(`Exported ${cleanName}.${ext} → ${path}`);
    try {
      await revealItemInDir(path);
    } catch {
      /* reveal is a bonus */
    }
    return path;
  } catch (e) {
    await showError(`Export failed: ${String(e)}`);
    return null;
  }
}
