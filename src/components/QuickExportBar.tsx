import { useState } from "react";
import { Save, Download, ChevronDown, FileImage, FileBox, Layers } from "lucide-react";
import { saveAvxProject, openAvxProject, exportDataUrl, type ExportFormat } from "../io/projectIo";
import { useEditorStore } from "../stores/useEditorStore";
import { showError } from "../ui/notify";
import clsx from "clsx";

const IMG_FORMATS: { id: ExportFormat; label: string; ext: string }[] = [
  { id: "png", label: "PNG", ext: "png" },
  { id: "jpg", label: "JPG", ext: "jpg" },
  { id: "webp", label: "WEBP", ext: "webp" },
  { id: "bmp", label: "BMP", ext: "bmp" },
  { id: "tiff", label: "TIFF", ext: "tiff" },
  { id: "svg", label: "SVG", ext: "svg" },
];

export default function QuickExportBar({ onOpenExport }: { onOpenExport: () => void }) {
  const [fmt, setFmt] = useState<ExportFormat>("png");
  const [busy, setBusy] = useState(false);
  const doc = useEditorStore((s) => s.doc);

  async function quickSaveAvx(as: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await saveAvxProject(as);
    } catch (e) {
      await showError(`Failed to save .avx: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function quickExport(f: ExportFormat) {
    if (busy) return;
    setBusy(true);
    try {
      const { dataUrl, ext } = exportDataUrl({ format: f, quality: 92, scale: 100, matte: f === "jpg" ? "white" : "none", fileName: doc.name });
      // trigger download via canvas or tauri
      if ("__TAURI__" in window) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { rustSaveDataUrl } = await import("../io/tauriIo");
        const { writeTextFile } = await import("../io/projectIo");
        const path = await save({ defaultPath: `${doc.name.replace(/\.[^.]+$/, "")}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
        if (!path) return;
        if (f === "svg") {
          const b64 = dataUrl.split(",")[1] ?? "";
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const text = new TextDecoder().decode(bytes);
          await writeTextFile(path, text);
        } else {
          await rustSaveDataUrl(dataUrl, path);
        }
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${doc.name.replace(/\.[^.]+$/, "")}.${ext}`;
        a.click();
      }
    } catch (e) {
      await showError(`Export failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-l border-[#2c2c31] px-2 py-1">
      <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#6e6e78] md:flex">
        <Layers size={11} /> Export
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => quickSaveAvx(false)}
          disabled={busy}
          className="flex h-7 items-center gap-1.5 rounded-md bg-[#2f7cf6] px-2.5 text-[11px] font-semibold text-white hover:bg-[#3b8bff] disabled:opacity-40"
          title="Save full .avx project (Ctrl+S)"
        >
          <Save size={12} /> .avx {doc.dirty ? "*" : ""}
        </button>
        <div className="relative group">
          <button className="grid h-7 w-7 place-items-center rounded-md border border-[#2c2c31] bg-[#232327] text-[#a7a7b0] hover:text-white">
            <ChevronDown size={12} />
          </button>
          <div className="absolute left-0 top-full z-20 mt-1 hidden w-40 overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-1 group-hover:block">
            <button onClick={() => quickSaveAvx(false)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-[#c9c9d1] hover:bg-[#232327] hover:text-white">
              <Save size={12} /> Save (Ctrl+S)
            </button>
            <button onClick={() => quickSaveAvx(true)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-[#c9c9d1] hover:bg-[#232327] hover:text-white">
              <FileBox size={12} /> Save As
            </button>
            <button onClick={() => void openAvxProject().catch((e) => showError(String(e)))} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] text-[#c9c9d1] hover:bg-[#232327] hover:text-white">
              <Layers size={12} /> Open .avx
            </button>
          </div>
        </div>
      </div>

      <div className="mx-1 h-4 w-px bg-[#2c2c31]" />

      <div className="flex items-center gap-1">
        <button
          onClick={onOpenExport}
          className="flex h-7 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-2.5 text-[11px] font-medium text-white hover:border-[#3a3a41]"
          title="Full export dialog (Ctrl+E)"
        >
          <Download size={12} /> Export
        </button>
        <div className="hidden items-center gap-1 md:flex">
          {IMG_FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => quickExport(f.id)}
              disabled={busy}
              className={clsx(
                "h-7 rounded-md border px-2 font-mono text-[10px]",
                fmt === f.id ? "border-[#2f7cf6] bg-[#2f7cf6] text-white" : "border-[#2c2c31] bg-transparent text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white",
              )}
              onMouseEnter={() => setFmt(f.id)}
              title={`Quick export ${f.ext.toUpperCase()}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => quickExport(fmt)}
          className="flex h-7 items-center gap-1 rounded-md bg-white px-2.5 text-[11px] font-semibold text-[#161618] hover:bg-[#ececee] md:hidden"
        >
          <FileImage size={12} /> {fmt.toUpperCase()}
        </button>
      </div>

      <span className="ml-auto hidden shrink-0 items-center gap-1 font-mono text-[10px] text-[#6e6e78] lg:flex">
        <span className="h-1 w-1 rounded-full bg-[#7ad69e]" /> {doc.width}x{doc.height} • {doc.dirty ? "unsaved" : "saved"}
      </span>
    </div>
  );
}
