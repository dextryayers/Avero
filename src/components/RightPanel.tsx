import { Fragment, useEffect, useRef, useState } from "react";
import {
  Eye,
  Folder,
  Group,
  Lock,
  Plus,
  Ungroup,
  Trash2,
  ChevronUp,
  ChevronDown,
  Undo2,
  Redo2,
  Copy,
  ArrowDownToLine,
  CircleDashed,
  Layers,
  Scan,
  Sparkles,
  Square,
  Sliders,
  Filter,
  FlaskConical,
  Type,
  Palette,
  Camera,
  Package,
  Layout,
  LayoutGrid,
  PenLine,
  Brush,
  Puzzle,
  Box,
  History,
  X,
  LocateFixed,
} from "lucide-react";
import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useShallow } from "zustand/shallow";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import clsx from "clsx";
import SelectionPanel from "./SelectionPanel";
import MaskPanel from "./MaskPanel";
import AdjustPanel from "./AdjustPanel";
import FilterPanel from "./FilterPanel";
import TextShapePanel from "./TextShapePanel";
import ColorPanel from "./ColorPanel";
import RawPanel from "./RawPanel";
import TransformPanel from "./TransformPanel";
import BatchPanel from "./BatchPanel";
import { BrushesView, ColourView, StrokeView, SwatchesView } from "./StudioViews";
import ArtboardPanel from "./ArtboardPanel";
import PluginPanel from "./PluginPanel";
import MockupPanel from "./MockupPanel";
import NativeLabPanel from "./NativeLabPanel";
import { ObjectsPanel } from "./ObjectsPanel";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { showError, showMessage, askConfirm, askText } from "../ui/notify";
import { doUndo, doRedo, jumpToHistory } from "../engine/historyOps";
import { blendToComposite } from "../engine/canvasRender";
import { CollapseChevron, DockSlider, EmptyState, ScrollPager } from "../ui/atoms";
import {
  AssetsPanel,
  DockTabBar,
  EffectsPanel,
  StylesPanel,
  TextStylesPanel,
  type DockTab,
} from "./LayerStudio";

export const BLEND_MODES: { id: string; label: string; group: string }[] = [
  { id: "normal", label: "Normal", group: "Normal" },
  { id: "dissolve", label: "Dissolve", group: "Normal" },
  { id: "darken", label: "Darken", group: "Darken" },
  { id: "multiply", label: "Multiply", group: "Darken" },
  { id: "color-burn", label: "Color Burn", group: "Darken" },
  { id: "linear-burn", label: "Linear Burn", group: "Darken" },
  { id: "darker-color", label: "Darker Color", group: "Darken" },
  { id: "lighten", label: "Lighten", group: "Lighten" },
  { id: "screen", label: "Screen", group: "Lighten" },
  { id: "color-dodge", label: "Color Dodge", group: "Lighten" },
  { id: "linear-dodge", label: "Linear Dodge", group: "Lighten" },
  { id: "lighter-color", label: "Lighter Color", group: "Lighten" },
  { id: "overlay", label: "Overlay", group: "Contrast" },
  { id: "soft-light", label: "Soft Light", group: "Contrast" },
  { id: "hard-light", label: "Hard Light", group: "Contrast" },
  { id: "vivid", label: "Vivid Light", group: "Contrast" },
  { id: "linear", label: "Linear Light", group: "Contrast" },
  { id: "pin", label: "Pin Light", group: "Contrast" },
  { id: "hard-mix", label: "Hard Mix", group: "Contrast" },
  { id: "difference", label: "Difference", group: "Inversion" },
  { id: "exclusion", label: "Exclusion", group: "Inversion" },
  { id: "subtract", label: "Subtract", group: "Inversion" },
  { id: "divide", label: "Divide", group: "Inversion" },
  { id: "hue", label: "Hue", group: "Component" },
  { id: "saturation", label: "Saturation", group: "Component" },
  { id: "color", label: "Color", group: "Component" },
  { id: "luminosity", label: "Luminosity", group: "Component" },
];

// 40px live layer thumbnail (checkerboard behind transparency).
function LayerThumb({ id, w, h }: { id: string; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const g = el.getContext("2d")!;
    const S = 40;
    el.width = S;
    el.height = S;
    g.fillStyle = "#2c2c31";
    g.fillRect(0, 0, S, S);
    g.fillStyle = "#3a3a41";
    for (let y = 0; y < S; y += 10)
      for (let x = 0; x < S; x += 10) if (((x + y) / 10) % 2 === 0) g.fillRect(x, y, 10, 10);
    const src = layerManager.get(id);
    if (src && w > 0 && h > 0) {
      const sc = Math.min(S / w, S / h);
      const dw = Math.max(1, w * sc);
      const dh = Math.max(1, h * sc);
      g.drawImage(src, (S - dw) / 2, (S - dh) / 2, dw, dh);
    }
  });
  return <canvas ref={ref} className="h-10 w-10 shrink-0 rounded border border-[#2c2c31]" />;
}

type Tab =
  | "layers"
  | "select"
  | "mask"
  | "adjust"
  | "filter"
  | "lab"
  | "text"
  | "color"
  | "raw"
  | "batch"
  | "art"
  | "plugin"
  | "mockup"
  | "history"
  | "objects";

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "layers", label: "Layers", icon: Layers },
  { id: "select", label: "Select", icon: Scan },
  { id: "mask", label: "Mask", icon: Square },
  { id: "adjust", label: "Adjust", icon: Sliders },
  { id: "filter", label: "Filter", icon: Filter },
  { id: "lab", label: "Memory", icon: FlaskConical },
  { id: "text", label: "Text", icon: Type },
  { id: "color", label: "Color", icon: Palette },
  { id: "raw", label: "RAW", icon: Camera },
  { id: "batch", label: "Batch", icon: Package },
  { id: "art", label: "Art", icon: Layout },
  { id: "plugin", label: "Plug", icon: Puzzle },
  { id: "mockup", label: "Mock", icon: Box },
  { id: "history", label: "Hist", icon: History },
  { id: "objects", label: "Objects", icon: Box },
];

