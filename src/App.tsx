import { Suspense, lazy, useEffect, useRef, useState } from "react";
import TitleBar from "./components/TitleBar";
import { getCompositeCanvas } from "./engine/compositeRef";
import StatusBar from "./components/StatusBar";
import CommandPalette from "./components/CommandPalette";
import PsdInfo from "./components/PsdInfo";
import WorkspaceBar from "./components/WorkspaceBar";
import QuickExportBar from "./components/QuickExportBar";
import NodeGraph from "./components/NodeGraph";
import Onboarding from "./components/Onboarding";
import BootSplash from "./components/BootSplash";
import HomeScreen, { openImageViaDialog } from "./components/HomeScreen";
import Notifier from "./components/Notifier";
import AppDialog from "./components/AppDialog";
import { SegmentFirstRunDialog, wasSegmentDialogDismissed } from "./components/SegmentFirstRunDialog";

// Code-split heavy routes: the editor workspace (canvas engine + panels),
// settings and export dialog load on demand instead of in the first paint.
const EditorView = lazy(() => import("./components/EditorView"));
const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
const ExportDialog = lazy(() => import("./components/ExportDialog"));

function ChunkFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-[#101012]" role="status" aria-label={label}>
      <div className="flex items-center gap-2.5 text-[12px] text-[#a7a7b0]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2c2c31] border-t-[#2f7cf6]" />
        Loading {label}…
      </div>
    </div>
  );
}
import { showError, showMessage, askText } from "./ui/notify";
import { fetchStartupFile, openAvxProject, saveAvxProject } from "./io/projectIo";
import { runAutoSegment } from "./io/autoSegment";
import { useEditorStore } from "./stores/useEditorStore";
import { useProStore } from "./stores/useProStore";
import { loadShortcuts } from "./stores/useWorkspaceStore";
import {
  adjustBrushHardness,
  adjustBrushOpacity,
  adjustBrushSize,
  comboOf,
  copyActiveLayer,
  cutActiveLayer,
  cycleFamily,
  deleteActivePixels,
  dispatchAction,
  duplicateActiveLayer,
  findMenuAction,
  isEditingNow,
  layerViaCut,
  matchRedo,
  matchUndo,
  nudgeActiveLayer,
  pasteClipboardAsLayer,
  resetBrushColors,
  selectFamilyFirst,
  setBrushOpacityDigit,
  spaceDown,
  spaceUp,
  swapBrushColors,
} from "./app/shortcuts";
import { useHomeStore } from "./stores/useHomeStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { layerManager } from "./engine/layerManager";
import { clearSelectionMask, drawRectSelection, featherSelection, hasSelection, inverseSelection, restoreLastSelection } from "./engine/selection";
import { loadRecovery, saveRecovery, clearRecovery } from "./engine/recovery";
import { doUndo, doRedo } from "./engine/historyOps";

