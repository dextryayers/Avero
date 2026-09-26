import { useEffect, useState } from "react";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";
import CanvasArea, { getCompositeCanvas } from "./components/CanvasArea";
import RightPanel from "./components/RightPanel";
import StatusBar from "./components/StatusBar";
import CommandPalette from "./components/CommandPalette";
import PsdInfo from "./components/PsdInfo";
import WorkspaceBar from "./components/WorkspaceBar";
import QuickExportBar from "./components/QuickExportBar";
import NodeGraph from "./components/NodeGraph";
import Onboarding from "./components/Onboarding";
import BootSplash from "./components/BootSplash";
import HomeScreen, { openImageViaDialog } from "./components/HomeScreen";
import ExportDialog from "./components/ExportDialog";
import { openAvxProject, saveAvxProject } from "./io/projectIo";
import { useEditorStore } from "./stores/useEditorStore";
import { useProStore } from "./stores/useProStore";
import { loadShortcuts } from "./stores/useWorkspaceStore";
import {
  adjustBrushSize,
  comboOf,
  cycleFamily,
  dispatchAction,
  findMenuAction,
  selectFamilyFirst,
  spaceDown,
  spaceUp,
} from "./app/shortcuts";
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
    // clipboard ringan in-memory untuk Ctrl+X/C/V
    const clipKey = "__avero_clipboard" as const;
    function getClip(): string | null {
      try { return (window as any)[clipKey] as string | null; } catch { return null; }
    }
    function setClip(v: string | null) { try { (window as any)[clipKey] = v; } catch {} }
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const ae = document.activeElement?.tagName;
      const inInput = ae === "INPUT" || ae === "TEXTAREA" || (ae === "SELECT" as any);
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (inInput) return;
        saveAvxProject(e.shiftKey).catch((err) => alert(`Gagal menyimpan proyek: ${String(err)}`));
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (inInput) return;
        setExportOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        if (inInput) return;
        openImageViaDialog();
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (inInput) return;
        const entry = useEditorStore.getState().undoMeta();
        if (entry) {
          layerManager.restore(entry.layerId, entry.snapshot);
          if (entry.maskSnapshot) layerManager.restoreMask(entry.layerId, entry.maskSnapshot);
          useEditorStore.getState().markDirty();
          useProStore.getState().bumpHistogram();
        }
        return;
      }
      if ((mod && e.key.toLowerCase() === "y") || (mod && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        if (inInput) return;
        useEditorStore.getState().redoMeta();
        return;
      }
      if (mod && e.key.toLowerCase() === "a" && !inInput) {
        e.preventDefault();
        const st = useEditorStore.getState();
        import("./engine/selection").then(({ drawRectSelection }) => {
          drawRectSelection(st.doc.width, st.doc.height, { x: 0, y: 0, w: st.doc.width, h: st.doc.height });
          window.dispatchEvent(new Event("avero:selection-changed"));
        });
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && !inInput) {
        e.preventDefault();
        clearSelectionMask();
        window.dispatchEvent(new Event("avero:selection-changed"));
        return;
      }
      if (mod && e.key.toLowerCase() === "t" && !inInput) {
        e.preventDefault();
        useEditorStore.getState().setTool("move");
        return;
      }
      if (mod && e.key.toLowerCase() === "c" && !inInput) {
        e.preventDefault();
        try {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (!id) return;
          const c = layerManager.get(id);
          if (!c) return;
          setClip(c.toDataURL("image/png"));
        } catch {}
        return;
      }
      if (mod && e.key.toLowerCase() === "x" && !inInput) {
        e.preventDefault();
        try {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (!id) return;
          const c = layerManager.get(id);
          if (!c) return;
          setClip(c.toDataURL("image/png"));
          const ctx = c.getContext("2d")!;
          ctx.clearRect(0, 0, c.width, c.height);
          st.markDirty();
          useProStore.getState().bumpHistogram();
          clearSelectionMask();
          window.dispatchEvent(new Event("avero:selection-changed"));
        } catch {}
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && !inInput) {
        e.preventDefault();
        const dataUrl = getClip();
        if (!dataUrl) return;
        try {
          const st = useEditorStore.getState();
          const img = new Image();
          img.onload = () => {
            import("./stores/useEditorStore").then(({ makeLayer }) => {
              const l = makeLayer(`Paste`);
              const nc = layerManager.ensure(l.id, st.doc.width, st.doc.height);
              nc.getContext("2d")!.drawImage(img, 0, 0, st.doc.width, st.doc.height);
              st.addLayer(l);
              st.setActiveLayer(l.id);
              st.markDirty();
              useProStore.getState().bumpHistogram();
            });
          };
          img.src = dataUrl;
        } catch {}
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        e.preventDefault();
        // hapus isi seleksi pada layer aktif
        try {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (id) {
            const c = layerManager.get(id);
            if (c) {
              clearSelectionMask();
              window.dispatchEvent(new Event("avero:selection-changed"));
            }
          }
        } catch {}
        clearSelectionMask();
        window.dispatchEvent(new Event("avero:selection-changed"));
        return;
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
        } else {
          selectFamilyFirst(t.toUpperCase());
        }
      }

      // Aksi menu global sesuai shortcut yang tercantum pada menu
      const hasMod = e.ctrlKey || e.metaKey || e.altKey;
      const isLetter = e.key.length === 1 && /[a-z]/i.test(e.key);
      if (hasMod || !isLetter) {
        const act = findMenuAction(comboOf(e));
        if (act && !inInput) {
          e.preventDefault();
          dispatchAction(act);
          return;
        }
      }
      if (inInput) return;
      // Shift+huruf: cycling keluarga tool (M marquee, R blur/sharpen/smudge, dst)
      if (!hasMod && e.shiftKey && isLetter) {
        if (cycleFamily(e.key.toUpperCase())) e.preventDefault();
        return;
      }
      if (!hasMod && (e.key === "[" || e.key === "]")) {
        adjustBrushSize(e.key === "]" ? 5 : -5);
        e.preventDefault();
        return;
      }
      if (e.key === " " && !hasMod) {
        spaceDown();
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " ") spaceUp();
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
    function onClipEvent(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      const ae = document.activeElement?.tagName;
      if (ae === "INPUT" || ae === "TEXTAREA") return;
      // simulasi Ctrl+C/X/V via dispatch KeyboardEvent agar pakai handler yang sama
      const key = detail === "cut" ? "x" : detail === "copy" ? "c" : detail === "paste" ? "v" : "";
      if (!key) return;
      const ev = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true });
      window.dispatchEvent(ev);
      // fallback langsung jika KeyboardEvent tidak tertangani (karena listener cek e.ctrlKey)
      // panggil logika clipboard langsung
      if (detail === "copy" || detail === "cut") {
        try {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (!id) return;
          const c = layerManager.get(id);
          if (!c) return;
          (window as any).__avero_clipboard = c.toDataURL("image/png");
          if (detail === "cut") {
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            st.markDirty();
            useProStore.getState().bumpHistogram();
          }
        } catch {}
      } else if (detail === "paste") {
        const dataUrl = (window as any).__avero_clipboard as string | null;
        if (!dataUrl) return;
        const st = useEditorStore.getState();
        const img = new Image();
        img.onload = () => {
          import("./stores/useEditorStore").then(({ makeLayer }) => {
            const l = makeLayer(`Paste`);
            const nc = layerManager.ensure(l.id, st.doc.width, st.doc.height);
            nc.getContext("2d")!.drawImage(img, 0, 0, st.doc.width, st.doc.height);
            st.addLayer(l);
            st.setActiveLayer(l.id);
            st.markDirty();
            useProStore.getState().bumpHistogram();
          });
        };
        img.src = dataUrl;
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("avero:open-export", onExportEvent);
    window.addEventListener("avero:save-avx", onSaveEvent);
    window.addEventListener("avero:open-avx", onOpenAvxEvent);
    window.addEventListener("avero:select", onSelectEvent);
    window.addEventListener("avero:clip", onClipEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("avero:open-export", onExportEvent);
      window.removeEventListener("avero:save-avx", onSaveEvent);
      window.removeEventListener("avero:open-avx", onOpenAvxEvent);
      window.removeEventListener("avero:select", onSelectEvent);
      window.removeEventListener("avero:clip", onClipEvent);
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
      {!homeOpen && (
        <div className="flex shrink-0 items-center border-b border-[#2c2c31] bg-[#161618]">
          <WorkspaceBar />
          <QuickExportBar onOpenExport={() => setExportOpen(true)} />
        </div>
      )}
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
