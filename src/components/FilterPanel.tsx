import { useProStore, type FilterType } from "../stores/useProStore";
import { useAutomationStore } from "../stores/useAutomationStore";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

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

export default function FilterPanel() {
  const filters = useProStore((s) => s.filters);
  const addFilter = useProStore((s) => s.addFilter);
  const updateFilter = useProStore((s) => s.updateFilter);
  const updateFilterParams = useProStore((s) => s.updateFilterParams);
  const removeFilter = useProStore((s) => s.removeFilter);
  const moveFilter = useProStore((s) => s.moveFilter);

  return (
    <div className="space-y-2 p-2 text-[12px]">
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
            className="flex items-center gap-1 rounded bg-[#7a4fd0] px-2 py-1 text-[10px] text-white hover:bg-[#6840b8]"
          >
            <Plus size={11} /> {f.label}
          </button>
        ))}
      </div>
      {filters.length === 0 && (
        <div className="rounded border border-dashed border-[#3e3e42] p-3 text-center text-[11px] text-[#a0a0a0]">
          Belum ada filter. Blur jalan GPU via canvas filter, sharpen via convolution.
        </div>
      )}
      {[...filters].reverse().map((f) => (
        <div key={f.id} className="rounded-md border border-[#3e3e42] bg-[#2a2a2a] p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => updateFilter(f.id, { enabled: e.target.checked })}
            />
            <span className="flex-1 font-medium text-white">{f.name}</span>
            <button onClick={() => moveFilter(f.id, 1)} className="rounded p-1 hover:bg-[#3e3e42]">
              <ChevronUp size={12} />
            </button>
            <button onClick={() => moveFilter(f.id, -1)} className="rounded p-1 hover:bg-[#3e3e42]">
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => removeFilter(f.id)}
              className="rounded p-1 text-red-300 hover:bg-[#3e3e42]"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {(f.type === "gaussianBlur" || f.type === "boxBlur") && (
              <label className="mb-0.5 flex justify-between text-[11px] text-[#a0a0a0]">
                Radius <span className="font-mono text-white">{f.params.radius}px</span>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={f.params.radius ?? 4}
                  onChange={(e) => updateFilterParams(f.id, { radius: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            )}
            {f.type === "motionBlur" && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Radius {f.params.radius}</label>
                <input
                  type="range"
                  min={1}
                  max={32}
                  value={f.params.radius ?? 8}
                  onChange={(e) => updateFilterParams(f.id, { radius: Number(e.target.value) })}
                  className="w-full"
                />
                <label className="text-[11px] text-[#a0a0a0]">Angle {f.params.angle}°</label>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={f.params.angle ?? 0}
                  onChange={(e) => updateFilterParams(f.id, { angle: Number(e.target.value) })}
                  className="w-full"
                />
              </>
            )}
            {f.type === "sharpen" && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Amount {f.params.amount}%</label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={f.params.amount ?? 60}
                  onChange={(e) => updateFilterParams(f.id, { amount: Number(e.target.value) })}
                  className="w-full"
                />
              </>
            )}
            {f.type === "noise" && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Amount {f.params.amount}</label>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={f.params.amount ?? 8}
                  onChange={(e) => updateFilterParams(f.id, { amount: Number(e.target.value) })}
                  className="w-full"
                />
              </>
            )}
            {f.type === "pixelate" && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Size {f.params.size}px</label>
                <input
                  type="range"
                  min={2}
                  max={48}
                  value={f.params.size ?? 8}
                  onChange={(e) => updateFilterParams(f.id, { size: Number(e.target.value) })}
                  className="w-full"
                />
              </>
            )}
            {(f.type === "unsharpMask") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Amount {f.params.amount}%</label>
                <input type="range" min={0} max={200} value={f.params.amount ?? 70} onChange={(e) => updateFilterParams(f.id, { amount: Number(e.target.value) })} className="w-full" />
                <label className="text-[11px] text-[#a0a0a0]">Radius {f.params.radius}px</label>
                <input type="range" min={1} max={10} value={f.params.radius ?? 2} onChange={(e) => updateFilterParams(f.id, { radius: Number(e.target.value) })} className="w-full" />
              </>
            )}
            {(f.type === "highPass" || f.type === "reduceNoise" || f.type === "oilPaintLite") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Strength {f.params.radius ?? f.params.strength ?? f.params.intensity ?? 4}</label>
                <input type="range" min={1} max={20} value={f.params.radius ?? f.params.strength ?? f.params.intensity ?? 4} onChange={(e) => {
                  if (f.type === "highPass") updateFilterParams(f.id, { radius: Number(e.target.value) });
                  else if (f.type === "reduceNoise") updateFilterParams(f.id, { strength: Number(e.target.value) * 8 });
                  else updateFilterParams(f.id, { radius: Number(e.target.value) });
                }} className="w-full" />
              </>
            )}
            {(f.type === "filmGrain") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Amount {f.params.amount}</label>
                <input type="range" min={0} max={60} value={f.params.amount ?? 18} onChange={(e) => updateFilterParams(f.id, { amount: Number(e.target.value) })} className="w-full" />
              </>
            )}
            {(f.type === "vignette") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Amount {f.params.amount}%</label>
                <input type="range" min={0} max={100} value={f.params.amount ?? 45} onChange={(e) => updateFilterParams(f.id, { amount: Number(e.target.value) })} className="w-full" />
              </>
            )}
            {(f.type === "tiltShift") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Blur {f.params.blur}px</label>
                <input type="range" min={1} max={24} value={f.params.blur ?? 8} onChange={(e) => updateFilterParams(f.id, { blur: Number(e.target.value) })} className="w-full" />
              </>
            )}
            {(f.type === "halftone") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Size {f.params.size}px</label>
                <input type="range" min={3} max={20} value={f.params.size ?? 6} onChange={(e) => updateFilterParams(f.id, { size: Number(e.target.value) })} className="w-full" />
              </>
            )}
            {(f.type === "chromaticAberration") && (
              <>
                <label className="text-[11px] text-[#a0a0a0]">Amount {f.params.amount}px</label>
                <input type="range" min={0} max={12} value={f.params.amount ?? 3} onChange={(e) => updateFilterParams(f.id, { amount: Number(e.target.value) })} className="w-full" />
              </>
            )}
            {(f.type === "emboss" || f.type === "findEdges") && (
              <div className="text-[10px] text-[#8a94a6]">Tanpa parameter berat — atur via Opacity.</div>
            )}
            <label className="text-[11px] text-[#a0a0a0]">Opacity {f.opacity}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={f.opacity}
              onChange={(e) => updateFilter(f.id, { opacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
