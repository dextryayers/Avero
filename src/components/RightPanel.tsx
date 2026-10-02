import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Undo2,
  Redo2,
  Copy,
  ArrowDownToLine,
  Layers,
  Scan,
  Square,
  Sliders,
  Filter,
  FlaskConical,
  Type,
  Palette,
  Camera,
  Package,
  GitBranch,
  Layout,
  Puzzle,
  Box,
  History,
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
import GitPanel from "./GitPanel";
import ArtboardPanel from "./ArtboardPanel";
import PluginPanel from "./PluginPanel";
import MockupPanel from "./MockupPanel";
import NativeLabPanel from "./NativeLabPanel";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { showError, askConfirm, askText } from "../ui/notify";
import { doUndo, doRedo, jumpToHistory } from "../engine/historyOps";
import { blendToComposite } from "../engine/canvasRender";

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
  | "git"
  | "art"
  | "plugin"
  | "mockup"
  | "history";

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
  { id: "git", label: "Git", icon: GitBranch },
  { id: "art", label: "Art", icon: Layout },
  { id: "plugin", label: "Plug", icon: Puzzle },
  { id: "mockup", label: "Mock", icon: Box },
  { id: "history", label: "Hist", icon: History },
];

export default function RightPanel() {
  const [tab, setTab] = useState<Tab>("layers");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "raster" | "text" | "shape" | "background">("all");
  const [showBrush, setShowBrush] = useState(true);
  const [showProps, setShowProps] = useState(true);
  const workspaceTab = useWorkspaceStore((s) => s.rightTab);
  useEffect(() => {
    if (workspaceTab && (tabs as { id: string }[]).some((t) => t.id === workspaceTab)) {
      setTab(workspaceTab as Tab);
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
  const doc = useEditorStore((s) => s.doc);
  // useShallow is required: a plain object selector without stable equality triggers an
  // endless update loop on React 19 (blank screen). Do not revert to a plain object.
  const brush = useEditorStore(
    useShallow((s) => ({
      size: s.brushSize,
      opacity: s.brushOpacity,
      hardness: s.brushHardness,
      color: s.brushColor,
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
    <div className="avero-contain flex w-[308px] shrink-0 flex-col border-l border-[#2c2c31] bg-[#1c1c1f]">
      <div className="flex items-center gap-2 border-b border-[#2c2c31] bg-[#161618] px-2.5 py-2">
        <span className="avero-micro">Properties</span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-[#6e6e78]">
          {doc.width}×{doc.height} · {layers.length} lyr
        </span>
      </div>
      <div className="flex overflow-x-auto border-b border-[#2c2c31] bg-[#161618] text-[10px] scrollbar-thin" role="tablist" aria-label="Studio panels">
        {tabs.map((t) => {
          const Icon = t.icon;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              title={`${t.label} panel`}
              className={clsx(
                "avero-lift flex shrink-0 flex-col items-center gap-0.5 whitespace-nowrap border-b-2 px-2 pb-1.5 pt-2",
                selected
                  ? "border-[#2f7cf6] bg-[#232327] font-semibold text-white"
                  : "border-transparent text-[#6e6e78] hover:bg-[#232327] hover:text-white",
              )}
            >
              <Icon size={13} />
              <span>{t.label}</span>
              {(t.id === "adjust" && adjustments.length > 0) || (t.id === "filter" && filters.length > 0) || (t.id === "history" && history.length > 0) ? (
                <span className="rounded bg-[#2f7cf6] px-1 font-mono text-[9px] leading-tight text-white">
                  {t.id === "adjust" ? adjustments.length : t.id === "filter" ? filters.length : history.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="avero-fade-in min-h-0 flex-1 overflow-y-auto" key={tab}>
        {tab === "layers" && (
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
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search layers..."
                  className="h-7 min-w-0 flex-1 rounded-md border border-[#2c2c31] bg-[#101012] px-2 text-[11px] text-white outline-none placeholder:text-[#6e6e78] focus:border-[#2f7cf6]"
                />
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
                  title="Filter by kind"
                  className="h-7 rounded-md border border-[#2c2c31] bg-[#101012] px-1 text-[11px] text-white"
                >
                  <option value="all">All</option>
                  <option value="raster">Raster</option>
                  <option value="text">Text</option>
                  <option value="shape">Shape</option>
                  <option value="background">Bg</option>
                </select>
              </div>
              <ActiveLayerProps />
            </div>

            <div className="p-2">
              {[...layers]
                .reverse()
                .filter(
                  (l) =>
                    (kindFilter === "all" || l.kind === kindFilter) &&
                    (query.trim() === "" || l.name.toLowerCase().includes(query.trim().toLowerCase())),
                )
                .map((l) => {
                const active = l.id === activeLayerId;
                const accelerated = blendToComposite(l.blendMode) !== "source-over" || l.blendMode === "normal";
                return (
                  <div
                    key={l.id}
                    onClick={() => setActiveLayer(l.id)}
                    onDoubleClick={async () => {
                      const v = await askText("Rename layer", "Layer name:", l.name);
                      if (v && v.trim()) updateLayer(l.id, { name: v.trim().slice(0, 60) });
                    }}
                    title="Click select · double-click rename"
                    className={clsx(
                      "avero-lift mb-1.5 rounded-md border p-2",
                      active ? "border-[#2f7cf6] bg-[#232327]" : "border-[#2c2c31] bg-[#161618]",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <LayerThumb id={l.id} w={doc.width} h={doc.height} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLayer(l.id, { visible: !l.visible });
                            }}
                            title={l.visible ? "Hide" : "Show"}
                            className="avero-lift text-[#a7a7b0] hover:text-white"
                          >
                            {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <span className="flex-1 truncate text-[12px] font-medium text-white">
                            {l.name}{" "}
                            <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 text-[9px] text-[#6e6e78]">{l.kind}</span>
                            {!accelerated && <span className="ml-1 text-[9px] text-[#d9a441]">cpu</span>}
                            {masks[l.id]?.hasMask && (
                              <span className="ml-1 rounded border border-[#2c2c31] bg-[#101012] px-1 text-[9px] text-[#8fb6f5]" title="Layer has a mask">
                                mask
                              </span>
                            )}
                            {l.clipped && (
                              <span className="ml-1 rounded border border-[#2c2c31] bg-[#101012] px-1 text-[9px] text-[#7ad69e]" title="Clipped to the layer below">
                                clip
                              </span>
                            )}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateLayer(l.id, { locked: !l.locked });
                            }}
                            title={l.locked ? "Unlock" : "Lock"}
                            className={clsx(
                              l.locked ? "text-[#d9a441]" : "text-[#a7a7b0] hover:text-white",
                            )}
                          >
                            <Lock size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-[#a7a7b0]">
                      <span className="w-10 font-mono">Op {l.opacity}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={l.opacity}
                        onChange={(e) => updateLayer(l.id, { opacity: Number(e.target.value) })}
                        className="h-1 flex-1"
                      />
                      <select
                        value={l.blendMode}
                        onChange={(e) => updateLayer(l.id, { blendMode: e.target.value as never })}
                        title={accelerated ? "GPU-accelerated blend" : "CPU fallback blend"}
                        className="max-w-[104px] rounded border border-[#2c2c31] bg-[#161618] px-1 py-0.5 text-[10px] text-white"
                      >
                        {BLEND_MODES.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <label className="flex items-center gap-1 text-[10px] text-[#a7a7b0]">
                        <input
                          type="checkbox"
                          checked={!!l.clipped}
                          onChange={(e) => updateLayer(l.id, { clipped: e.target.checked })}
                        />{" "}
                        Clip
                      </label>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateLayer(l.id);
                          }}
                          title="Duplicate layer"
                          className="rounded p-1 text-[#a7a7b0] hover:bg-[#2c2c31] hover:text-white"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={() => moveLayer(l.id, 1)}
                          title="Move up"
                          className="rounded p-1 text-[#a7a7b0] hover:bg-[#2c2c31] hover:text-white"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => moveLayer(l.id, -1)}
                          title="Move down"
                          className="rounded p-1 text-[#a7a7b0] hover:bg-[#2c2c31] hover:text-white"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#2c2c31] p-3">
              <button onClick={() => setShowBrush((v) => !v)} className="mb-1.5 flex w-full items-center justify-between">
                <h4 className="avero-micro">Brush</h4>
                <span className="font-mono text-[10px] text-[#6e6e78]">{showBrush ? "-" : "+"}</span>
              </button>
              {showBrush && (
                <div className="avero-fade-in">
              <label className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                Size <span className="font-mono text-white">{brush.size}px</span>
              </label>
              <input
                type="range"
                min={1}
                max={200}
                value={brush.size}
                onChange={(e) => setBrush({ size: Number(e.target.value) })}
                className="w-full"
              />
              <label className="mb-1 mt-1 flex justify-between text-[11px] text-[#a7a7b0]">
                Hardness <span className="font-mono text-white">{brush.hardness}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={brush.hardness}
                onChange={(e) => setBrush({ hardness: Number(e.target.value) })}
                className="w-full"
              />
              <label className="mb-1 mt-1 flex justify-between text-[11px] text-[#a7a7b0]">
                Opacity <span className="font-mono text-white">{brush.opacity}%</span>
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={brush.opacity}
                onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
                className="w-full"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={brush.color}
                  onChange={(e) => setBrush({ color: e.target.value })}
                  className="h-7 w-11 cursor-pointer rounded border border-[#2c2c31] bg-transparent"
                />
                <span className="font-mono text-[11px] text-[#a7a7b0]">{brush.color}</span>
              </div>
                </div>
              )}
            </div>
            <div className="border-t border-[#2c2c31] p-3">
              <button onClick={() => setShowProps((v) => !v)} className="mb-1.5 flex w-full items-center justify-between">
                <h4 className="avero-micro">Layer properties</h4>
                <span className="font-mono text-[10px] text-[#6e6e78]">{showProps ? "-" : "+"}</span>
              </button>
              {showProps && <TransformPanel />}
            </div>
          </div>
        )}

        {tab === "select" && <SelectionPanel />}
        {tab === "mask" && <MaskPanel />}
        {tab === "adjust" && <AdjustPanel />}
        {tab === "filter" && <FilterPanel />}
        {tab === "lab" && <NativeLabPanel />}
        {tab === "text" && <TextShapePanel />}
        {tab === "color" && <ColorPanel />}
        {tab === "raw" && <RawPanel />}
        {tab === "batch" && <BatchPanel />}
        {tab === "git" && <GitPanel />}
        {tab === "art" && <ArtboardPanel />}
        {tab === "plugin" && <PluginPanel />}
        {tab === "mockup" && <MockupPanel />}

        {tab === "history" && (
          <div className="avero-slide-in p-2 text-[12px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#6e6e78]">
                {history.length} steps · click to jump
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => useEditorStore.getState().clearHistory()}
                  className="avero-lift rounded bg-[#232327] px-2 py-0.5 text-[10px] text-[#a7a7b0] hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 && (
              <div className="p-3 text-center text-[#6e6e78]">No history yet. Paint or transform to record steps.</div>
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