// Premium tab bar: every tab carries a one line English guide so the panel
// explains itself on hover. No emdash in any string.
const TAB_HINTS: Record<Tab, string> = {
  layers: "Layers panel. Click a row to select, Ctrl+click for multi-select, double-click to rename.",
  select: "Selection panel. Feather, grow, shrink and invert the pixel selection.",
  mask: "Mask panel. Feather and density for the active layer mask.",
  adjust: "Adjustments panel. Tone layers with live preview.",
  filter: "Filters panel. Apply and stack image filters.",
  lab: "Memory lab panel. Scratch experiments and test tools.",
  text: "Text panel. Fonts, FX and layout for text layers.",
  color: "Color picker panel. Sample and set the working color.",
  raw: "RAW developer panel. Develop raw photos before editing.",
  batch: "Batch panel. Queue and run multi file jobs.",
  art: "Artboards panel. Arrange artboards for export.",
  plugin: "Plugins panel. SDK extensions and extra tools.",
  mockup: "Mockup panel. Preview the design in scenes.",
  history: "History panel. Step back through undo states.",
  objects: "Objects panel. Auto detected segments as selectable layers.",
};

export default function RightPanel({ dual = false, onToggleLayers, width }: { dual?: boolean; onToggleLayers?: () => void; width?: number } = {}) {
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const v = localStorage.getItem("avero:right-tab");
      const ids: string[] = tabs.map((t) => t.id);
      if (v && ids.includes(v)) return v as Tab;
    } catch {
      /* ignore */
    }
    return "layers";
  });
  function setTab(t: Tab | ((prev: Tab) => Tab)) {
    setTabState((prev) => {
      const next = typeof t === "function" ? (t as (p: Tab) => Tab)(prev) : t;
      try {
        localStorage.setItem("avero:right-tab", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "raster" | "text" | "shape" | "background">(() => {
    try {
      const v = localStorage.getItem("avero:layers-kind");
      if (v === "raster" || v === "text" || v === "shape" || v === "background") return v;
    } catch {
      /* ignore */
    }
    return "all";
  });
  const [showBrush, setShowBrush] = useState(() => {
    try {
      return localStorage.getItem("avero:layers-brush-open") !== "0";
    } catch {
      /* ignore */
    }
    return true;
  });
  const [showProps, setShowProps] = useState(() => {
    try {
      return localStorage.getItem("avero:layers-props-open") !== "0";
    } catch {
      /* ignore */
    }
    return true;
  });
  useEffect(() => {
    try {
      localStorage.setItem("avero:layers-kind", kindFilter);
      localStorage.setItem("avero:layers-brush-open", showBrush ? "1" : "0");
      localStorage.setItem("avero:layers-props-open", showProps ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [kindFilter, showBrush, showProps]);
  // Affinity-style layer studio tabs (Layers/Effects/Styles/Text/Assets).
  const [dock, setDock] = useState<DockTab>("layers");
  // Right-click layer menu: clamped viewport position + target layer id.
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  function deleteLayerFull(id: string) {
    const st = useEditorStore.getState();
    if (st.layers.length <= 1) return;
    layerManager.remove(id);
    layerManager.removeMask(id);
    useProStore.getState().removeMaskEntry(id);
    useProStore.getState().removeTransform(id);
    st.removeLayer(id);
    setMenu(null);
  }

  // Plan4 Fase 19: group the current multi-selection under one collapsible
  // header. Panel-only organization (pixels keep stack order); groupId
  // persists in .avx via the layer meta automatically.
  function groupSelected(): boolean {
    const st = useEditorStore.getState();
    const ids = st.selectedLayerIds.filter((id) => st.layers.some((l) => l.id === id));
    if (ids.length < 2) {
      void showMessage("Select 2 or more layers first (Ctrl+click rows).");
      return false;
    }
    const gid = `group-${Date.now().toString(36)}`;
    for (const id of ids) st.updateLayer(id, { groupId: gid });
    st.markDirty();
    void showMessage(`Grouped ${ids.length} layers. Right-click to ungroup.`);
    return true;
  }

  function ungroupMembers(groupId: string) {
    const st = useEditorStore.getState();
    for (const l of st.layers) {
      if (l.groupId === groupId) st.updateLayer(l.id, { groupId: null });
    }
    st.markDirty();
  }

  // Smart Layers search: reveal jumps to the active row. Filters clear first
  // so a hidden active layer becomes visible, then the row scrolls into view.
  function revealActiveLayer() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setQuery("");
    setKindFilter("all");
    setTab("layers");
    setStudio(null);
    requestAnimationFrame(() => {
      try {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.querySelector(`[data-layer-row="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      } catch {
        /* keep current scroll on query failure */
      }
    });
  }
  // Affinity-style studio strip: colour tools above the main tab system.
  // Selecting a main tab always returns to tab content.
  const [studio, setStudio] = useState<null | "colour" | "swatches" | "stroke" | "brushes">(null);
  // Dual column dock: when paired with ColorDock on the right, this column
  // owns Layers and friends while Color tabs live in ColorDock.
  const stripTabs = dual ? tabs.filter((t) => t.id !== "color") : tabs;
  useEffect(() => {
    if (dual) {
      setStudio(null);
      setTab((t) => (t === "color" ? "layers" : t));
    }
  }, [dual]);
  const workspaceTab = useWorkspaceStore((s) => s.rightTab);
  useEffect(() => {
    if (workspaceTab && (tabs as { id: string }[]).some((t) => t.id === workspaceTab)) {
      setTab(workspaceTab as Tab);
      setStudio(null);
      useWorkspaceStore.getState().setRightTab(null);
    }
  }, [workspaceTab]);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const addLayer = useEditorStore((s) => s.addLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  const moveLayer = useEditorStore((s) => s.moveLayer);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const setLayerSelection = useEditorStore((s) => s.setLayerSelection);
  const toggleLayerSelect = useEditorStore((s) => s.toggleLayerSelect);
  const selectLayerRange = useEditorStore((s) => s.selectLayerRange);
  const collapsedGroups = useEditorStore((s) => s.collapsedGroups);
  const toggleGroupCollapse = useEditorStore((s) => s.toggleGroupCollapse);
  const doc = useEditorStore((s) => s.doc);
  // useShallow is required: a plain object selector without stable equality triggers an
  // endless update loop on React 19 (blank screen). Do not revert to a plain object.
  const brush = useEditorStore(
    useShallow((s) => ({
      size: s.brushSize,
      opacity: s.brushOpacity,
      hardness: s.brushHardness,
      color: s.brushColor,
      flow: s.brushFlow,
      spacing: s.brushSpacing,
      smoothing: s.brushSmoothing,
    })),
  );
  const setBrush = useEditorStore((s) => s.setBrush);
  const history = useEditorStore((s) => s.history);
  const future = useEditorStore((s) => s.future);
  const adjustments = useProStore((s) => s.adjustments);
  const filters = useProStore((s) => s.filters);
  const masks = useProStore((s) => s.masks);

  function handleUndo() {
    doUndo();
  }

  function handleRedo() {
    doRedo();
  }

  function duplicateLayer(id: string) {
    const st = useEditorStore.getState();
    const pro = useProStore.getState();
    const src = st.layers.find((l) => l.id === id);
    if (!src) return;
    const l = makeLayer(`${src.name} copy`);
    const nl = { ...l, opacity: src.opacity, blendMode: src.blendMode, kind: src.kind, locked: false };
    const sc = layerManager.get(id);
    const dc = layerManager.ensure(nl.id, st.doc.width, st.doc.height);
    if (sc) dc.getContext("2d")!.drawImage(sc, 0, 0);
    const sm = layerManager.getMask(id);
    if (sm) {
      const dm = layerManager.ensureMask(nl.id, st.doc.width, st.doc.height);
      dm.getContext("2d")!.drawImage(sm, 0, 0);
      pro.ensureMask(nl.id);
      const mc = pro.masks[id];
      if (mc) pro.updateMask(nl.id, { ...mc });
    }
    const t = pro.transforms[id];
    if (t) {
      pro.ensureTransform(nl.id);
      pro.updateTransform(nl.id, { ...t });
    }
    const ts = pro.textSpecs[id];
    if (ts) pro.setTextSpec(nl.id, { ...ts });
    const ss = pro.shapeSpecs[id];
    if (ss) pro.setShapeSpec(nl.id, { ...ss });
    st.addLayer(nl);
  }

  async function mergeDown(id: string) {
    const st = useEditorStore.getState();
    const idx = st.layers.findIndex((l) => l.id === id);
    if (idx <= 0) {
      await showError("No layer below to merge into.");
      return;
    }
    const top = st.layers[idx];
    const below = st.layers[idx - 1];
    if (!(await askConfirm(`Merge "${top.name}" into "${below.name}"? This is destructive.`))) return;
    const bc = layerManager.get(below.id);
    const tc = layerManager.get(id);
    if (bc && tc) {
      const bctx = bc.getContext("2d")!;
      bctx.save();
      bctx.globalAlpha = top.opacity / 100;
      try {
        bctx.globalCompositeOperation = top.blendMode as GlobalCompositeOperation;
      } catch {
        bctx.globalCompositeOperation = "source-over";
      }
      bctx.drawImage(tc, 0, 0);
      bctx.restore();
    }
    layerManager.remove(id);
    layerManager.removeMask(id);
    useProStore.getState().removeMaskEntry(id);
    useProStore.getState().removeTransform(id);
    st.removeLayer(id);
    st.setActiveLayer(below.id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  async function flattenImage() {
    const st = useEditorStore.getState();
    if (st.layers.length <= 1) return;
    if (!(await askConfirm(`Merge ${st.layers.length} layers into one? This is destructive.`))) return;
    const bottom = st.layers[0];
    const bc = layerManager.ensure(bottom.id, st.doc.width, st.doc.height);
    const bctx = bc.getContext("2d")!;
    for (let i = 1; i < st.layers.length; i++) {
      const l = st.layers[i];
      if (!l.visible) continue;
      const c = layerManager.get(l.id);
      if (!c) continue;
      bctx.save();
      bctx.globalAlpha = l.opacity / 100;
      try {
        bctx.globalCompositeOperation = l.blendMode as GlobalCompositeOperation;
      } catch {
        bctx.globalCompositeOperation = "source-over";
      }
      bctx.drawImage(c, 0, 0);
      bctx.restore();
    }
    st.layers.slice(1).forEach((l) => {
      layerManager.remove(l.id);
      layerManager.removeMask(l.id);
      useProStore.getState().removeMaskEntry(l.id);
      useProStore.getState().removeTransform(l.id);
    });
    useEditorStore.setState({ layers: [bottom], activeLayerId: bottom.id });
    st.markDirty();
    useProStore.getState().bumpHistogram();
  }

  return (
    <div
      className={`avero-contain flex shrink-0 flex-col border-l border-[#2c2c31] bg-[#1c1c1f]${dual || width ? "" : " w-[308px]"}`}
      style={width ? { width } : undefined}
    >
      <div className="flex items-center gap-2 border-b border-[#2c2c31] bg-[#161618] px-2.5 py-2">
        <span className="avero-micro">Properties</span>
        {dual && onToggleLayers && (
          <button
            onClick={onToggleLayers}
            title="Hide Layers column"
            className="grid h-6 w-6 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
          >
            <Layers size={13} />
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] tabular-nums text-[#6e6e78]">
          {doc.width}×{doc.height} · {layers.length} lyr
        </span>
      </div>
      <ScrollPager
        ariaLabel="Studio panels"
        className="border-b border-[#2c2c31] bg-[#161618] py-0.5 text-[10px]"
        jumpLabel="Panels"
        jumpItems={stripTabs.map((t) => ({
          id: t.id,
          label: `${t.label} panel`,
          icon: t.icon,
          active: tab === t.id,
          badge:
            t.id === "adjust" && adjustments.length > 0
              ? adjustments.length
              : t.id === "filter" && filters.length > 0
                ? filters.length
                : t.id === "history" && history.length > 0
                  ? history.length
                  : undefined,
        }))}
        onJumpPick={(id) => {
          setTab(id as Tab);
          setStudio(null);
        }}
      >
        {stripTabs.map((t) => {
          const Icon = t.icon;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setTab(t.id);
                setStudio(null);
              }}
              title={TAB_HINTS[t.id]}
              className={clsx(
                "avero-lift flex shrink-0 flex-col items-center gap-0.5 whitespace-nowrap rounded-t-md border-b-2 px-2 pb-1.5 pt-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]",
                selected
                  ? "border-[#2f7cf6] bg-[#232327] font-semibold text-white"
                  : "border-transparent text-[#6e6e78] hover:bg-[#232327] hover:text-white",
              )}
            >
              <Icon size={13} />
              <span>{t.label}</span>
              {(t.id === "adjust" && adjustments.length > 0) || (t.id === "filter" && filters.length > 0) || (t.id === "history" && history.length > 0) ? (
                <span className="rounded-full bg-[#2f7cf6] px-1.5 font-mono text-[9px] leading-tight text-white shadow-[0_1px_6px_rgba(47,124,246,0.5)]">
                  {t.id === "adjust" ? adjustments.length : t.id === "filter" ? filters.length : history.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </ScrollPager>
      {!dual && (
      <div className="grid grid-cols-4 border-b border-[#2c2c31] bg-[#101012]" role="tablist" aria-label="Colour studio">
        {(
          [
            { id: "colour", label: "Colour", icon: Palette },
            { id: "swatches", label: "Swatches", icon: LayoutGrid },
            { id: "stroke", label: "Stroke", icon: PenLine },
            { id: "brushes", label: "Brushes", icon: Brush },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const selected = studio === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setStudio(selected ? null : t.id)}
              title={`${t.label} studio (click again to close)`}
              className={clsx(
                "avero-lift flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-2 text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]",
                selected
                  ? "border-[#2f7cf6] bg-[#1c1c1f] font-semibold text-white"
                  : "border-transparent text-[#6e6e78] hover:text-white",
              )}
            >
              <Icon size={13} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      )}

      {studio === null && tab === "layers" && <DockTabBar value={dock} onChange={setDock} />}

      <div className="avero-fade-in min-h-0 flex-1 overflow-y-auto" key={`${studio ?? tab}-${dock}`}>
        {studio === "colour" && <ColourView />}
        {studio === "swatches" && <SwatchesView />}
        {studio === "stroke" && <StrokeView />}
        {studio === "brushes" && <BrushesView />}
        {studio === null && tab === "layers" && dock === "effects" && <EffectsPanel />}
        {studio === null && tab === "layers" && dock === "styles" && <StylesPanel />}
        {studio === null && tab === "layers" && dock === "text" && <TextStylesPanel />}
        {studio === null && tab === "layers" && dock === "assets" && <AssetsPanel />}
        {studio === null && tab === "layers" && dock === "layers" && (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-1 border-b border-[#2c2c31] p-2">
              <button
                onClick={() => {
                  const l = makeLayer(`Layer ${layers.length + 1}`);
                  layerManager.ensure(l.id, doc.width, doc.height);
                  useProStore.getState().ensureTransform(l.id);
                  addLayer(l);
                }}
                className="avero-btn-primary avero-lift flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white"
              >
                <Plus size={13} /> Layer
              </button>
              <button
                onClick={() => {
                  void import("../io/importImage").then(({ importImageAsLayer }) => importImageAsLayer());
                }}
                title="Import one or many external images as new layers (proportional, no stretch)"
                className="flex items-center gap-1 rounded-md border border-[#2f7cf6]/40 bg-[#2f7cf6]/10 px-2 py-1 text-[11px] font-semibold text-[#9ec1ff] transition-colors hover:bg-[#2f7cf6]/20 hover:text-white"
              >
                <Folder size={13} /> Import
              </button>
              <button
                onClick={() => {
                  if (!activeLayerId) return;
                  // Free pixel + mask canvases too (store alone would leak them).
                  layerManager.remove(activeLayerId);
                  layerManager.removeMask(activeLayerId);
                  useProStore.getState().removeMaskEntry(activeLayerId);
                  useProStore.getState().removeTransform(activeLayerId);
                  removeLayer(activeLayerId);
                }}
                disabled={layers.length <= 1}
                title="Delete layer"
                className="flex items-center gap-1 rounded-md bg-[#232327] px-2 py-1 text-[11px] text-white disabled:opacity-40"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => {
                  if (activeLayerId) void mergeDown(activeLayerId);
                }}
                disabled={layers.length <= 1}
                title="Merge down"
                className="rounded-md bg-[#232327] px-2 py-1 text-white disabled:opacity-40"
              >
                <ArrowDownToLine size={13} />
              </button>
              <button
                onClick={() => void flattenImage()}
                disabled={layers.length <= 1}
                title="Flatten image"
                className="rounded-md bg-[#232327] px-2 py-1 text-white disabled:opacity-40"
              >
                <Layers size={13} />
              </button>
              <div className="ml-auto flex gap-1">
                <button
                  title="Undo"
                  onClick={handleUndo}
                  className="rounded p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
                >
                  <Undo2 size={14} />
                </button>
                <button
                  title="Redo"
                  onClick={handleRedo}
                  className="rounded p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
                >
                  <Redo2 size={14} />
                </button>
              </div>
            </div>

            <div className="border-b border-[#2c2c31] p-2">
              <div className="mb-1.5 flex gap-1">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search layers..."
                    aria-label="Search layers"
                    className="h-7 w-full min-w-0 rounded-md border border-[#2c2c31] bg-[#101012] px-2 pr-7 text-[11px] text-white outline-none placeholder:text-[#6e6e78] focus:border-[#2f7cf6]"
                  />
                  {query !== "" && (
                    <button
                      onClick={() => setQuery("")}
                      title="Clear search"
                      aria-label="Clear search"
                      className="absolute right-1 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-[#6e6e78] hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f7cf6]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
                  title="Filter by kind"
                  className="h-7 rounded-md border border-[#2c2c31] bg-[#101012] px-1 text-[11px] text-white"
                >
                  <option value="all">All ({layers.length})</option>
                  <option value="raster">Raster ({layers.filter((l) => l.kind === "raster").length})</option>
                  <option value="text">Text ({layers.filter((l) => l.kind === "text").length})</option>
                  <option value="shape">Shape ({layers.filter((l) => l.kind === "shape").length})</option>
                  <option value="background">Bg ({layers.filter((l) => l.kind === "background").length})</option>
                </select>
                <button
                  onClick={revealActiveLayer}
                  title="Reveal active layer: clear filters and scroll to it"
                  aria-label="Reveal active layer"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#2c2c31] text-[#a7a7b0] hover:border-[#2f7cf6]/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]"
                >
                  <LocateFixed size={13} />
                </button>
              </div>
              {(() => {
                const q = query.trim().toLowerCase();
                const shown = layers.filter(
                  (l) =>
                    (kindFilter === "all" || l.kind === kindFilter) &&
                    (q === "" || l.name.toLowerCase().includes(q)),
                ).length;
                return (
                  <div className="mb-1 px-0.5 font-mono text-[9px] tabular-nums text-[#6e6e78]">
                    {shown} of {layers.length} shown
                  </div>
                );
              })()}
              {(() => {
                const al = layers.find((l) => l.id === activeLayerId);
                if (!al) return null;
                return (
                  <div className="flex items-center gap-1.5 border-b border-[#2c2c31] bg-[#161618] px-2 py-1.5">
                    <span className="shrink-0 text-[11px] font-medium text-[#8e8e98]">Opacity:</span>
                    <input
                      type="number"
                      value={al.opacity}
                      min={0}
                      max={100}
                      disabled={al.locked}
                      onChange={(e) => updateLayer(al.id, { opacity: Math.max(0, Math.min(100, Number(e.target.value))) })}
                      title="Active layer opacity percent"
                      aria-label="Active layer opacity percent"
                      className="h-6 w-14 shrink-0 rounded-lg border border-white/10 bg-[#101012] px-1 font-mono text-[11px] tabular-nums text-white outline-none transition-colors disabled:opacity-40 focus:border-[#2f7cf6]"
                    />
                    <span className="font-mono text-[10px] text-[#6e6e78]">%</span>
                    <select
                      value={al.blendMode}
                      disabled={al.locked}
                      onChange={(e) => updateLayer(al.id, { blendMode: e.target.value as never })}
                      title="Active layer blend mode"
                      aria-label="Active layer blend mode"
                      className="h-6 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101012] px-1 text-[11px] text-white outline-none transition-colors disabled:opacity-40 focus:border-[#2f7cf6]"
                    >
                      {BLEND_MODES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateLayer(al.id, { locked: !al.locked })}
                      title={al.locked ? "Unlock active layer" : "Lock active layer"}
                      aria-pressed={al.locked}
                      className={clsx(
                        "avero-press grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-colors",
                        al.locked ? "border-[#2f7cf6] bg-[#2f7cf6] text-white shadow-[0_2px_8px_rgba(47,124,246,0.4)]" : "border-white/10 text-[#a7a7b0] hover:text-white",
                      )}
                    >
                      <Lock size={12} />
                    </button>
                  </div>
                );
              })()}
              <ActiveLayerProps />
            </div>

            <div className="space-y-1 p-2">
              {(() => {
                const vis = [...layers]
                  .reverse()
                  .filter(
                    (l) =>
                      (kindFilter === "all" || l.kind === kindFilter) &&
                      (query.trim() === "" || l.name.toLowerCase().includes(query.trim().toLowerCase())),
                  );
                if (vis.length === 0) {
                  if (layers.length === 0) {
                    return (
                      <EmptyState
                        title="No layers"
                        hint="Add a layer to start."
                        action={{
                          label: "Add layer",
                          title: "Create a new transparent layer",
                          onClick: () => {
                            const l = makeLayer(`Layer ${layers.length + 1}`);
                            layerManager.ensure(l.id, doc.width, doc.height);
                            useProStore.getState().ensureTransform(l.id);
                            addLayer(l);
                          },
                        }}
                      />
                    );
                  }
                  return (
                    <EmptyState
                      title="No matches"
                      hint="Try a different search or kind filter."
                      action={{
                        label: "Clear search",
                        title: "Clear search text and kind filter",
                        onClick: () => {
                          setQuery("");
                          setKindFilter("all");
                        },
                      }}
                    />
                  );
                }
                const kindLabel: Record<string, string> = {
                  raster: "Layer",
                  background: "Background",
                  text: "Text",
                  shape: "Shape",
                  group: "Group",
                  fill: "Fill",
                };
                return vis.map((l, vi) => {
                  const active = l.id === activeLayerId;
                  const selected = selectedLayerIds.includes(l.id);
                  const accelerated = blendToComposite(l.blendMode) !== "source-over" || l.blendMode === "normal";
                  const hasFx =
                    !!l.fx && (!!l.fx.dropShadow?.enabled || !!l.fx.outerGlow?.enabled || !!l.fx.innerGlow?.enabled || !!l.fx.stroke?.enabled);
                  const g = l.groupId ?? null;
                  const prevG = vi > 0 ? (vis[vi - 1].groupId ?? null) : null;
                  const runStart = !!g && g !== prevG;
                  const collapsed = g ? collapsedGroups.includes(g) : false;
                  const runCount = g ? vis.filter((x) => x.groupId === g).length : 0;
                  return (
                    <Fragment key={l.id}>
                      {runStart && g && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1">
                          <Folder size={12} className="shrink-0 text-[#d9a441]" />
                          <span className="flex-1 truncate text-[11px] font-semibold text-white" title={`Group with ${runCount} shown layers`}>
                            Group ({runCount})
                          </span>
                          <button
                            onClick={() => ungroupMembers(g)}
                            title="Ungroup these layers"
                            className="grid h-5 w-5 place-items-center rounded-md text-[#6e6e78] transition-colors hover:bg-white/5 hover:text-white"
                          >
                            <Ungroup size={12} />
                          </button>
                          <button
                            onClick={() => toggleGroupCollapse(g)}
                            title={collapsed ? "Expand group" : "Collapse group"}
                            aria-expanded={!collapsed}
                            className="grid h-5 w-5 place-items-center rounded-md text-[#6e6e78] transition-colors hover:bg-white/5 hover:text-white"
                          >
                            <CollapseChevron open={!collapsed} />
                          </button>
                        </div>
                      )}
                      {!collapsed && (
                    <div
                      data-layer-row={l.id}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          toggleLayerSelect(l.id);
                          const fresh = useEditorStore.getState().selectedLayerIds;
                          if (fresh.includes(l.id)) {
                            setActiveLayer(l.id);
                          } else if (activeLayerId === l.id) {
                            const rest = fresh.filter((x) => x !== l.id);
                            setActiveLayer(rest[rest.length - 1] ?? layers[layers.length - 1]?.id ?? l.id);
                          }
                        } else if (e.shiftKey && activeLayerId && activeLayerId !== l.id) {
                          selectLayerRange(activeLayerId, l.id);
                          setActiveLayer(l.id);
                        } else {
                          setActiveLayer(l.id);
                          setLayerSelection([l.id]);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveLayer(l.id);
                        setMenu({
                          x: Math.max(8, Math.min(e.clientX, window.innerWidth - 216)),
                          y: Math.max(8, Math.min(e.clientY, window.innerHeight - 430)),
                          id: l.id,
                        });
                      }}
                      onDoubleClick={async () => {
                        const v = await askText("Rename layer", "Layer name:", l.name);
                        if (v && v.trim()) updateLayer(l.id, { name: v.trim().slice(0, 60) });
                      }}
                      title="Click select, Ctrl+click multi-select, Shift+click range, double-click rename"
                      className={clsx(
                        "avero-lift cursor-pointer rounded-xl border px-2 py-1.5 transition-colors",
                        g && "ml-5",
                        active
                          ? "border-[#2f7cf6]/60 bg-[#232327] shadow-[0_2px_12px_rgba(47,124,246,0.25)]"
                          : selected
                            ? "border-[#2f7cf6]/40 bg-[#1d1d22]"
                            : "border-[#2c2c31] bg-[#161618] hover:border-[#3a3a41] hover:bg-[#1b1b1f]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <LayerThumb id={l.id} w={doc.width} h={doc.height} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium text-white">
                            {l.name} <span className="font-normal text-[#6e6e78]">({kindLabel[l.kind] ?? l.kind})</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-[#6e6e78]">
                            <span className="tabular-nums">{l.opacity}%</span>
                            <span className="truncate">{BLEND_MODES.find((b) => b.id === l.blendMode)?.label ?? l.blendMode}</span>
                            {!accelerated && <span className="text-[#d9a441]">cpu</span>}
                            {masks[l.id]?.hasMask && <span className="text-[#8fb6f5]" title="Layer has a mask">mask</span>}
                            {l.clipped && <span className="text-[#7ad69e]" title="Clipped to the layer below">clip</span>}
                            {hasFx && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDock("effects");
                                }}
                                title="Layer has effects - open the Effects panel"
                                className="text-[#c9a0ff] hover:text-white hover:underline"
                              >
                                fx
                              </button>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateLayer(l.id, { locked: !l.locked });
                          }}
                          title={l.locked ? "Unlock layer" : "Lock layer"}
                          aria-pressed={l.locked}
                          className={clsx("shrink-0 rounded-md p-1 transition-colors", l.locked ? "text-[#d9a441]" : "text-[#4a4a52] hover:text-white")}
                        >
                          <Lock size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateLayer(l.id, { visible: !l.visible });
                          }}
                          title={l.visible ? "Hide layer" : "Show layer"}
                          aria-pressed={l.visible}
                          className={clsx(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                            l.visible
                              ? "border-[#2f7cf6]/60 bg-[#2f7cf6]/20 text-white"
                              : "border-[#3a3a41] text-transparent hover:text-[#6e6e78]",
                          )}
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                      {active && (
                        <div className="avero-fade-in mt-1.5 space-y-1.5 border-t border-white/5 pt-2" onClick={(e) => e.stopPropagation()}>
                          <DockSlider
                            compact
                            value={l.opacity}
                            min={0}
                            max={100}
                            suffix="%"
                            disabled={l.locked}
                            title="Layer opacity"
                            onChange={(v) => updateLayer(l.id, { opacity: v })}
                          />
                          <div className="flex items-center gap-1">
                            <select
                              value={l.blendMode}
                              disabled={l.locked}
                              onChange={(e) => updateLayer(l.id, { blendMode: e.target.value as never })}
                              title={accelerated ? "GPU-accelerated blend" : "CPU fallback blend"}
                              className="h-6 min-w-0 flex-1 rounded-md border border-[#2c2c31] bg-[#101012] px-1 text-[10px] text-white outline-none disabled:opacity-40 focus:border-[#2f7cf6]"
                            >
                              {BLEND_MODES.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => updateLayer(l.id, { clipped: !l.clipped })}
                              disabled={l.locked}
                              title="Clip to the layer below"
                              aria-pressed={!!l.clipped}
                              className={clsx(
                                "h-6 shrink-0 rounded-md px-2 text-[10px] font-medium transition-colors disabled:opacity-40",
                                l.clipped ? "bg-[#2f7cf6]/20 text-[#8fb6f5] ring-1 ring-[#2f7cf6]/50" : "bg-white/5 text-[#8e8e98] hover:text-white",
                              )}
                            >
                              Clip
                            </button>
                            <button
                              onClick={() => duplicateLayer(l.id)}
                              title="Duplicate layer (Ctrl+J)"
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#a7a7b0] hover:bg-white/5 hover:text-white"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              onClick={() => moveLayer(l.id, 1)}
                              title="Move up (Ctrl+])"
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#a7a7b0] hover:bg-white/5 hover:text-white"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => moveLayer(l.id, -1)}
                              title="Move down (Ctrl+[)"
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#a7a7b0] hover:bg-white/5 hover:text-white"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                      )}
                    </Fragment>
                  );
                });
              })()}
            </div>

            <div className="border-t border-[#2c2c31] p-3">
              <button onClick={() => setShowBrush((v) => !v)} aria-expanded={showBrush} title="Toggle brush console" className="mb-1.5 flex w-full items-center justify-between rounded-md px-1 py-0.5 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]">
                <h4 className="avero-micro">Brush</h4>
                <CollapseChevron open={showBrush} />
              </button>
              {showBrush && (
                <div className="avero-fade-in space-y-2">
                  <DockSlider label="Size" value={brush.size} min={1} max={200} suffix="px" title="Brush size - [ / ]" onChange={(v) => setBrush({ size: v })} />
                  <DockSlider label="Hard" value={brush.hardness} min={0} max={100} suffix="%" title="Edge hardness - Shift+[ / ]" onChange={(v) => setBrush({ hardness: v })} />
                  <DockSlider label="Opacity" value={brush.opacity} min={1} max={100} suffix="%" title="Brush opacity - number keys 1-0" onChange={(v) => setBrush({ opacity: v })} />
                  <DockSlider label="Flow" value={brush.flow} min={1} max={100} suffix="%" title="Ink flow per dab - Shift+digits" onChange={(v) => setBrush({ flow: v })} />
                  <DockSlider label="Spacing" value={brush.spacing} min={1} max={200} suffix="%" title="Distance between dabs" onChange={(v) => setBrush({ spacing: v })} />
                  <DockSlider label="Smooth" value={brush.smoothing} min={0} max={100} suffix="%" title="Stroke stabilizer" onChange={(v) => setBrush({ smoothing: v })} />
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="group relative h-7 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-white/20 transition-all hover:ring-2 hover:ring-[#2f7cf6]" title="Brush color">
                      <span className="absolute inset-0" style={{ backgroundColor: brush.color }} />
                      <input
                        type="color"
                        value={brush.color}
                        onChange={(e) => setBrush({ color: e.target.value })}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Brush color"
                      />
                    </span>
                    <span className="font-mono text-[11px] uppercase tabular-nums text-[#a7a7b0]">{brush.color}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-[#2c2c31] p-3">
              <button onClick={() => setShowProps((v) => !v)} aria-expanded={showProps} title="Toggle layer properties" className="mb-1.5 flex w-full items-center justify-between rounded-md px-1 py-0.5 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]">
                <h4 className="avero-micro">Layer properties</h4>
                <CollapseChevron open={showProps} />
              </button>
              {showProps && <TransformPanel />}
            </div>
            <div className="sticky bottom-0 flex items-center justify-center gap-1 border-t border-[#2c2c31] bg-[#161618] p-1.5">
              <button
                onClick={() => {
                  const l = makeLayer(`Layer ${layers.length + 1}`);
                  layerManager.ensure(l.id, doc.width, doc.height);
                  useProStore.getState().ensureTransform(l.id);
                  addLayer(l);
                }}
                title="New layer"
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => {
                  if (activeLayerId) duplicateLayer(activeLayerId);
                }}
                title="Duplicate active layer"
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => {
                  if (!activeLayerId || layers.length <= 1) return;
                  layerManager.remove(activeLayerId);
                  layerManager.removeMask(activeLayerId);
                  useProStore.getState().removeMaskEntry(activeLayerId);
                  useProStore.getState().removeTransform(activeLayerId);
                  removeLayer(activeLayerId);
                }}
                disabled={layers.length <= 1}
                title="Delete active layer"
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => {
                  if (activeLayerId) void mergeDown(activeLayerId);
                }}
                disabled={layers.length <= 1}
                title="Merge down (Ctrl+Shift+M)"
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white disabled:opacity-40"
              >
                <ArrowDownToLine size={14} />
              </button>
              <button
                onClick={() => groupSelected()}
                disabled={selectedLayerIds.length < 2}
                title={selectedLayerIds.length < 2 ? "Group selected layers (Ctrl+G): select 2+ rows with Ctrl+click first" : `Group ${selectedLayerIds.length} selected layers (Ctrl+G)`}
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white disabled:opacity-40"
              >
                <Group size={14} />
              </button>
              <span className="mx-1 h-4 w-px bg-[#2c2c31]" />
              <button
                onClick={() => {
                  const st = useEditorStore.getState();
                  const id = st.activeLayerId;
                  if (!id) return;
                  const m = st.layers.find((l) => l.id === id);
                  if (!m || m.locked || !m.visible) return;
                  useProStore.getState().ensureMask(id);
                  layerManager.ensureMask(id, st.doc.width, st.doc.height);
                  st.markDirty();
                  setTab("mask");
                  setDock("layers");
                }}
                title="Add a mask to the active layer and open the Mask panel"
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <CircleDashed size={14} />
              </button>
              <button
                onClick={() => {
                  if (!activeLayerId) return;
                  setDock("effects");
                }}
                title="Open layer effects for the active layer"
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <Sparkles size={14} />
              </button>
              <span className="mx-1 h-4 w-px bg-[#2c2c31]" />
              <button
                title="Undo"
                onClick={handleUndo}
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <Undo2 size={14} />
              </button>
              <button
                title="Redo"
                onClick={handleRedo}
                className="avero-press grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <Redo2 size={14} />
              </button>
            </div>
          </div>
        )}

        {studio === null && tab === "select" && <SelectionPanel />}
        {studio === null && tab === "mask" && <MaskPanel />}
        {studio === null && tab === "adjust" && <AdjustPanel />}
        {studio === null && tab === "filter" && <FilterPanel />}
        {studio === null && tab === "lab" && <NativeLabPanel />}
        {studio === null && tab === "text" && <TextShapePanel />}
        {studio === null && tab === "color" && <ColorPanel />}
        {studio === null && tab === "raw" && <RawPanel />}
        {studio === null && tab === "batch" && <BatchPanel />}
        {studio === null && tab === "art" && <ArtboardPanel />}
        {studio === null && tab === "plugin" && <PluginPanel />}
        {studio === null && tab === "mockup" && <MockupPanel />}
        {studio === null && tab === "objects" && <ObjectsPanel />}

        {studio === null && tab === "history" && (
          <div className="avero-slide-in p-2 text-[12px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#6e6e78]">
                {history.length} steps · click to jump
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => useEditorStore.getState().clearHistory()}
                  title="Clear undo history"
                  className="avero-lift rounded bg-[#232327] px-2 py-0.5 text-[10px] text-[#a7a7b0] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 && (
              <EmptyState
                title="No history yet"
                hint="Paint or transform to record steps. Recording is automatic."
              />
            )}
            {history.map((h, i) => (
              <button
                key={h.id}
                onClick={() => jumpToHistory(i)}
                title="Jump to this state"
                className={clsx(
                  "avero-lift mb-1 block w-full rounded px-2 py-1.5 text-left hover:bg-[#2c2c31]",
                  i === history.length - 1 ? "bg-[#232327]" : "bg-transparent",
                )}
              >
                <div className="font-medium text-white">{h.label}</div>
                <div className="font-mono text-[10px] text-[#6e6e78]">
                  {new Date(h.time).toLocaleTimeString()}
                  {i === history.length - 1 ? " · current" : ""}
                </div>
              </button>
            ))}
            {future.length > 0 && (
              <div className="p-2 text-[11px] text-[#6e6e78]">{future.length} redo available</div>
            )}
          </div>
        )}
      </div>
      {menu &&
        (() => {
          const m = layers.find((l) => l.id === menu.id);
          if (!m) return null;
          const st = useEditorStore.getState();
          const idx = st.layers.findIndex((l) => l.id === m.id);
          const close = () => setMenu(null);
          const items: {
            icon: typeof Copy;
            label: string;
            hint?: string;
            danger?: boolean;
            disabled?: boolean;
            run: () => void;
          }[] = [
            {
              icon: PenLine,
              label: "Rename",
              run: async () => {
                close();
                const v = await askText("Rename layer", "Layer name:", m.name);
                if (v && v.trim()) updateLayer(m.id, { name: v.trim().slice(0, 60) });
              },
            },
            { icon: Copy, label: "Duplicate", hint: "Ctrl+J", run: () => { close(); duplicateLayer(m.id); } },
            {
              icon: ChevronUp,
              label: "Bring to front",
              hint: "Ctrl+Shift+]",
              run: () => { close(); for (let i = 0; i < 99; i++) moveLayer(m.id, 1); },
            },
            {
              icon: ChevronDown,
              label: "Send to back",
              hint: "Ctrl+Shift+[",
              run: () => { close(); for (let i = 0; i < 99; i++) moveLayer(m.id, -1); },
            },
            {
              icon: ArrowDownToLine,
              label: "Merge down",
              hint: "Ctrl+Shift+M",
              disabled: idx <= 0,
              run: () => { close(); void mergeDown(m.id); },
            },
            {
              icon: Group,
              label: `Group selected (${st.selectedLayerIds.length})`,
              hint: "Ctrl+G",
              disabled: st.selectedLayerIds.length < 2,
              run: () => { close(); groupSelected(); },
            },
            ...(m.groupId
              ? [
                  {
                    icon: Ungroup,
                    label: "Ungroup",
                    run: () => {
                      close();
                      ungroupMembers(m.groupId as string);
                    },
                  } as const,
                ]
              : []),
            {
              icon: CircleDashed,
              label: "Add mask",
              run: () => {
                close();
                if (m.locked || !m.visible) return;
                useProStore.getState().ensureMask(m.id);
                layerManager.ensureMask(m.id, st.doc.width, st.doc.height);
                st.markDirty();
                setTab("mask");
              },
            },
            {
              icon: Sparkles,
              label: "Layer effects",
              run: () => { close(); setDock("effects"); },
            },
            {
              icon: Lock,
              label: m.locked ? "Unlock" : "Lock",
              run: () => { close(); updateLayer(m.id, { locked: !m.locked }); },
            },
            {
              icon: Eye,
              label: m.visible ? "Hide" : "Show",
              run: () => { close(); updateLayer(m.id, { visible: !m.visible }); },
            },
            {
              icon: Trash2,
              label: "Delete",
              danger: true,
              disabled: layers.length <= 1,
              run: () => deleteLayerFull(m.id),
            },
          ];
          return (
            <>
              <div
                className="fixed inset-0 z-50 cursor-default"
                onClick={close}
                onContextMenu={(e) => {
                  e.preventDefault();
                  close();
                }}
              />
              <div
                role="menu"
                aria-label={`Layer actions for ${m.name}`}
                style={{ left: menu.x, top: menu.y }}
                className="avero-pop fixed z-50 w-[200px] rounded-xl border border-white/10 bg-[#1b1b1f]/95 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              >
                <div className="truncate px-2 pb-1 pt-1 text-[11px] font-semibold text-white" title={m.name}>
                  {m.name}
                </div>
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.label}
                      role="menuitem"
                      disabled={it.disabled}
                      onClick={it.run}
                      title={it.label}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors disabled:opacity-40",
                        it.danger ? "text-red-300 hover:bg-red-950/60 hover:text-red-200" : "text-[#c9c9d1] hover:bg-[#2f7cf6] hover:text-white",
                      )}
                    >
                      <Icon size={13} className="shrink-0" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && <span className="font-mono text-[9px] opacity-60">{it.hint}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}
    </div>
  );
}

function ActiveLayerProps() {
  const activeId = useEditorStore((s) => s.activeLayerId);
  const layers = useEditorStore((s) => s.layers);
  const transforms = useProStore((s) => s.transforms);
  const updateTransform = useProStore((s) => s.updateTransform);
  const ensureTransform = useProStore((s) => s.ensureTransform);
  const l = layers.find((x) => x.id === activeId);
  if (!l) return <div className="font-mono text-[10px] text-[#6e6e78]">No active layer.</div>;
  const t = transforms[l.id];
  const num = (field: "x" | "y" | "rotation", val: number) => {
    if (!activeId) return;
    ensureTransform(activeId);
    updateTransform(activeId, { [field]: Math.round(val) } as never);
  };
  const meta = l.locked || !l.visible;
  return (
    <div className="rounded-md border border-[#2c2c31] bg-[#101012] p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="truncate text-[11px] font-semibold text-white">{l.name}</span>
        <span className="font-mono text-[10px] text-[#6e6e78]">
          {l.opacity}% · {l.blendMode}
        </span>
      </div>
      {t ? (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] tabular-nums text-[#a7a7b0]">
          <label className="flex items-center gap-1">
            X
            <input
              type="number"
              value={Math.round(t.x)}
              disabled={meta}
              onChange={(e) => num("x", Number(e.target.value))}
              className="h-5 w-full min-w-0 rounded border border-[#2c2c31] bg-[#161618] px-1 text-white outline-none disabled:opacity-40 focus:border-[#2f7cf6]"
            />
          </label>
          <label className="flex items-center gap-1">
            Y
            <input
              type="number"
              value={Math.round(t.y)}
              disabled={meta}
              onChange={(e) => num("y", Number(e.target.value))}
              className="h-5 w-full min-w-0 rounded border border-[#2c2c31] bg-[#161618] px-1 text-white outline-none disabled:opacity-40 focus:border-[#2f7cf6]"
            />
          </label>
          <span>SX {t.scaleX.toFixed(2)}</span>
          <span>SY {t.scaleY.toFixed(2)}</span>
          <label className="col-span-2 flex items-center gap-1">
            R
            <input
              type="number"
              value={Math.round(t.rotation)}
              disabled={meta}
              onChange={(e) => num("rotation", Number(e.target.value))}
              className="h-5 w-full min-w-0 rounded border border-[#2c2c31] bg-[#161618] px-1 text-white outline-none disabled:opacity-40 focus:border-[#2f7cf6]"
            />
            <span>°</span>
          </label>
        </div>
      ) : (
        <div className="font-mono text-[10px] text-[#6e6e78]">No transform. Move tool to transform.</div>
      )}
    </div>
  );
}
