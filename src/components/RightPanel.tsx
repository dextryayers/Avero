import { useEffect, useState } from "react";
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
import AiPanel from "./AiPanel";
import BatchPanel from "./BatchPanel";
import GitPanel from "./GitPanel";
import ArtboardPanel from "./ArtboardPanel";
import PluginPanel from "./PluginPanel";
import MockupPanel from "./MockupPanel";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";

type Tab =
  | "layers"
  | "select"
  | "mask"
  | "adjust"
  | "filter"
  | "text"
  | "color"
  | "raw"
  | "ai"
  | "batch"
  | "git"
  | "art"
  | "plugin"
  | "mockup"
  | "history";

const tabs: { id: Tab; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "select", label: "Select" },
  { id: "mask", label: "Mask" },
  { id: "adjust", label: "Adjust" },
  { id: "filter", label: "Filter" },
  { id: "text", label: "Text" },
  { id: "color", label: "Color" },
  { id: "raw", label: "RAW" },
  { id: "ai", label: "AI" },
  { id: "batch", label: "Batch" },
  { id: "git", label: "Git" },
  { id: "art", label: "Art" },
  { id: "plugin", label: "Plug" },
  { id: "mockup", label: "Mock" },
  { id: "history", label: "Hist" },
];

export default function RightPanel() {
  const [tab, setTab] = useState<Tab>("layers");
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
  // useShallow wajib: selector objek tanpa equality stabil memicu loop update
  // tak berujung pada React 19 (blank screen). Jangan kembalikan ke objek polos.
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

  function handleUndo() {
    const entry = useEditorStore.getState().undoMeta();
    if (entry) {
      layerManager.restore(entry.layerId, entry.snapshot);
      if (entry.maskSnapshot) layerManager.restoreMask(entry.layerId, entry.maskSnapshot);
      useEditorStore.getState().markDirty();
      useProStore.getState().bumpHistogram();
    }
  }

  function handleRedo() {
    const entry = useEditorStore.getState().redoMeta();
    if (entry) useEditorStore.getState().markDirty();
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

  function mergeDown(id: string) {
    const st = useEditorStore.getState();
    const idx = st.layers.findIndex((l) => l.id === id);
    if (idx <= 0) {
      alert("Tidak ada layer di bawahnya untuk digabung.");
      return;
    }
    const top = st.layers[idx];
    const below = st.layers[idx - 1];
    if (!window.confirm(`Gabung "${top.name}" ke "${below.name}"? Tindakan ini destruktif.`)) return;
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

  function flattenImage() {
    const st = useEditorStore.getState();
    if (st.layers.length <= 1) return;
    if (!window.confirm(`Gabung ${st.layers.length} layer jadi satu? Tindakan ini destruktif.`)) return;
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
    <div className="flex w-[300px] shrink-0 flex-col border-l border-[#2c2c31] bg-[#1c1c1f]">
      <div className="flex overflow-x-auto border-b border-[#2c2c31] bg-[#161618] text-[10px]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            className={clsx(
              "shrink-0 px-2.5 py-2",
              tab === t.id
                ? "bg-[#232327] font-semibold text-white shadow-[inset_0_-2px_0_#2f7cf6]"
                : "text-[#6e6e78] hover:text-white",
            )}
          >
            {t.label}
            {t.id === "adjust" && adjustments.length > 0 ? ` ${adjustments.length}` : ""}
            {t.id === "filter" && filters.length > 0 ? ` ${filters.length}` : ""}
            {t.id === "history" && history.length > 0 ? ` ${history.length}` : ""}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
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
                className="avero-btn-primary flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white"
              >
                <Plus size={13} /> Layer
              </button>
              <button
                onClick={() => activeLayerId && removeLayer(activeLayerId)}
                disabled={layers.length <= 1}
                title="Hapus layer"
                className="flex items-center gap-1 rounded-md bg-[#232327] px-2 py-1 text-[11px] text-white disabled:opacity-40"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => activeLayerId && mergeDown(activeLayerId)}
                disabled={layers.length <= 1}
                title="Merge down"
                className="rounded-md bg-[#232327] px-2 py-1 text-white disabled:opacity-40"
              >
                <ArrowDownToLine size={13} />
              </button>
              <button
                onClick={flattenImage}
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

            <div className="p-2">
              {[...layers].reverse().map((l) => {
                const active = l.id === activeLayerId;
                return (
                  <div
                    key={l.id}
                    onClick={() => setActiveLayer(l.id)}
                    className={clsx(
                      "mb-1.5 rounded-md border p-2",
                      active ? "border-[#2f7cf6] bg-[#232327]" : "border-[#2c2c31] bg-[#161618]",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(l.id, { visible: !l.visible });
                        }}
                        className="text-[#a7a7b0] hover:text-white"
                      >
                        {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <span className="flex-1 truncate text-[12px] font-medium text-white">
                        {l.name} <span className="text-[9px] text-[#6e6e78]">{l.kind}</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateLayer(l.id, { locked: !l.locked });
                        }}
                        className={clsx(
                          l.locked ? "text-[#d9a441]" : "text-[#a7a7b0] hover:text-white",
                        )}
                      >
                        <Lock size={13} />
                      </button>
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
                        onChange={(e) => updateLayer(l.id, { blendMode: e.target.value as any })}
                        className="rounded border border-[#2c2c31] bg-[#161618] px-1 py-0.5 text-[10px] text-white"
                      >
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                        <option value="difference">Diff</option>
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
                          title="Duplikat layer"
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
              <h4 className="avero-micro mb-1.5">Brush</h4>
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
            <TransformPanel />
          </div>
        )}

        {tab === "select" && <SelectionPanel />}
        {tab === "mask" && <MaskPanel />}
        {tab === "adjust" && <AdjustPanel />}
        {tab === "filter" && <FilterPanel />}
        {tab === "text" && <TextShapePanel />}
        {tab === "color" && <ColorPanel />}
        {tab === "raw" && <RawPanel />}
        {tab === "ai" && <AiPanel />}
        {tab === "batch" && <BatchPanel />}
        {tab === "git" && <GitPanel />}
        {tab === "art" && <ArtboardPanel />}
        {tab === "plugin" && <PluginPanel />}
        {tab === "mockup" && <MockupPanel />}

        {tab === "history" && (
          <div className="p-2 text-[12px]">
            {history.length === 0 && (
              <div className="p-3 text-center text-[#6e6e78]">Belum ada history.</div>
            )}
            {[...history].reverse().map((h) => (
              <div key={h.id} className="mb-1 rounded bg-[#232327] px-2 py-1.5">
                <div className="font-medium text-white">{h.label}</div>
                <div className="font-mono text-[10px] text-[#6e6e78]">
                  {new Date(h.time).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {future.length > 0 && (
              <div className="p-2 text-[11px] text-[#6e6e78]">{future.length} redo tersedia</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
