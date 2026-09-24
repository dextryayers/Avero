import { useEffect, useState } from "react";
import { useProStore, type AdjustmentType } from "../stores/useProStore";
import { useAutomationStore } from "../stores/useAutomationStore";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import {
  isTauri,
  nativeInfo,
  nativePipelineCanvas,
  nativeProcessCanvas,
  type NativeInfo,
  type NativeOp,
} from "../io/nativeEngine";
import { ChevronDown, ChevronUp, Cpu, Layers, Plus, Trash2, Zap } from "lucide-react";

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
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#2f7cf6]" />
    </div>
  );
}

function NativeRow({
  label,
  desc,
  busy,
  onApply,
  children,
}: {
  label: string;
  desc: string;
  busy: boolean;
  onApply: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#2c2c31] bg-[#232327] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-white">{label}</div>
          <div className="text-[10px] leading-tight text-[#6e6e78]">{desc}</div>
        </div>
        <button
          disabled={busy}
          onClick={onApply}
          className="shrink-0 rounded-md bg-[#2f7cf6] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#3b8bff] disabled:opacity-40"
        >
          {busy ? "..." : "Apply"}
        </button>
      </div>
      {children && <div className="mt-2 space-y-1.5">{children}</div>}
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
  const [queue, setQueue] = useState<NativeOp[]>([]);
  // param state
  const [p, setP] = useState({
    brightness: 20,
    contrast: 25,
    threshold: 128,
    desat: 70,
    exposure: 1.0,
    gamma: 1.0,
    vibrance: 30,
    warmth: 20,
    levels: 4,
    sepia: 60,
    cr: 12,
    mg: 0,
    yb: 0,
    shadows: 30,
    highlights: 30,
    hue: 30,
    opacity: 100,
  });

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo().then(setNat).catch(() => setNat(null));
  }, []);

  async function runOp(op: NativeOp, label: string) {
    if (busy || !isTauri()) return;
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setBusy(label);
    try {
      const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
      await nativeProcessCanvas(c, "op", op);
      st.markDirty();
      useProStore.getState().bumpHistogram();
      useAutomationStore.getState().pushStep(`Native ${label}`, { type: "adjustment/add", payload: { kind: label } });
    } catch (e) {
      alert(`Native C gagal: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function runQueue() {
    if (queue.length === 0 || busy || !isTauri()) return;
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setBusy("pipeline");
    try {
      const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
      await nativePipelineCanvas(c, queue, []);
      st.markDirty();
      useProStore.getState().bumpHistogram();
      useAutomationStore.getState().pushStep(`Pipeline ${queue.length} ops`, { type: "pipeline/native", payload: { n: queue.length } });
      setQueue([]);
    } catch (e) {
      alert(`Pipeline gagal: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 p-2 text-[12px]">
      {/* Engine header - profesional */}
      <div className="avero-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[#2c2c31] bg-[#161618] px-3 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#2f7cf6] text-white"><Cpu size={14} /></span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold leading-none text-white">Native C engine v2</div>
            <div className="truncate font-mono text-[10px] text-[#6e6e78]">{nat ? `${nat.c_engine} ${nat.c_version} • ${nat.cpp_version}` : isTauri() ? "memuat engine..." : "web only (JS fallback)"}</div>
          </div>
          <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] ${nat?.ready ? "bg-[#232327] text-[#8fb6f5]" : "bg-[#2c2c31] text-[#6e6e78]"}`}>{nat?.ready ? "18 ops ready" : "offline"}</span>
        </div>
        <div className="px-3 py-2 text-[10px] leading-relaxed text-[#6e6e78]">
          Operasi in-place ke layer aktif via FFI C. Untuk pipeline batch gunakan antrean di bawah. Berbeda dengan adjustment stack non-destruktif.
        </div>
      </div>

      {/* Grup Dasar */}
      <div className="space-y-2">
        <div className="avero-micro flex items-center gap-1.5"><Layers size={11} /> Dasar</div>
        <div className="grid gap-2">
          <NativeRow label="Grayscale" desc="Luminance Rec.709" busy={busy === "gray"} onApply={() => runOp({ op: "gray" }, "gray")} />
          <NativeRow label="Invert" desc="255 - channel" busy={busy === "invert"} onApply={() => runOp({ op: "invert" }, "invert")} />
          <NativeRow label="Brightness" desc="geser -100..100" busy={busy === "brightness"} onApply={() => runOp({ op: "brightness", amount: p.brightness }, "brightness")}>
            <Slider label="Amount" value={p.brightness} min={-100} max={100} onChange={(v) => setP({ ...p, brightness: v })} />
          </NativeRow>
          <NativeRow label="Contrast" desc="factor sekitar 1.0" busy={busy === "contrast"} onApply={() => runOp({ op: "contrast", amount: p.contrast }, "contrast")}>
            <Slider label="Amount" value={p.contrast} min={-100} max={100} onChange={(v) => setP({ ...p, contrast: v })} />
          </NativeRow>
          <NativeRow label="Desaturate" desc="campur ke luma 0..100" busy={busy === "desat"} onApply={() => runOp({ op: "desaturate", amount: p.desat }, "desat")}>
            <Slider label="Amount" value={p.desat} min={0} max={100} onChange={(v) => setP({ ...p, desat: v })} />
          </NativeRow>
          <NativeRow label="Opacity" desc="alpha layer 0..100" busy={busy === "opacity"} onApply={() => runOp({ op: "opacity", opacity: p.opacity }, "opacity")}>
            <Slider label="Opacity" value={p.opacity} min={0} max={100} onChange={(v) => setP({ ...p, opacity: v })} />
          </NativeRow>
        </div>
      </div>

      {/* Grup Exposure */}
      <div className="space-y-2">
        <div className="avero-micro flex items-center gap-1.5"><Zap size={11} /> Exposure dan tone</div>
        <div className="grid gap-2">
          <NativeRow label="Exposure" desc="EV -6..6 (pow2)" busy={busy === "exposure"} onApply={() => runOp({ op: "exposure", ev: p.exposure }, "exposure")}>
            <Slider label="EV" value={p.exposure} min={-4} max={4} step={0.1} onChange={(v) => setP({ ...p, exposure: v })} />
          </NativeRow>
          <NativeRow label="Gamma" desc="koreksi 0.1..4" busy={busy === "gamma"} onApply={() => runOp({ op: "gamma", gamma: p.gamma }, "gamma")}>
            <Slider label="Gamma" value={p.gamma} min={0.1} max={4} step={0.05} onChange={(v) => setP({ ...p, gamma: v })} />
          </NativeRow>
          <NativeRow label="Shadows / Highlights" desc="angkat bayangan, tekan highlight" busy={busy === "shhi"} onApply={() => runOp({ op: "shadowsHighlights", shadows: p.shadows, highlights: p.highlights }, "shhi")}>
            <Slider label="Shadows" value={p.shadows} min={-100} max={100} onChange={(v) => setP({ ...p, shadows: v })} />
            <Slider label="Highlights" value={p.highlights} min={-100} max={100} onChange={(v) => setP({ ...p, highlights: v })} />
          </NativeRow>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!isTauri() || !!busy} onClick={() => runOp({ op: "autoLevels" }, "autoLevels")} className="rounded-md border border-[#2c2c31] bg-[#232327] py-2 text-[11px] font-semibold text-white hover:bg-[#2c2c31] disabled:opacity-40">Auto Levels (C)</button>
            <button disabled={!isTauri() || !!busy} onClick={() => runOp({ op: "autoContrast" }, "autoContrast")} className="rounded-md border border-[#2c2c31] bg-[#232327] py-2 text-[11px] font-semibold text-white hover:bg-[#2c2c31] disabled:opacity-40">Auto Contrast (C)</button>
          </div>
        </div>
      </div>

      {/* Grup Warna */}
      <div className="space-y-2">
        <div className="avero-micro">Warna kreatif</div>
        <div className="grid gap-2">
          <NativeRow label="Vibrance" desc="boost saturasi rendah" busy={busy === "vibrance"} onApply={() => runOp({ op: "vibrance", amount: p.vibrance }, "vibrance")}>
            <Slider label="Amount" value={p.vibrance} min={-100} max={100} onChange={(v) => setP({ ...p, vibrance: v })} />
          </NativeRow>
          <NativeRow label="Warmth" desc="hangat -100 dingin +100" busy={busy === "warmth"} onApply={() => runOp({ op: "warmth", warmth: p.warmth }, "warmth")}>
            <Slider label="Warmth" value={p.warmth} min={-100} max={100} onChange={(v) => setP({ ...p, warmth: v })} />
          </NativeRow>
          <NativeRow label="Color Balance" desc="Cyan-Red, Magenta-Green, Yellow-Blue" busy={busy === "balance"} onApply={() => runOp({ op: "colorBalance", cr: p.cr, mg: p.mg, yb: p.yb }, "balance")}>
            <Slider label="Cyan - Red" value={p.cr} min={-100} max={100} onChange={(v) => setP({ ...p, cr: v })} />
            <Slider label="Magenta - Green" value={p.mg} min={-100} max={100} onChange={(v) => setP({ ...p, mg: v })} />
            <Slider label="Yellow - Blue" value={p.yb} min={-100} max={100} onChange={(v) => setP({ ...p, yb: v })} />
          </NativeRow>
          <NativeRow label="Hue Shift" desc="putar hue 0..360" busy={busy === "hue"} onApply={() => runOp({ op: "hueShift", hueDeg: p.hue }, "hue")}>
            <Slider label="Hue" value={p.hue} min={0} max={360} onChange={(v) => setP({ ...p, hue: v })} />
          </NativeRow>
          <NativeRow label="Sepia" desc="campur 0..100" busy={busy === "sepia"} onApply={() => runOp({ op: "sepia", amount: p.sepia }, "sepia")}>
            <Slider label="Amount" value={p.sepia} min={0} max={100} onChange={(v) => setP({ ...p, sepia: v })} />
          </NativeRow>
          <NativeRow label="Posterize / Threshold" desc="reduksi level" busy={busy === "poster"} onApply={() => runOp({ op: "posterize", levels: p.levels }, "poster")}>
            <Slider label="Levels" value={p.levels} min={2} max={32} onChange={(v) => setP({ ...p, levels: v })} />
            <Slider label="Threshold" value={p.threshold} min={0} max={255} onChange={(v) => setP({ ...p, threshold: v })} />
            <div className="flex gap-1.5">
              <button disabled={!!busy} onClick={() => runOp({ op: "threshold", level: p.threshold }, "threshold")} className="flex-1 rounded bg-[#232327] py-1.5 text-[10px] font-semibold text-white hover:bg-[#2c2c31] disabled:opacity-40">Threshold C</button>
              <button disabled={!!busy} onClick={() => runOp({ op: "posterize", levels: p.levels }, "poster")} className="flex-1 rounded bg-[#232327] py-1.5 text-[10px] font-semibold text-white hover:bg-[#2c2c31] disabled:opacity-40">Posterize C</button>
            </div>
          </NativeRow>
        </div>
      </div>

      {/* Pipeline */}
      <div className="avero-card space-y-2 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Zap size={12} className="text-[#8fb6f5]" /> Studio pipeline</div>
        <div className="text-[10px] text-[#6e6e78]">Antrekan beberapa operasi C, jalankan sekaligus dalam satu IPC Rust (tanpa round-trip).</div>
        <div className="flex flex-wrap gap-1">
          {[
            { k: "brightness", op: { op: "brightness" as const, amount: p.brightness } },
            { k: "contrast", op: { op: "contrast" as const, amount: p.contrast } },
            { k: "vibrance", op: { op: "vibrance" as const, amount: p.vibrance } },
            { k: "warmth", op: { op: "warmth" as const, warmth: p.warmth } },
            { k: "sepia", op: { op: "sepia" as const, amount: 30 } },
          ].map((x) => (
            <button key={x.k} disabled={!!busy} onClick={() => setQueue([...queue, x.op as NativeOp])} className="rounded bg-[#232327] px-2 py-1 text-[10px] text-white hover:bg-[#2c2c31] disabled:opacity-40">+ {x.k}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 font-mono text-[10px] text-[#a7a7b0]">{queue.length === 0 ? "Antrean kosong" : queue.map((o, i) => <span key={i} className="rounded bg-[#232327] px-1.5 py-0.5">{(o as any).op}</span>)}</div>
        <div className="flex gap-1.5">
          <button disabled={queue.length === 0 || !!busy} onClick={runQueue} className="avero-btn-primary flex-1 rounded-md py-2 text-[11px] font-semibold text-white disabled:opacity-40">{busy === "pipeline" ? "Menjalankan..." : `Jalankan ${queue.length} ops`}</button>
          <button disabled={queue.length === 0 || !!busy} onClick={() => setQueue([])} className="rounded-md bg-[#232327] px-3 py-2 text-[11px] text-white hover:bg-[#2c2c31] disabled:opacity-40">Clear</button>
        </div>
      </div>

      {/* Non-destruktif JS stack */}
      <div className="border-t border-[#2c2c31] pt-3">
        <div className="avero-micro mb-2">Adjustment stack non-destruktif (JS)</div>
        <div className="flex flex-wrap gap-1">
          {addable.map((a) => (
            <button key={a.id} onClick={() => { addAdjustment(a.id); useAutomationStore.getState().pushStep(`Add ${a.label}`, { type: "adjustment/add", payload: { kind: a.id } }); }} className="avero-btn-primary flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white">
              <Plus size={11} /> {a.label}
            </button>
          ))}
        </div>
      </div>
      {adjustments.length === 0 && (
        <div className="rounded-md border border-dashed border-[#2c2c31] p-3 text-center text-[11px] text-[#6e6e78]">Belum ada adjustment stack. Tambahkan Brightness atau Levels. Semua bisa disusun ulang dan opacity.</div>
      )}
      {[...adjustments].reverse().map((a) => (
        <div key={a.id} className="rounded-md border border-[#2c2c31] bg-[#161618] p-2">
          <div className="flex items-center gap-1.5">
            <input type="checkbox" checked={a.enabled} onChange={(e) => updateAdjustment(a.id, { enabled: e.target.checked })} className="accent-[#2f7cf6]" />
            <span className="flex-1 font-medium text-white">{a.name}</span>
            <button onClick={() => moveAdjustment(a.id, 1)} className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"><ChevronUp size={12} /></button>
            <button onClick={() => moveAdjustment(a.id, -1)} className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"><ChevronDown size={12} /></button>
            <button onClick={() => removeAdjustment(a.id)} className="rounded p-1 text-[#e5534b] hover:bg-[#232327]"><Trash2 size={12} /></button>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {a.type === "brightnessContrast" && (<><Slider label="Brightness" value={a.params.brightness ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { brightness: v })} /><Slider label="Contrast" value={a.params.contrast ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { contrast: v })} /></>)}
            {a.type === "levels" && (<><Slider label="In black" value={a.params.inBlack ?? 0} min={0} max={200} onChange={(v) => updateAdjustmentParams(a.id, { inBlack: v })} /><Slider label="In white" value={a.params.inWhite ?? 255} min={55} max={255} onChange={(v) => updateAdjustmentParams(a.id, { inWhite: v })} /><Slider label="Gamma" value={a.params.gamma ?? 1} min={0.1} max={3} step={0.05} onChange={(v) => updateAdjustmentParams(a.id, { gamma: v })} /></>)}
            {a.type === "curves" && (<><Slider label="Lift" value={a.params.lift ?? 0} min={-60} max={60} onChange={(v) => updateAdjustmentParams(a.id, { lift: v })} /><Slider label="Gain" value={a.params.gain ?? 0} min={-60} max={60} onChange={(v) => updateAdjustmentParams(a.id, { gain: v })} /></>)}
            {a.type === "exposure" && (<Slider label="Exposure EV" value={a.params.exposure ?? 0} min={-4} max={4} step={0.1} onChange={(v) => updateAdjustmentParams(a.id, { exposure: v })} />)}
            {a.type === "hueSaturation" && (<><Slider label="Hue" value={a.params.hue ?? 0} min={-180} max={180} onChange={(v) => updateAdjustmentParams(a.id, { hue: v })} /><Slider label="Saturation" value={a.params.saturation ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { saturation: v })} /><Slider label="Lightness" value={a.params.lightness ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { lightness: v })} /></>)}
            {a.type === "vibrance" && (<><Slider label="Vibrance" value={a.params.vibrance ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { vibrance: v })} /><Slider label="Saturation" value={a.params.saturation ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { saturation: v })} /></>)}
            {a.type === "colorBalance" && (<><Slider label="Cyan-Red" value={a.params.cyanRed ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { cyanRed: v })} /><Slider label="Magenta-Green" value={a.params.magentaGreen ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { magentaGreen: v })} /><Slider label="Yellow-Blue" value={a.params.yellowBlue ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { yellowBlue: v })} /></>)}
            {a.type === "selectiveColor" && (<><Slider label="Reds" value={a.params.reds ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { reds: v })} /><Slider label="Yellows" value={a.params.yellows ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { yellows: v })} /><Slider label="Blues" value={a.params.blues ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { blues: v })} /></>)}
            {a.type === "shadowsHighlights" && (<><Slider label="Shadows" value={a.params.shadows ?? 25} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { shadows: v })} /><Slider label="Highlights" value={a.params.highlights ?? 25} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { highlights: v })} /></>)}
            {a.type === "photoFilter" && (<><Slider label="Warmth" value={a.params.warmth ?? 0} min={-100} max={100} onChange={(v) => updateAdjustmentParams(a.id, { warmth: v })} /><Slider label="Density" value={a.params.density ?? 25} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { density: v })} /></>)}
            {a.type === "channelMixer" && (<Slider label="Red mix" value={a.params.red ?? 100} min={0} max={200} onChange={(v) => updateAdjustmentParams(a.id, { red: v })} />)}
            {a.type === "gradientMap" && (<Slider label="Highlights" value={a.params.highlights ?? 100} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { highlights: v })} />)}
            {a.type === "colorLookup" && (<><Slider label="Strength" value={a.params.strength ?? 50} min={0} max={100} onChange={(v) => updateAdjustmentParams(a.id, { strength: v })} /><Slider label="Tone" value={a.params.tone ?? 0} min={-50} max={50} onChange={(v) => updateAdjustmentParams(a.id, { tone: v })} /></>)}
            {a.type === "threshold" && (<Slider label="Level" value={a.params.level ?? 128} min={0} max={255} onChange={(v) => updateAdjustmentParams(a.id, { level: v })} />)}
            {a.type === "posterize" && (<Slider label="Levels" value={a.params.levels ?? 4} min={2} max={12} onChange={(v) => updateAdjustmentParams(a.id, { levels: v })} />)}
            {(a.type === "invert" || a.type === "blackWhite" || a.type === "autoContrast") && (<div className="text-[10px] text-[#6e6e78]">Tanpa parameter. Aktifkan toggle untuk pratinjau.</div>)}
            <Slider label="Opacity" value={a.opacity} min={0} max={100} onChange={(v) => updateAdjustment(a.id, { opacity: v })} />
          </div>
        </div>
      ))}
    </div>
  );
}
