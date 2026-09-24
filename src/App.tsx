import { useEffect, useState } from "react";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";
import CanvasArea from "./components/CanvasArea";
import RightPanel from "./components/RightPanel";
import StatusBar from "./components/StatusBar";
import CommandPalette from "./components/CommandPalette";
import { useEditorStore } from "./stores/useEditorStore";
import { layerManager } from "./engine/layerManager";

export default function App() {
  const [palette, setPalette] = useState(false);
  const newDocument = useEditorStore((s) => s.newDocument);

  // init dokumen default sekali
  useEffect(() => {
    const s = useEditorStore.getState();
    if (s.layers.length > 0 && !s.activeLayerId) {
      useEditorStore.setState({ activeLayerId: s.layers[0].id });
    }
    layerManager.ensure(s.layers[0].id, s.doc.width, s.doc.height);
  }, []);

  // shortcut global profesional
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        const entry = useEditorStore.getState().undoMeta();
        if (entry) {
          layerManager.restore(entry.layerId, entry.snapshot);
          useEditorStore.getState().markDirty();
        }
      }
      if (
        (mod && e.key.toLowerCase() === "y") ||
        (mod && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        useEditorStore.getState().redoMeta();
      }
      if (!mod) {
        const t = e.key.toLowerCase();
        const map: Record<string, any> = {
          v: "move",
          m: "select-rect",
          b: "brush",
          e: "eraser",
          i: "eyedropper",
          h: "pan",
          z: "zoom",
        };
        if (
          map[t] &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          useEditorStore.getState().setTool(map[t]);
        }
      }
      if (e.key === " ") {
        // tahan spasi untuk pan sementara: ubah cursor via tool pan
        // sederhana: tidak ubah tool permanen, hanya flag di CanvasArea via key state global
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] text-[#e0e0e0]">
      <TitleBar onOpenCommand={() => setPalette(true)} />
      <div className="flex min-h-0 flex-1">
        <ToolBar />
        <CanvasArea />
        <RightPanel />
      </div>
      <StatusBar />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      {/* Hint bar Fase 1 */}
      <div className="flex items-center gap-2 border-t border-[#3e3e42] bg-[#1a1a1a] px-3 py-1 text-[10px] text-[#a0a0a0]">
        <span>
          Fase 0 selesai: installer shell + Rust IPC. Fase 1 MVP: brush, layer, undo, open PNG JPG
          PSD, export. Tekan Ctrl+K untuk semua aksi.
        </span>
        <button
          onClick={() => newDocument("Untitled", 1920, 1080)}
          className="ml-auto rounded bg-[#2d2d2d] px-2 py-0.5 hover:bg-[#3e3e42] hover:text-white"
        >
          New 1920x1080
        </button>
      </div>
    </div>
  );
}
