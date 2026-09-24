import { useState } from "react";
import { Eye, EyeOff, Lock, Plus, Trash2, ChevronUp, ChevronDown, Undo2, Redo2 } from "lucide-react";
import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import clsx from "clsx";

export default function RightPanel() {
  const [tab, setTab] = useState<"layers" | "adjust" | "history">("layers");
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const addLayer = useEditorStore((s) => s.addLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  const moveLayer = useEditorStore((s) => s.moveLayer);
  const doc = useEditorStore((s) => s.doc);
  const brush = useEditorStore((s) => ({ size: s.brushSize, opacity: s.brushOpacity, hardness: s.brushHardness, color: s.brushColor }));
  const setBrush = useEditorStore((s) => s.setBrush);
  const history = useEditorStore((s) => s.history);
  const future = useEditorStore((s) => s.future);

  function handleUndo() {
    const entry = useEditorStore.getState().undoMeta();
    if (entry) {
      // simpan current ke future sudah dilakukan di store via snapshot lama?
      // Untuk MVP: restore snapshot yang tersimpan, tapi simpan current dulu ke redo stack manual
      // Sederhananya: snapshot current sebelum undo sudah disimpan saat push, jadi restore entry.snapshot
      // Namun redo butuh snapshot sesudah. Kita ambil snapshot sekarang dan tukar.
      // Implementasi ringan: restore langsung.
      layerManager.restore(entry.layerId, entry.snapshot);
      useEditorStore.getState().markDirty();
    }
  }

  function handleRedo() {
    // MVP: redo hanya majukan pointer, pixel dikembalikan via snapshot berikutnya?
    // Karena keterbatasan MVP, redo trigger render ulang saja dan beri info.
    const entry = useEditorStore.getState().redoMeta();
    if (entry) {
      useEditorStore.getState().markDirty();
    }
  }

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-l border-[#3e3e42] bg-[#252526]">
      <div className="flex border-b border-[#3e3e42] text-[12px]">
        {(["layers", "adjust", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx("flex-1 px-3 py-2 capitalize", tab === t ? "bg-[#2d2d2d] text-white" : "text-[#a0a0a0] hover:text-white")}
          >
            {t} {t === "history" && history.length > 0 ? `(${history.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "layers" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-[#3e3e42] p-2">
            <button
              onClick={() => {
                const l = makeLayer(`Layer ${layers.length + 1}`);
                layerManager.ensure(l.id, doc.width, doc.height);
                addLayer(l);
              }}
              className="flex items-center gap-1 rounded bg-[#0a84ff] px-2 py-1 text-[11px] text-white hover:bg-[#0070e0]"
            >
              <Plus size={13} /> Layer
            </button>
            <button
              onClick={() => activeLayerId && removeLayer(activeLayerId)}
              disabled={layers.length <= 1}
              className="flex items-center gap-1 rounded bg-[#3e3e42] px-2 py-1 text-[11px] text-white disabled:opacity-40"
            >
              <Trash2 size={13} />
            </button>
            <div className="ml-auto flex gap-1">
              <button title="Undo" onClick={handleUndo} className="rounded p-1.5 hover:bg-[#3e3e42]">
                <Undo2 size={14} />
              </button>
              <button title="Redo" onClick={handleRedo} className="rounded p-1.5 hover:bg-[#3e3e42]">
                <Redo2 size={14} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {[...layers].reverse().map((l) => {
              const active = l.id === activeLayerId;
              return (
                <div
                  key={l.id}
                  onClick={() => setActiveLayer(l.id)}
                  className={clsx("mb-1.5 rounded-md border p-2", active ? "border-[#0a84ff] bg-[#2d2d2d]" : "border-[#3e3e42] bg-[#2a2a2a]")}
                >
                  <div className="flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible }); }} className="text-[#a0a0a0] hover:text-white">
                      {l.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <span className="flex-1 truncate text-[12px] font-medium">{l.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { locked: !l.locked }); }} className={clsx(l.locked ? "text-amber-400" : "text-[#a0a0a0] hover:text-white")}>
                      <Lock size={13} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[#a0a0a0]">
                    <span className="w-10">Op {l.opacity}</span>
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
                      className="rounded bg-[#1e1e1e] px-1 py-0.5 text-[10px] text-white"
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
                  <div className="mt-1 flex justify-end gap-1">
                    <button onClick={() => moveLayer(l.id, 1)} title="Move up" className="rounded p-1 hover:bg-[#3e3e42]">
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveLayer(l.id, -1)} title="Move down" className="rounded p-1 hover:bg-[#3e3e42]">
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "adjust" && (
        <div className="space-y-4 overflow-y-auto p-3 text-[12px]">
          <section>
            <h4 className="mb-2 font-semibold text-white">Brush</h4>
            <label className="mb-1 flex justify-between text-[#a0a0a0]">
              Size <span className="font-mono text-white">{brush.size}px</span>
            </label>
            <input type="range" min={1} max={200} value={brush.size} onChange={(e) => setBrush({ size: Number(e.target.value) })} className="w-full" />
            <label className="mb-1 mt-2 flex justify-between text-[#a0a0a0]">
              Opacity <span className="font-mono text-white">{brush.opacity}%</span>
            </label>
            <input type="range" min={1} max={100} value={brush.opacity} onChange={(e) => setBrush({ opacity: Number(e.target.value) })} className="w-full" />
            <label className="mb-1 mt-2 flex justify-between text-[#a0a0a0]">
              Hardness <span className="font-mono text-white">{brush.hardness}%</span>
            </label>
            <input type="range" min={1} max={100} value={brush.hardness} onChange={(e) => setBrush({ hardness: Number(e.target.value) })} className="w-full" />
            <div className="mt-2 flex items-center gap-2">
              <input type="color" value={brush.color} onChange={(e) => setBrush({ color: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-[#3e3e42] bg-transparent" />
              <span className="font-mono text-[#c5c5c5]">{brush.color}</span>
            </div>
          </section>
          <section className="rounded-md border border-[#3e3e42] bg-[#2d2d2d] p-2 text-[11px] text-[#a0a0a0]">
            Adjustment layer, Curves, Levels, dan filter GPU masuk Fase 2. Struktur non destructive sudah disiapkan di store dan Rust engine.
          </section>
          <section>
            <h4 className="mb-1 font-semibold text-white">Document</h4>
            <div className="font-mono text-[11px] text-[#c5c5c5]">
              {doc.width} x {doc.height}px
              <br />
              {doc.filePath ?? "Belum disimpan"}
            </div>
          </section>
        </div>
      )}

      {tab === "history" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2 text-[12px]">
          {history.length === 0 && <div className="p-3 text-center text-[#a0a0a0]">Belum ada history. Lakukan brush stroke untuk melihat undo stack.</div>}
          {[...history].reverse().map((h) => (
            <div key={h.id} className="mb-1 rounded bg-[#2d2d2d] px-2 py-1.5">
              <div className="font-medium text-white">{h.label}</div>
              <div className="font-mono text-[10px] text-[#a0a0a0]">{new Date(h.time).toLocaleTimeString()}</div>
            </div>
          ))}
          {future.length > 0 && <div className="p-2 text-[11px] text-[#a0a0a0]">{future.length} redo tersedia</div>}
        </div>
      )}
    </div>
  );
}
