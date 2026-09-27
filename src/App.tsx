import { useEffect, useRef, useState } from "react";
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
import Notifier from "./components/Notifier";
import AppDialog from "./components/AppDialog";
import { showError, askText } from "./ui/notify";
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
import { useSettingsStore } from "./stores/useSettingsStore";
import SettingsPanel from "./components/SettingsPanel";
import { layerManager } from "./engine/layerManager";
import { clearSelectionMask } from "./engine/selection";
import { loadRecovery, saveRecovery, clearRecovery } from "./engine/recovery";
import { doUndo, doRedo } from "./engine/historyOps";

export default function App() {
  const [palette, setPalette] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsReturn, setSettingsReturn] = useState<"home" | "editor">("home");
  const [booted, setBooted] = useState(false);
  const [recovery, setRecovery] = useState<ReturnType<typeof loadRecovery>>(null);
  const newDocument = useEditorStore((s) => s.newDocument);
  const homeOpen = useHomeStore((s) => s.homeOpen);
  const setHome = useHomeStore((s) => s.setHome);

  function openSettings() {
    setSettingsReturn(useHomeStore.getState().homeOpen ? "home" : "editor");
    setExportOpen(false);
    setPalette(false);
    setSettingsOpen(true);
  }
  function closeSettings() {
    setSettingsOpen(false);
    setHome(settingsReturn === "home");
  }

  const openSettingsRef = useRef(openSettings);
  const closeSettingsRef = useRef(closeSettings);
  const settingsOpenRef = useRef(settingsOpen);
  openSettingsRef.current = openSettings;
  closeSettingsRef.current = closeSettings;
  settingsOpenRef.current = settingsOpen;

  useEffect(() => {
    const s = useEditorStore.getState();
    if (s.layers.length > 0) {
      if (!s.activeLayerId) useEditorStore.setState({ activeLayerId: s.layers[0].id });
      layerManager.ensure(s.layers[0].id, s.doc.width, s.doc.height);
      useProStore.getState().ensureTransform(s.layers[0].id);
    }
    setRecovery(loadRecovery());
  }, []);

  // Autosave recovery on the interval chosen in Settings (0 disables it).
  const autosaveMin = useSettingsStore((s) => s.autosaveMin);
  const animations = useSettingsStore((s) => s.animations);
  useEffect(() => {
    if (autosaveMin <= 0) return;
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
        /* ignore */
      }
    }, autosaveMin * 60000);
    return () => clearInterval(t);
  }, [autosaveMin]);

  useEffect(() => {
    const shortcuts = loadShortcuts();
    const inv: Record<string, string> = {};
    Object.entries(shortcuts).forEach(([tool, key]) => {
      inv[key.toLowerCase()] = tool;
    });
    // lightweight in-memory clipboard for Ctrl+X/C/V
    // Path A: cap clipboard at 2048px on the long side so base64 PNG stays manageable for 4K.
    const clipKey = "__avero_clipboard" as const;
    function getClip(): string | null {
      try { return (window as any)[clipKey] as string | null; } catch { return null; }
    }
    function setClip(v: string | null) { try { (window as any)[clipKey] = v; } catch {} }
    function layerToClipboardURL(c: HTMLCanvasElement): string {
      try {
        const maxSide = 2048;
        const m = Math.max(c.width, c.height);
        if (m <= maxSide) return c.toDataURL("image/png");
        const sc = maxSide / m;
        const t = document.createElement("canvas");
        t.width = Math.max(1, Math.round(c.width * sc));
        t.height = Math.max(1, Math.round(c.height * sc));
        t.getContext("2d")!.drawImage(c, 0, 0, t.width, t.height);
        return t.toDataURL("image/png");
      } catch {
        return c.toDataURL("image/png");
      }
    }
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const ae = document.activeElement?.tagName;
      const inInput = ae === "INPUT" || ae === "TEXTAREA" || (ae === "SELECT" as any);
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        window.dispatchEvent(new Event("avero:toggle-settings"));
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (inInput) return;
        saveAvxProject(e.shiftKey).catch((err) => showError(`Failed to save project: ${String(err)}`));
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
        doUndo();
        return;
      }
      if ((mod && e.key.toLowerCase() === "y") || (mod && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        if (inInput) return;
        doRedo();
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
          setClip(layerToClipboardURL(c));
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
          setClip(layerToClipboardURL(c));
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
        // delete selection contents on the active layer
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
        // M toggles rect/ellipse, U cycles shapes, R/J/O/G/P Photoshop-style cycling
        // Manual 2026: expanded orders so every new manual sub-tool reachable via keyboard.
        if (t === "m") {
          const order = ["select-rect", "select-ellipse", "select-square", "select-rounded"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          pro.setSelKind(ed.tool === "select-ellipse" ? "ellipse" : "rect");
          return;
        }
        if (t === "u") {
          const order = ["shape-rect", "shape-ellipse", "shape-polygon", "shape-chevron", "shape-moon", "shape-cross", "shape-plus", "shape-trapezoid"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "r") {
          const order = ["blur", "blur-surface", "blur-field", "sharpen", "sharpen-clarity", "smudge"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "o") {
          const order = ["dodge", "dodge-high", "burn", "burn-shadow", "sponge", "sponge-sat", "sponge-desat"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "g") {
          const order = ["gradient", "gradient-radial", "gradient-diamond", "fill", "fill-solid", "fill-clear"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "p") {
          const order = ["pen", "pen-free", "line", "line-arrow", "curvature-pen"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
          return;
        }
        if (t === "j") {
          const order = ["spot-heal", "heal-freckle", "heal-eye", "heal-teeth", "clone", "clone-soft"] as const;
          const i = order.indexOf(ed.tool as (typeof order)[number]);
          ed.setTool(order[(i + 1) % order.length]);
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

      // Global menu actions matching the shortcuts listed in the menu
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
      // Shift+letter: tool family cycling (M marquee, R blur/sharpen/smudge, etc.)
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
      saveAvxProject(false).catch((err) => showError(`Failed to save project: ${String(err)}`));
    }
    function onOpenAvxEvent() {
      openAvxProject().catch((err) => showError(`Failed to open project: ${String(err)}`));
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
        askText("Feather Selection", "Feather radius in px (0-100):", "2").then((v) => {
          if (v !== null && v !== "") sel.featherSelection(Math.max(0, Math.min(100, Number(v) || 0)));
        });
      }
    }
    function onClipEvent(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      const ae = document.activeElement?.tagName;
      if (ae === "INPUT" || ae === "TEXTAREA") return;
      // simulate Ctrl+C/X/V via KeyboardEvent dispatch to reuse the same handler
      const key = detail === "cut" ? "x" : detail === "copy" ? "c" : detail === "paste" ? "v" : "";
      if (!key) return;
      const ev = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true });
      window.dispatchEvent(ev);
      // direct fallback if the KeyboardEvent is unhandled (listener checks e.ctrlKey)
      // call clipboard logic directly
      if (detail === "copy" || detail === "cut") {
        try {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (!id) return;
          const c = layerManager.get(id);
          if (!c) return;
          (window as any).__avero_clipboard = layerToClipboardURL(c);
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
    function onSettingsEvent() {
      openSettingsRef.current();
    }
    function onCloseSettingsEvent() {
      closeSettingsRef.current();
    }
    function onToggleSettingsEvent() {
      if (settingsOpenRef.current) closeSettingsRef.current();
      else openSettingsRef.current();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("avero:open-settings", onSettingsEvent);
    window.addEventListener("avero:close-settings", onCloseSettingsEvent);
    window.addEventListener("avero:toggle-settings", onToggleSettingsEvent);
    window.addEventListener("avero:open-export", onExportEvent);
    window.addEventListener("avero:save-avx", onSaveEvent);
    window.addEventListener("avero:open-avx", onOpenAvxEvent);
    window.addEventListener("avero:select", onSelectEvent);
    window.addEventListener("avero:clip", onClipEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("avero:open-settings", onSettingsEvent);
      window.removeEventListener("avero:close-settings", onCloseSettingsEvent);
      window.removeEventListener("avero:toggle-settings", onToggleSettingsEvent);
      window.removeEventListener("avero:open-export", onExportEvent);
      window.removeEventListener("avero:save-avx", onSaveEvent);
      window.removeEventListener("avero:open-avx", onOpenAvxEvent);
      window.removeEventListener("avero:select", onSelectEvent);
      window.removeEventListener("avero:clip", onClipEvent);
    };
  }, []);

  return (
    <div className={`flex h-full flex-col bg-[#161618] text-[#ececee]${animations ? "" : " avero-no-anim"}`}>
      {!booted && <BootSplash onDone={() => setBooted(true)} />}
      <TitleBar
        onOpenCommand={() => setPalette(true)}
        onOpenExport={() => setExportOpen(true)}
        onHome={() => setHome(true)}
      />
      {!homeOpen && !settingsOpen && (
        <div className="flex shrink-0 items-center border-b border-[#2c2c31] bg-[#161618]">
          <WorkspaceBar />
          <QuickExportBar onOpenExport={() => setExportOpen(true)} />
        </div>
      )}
      {!homeOpen && !settingsOpen && <PsdInfo />}
      {!homeOpen && !settingsOpen && <NodeGraph />}
      {recovery && !homeOpen && !settingsOpen && (
        <div className="flex items-center gap-2 border-b border-amber-600 bg-[#3a2f14] px-3 py-1.5 text-[11px] text-amber-100">
          <span>
            Recovery found {recovery.docName} {recovery.width}x{recovery.height}. Continue or
            discard.
          </span>
          <button onClick={() => setRecovery(null)} className="rounded bg-[#5a4a1a] px-2 py-0.5">
            Continue this session
          </button>
          <button
            onClick={() => {
              clearRecovery();
              setRecovery(null);
            }}
            className="rounded bg-[#2c2c31] px-2 py-0.5"
          >
            Discard recovery
          </button>
        </div>
      )}
      {settingsOpen ? (
        <SettingsPanel onBack={closeSettings} />
      ) : homeOpen ? (
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
      {!homeOpen && !settingsOpen && exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {booted && <Onboarding />}
      <AppDialog />
      <Notifier />

      <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#1c1c1f] px-3 py-1 font-mono text-[10px] text-[#6e6e78]">
        <span>
          AVERO STUDIO v2.0.0. Ctrl+S saves .avx. Ctrl+E exports. Ctrl+K all actions. Ctrl+, settings.
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