export default function App() {
  const [palette, setPalette] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsReturn, setSettingsReturn] = useState<"home" | "editor">("home");
  const [booted, setBooted] = useState(false);
  const [recovery, setRecovery] = useState<ReturnType<typeof loadRecovery>>(null);
  const [segmentDialog, setSegmentDialog] = useState(false);

  useEffect(() => {
    if (!booted) return;
    if (wasSegmentDialogDismissed()) return;
    if (!useSettingsStore.getState().autoSegment) return;
    const t = setTimeout(() => setSegmentDialog(true), 800);
    return () => clearTimeout(t);
  }, [booted]);
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
    // Double-clicked .avx at launch: open the project straight away.
    fetchStartupFile().then((p) => {
      if (p) {
        openAvxProject(p)
          .then((ok) => {
            if (ok) {
              void showMessage(`Opened ${p.split(/[/\\]/).pop()}`);
            }
          })
          .catch((err) => showError(`Failed to open project: ${String(err)}`));
      }
    });
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
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const editing = isEditingNow();
      const key = e.key.toLowerCase();
      // ---- Layer 1: global app - works even while typing in inputs.
      if (mod && key === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        window.dispatchEvent(new Event("avero:toggle-settings"));
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        // Save works from anywhere (even while typing a layer name).
        saveAvxProject(e.shiftKey).catch((err) => showError(`Failed to save project: ${String(err)}`));
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "e") {
        e.preventDefault();
        if (editing) return;
        setExportOpen(true);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "o") {
        e.preventDefault();
        if (editing) return;
        openImageViaDialog();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        if (editing) return;
        dispatchAction("new-doc");
        return;
      }
      // While typing text: let native browser shortcuts (text undo/cut/paste,
      // arrows, Space) work. Only layer 1 + Escape may run.
      if (editing) {
        if (e.key === "Escape") {
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
        return;
      }
      // ---- Layer 2: general edit - Undo / Redo / Step-backward.
      if (matchUndo(e)) {
        e.preventDefault();
        doUndo();
        return;
      }
      if (matchRedo(e)) {
        e.preventDefault();
        doRedo();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "a") {
        e.preventDefault();
        const st = useEditorStore.getState();
        drawRectSelection(st.doc.width, st.doc.height, { x: 0, y: 0, w: st.doc.width, h: st.doc.height });
        window.dispatchEvent(new Event("avero:selection-changed"));
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "d") {
        e.preventDefault();
        clearSelectionMask();
        window.dispatchEvent(new Event("avero:selection-changed"));
        return;
      }
      if (mod && e.shiftKey && !e.altKey && key === "d") {
        e.preventDefault();
        // Reselect: restore the last selection (not select-all).
        if (!restoreLastSelection()) {
          const st = useEditorStore.getState();
          drawRectSelection(st.doc.width, st.doc.height, { x: 0, y: 0, w: st.doc.width, h: st.doc.height });
        }
        window.dispatchEvent(new Event("avero:selection-changed"));
        return;
      }
      if (mod && e.shiftKey && !e.altKey && key === "i") {
        e.preventDefault();
        inverseSelection();
        window.dispatchEvent(new Event("avero:selection-changed"));
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "t") {
        e.preventDefault();
        useEditorStore.getState().setTool("transform-free");
        return;
      }
      // Cut / Copy hormati seleksi + tulis clipboard sistem (best-effort).
      if (mod && !e.shiftKey && !e.altKey && key === "c") {
        e.preventDefault();
        copyActiveLayer();
        return;
      }
      if (mod && e.shiftKey && !e.altKey && key === "c") {
        e.preventDefault();
        copyActiveLayer();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "x") {
        e.preventDefault();
        cutActiveLayer();
        return;
      }
      // Paste normal (tengah, proporsional) vs Paste in Place (offset asal).
      if (mod && !e.altKey && key === "v") {
        e.preventDefault();
        void pasteClipboardAsLayer(e.shiftKey);
        return;
      }
      // Duplikat / via-cut / urutan layer.
      if (mod && !e.shiftKey && !e.altKey && key === "j") {
        e.preventDefault();
        duplicateActiveLayer();
        return;
      }
      if (mod && e.shiftKey && !e.altKey && key === "j") {
        e.preventDefault();
        if (!layerViaCut()) duplicateActiveLayer();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "g") {
        e.preventDefault();
        dispatchAction("group");
        return;
      }
      if (mod && !e.altKey && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        const id = useEditorStore.getState().activeLayerId;
        if (!id) return;
        if (e.shiftKey) dispatchAction(e.key === "]" ? "layer-top" : "layer-bottom");
        else useEditorStore.getState().moveLayer(id, e.key === "]" ? 1 : -1);
        return;
      }
      // Fill FG / BG + Delete - always via history-aware helpers.
      if (!mod && e.altKey && !e.shiftKey && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        dispatchAction("fill-fg");
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        // Ctrl+Backspace = fill BG (standard), plain Backspace = delete pixels.
        if (e.key === "Backspace") dispatchAction("fill-bg");
        else deleteActivePixels();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !mod && !e.altKey) {
        // In the editor, Delete always means delete pixels.
        e.preventDefault();
        deleteActivePixels();
        return;
      }
      // Crop commit/cancel via keyboard.
      if (e.key === "Enter" && !mod && !e.altKey) {
        const t = useEditorStore.getState().tool as string;
        if (t === "crop" || t.startsWith("crop-") || t === "perspective-crop" || t === "crop-straighten") {
          e.preventDefault();
          window.dispatchEvent(new Event("avero:crop-apply"));
          return;
        }
      }
      if (e.key === "Escape" && !mod && !e.altKey && !e.shiftKey) {
        const t = useEditorStore.getState().tool as string;
        if (t === "crop" || t.startsWith("crop-") || t === "perspective-crop" || t === "crop-straighten") {
          e.preventDefault();
          window.dispatchEvent(new Event("avero:crop-cancel"));
          return;
        }
        if (hasSelection()) {
          e.preventDefault();
          clearSelectionMask();
          window.dispatchEvent(new Event("avero:selection-changed"));
          return;
        }
        return;
      }
      // ---- Layer 3: quick view.
      if (mod && !e.shiftKey && !e.altKey && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        const ed = useEditorStore.getState();
        ed.setZoom(ed.zoom + 25);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key === "-") {
        e.preventDefault();
        const ed = useEditorStore.getState();
        ed.setZoom(ed.zoom - 25);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key === "0") {
        e.preventDefault();
        window.dispatchEvent(new Event("avero:fit-zoom"));
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key === "1") {
        e.preventDefault();
        useEditorStore.getState().setZoom(100);
        return;
      }
      // ---- Layer 4: single tool letters (no Ctrl/Alt) + digits + X/D.
      if (!mod && !e.altKey && !e.shiftKey) {
        const t = e.key.toLowerCase();
        // Digits 1..0 = Photoshop-style brush opacity (Shift+digit = Flow).
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          setBrushOpacityDigit(e.key, false);
          return;
        }
        if (t === "x") {
          e.preventDefault();
          swapBrushColors();
          return;
        }
        if (t === "d") {
          e.preventDefault();
          resetBrushColors();
          return;
        }
        const ed = useEditorStore.getState();
        const pro = useProStore.getState();
        // M/U/R/O/G/P/J: putar sub-tool sekeluarga (semua manual 2026 terjangkau).
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
          ed.setTool(tool as never);
          if (t === "l" || t === "w") {
            pro.setSelKind(t === "l" ? "lasso" : "wand");
          }
          return;
        }
        if (selectFamilyFirst(t.toUpperCase())) return;
      }
      // Shift+digit = brush Flow.
      if (!mod && !e.altKey && e.shiftKey && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setBrushOpacityDigit(e.key, true);
        return;
      }

      // ---- Layer 5: remaining generic menu actions (Levels Ctrl+L, Curves Ctrl+M, ...).
      {
        const hasMod = e.ctrlKey || e.metaKey || e.altKey;
        const isLetter = e.key.length === 1 && /[a-z]/i.test(e.key);
        if (hasMod || !isLetter) {
          const act = findMenuAction(comboOf(e));
          if (act) {
            e.preventDefault();
            dispatchAction(act);
            return;
          }
        }
      }
      // Shift+huruf: putar keluarga tool (M marquee, R blur/sharpen/smudge, ...).
      {
        const hasMod = e.ctrlKey || e.metaKey || e.altKey;
        const isLetter = e.key.length === 1 && /[a-z]/i.test(e.key);
        if (!hasMod && e.shiftKey && isLetter) {
          if (cycleFamily(e.key.toUpperCase())) e.preventDefault();
          return;
        }
      }
      // [ ] brush size, Shift+[ ] hardness, Ctrl+[ ] / Alt+[ ] opacity/flow.
      if (!mod && e.key !== undefined && (e.key === "[" || e.key === "]" || e.key === "{" || e.key === "}")) {
        if (e.altKey) adjustBrushOpacity(e.key === "]" || e.key === "}" ? 10 : -10);
        else if (e.key === "{" || e.key === "}") adjustBrushHardness(e.key === "}" ? 10 : -10);
        else if (e.shiftKey) adjustBrushHardness(e.key === "]" ? 10 : -10);
        else adjustBrushSize(e.key === "]" ? 5 : -5);
        e.preventDefault();
        return;
      }
      if (mod && !e.shiftKey && e.altKey && (e.key === "[" || e.key === "]")) {
        e.preventDefault();
        adjustBrushOpacity(e.key === "]" ? 10 : -10);
        return;
      }
      // Arrows: nudge layer 1px (Shift = 10px), history coalesced.
      if (!mod && !e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeActiveLayer(dx, dy);
        return;
      }
      // Comma and dot rotate the view, slash resets - mirrors the Rotate slider in the bar.
      if (!mod && !e.altKey && !e.shiftKey && (e.key === "," || e.key === "." || e.key === "/")) {
        const ed = useEditorStore.getState();
        if (e.key === ",") ed.setViewRotate(ed.viewRotate - 15);
        else if (e.key === ".") ed.setViewRotate(ed.viewRotate + 15);
        else ed.setViewRotate(0);
        e.preventDefault();
        return;
      }
      if (e.key === " " && !mod && !e.altKey) {
        if (spaceDown()) e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " ") spaceUp();
    }
    function onExportEvent() {
      setExportOpen(true);
    }
    function onSaveEvent() {
      saveAvxProject(false)
        .then((p) => {
          if (p) void showMessage(`Saved: ${p}`);
        })
        .catch((err) => showError(`Failed to save project: ${String(err)}`));
    }
    function onOpenAvxEvent() {
      openAvxProject()
        .then((ok) => {
          if (ok) void showMessage("The .avx project opened successfully.");
        })
        .catch((err) => showError(`Failed to open project: ${String(err)}`));
    }
    async function onSelectEvent(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      const st = useEditorStore.getState();
      const W = st.doc.width;
      const H = st.doc.height;
      if (detail === "sel-all") {
        drawRectSelection(W, H, { x: 0, y: 0, w: W, h: H });
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-none") {
        clearSelectionMask();
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-reselect") {
        // Fix: restore the last selection, not select-all.
        if (!restoreLastSelection()) {
          drawRectSelection(W, H, { x: 0, y: 0, w: W, h: H });
        }
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-inverse") {
        inverseSelection();
        window.dispatchEvent(new Event("avero:selection-changed"));
      } else if (detail === "sel-feather") {
        askText("Feather Selection", "Feather radius in px (0-100):", "2").then((v) => {
          if (v !== null && v !== "") featherSelection(Math.max(0, Math.min(100, Number(v) || 0)));
        });
      }
    }
    function onClipEvent(e: Event) {
      const detail = (e as CustomEvent).detail as string;
      if (isEditingNow()) return;
      // Use the centralized helpers directly (history + selection + proportional paste).
      if (detail === "copy") copyActiveLayer();
      else if (detail === "cut") cutActiveLayer();
      else if (detail === "paste") void pasteClipboardAsLayer(false);
      else if (detail === "paste-place") void pasteClipboardAsLayer(true);
    }
    function onAutoSegmentEvent() {
      // Plan5 Fase 1 slice: palette-triggered for now; auto-run on import
      // arrives with the Fase 6 frontend work.
      void runAutoSegment();
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
    function onOpenAvxPathEvent(e: Event) {
      // Single-instance forward: a double-clicked .avx while already running.
      const path = (e as CustomEvent).detail as string;
      if (!path) return;
      openAvxProject(path)
        .then((ok) => {
          if (ok) {
            void showMessage(`Opened ${path.split(/[/\\]/).pop()}`);
          }
        })
        .catch((err) => showError(`Failed to open project: ${String(err)}`));
    }
    function onOpenImagePathEvent(e: Event) {
      const path = (e as CustomEvent).detail as string;
      if (!path) return;
      window.dispatchEvent(new CustomEvent("avero:open-path", { detail: path }));
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("avero:open-settings", onSettingsEvent);
    window.addEventListener("avero:close-settings", onCloseSettingsEvent);
    window.addEventListener("avero:toggle-settings", onToggleSettingsEvent);
    window.addEventListener("avero:open-export", onExportEvent);
    window.addEventListener("avero:save-avx", onSaveEvent);
    window.addEventListener("avero:open-avx", onOpenAvxEvent);
    window.addEventListener("avero:open-avx-path", onOpenAvxPathEvent);
    window.addEventListener("avero:open-image-path", onOpenImagePathEvent);
    window.addEventListener("avero:select", onSelectEvent);
    window.addEventListener("avero:clip", onClipEvent);
    window.addEventListener("avero:auto-segment", onAutoSegmentEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("avero:open-settings", onSettingsEvent);
      window.removeEventListener("avero:close-settings", onCloseSettingsEvent);
      window.removeEventListener("avero:toggle-settings", onToggleSettingsEvent);
      window.removeEventListener("avero:open-export", onExportEvent);
      window.removeEventListener("avero:save-avx", onSaveEvent);
      window.removeEventListener("avero:open-avx", onOpenAvxEvent);
      window.removeEventListener("avero:open-avx-path", onOpenAvxPathEvent);
      window.removeEventListener("avero:open-image-path", onOpenImagePathEvent);
      window.removeEventListener("avero:select", onSelectEvent);
      window.removeEventListener("avero:clip", onClipEvent);
      window.removeEventListener("avero:auto-segment", onAutoSegmentEvent);
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
        <Suspense fallback={<ChunkFallback label="Settings" />}>
          <SettingsPanel onBack={closeSettings} />
        </Suspense>
      ) : homeOpen ? (
        <HomeScreen />
      ) : (
        <Suspense fallback={<ChunkFallback label="Editor" />}>
          <EditorView />
        </Suspense>
      )}
      <StatusBar />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {!homeOpen && !settingsOpen && exportOpen && (
        <Suspense fallback={null}>
          <ExportDialog onClose={() => setExportOpen(false)} />
        </Suspense>
      )}
      {segmentDialog && <SegmentFirstRunDialog onDone={() => setSegmentDialog(false)} />}
      {booted && <Onboarding />}
      <AppDialog />
      <Notifier />

      <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#1c1c1f] px-3 py-1 font-mono text-[10px] text-[#6e6e78]">
        <span>
          AVERO STUDIO v2.0.0. Ctrl+Z/Y undo-redo · Ctrl+X/C/V cut-copy-paste · Ctrl+Shift+V in place · [ ] brush · 1-0 opacity · X/D colors · Space hand · Ctrl+S save · Ctrl+E export · Ctrl+K actions
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
