import { useEffect, useState } from "react";
import { useProStore, type AdjustmentType } from "../stores/useProStore";
import { useAutomationStore } from "../stores/useAutomationStore";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { isTauri, nativeProcessCanvas, type NativeInfo, nativeInfo } from "../io/nativeEngine";
import { ChevronDown, ChevronUp, Cpu, Plus, Trash2 } from "lucide-react";

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
      <label className="mb-0.5 flex justify-between text-[11px] text-[#a7a7b0]">
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
  const [nat, setNat] = useState<NativeInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo()
      .then(setNat)
      .catch(() => setNat(null));
  }, []);

  async function runNativeOp(kind: "gray" | "invert" | "brightness" | "contrast" | "desaturate") {
    if (busy || !isTauri()) return;
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setBusy(kind);
    try {
      const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
      const op =
        kind === "gray"
          ? { op: "gray" as const }
          : kind === "invert"
            ? { op: "invert" as const }
            : kind === "brightness"
              ? { op: "brightness" as const, amount: 20 }
              : kind === "contrast"
                ? { op: "contrast" as const, amount: 25 }
                : { op: "desaturate" as const, amount: 80 };
      await nativeProcessCanvas(c, "op", op);
      st.markDirty();
      useProStore.getState().bumpHistogram();
      useAutomationStore
        .getState()
        .pushStep(`Native ${kind}`, { type: "adjustment/add", payload: { kind } });
    } catch (e) {
      alert(`Native C gagal: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 p-2 text-[12px]">
      <div className="rounded-md border border-[#2c2c31] bg-[#161618] p-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-white">
          <Cpu size={12} className="text-[#8fb6f5]" /> Native C ops
          <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">
            {nat ? nat.c_engine : isTauri() ? "memuat..." : "web only"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["gray", "Gray C"],
              ["invert", "Invert C"],
              ["brightness", "Brightness C"],
              ["contrast", "Contrast C"],
              ["desaturate", "Desat C"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              disabled={!isTauri() || busy !== null}
              onClick={() => runNativeOp(k)}
              className="flex items-center gap-1 rounded-md border border-[#2c2c31] bg-[#232327] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#2c2c31] disabled:opacity-40"
            >
              {busy === k ? "..." : label}
            </button>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-[#6e6e78]">
          In-place ke layer aktif lewat FFI C. Berbeda dengan stack adjustment non-destruktif.
        </div>
      </div>
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
            className="avero-btn-primary flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white"
          >
            <Plus size={11} /> {a.label}
          </button>
        ))}
      </div>
      {adjustments.length === 0 && (
        <div className="rounded-md border border-dashed border-[#2c2c31] p-3 text-center text-[11px] text-[#6e6e78]">
          Belum ada adjustment. Tambahkan Brightness atau Levels. Semua non-destruktif dan bisa
          disusun ulang.
        </div>
      )}
      {[...adjustments].reverse().map((a) => (
        <div key={a.id} className="rounded-md border border-[#2c2c31] bg-[#161618] p-2">
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={a.enabled}
              onChange={(e) => updateAdjustment(a.id, { enabled: e.target.checked })}
              className="accent-[#2f7cf6]"
            />
            <span className="flex-1 font-medium text-white">{a.name}</span>
            <button
              onClick={() => moveAdjustment(a.id, 1)}
              className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
            >
              <ChevronUp size={12} />
            </button>
            <button
              onClick={() => moveAdjustment(a.id, -1)}
              className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
            >
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => removeAdjustment(a.id)}
              className="rounded p-1 text-[#e5534b] hover:bg-[#232327]"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {a.type === "brightnessContrast" && (
              <>
                <Slider label="Brightness" value={a.params.brightness ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { brightness: v })} />
                <Slider label="Contrast" value={a.params.contrast ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { contrast: v })} />
              </>
            )}
            {a.type === "levels" && (
              <>
                <Slider label="In black" value={a.params.inBlack ?? 0} min={0} max={200} onChange={(v) => updateAdjustmentParams(a.id, { inBlack: v })} />
                <Slider label="In white" value={a.params.inWhite ?? 255} min={55} max={255} onChange={(v) => updateAdjustmentParams(a.id, { inWhite: v })} />
                <Slider label="Gamma" value={a.params.gamma ?? 1} min={0.1} max={3} step={0.05} onChange={(v) => updateAdjustmentParams(a.id, { gamma: v })} />
              </>
            )}
            {a.type === "curves" && (
              <>
                <Slider label="Lift" value={a.params.lift ?? 0} min={-60} max={60} onChange={(v) => updateAdjustmentParams(a.id, { lift: v })} />
                <Slider label="Gain" value={a.params.gain ?? 0} min={-60} max={60} onChange={(v) => updateAdjustmentParams(a.id, { gain: v })} />
              </>
            )}
            {a.type === "exposure" && (
              <Slider label="Exposure EV" value={a.params.exposure ?? 0} min={-4} max={4} step={0.1} onChange={(v) => updateAdjustmentParams(a.id, { exposure: v })} />
            )}
            {a.type === "hueSaturation" && (
              <>
                <Slider label="Hue" value={a.params.hue ?? 0} min={-180} max={180} onChange={(v) => updateAdjustmentParams(a.id, { hue: v })} />
                <Slider label="Saturation" value={a.params.saturation ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { saturation: v })} />
                <Slider label="Lightness" value={a.params.lightness ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { lightness: v })} />
              </>
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
            {a.type === "threshold" && (
              <Slider label="Level" value={a.params.level ?? 128} min={0} max={255} onChange={(v) => updateAdjustmentParams(a.id, { level: v })} />
            )}
            {a.type === "posterize" && (
              <Slider label="Levels" value={a.params.levels ?? 4} min={2} max={12} onChange={(v) => updateAdjustmentParams(a.id, { levels: v })} />
            )}
            {(a.type === "invert" || a.type === "blackWhite" || a.type === "autoContrast") && (
              <div className="text-[10px] text-[#6e6e78]">
                Tanpa parameter. Aktifkan toggle untuk pratinjau.
              </div>
            )}
            <Slider label="Opacity" value={a.opacity} min={0} max={100} onChange={(v) => updateAdjustment(a.id, { opacity: v })} />
          </div>
        </div>
      ))}
    </div>
  );
}
