import { useEffect, useState } from "react";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";
import CanvasArea, { getCompositeCanvas } from "./components/CanvasArea";
import RightPanel from "./components/RightPanel";
import StatusBar from "./components/StatusBar";
import CommandPalette from "./components/CommandPalette";
import PsdInfo from "./components/PsdInfo";
import WorkspaceBar from "./components/WorkspaceBar";
import NodeGraph from "./components/NodeGraph";
import Onboarding from "./components/Onboarding";
import BootSplash from "./components/BootSplash";
import HomeScreen, { openImageViaDialog } from "./components/HomeScreen";
import ExportDialog from "./components/ExportDialog";
import { openAvxProject, saveAvxProject } from "./io/projectIo";
import { useEditorStore } from "./stores/useEditorStore";
import { useProStore } from "./stores/useProStore";
import { loadShortcuts } from "./stores/useWorkspaceStore";
import { useHomeStore } from "./stores/useHomeStore";
import { layerManager } from "./engine/layerManager";
import { clearSelectionMask } from "./engine/selection";
import { loadRecovery, saveRecovery, clearRecovery } from "./engine/recovery";

export default function App() {
  const [palette, setPalette] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [recovery, setRecovery] = useState<ReturnType<typeof loadRecovery>>(null);
  const newDocument = useEditorStore((s) => s.newDocument);
  const homeOpen = useHomeStore((s) => s.homeOpen);
  const setHome = useHomeStore((s) => s.setHome);

  useEffect(() => {
    const s = useEditorStore.getState();
    if (s.layers.length > 0 && !s.activeLayerId) {
      useEditorStore.setState({ activeLayerId: s.layers[0].id });
    }
    layerManager.ensure(s.layers[0].id, s.doc.width, s.doc.height);
    useProStore.getState().ensureTransform(s.layers[0].id);
    setRecovery(loadRecovery());
  }, []);

  // Autosave recovery tiap 2 menit
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const st = useEditorStore.getState();
        if (!st.doc.dirty) return;
        const comp = getCompositeCanvas();
        if (!comp) return;
        const th = document.createElement("canvas");
        th.width = 320;
        th.height = Math.max(1, Math.round((320 * comp.height) / Math.max(1, comp.width)));
        th.getContext("2d")!.drawImage(comp, 0, 0, th.width, th.height);
        saveRecovery(th.toDataURL("image/jpeg", 0.6), st.doc.name, st.doc.width, st.doc.height);
      } catch {
        /* abaikan */
      }
    }, 120000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const shortcuts = loadShortcuts();
    const inv: Record<string, string> = {};
    Object.entries(shortcuts).forEach(([tool, key]) => {
      inv[key.toLowerCase()] = tool;
    });
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
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        clearSelectionMask();
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const ae = document.activeElement?.tagName;
        if (ae === "INPUT" || ae === "TEXTAREA") return;
        saveAvxProject(e.shiftKey).catch((err) => alert(`Gagal menyimpan proyek: ${String(err)}`));
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openImageViaDialog();
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        const entry = useEditorStore.getState().undoMeta();
        if (entry) {
          layerManager.restore(entry.layerId, entry.snapshot);
          if (entry.maskSnapshot) layerManager.restoreMask(entry.layerId, entry.maskSnapshot);
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
      if (!mod && !e.shiftKey) {
        const t = e.key.toLowerCase();
        const ae = document.activeElement?.tagName;
        if (ae === "INPUT" || ae === "TEXTAREA") return;
        const ed = useEditorStore.getState();
        const pro = useProStore.getState();
        // M bolak-balik rect/ellipse, U putar shapes, R/J/O/G/P cycling ala Photoshop
        if (t === "m") {
          const next = ed.tool === "select-rect" ? "select-ellipse" : "select-rect";
          ed.setTool(next);
          pro.setSelKind(next === "select-rect" ? "rect" : "ellipse");
          return;
        }
        if (t === "u") {
          const order = ["shape-rect", "shape-ellipse", "shape-polygon"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "r") {
          const order = ["blur", "sharpen", "smudge"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "o") {
          const order = ["dodge", "burn", "sponge"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "g") {
          ed.setTool(ed.tool === "gradient" ? "fill" : "gradient");
          return;
        }
        if (t === "p") {
          ed.setTool(ed.tool === "pen" ? "line" : "pen");
          return;
        }
        if (t === "j") {
          ed.setTool(ed.tool === "spot-heal" ? "clone" : "spot-heal");
          return;
        }
        const tool = inv[t];
        if (tool) {
          ed.setTool(tool as any);
          if (t === "l" || t === "w") {
            pro.setSelKind(t === "l" ? "lasso" : "wand");
          }
        }
      }
    }
    function onExportEvent() {
      setExportOpen(true);
    }
    function onSaveEvent() {
      saveAvxProject(false).catch((err) => alert(`Gagal menyimpan proyek: ${String(err)}`));
    }
    function onOpenAvxEvent() {
      openAvxProject().catch((err) => alert(`Gagal membuka proyek: ${String(err)}`));
    }
    async function onSelectEvent(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      const sel = await import("./engine/selection");
      const st = useEditorStore.getState();
      const W = st.doc.width;
      const H = st.doc.height;
      if (detail === "sel-all") {
        sel.drawRectSelection(W, H, { x: 0, y: 0, w: W, h: H });
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-none") {
        sel.clearSelectionMask();
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-reselect") {
        sel.drawRectSelection(W, H, { x: 0, y: 0, w: W, h: H });
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-inverse") {
        const c = sel.selectionMaskCanvas();
        if (c) {
          const ctx = c.getContext("2d")!;
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
            d[i + 3] = 255 - a;
          }
          ctx.putImageData(img, 0, 0);
          window.dispatchEvent(new Event("avero:selection-changed"));
        }
      } else if (detail === "sel-feather") {
        const v = prompt("Feather px (0-100):", "2");
        if (v) sel.featherSelection(Number(v) || 0);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("avero:open-export", onExportEvent);
    window.addEventListener("avero:save-avx", onSaveEvent);
    window.addEventListener("avero:open-avx", onOpenAvxEvent);
    window.addEventListener("avero:select", onSelectEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("avero:open-export", onExportEvent);
      window.removeEventListener("avero:save-avx", onSaveEvent);
      window.removeEventListener("avero:open-avx", onOpenAvxEvent);
      window.removeEventListener("avero:select", onSelectEvent);
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#161618] text-[#ececee]">
      {!booted && <BootSplash onDone={() => setBooted(true)} />}
      <TitleBar
        onOpenCommand={() => setPalette(true)}
        onOpenExport={() => setExportOpen(true)}
        onHome={() => setHome(true)}
      />
      <WorkspaceBar />
      {!homeOpen && <PsdInfo />}
      {!homeOpen && <NodeGraph />}
      {recovery && !homeOpen && (
        <div className="flex items-center gap-2 border-b border-amber-600 bg-[#3a2f14] px-3 py-1.5 text-[11px] text-amber-100">
          <span>
            Ditemukan autosave {recovery.docName} {recovery.width}x{recovery.height}. Lanjutkan atau
            abaikan.
          </span>
          <button onClick={() => setRecovery(null)} className="rounded bg-[#5a4a1a] px-2 py-0.5">
            Lanjut sesi ini
          </button>
          <button
            onClick={() => {
              clearRecovery();
              setRecovery(null);
            }}
            className="rounded bg-[#2c2c31] px-2 py-0.5"
          >
            Hapus recovery
          </button>
        </div>
      )}
      {homeOpen ? (
        <HomeScreen />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ToolBar />
          <CanvasArea />
          <RightPanel />
        </div>
      )}
      <StatusBar />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {!homeOpen && exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {booted && <Onboarding />}

      <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#1c1c1f] px-3 py-1 font-mono text-[10px] text-[#6e6e78]">
        <span>
          AVERO STUDIO v2.0.0. Ctrl+S simpan .avx. Ctrl+E export. Ctrl+K semua aksi. Del hapus seleksi.
        </span>
        <button
          onClick={() => {
            layerManager.clear();
            newDocument("Untitled", 1920, 1080);
            clearSelectionMask();
            clearRecovery();
            useProStore.getState().bumpHistogram();
            setHome(false);
          }}
          className="ml-auto shrink-0 rounded bg-[#232327] px-2 py-0.5 text-[#a7a7b0] hover:bg-[#2c2c31] hover:text-white"
        >
          New 1920x1080
        </button>
      </div>
    </div>
  );
}
