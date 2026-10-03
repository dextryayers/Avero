import { useState } from "react";
import { Save, Download, ChevronDown, FileBox, Layers } from "lucide-react";
import { saveAvxProject, openAvxProject } from "../io/projectIo";
import { useEditorStore } from "../stores/useEditorStore";
import { showError, showMessage } from "../ui/notify";

export default function QuickExportBar({ onOpenExport }: { onOpenExport: () => void }) {
  const [busy, setBusy] = useState(false);
  const doc = useEditorStore((s) => s.doc);

  async function quickSaveAvx(as: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const p = await saveAvxProject(as, undefined);
      if (p) await showMessage(`Saved: ${p}`);
    } catch (e) {
      await showError(`Failed to save .avx: ${String(e)}`);
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
          className="flex h-7 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-semibold text-[#161618] hover:bg-[#ececee]"
          title="Open the Export page (Ctrl+E)"
        >
          <Download size={12} /> Export
        </button>
      </div>

      <span className="ml-auto hidden shrink-0 items-center gap-1 font-mono text-[10px] text-[#6e6e78] lg:flex">
        <span className="h-1 w-1 rounded-full bg-[#7ad69e]" /> {doc.width}x{doc.height} • {doc.dirty ? "unsaved" : "saved"}
      </span>
    </div>
  );
}
