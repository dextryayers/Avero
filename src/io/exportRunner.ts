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
// Asks for the destination first so no heavy encode is wasted on cancel.
// Canvas-native formats encode in the browser; the rest travel as PNG bytes
// through the Rust encoders and land as real files in their own container.
export async function runImageExport(opts: ImageExportOpts): Promise<string | null> {
  const fmt = opts.format.toLowerCase();
  const cleanName = opts.fileName.trim() || "Untitled";

  if (fmt === "avx") {
    const p = await saveAvxProject(true, opts.onStage);
    if (p) {
      await showMessage(`Saved: ${p}`);
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
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
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
