import { useEffect, useState } from "react";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";
import CanvasArea from "./components/CanvasArea";
import RightPanel from "./components/RightPanel";
import StatusBar from "./components/StatusBar";
import CommandPalette from "./components/CommandPalette";
import PsdInfo from "./components/PsdInfo";
import { useEditorStore } from "./stores/useEditorStore";
import { useProStore } from "./stores/useProStore";
import { layerManager } from "./engine/layerManager";
import { clearSelectionMask } from "./engine/selection";

export default function App() {
  const [palette, setPalette] = useState(false);
  const newDocument = useEditorStore((s) => s.newDocument);

  useEffect(() => {
    const s = useEditorStore.getState();
    if (s.layers.length > 0 && !s.activeLayerId) {
      useEditorStore.setState({ activeLayerId: s.layers[0].id });
    }
    layerManager.ensure(s.layers[0].id, s.doc.width, s.doc.height);
    useProStore.getState().ensureTransform(s.layers[0].id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        clearSelectionMask();
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        const entry = useEditorStore.getState().undoMeta();
        if (entry) {
          layerManager.restore(entry.layerId, entry.snapshot);
          useEditorStore.getState().markDirty();
          useProStore.getState().bumpHistogram();
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
          l: "select-lasso",
          w: "wand",
          b: "brush",
          e: "eraser",
          i: "eyedropper",
          t: "text",
          u: "shape-rect",
          o: "shape-ellipse",
          h: "pan",
          z: "zoom",
        };
        if (
          map[t] &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          useEditorStore.getState().setTool(map[t]);
          if (t === "m" || t === "l" || t === "w") {
            useProStore.getState().setSelKind(t === "m" ? "rect" : t === "l" ? "lasso" : "wand");
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] text-[#e0e0e0]">
      <TitleBar onOpenCommand={() => setPalette(true)} />
      <PsdInfo />
      <div className="flex min-h-0 flex-1">
        <ToolBar />
        <CanvasArea />
        <RightPanel />
      </div>
      <StatusBar />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      <div className="flex items-center gap-2 border-t border-[#3e3e42] bg-[#1a1a1a] px-3 py-1 text-[10px] text-[#a0a0a0]">
        <span>
          Fase 2: select, mask, adjust 9, filter 6, text, shape, transform. Fase 3: color space,
          histogram, proofing, RAW develop. Ctrl+K semua aksi, Ctrl+D deselect.
        </span>
        <button
          onClick={() => {
            layerManager.clear();
            newDocument("Untitled", 1920, 1080);
            clearSelectionMask();
            useProStore.getState().bumpHistogram();
          }}
          className="ml-auto shrink-0 rounded bg-[#2d2d2d] px-2 py-0.5 hover:bg-[#3e3e42] hover:text-white"
        >
          New 1920x1080
        </button>
      </div>
    </div>
  );
}
