import { useProStore, type AdjustmentType } from "../stores/useProStore";
import { useAutomationStore } from "../stores/useAutomationStore";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

const addable: { id: AdjustmentType; label: string }[] = [
  { id: "brightnessContrast", label: "Brightness" },
  { id: "levels", label: "Levels" },
  { id: "curves", label: "Curves" },
  { id: "exposure", label: "Exposure" },
  { id: "hueSaturation", label: "HSL" },
  { id: "vibrance", label: "Vibrance" },
  { id: "colorBalance", label: "Balance" },
  { id: "selectiveColor", label: "Selective" },
  { id: "shadowsHighlights", label: "Sh/Hi" },
  { id: "photoFilter", label: "PhotoFilter" },
  { id: "channelMixer", label: "Mixer" },
  { id: "gradientMap", label: "GradMap" },
  { id: "colorLookup", label: "LUT" },
  { id: "blackWhite", label: "B/W" },
  { id: "autoContrast", label: "Auto" },
  { id: "invert", label: "Invert" },
  { id: "threshold", label: "Threshold" },
  { id: "posterize", label: "Posterize" },
];

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-0.5 flex justify-between text-[11px] text-[#a0a0a0]">
        {label} <span className="font-mono text-white">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function AdjustPanel() {
  const adjustments = useProStore((s) => s.adjustments);
  const addAdjustment = useProStore((s) => s.addAdjustment);
  const updateAdjustment = useProStore((s) => s.updateAdjustment);
  const updateAdjustmentParams = useProStore((s) => s.updateAdjustmentParams);
  const removeAdjustment = useProStore((s) => s.removeAdjustment);
  const moveAdjustment = useProStore((s) => s.moveAdjustment);

  return (
    <div className="space-y-2 p-2 text-[12px]">
      <div className="flex flex-wrap gap-1">
        {addable.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              addAdjustment(a.id);
              useAutomationStore
                .getState()
                .pushStep(`Add ${a.label}`, { type: "adjustment/add", payload: { kind: a.id } });
            }}
            className="flex items-center gap-1 rounded bg-[#0a84ff] px-2 py-1 text-[10px] text-white hover:bg-[#0070e0]"
          >
            <Plus size={11} /> {a.label}
          </button>
        ))}
      </div>
      {adjustments.length === 0 && (
        <div className="rounded border border-dashed border-[#3e3e42] p-3 text-center text-[11px] text-[#a0a0a0]">
          Belum ada adjustment. Tambahkan Brightness atau Levels. Semua non-destructive dan bisa di
          reorder.
        </div>
      )}
      {[...adjustments].reverse().map((a) => (
        <div key={a.id} className="rounded-md border border-[#3e3e42] bg-[#2a2a2a] p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={a.enabled}
              onChange={(e) => updateAdjustment(a.id, { enabled: e.target.checked })}
            />
            <span className="flex-1 font-medium text-white">{a.name}</span>
            <button
              onClick={() => moveAdjustment(a.id, 1)}
              className="rounded p-1 hover:bg-[#3e3e42]"
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={() => moveAdjustment(a.id, -1)}
              className="rounded p-1 hover:bg-[#3e3e42]"
            >
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => removeAdjustment(a.id)}
              className="rounded p-1 text-red-300 hover:bg-[#3e3e42]"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {a.type === "brightnessContrast" && (
              <>
                <Slider
                  label="Brightness"
                  value={a.params.brightness ?? 0}
                  min={-100}
                  max={100}
                  onChange={(v) => updateAdjustmentParams(a.id, { brightness: v })}
                />
                <Slider
                  label="Contrast"
                  value={a.params.contrast ?? 0}
                  min={-100}
                  max={100}
                  onChange={(v) => updateAdjustmentParams(a.id, { contrast: v })}
                />
              </>
            )}
            {a.type === "levels" && (
              <>
                <Slider
                  label="In black"
                  value={a.params.inBlack ?? 0}
                  min={0}
                  max={200}
                  onChange={(v) => updateAdjustmentParams(a.id, { inBlack: v })}
                />
                <Slider
                  label="In white"
                  value={a.params.inWhite ?? 255}
                  min={55}
                  max={255}
                  onChange={(v) => updateAdjustmentParams(a.id, { inWhite: v })}
                />
                <Slider
                  label="Gamma"
                  value={a.params.gamma ?? 1}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(v) => updateAdjustmentParams(a.id, { gamma: v })}
                />
              </>
            )}
            {a.type === "curves" && (
              <>
                <Slider
                  label="Lift"
                  value={a.params.lift ?? 0}
                  min={-60}
                  max={60}
                  onChange={(v) => updateAdjustmentParams(a.id, { lift: v })}
                />
                <Slider
                  label="Gain"
                  value={a.params.gain ?? 0}
                  min={-60}
                  max={60}
                  onChange={(v) => updateAdjustmentParams(a.id, { gain: v })}
                />
              </>
            )}
            {a.type === "exposure" && (
              <Slider
                label="Exposure EV"
                value={a.params.exposure ?? 0}
                min={-4}
                max={4}
                step={0.1}
                onChange={(v) => updateAdjustmentParams(a.id, { exposure: v })}
              />
            )}
            {a.type === "hueSaturation" && (
              <>
                <Slider
                  label="Hue"
                  value={a.params.hue ?? 0}
                  min={-180}
                  max={180}
                  onChange={(v) => updateAdjustmentParams(a.id, { hue: v })}
                />
                <Slider
                  label="Saturation"
                  value={a.params.saturation ?? 0}
                  min={-100}
                  max={100}
                  onChange={(v) => updateAdjustmentParams(a.id, { saturation: v })}
                />
                <Slider
                  label="Lightness"
                  value={a.params.lightness ?? 0}
                  min={-100}
                  max={100}
                  onChange={(v) => updateAdjustmentParams(a.id, { lightness: v })}
                />
              </>
            )}
            {a.type === "threshold" && (
              <Slider
                label="Level"
                value={a.params.level ?? 128}
                min={0}
                max={255}
                onChange={(v) => updateAdjustmentParams(a.id, { level: v })}
              />
            )}
            {a.type === "posterize" && (
              <Slider
                label="Levels"
                value={a.params.levels ?? 4}
                min={2}
                max={12}
                onChange={(v) => updateAdjustmentParams(a.id, { levels: v })}
              />
            )}
            {(a.type === "invert" || a.type === "blackWhite" || a.type === "autoContrast") && (
              <div className="text-[10px] text-[#a0a0a0]">
                Tanpa parameter, toggle enable untuk preview.
              </div>
            )}
            {a.type === "vibrance" && (
              <>
                <Slider label="Vibrance" value={a.params.vibrance ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { vibrance: v })} />
                <Slider label="Saturation" value={a.params.saturation ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { saturation: v })} />
              </>
            )}
            {a.type === "colorBalance" && (
              <>
                <Slider label="Cyan-Red" value={a.params.cyanRed ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { cyanRed: v })} />
                <Slider label="Magenta-Green" value={a.params.magentaGreen ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { magentaGreen: v })} />
                <Slider label="Yellow-Blue" value={a.params.yellowBlue ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { yellowBlue: v })} />
              </>
            )}
            {a.type === "selectiveColor" && (
              <>
                <Slider label="Reds" value={a.params.reds ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { reds: v })} />
                <Slider label="Yellows" value={a.params.yellows ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { yellows: v })} />
                <Slider label="Blues" value={a.params.blues ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { blues: v })} />
              </>
            )}
            {a.type === "shadowsHighlights" && (
              <>
                <Slider label="Shadows" value={a.params.shadows ?? 25} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { shadows: v })} />
                <Slider label="Highlights" value={a.params.highlights ?? 25} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { highlights: v })} />
              </>
            )}
            {a.type === "photoFilter" && (
              <>
                <Slider label="Warmth" value={a.params.warmth ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { warmth: v })} />
                <Slider label="Density" value={a.params.density ?? 25} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { density: v })} />
              </>
            )}
            {a.type === "channelMixer" && (
              <Slider label="Red mix" value={a.params.red ?? 100} min={0} max={200} onChange={(v) => updateAdjustmentParams(a.id, { red: v })} />
            )}
            {a.type === "gradientMap" && (
              <Slider label="Highlights" value={a.params.highlights ?? 100} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { highlights: v })} />
            )}
            {a.type === "colorLookup" && (
              <>
                <Slider label="Strength" value={a.params.strength ?? 50} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { strength: v })} />
                <Slider label="Tone" value={a.params.tone ?? 0} min={-50} max={50} onChange={(v) => updateAdjustmentParams(a.id, { tone: v })} />
              </>
            )}
            <Slider
              label="Opacity"
              value={a.opacity}
              min={0}
              max={100}
              onChange={(v) => updateAdjustment(a.id, { opacity: v })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
