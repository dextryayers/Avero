import { useEffect, useState } from "react";
import { useProStore, type FilterType } from "../stores/useProStore";
import { useAutomationStore } from "../stores/useAutomationStore";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { nativeInfo, nativeProcessCanvas, isTauri, type NativeInfo } from "../io/nativeEngine";
import { ChevronDown, ChevronUp, Cpu, Plus, Trash2 } from "lucide-react";

const addable: { id: FilterType; label: string }[] = [
  { id: "gaussianBlur", label: "Gaussian" },
  { id: "motionBlur", label: "Motion" },
  { id: "sharpen", label: "Sharpen" },
  { id: "unsharpMask", label: "Unsharp" },
  { id: "highPass", label: "HighPass" },
  { id: "reduceNoise", label: "Denoise" },
  { id: "filmGrain", label: "Grain" },
  { id: "vignette", label: "Vignette" },
  { id: "tiltShift", label: "TiltShift" },
  { id: "halftone", label: "Halftone" },
  { id: "oilPaintLite", label: "OilPaint" },
  { id: "chromaticAberration", label: "Chroma" },
  { id: "pixelate", label: "Pixelate" },
  { id: "emboss", label: "Emboss" },
  { id: "findEdges", label: "Edges" },
];

function Row({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="flex justify-between text-[11px] text-[#a7a7b0]">
        {label} <span className="font-mono text-white">{value}</span>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

export default function FilterPanel() {
  const filters = useProStore((s) => s.filters);
  const addFilter = useProStore((s) => s.addFilter);
  const updateFilter = useProStore((s) => s.updateFilter);
  const updateFilterParams = useProStore((s) => s.updateFilterParams);
  const removeFilter = useProStore((s) => s.removeFilter);
  const moveFilter = useProStore((s) => s.moveFilter);
  const [nat, setNat] = useState<NativeInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo()
      .then(setNat)
      .catch(() => setNat(null));
  }, []);

  async function runNative(kind: "boxBlur" | "sharpen" | "unsharp" | "emboss" | "motionBlur") {
    if (busy || !isTauri()) return;
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setBusy(true);
    try {
      const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
      const filter =
        kind === "boxBlur"
          ? { op: "boxBlur" as const, radius: 4 }
          : kind === "sharpen"
            ? { op: "sharpen" as const, amount: 1.2 }
            : kind === "unsharp"
              ? { op: "unsharp" as const, amount: 1.5, radius: 2 }
              : kind === "emboss"
                ? { op: "emboss" as const }
                : { op: "motionBlur" as const, radius: 12, angle: 0 };
      await nativeProcessCanvas(c, "filter", filter);
      st.markDirty();
      useProStore.getState().bumpHistogram();
      useAutomationStore
        .getState()
        .pushStep(`Native ${kind}`, { type: "filter/add", payload: { kind } });
    } catch (e) {
      alert(`Native C++ gagal: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 p-2 text-[12px]">
      <div className="rounded-md border border-[#2c2c31] bg-[#161618] p-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-white">
          <Cpu size={12} className="text-[#8fb6f5]" /> Native engine
          <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">
            {nat ? `${nat.c_engine} / ${nat.cpp_engine}` : isTauri() ? "memuat..." : "web only"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["boxBlur", "BoxBlur C++"],
              ["sharpen", "Sharpen C++"],
              ["unsharp", "Unsharp C++"],
              ["emboss", "Emboss C++"],
              ["motionBlur", "Motion C++"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              disabled={!isTauri() || busy}
              onClick={() => runNative(k)}
              className="flex items-center gap-1 rounded-md border border-[#2c2c31] bg-[#232327] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#2c2c31] disabled:opacity-40"
            >
              {busy ? "..." : label}
            </button>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-[#6e6e78]">
          Terapkan langsung ke layer aktif. C untuk op pixel, C++ untuk filter konvolusi.
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {addable.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              addFilter(f.id);
              useAutomationStore
                .getState()
                .pushStep(`Add ${f.label}`, { type: "filter/add", payload: { kind: f.id } });
            }}
            className="flex items-center gap-1 rounded-md bg-[#232327] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#2c2c31]"
          >
            <Plus size={11} /> {f.label}
          </button>
        ))}
      </div>
      {filters.length === 0 && (
        <div className="rounded-md border border-dashed border-[#2c2c31] p-3 text-center text-[11px] text-[#6e6e78]">
          Belum ada filter. Blur memakai akselerasi kanvas, sharpen memakai konvolusi.
        </div>
      )}
      {[...filters].reverse().map((f) => (
        <div key={f.id} className="rounded-md border border-[#2c2c31] bg-[#161618] p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => updateFilter(f.id, { enabled: e.target.checked })}
              className="accent-[#2f7cf6]"
            />
            <span className="flex-1 font-medium text-white">{f.name}</span>
            <button onClick={() => moveFilter(f.id, 1)} className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
              <ChevronUp size={12} />
            </button>
            <button onClick={() => moveFilter(f.id, -1)} className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => removeFilter(f.id)}
              className="rounded p-1 text-[#e5534b] hover:bg-[#232327]"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {(f.type === "gaussianBlur" || f.type === "boxBlur") && (
              <Row label="Radius" value={f.params.radius ?? 4} min={0} max={32} onChange={(v) => updateFilterParams(f.id, { radius: v })} />
            )}
            {f.type === "motionBlur" && (
              <>
                <Row label="Radius" value={f.params.radius ?? 8} min={1} max={32} onChange={(v) => updateFilterParams(f.id, { radius: v })} />
                <Row label="Angle" value={f.params.angle ?? 0} min={0} max={180} onChange={(v) => updateFilterParams(f.id, { angle: v })} />
              </>
            )}
            {f.type === "sharpen" && (
              <Row label="Amount" value={f.params.amount ?? 60} min={0} max={200} onChange={(v) => updateFilterParams(f.id, { amount: v })} />
            )}
            {f.type === "unsharpMask" && (
              <>
                <Row label="Amount" value={f.params.amount ?? 70} min={0} max={200} onChange={(v) => updateFilterParams(f.id, { amount: v })} />
                <Row label="Radius" value={f.params.radius ?? 2} min={1} max={10} onChange={(v) => updateFilterParams(f.id, { radius: v })} />
              </>
            )}
            {f.type === "highPass" && (
              <Row label="Radius" value={f.params.radius ?? 4} min={1} max={20} onChange={(v) => updateFilterParams(f.id, { radius: v })} />
            )}
            {f.type === "reduceNoise" && (
              <Row label="Strength" value={f.params.strength ?? 40} min={0} max={120} onChange={(v) => updateFilterParams(f.id, { strength: v })} />
            )}
            {f.type === "noise" && (
              <Row label="Amount" value={f.params.amount ?? 8} min={0} max={48} onChange={(v) => updateFilterParams(f.id, { amount: v })} />
            )}
            {f.type === "filmGrain" && (
              <Row label="Amount" value={f.params.amount ?? 18} min={0} max={60} onChange={(v) => updateFilterParams(f.id, { amount: v })} />
            )}
            {f.type === "pixelate" && (
              <Row label="Size" value={f.params.size ?? 8} min={2} max={48} onChange={(v) => updateFilterParams(f.id, { size: v })} />
            )}
            {f.type === "halftone" && (
              <Row label="Size" value={f.params.size ?? 6} min={3} max={20} onChange={(v) => updateFilterParams(f.id, { size: v })} />
            )}
            {f.type === "oilPaintLite" && (
              <Row label="Radius" value={f.params.radius ?? 3} min={1} max={12} onChange={(v) => updateFilterParams(f.id, { radius: v })} />
            )}
            {f.type === "tiltShift" && (
              <Row label="Blur" value={f.params.blur ?? 8} min={1} max={24} onChange={(v) => updateFilterParams(f.id, { blur: v })} />
            )}
            {f.type === "vignette" && (
              <Row label="Amount" value={f.params.amount ?? 45} min={0} max={100} onChange={(v) => updateFilterParams(f.id, { amount: v })} />
            )}
            {f.type === "chromaticAberration" && (
              <Row label="Amount" value={f.params.amount ?? 3} min={0} max={12} onChange={(v) => updateFilterParams(f.id, { amount: v })} />
            )}
            {(f.type === "emboss" || f.type === "findEdges") && (
              <div className="text-[10px] text-[#6e6e78]">Tanpa parameter. Atur via Opacity.</div>
            )}
            <Row label="Opacity" value={f.opacity} min={0} max={100} onChange={(v) => updateFilter(f.id, { opacity: v })} />
          </div>
        </div>
      ))}
    </div>
  );
}
