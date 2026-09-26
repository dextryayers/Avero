import { useEffect, useState } from "react";
import { useProStore, type FilterType } from "../stores/useProStore";
import { useAutomationStore } from "../stores/useAutomationStore";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import {
  isTauri,
  nativeInfo,
  nativePipelineCanvas,
  nativeProcessCanvas,
  type NativeInfo,
  type NativeFilterOp,
} from "../io/nativeEngine";
import { ChevronDown, ChevronUp, Cpu, Layers, Leaf, Plus, Trash2, Zap } from "lucide-react";

const addable: { id: FilterType; label: string }[] = [
  { id: "gaussianBlur", label: "Gaussian" },
  { id: "boxBlur", label: "BoxBlur" },
  { id: "motionBlur", label: "Motion" },
  { id: "sharpen", label: "Sharpen" },
  { id: "unsharpMask", label: "Unsharp" },
  { id: "highPass", label: "HighPass" },
  { id: "reduceNoise", label: "Denoise" },
  { id: "noise", label: "Noise" },
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

function Row({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="flex justify-between text-[11px] text-[#a7a7b0]">{label} <span className="font-mono text-white">{value}</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#2f7cf6]" />
    </div>
  );
}

function NativeFRow({
  label, desc, busy, onApply, children,
}: { label: string; desc: string; busy: boolean; onApply: () => void; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#2c2c31] bg-[#232327] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-[11px] font-semibold text-white">{label}</div><div className="text-[10px] text-[#6e6e78]">{desc}</div></div>
        <button disabled={busy} onClick={onApply} className="shrink-0 rounded-md bg-[#2f7cf6] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#3b8bff] disabled:opacity-40">{busy ? "..." : "Apply"}</button>
      </div>
      {children && <div className="mt-2 space-y-1.5">{children}</div>}
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
  const [busy, setBusy] = useState<string | null>(null);
  const [queue, setQueue] = useState<NativeFilterOp[]>([]);
  const [light, setLight] = useState(false);
  const [p, setP] = useState({
    box: 4, sigma: 2.0, median: 2, amount: 1.2, unsharpAmt: 1.5, unsharpRad: 2,
    motionR: 12, motionA: 0, vignette: 0.45, chroma: 4, grain: 16, halftone: 6,
    tiltBlur: 8, focusY: 540, focusH: 240, oilR: 3, oilI: 16, pixel: 8,
  });

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo().then(setNat).catch(() => setNat(null));
  }, []);

  async function runFilter(op: NativeFilterOp, key: string) {
    if (busy || !isTauri()) return;
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setBusy(key);
    try {
      const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
      await nativeProcessCanvas(c, "filter", op);
      st.markDirty();
      useProStore.getState().bumpHistogram();
      useAutomationStore.getState().pushStep(`Filter ${key}`, { type: "filter/add", payload: { kind: key } });
    } catch (e) { alert(`Filter gagal: ${String(e)}`); } finally { setBusy(null); }
  }

  async function runQ() {
    if (queue.length === 0 || busy || !isTauri()) return;
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    if (!id) return;
    setBusy("pipeline");
    try {
      const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
      await nativePipelineCanvas(c, [], queue, light);
      st.markDirty();
      useProStore.getState().bumpHistogram();
      useAutomationStore.getState().pushStep(`Pipeline ${queue.length} filters`, { type: "pipeline/native", payload: { n: queue.length } });
      setQueue([]);
    } catch (e) { alert(`Pipeline gagal: ${String(e)}`); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3 p-2 text-[12px]">
      <div className="avero-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[#2c2c31] bg-[#161618] px-3 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#2f7cf6] text-white"><Cpu size={14} /></span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold leading-none text-white">Gudang Filter v2</div>
            <div className="truncate font-mono text-[10px] text-[#6e6e78]">{nat ? "20 filter siap pakai · proses dua arah presisi" : isTauri() ? "memuat filter..." : "pratinjau web"}</div>
          </div>
          <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] ${nat?.ready ? "bg-[#232327] text-[#8fb6f5]" : "bg-[#2c2c31] text-[#6e6e78]"}`}>{nat?.ready ? "20 filter" : "offline"}</span>
        </div>
        <div className="px-3 py-2 text-[10px] leading-relaxed text-[#6e6e78]">Diproses dua arah dari sumber ke tujuan, blur terpisah dan konvolusi kernel. Untuk beberapa filter sekaligus gunakan antrean.</div>
      </div>

      <div className="space-y-2">
        <div className="avero-micro flex items-center gap-1.5"><Layers size={11} /> Blur</div>
        <div className="grid gap-2">
          <NativeFRow label="Box Blur" desc="separable O(w*h)" busy={busy === "box"} onApply={() => runFilter({ op: "boxBlur", radius: p.box }, "box")}>
            <Row label="Radius" value={p.box} min={0} max={32} onChange={(v) => setP({ ...p, box: v })} />
          </NativeFRow>
          <NativeFRow label="Gaussian" desc="sigma 0.1..16" busy={busy === "gauss"} onApply={() => runFilter({ op: "gaussian", sigma: p.sigma }, "gauss")}>
            <Row label="Sigma" value={p.sigma} min={0.1} max={16} step={0.1} onChange={(v) => setP({ ...p, sigma: v })} />
          </NativeFRow>
          <NativeFRow label="Median" desc="denoise radius 0..16" busy={busy === "median"} onApply={() => runFilter({ op: "median", radius: p.median }, "median")}>
            <Row label="Radius" value={p.median} min={0} max={8} onChange={(v) => setP({ ...p, median: v })} />
          </NativeFRow>
          <NativeFRow label="Motion Blur" desc="panjang dan sudut" busy={busy === "motion"} onApply={() => runFilter({ op: "motionBlur", radius: p.motionR, angle: p.motionA }, "motion")}>
            <Row label="Radius" value={p.motionR} min={1} max={32} onChange={(v) => setP({ ...p, motionR: v })} />
            <Row label="Angle" value={p.motionA} min={0} max={180} onChange={(v) => setP({ ...p, motionA: v })} />
          </NativeFRow>
          <NativeFRow label="Tilt Shift" desc="fokus tengah, blur tepi" busy={busy === "tilt"} onApply={() => runFilter({ op: "tiltShift", blur: p.tiltBlur, focusY: p.focusY, focusH: p.focusH }, "tilt")}>
            <Row label="Blur" value={p.tiltBlur} min={1} max={24} onChange={(v) => setP({ ...p, tiltBlur: v })} />
            <Row label="Focus Y" value={p.focusY} min={0} max={1080} onChange={(v) => setP({ ...p, focusY: v })} />
            <Row label="Focus H" value={p.focusH} min={8} max={600} onChange={(v) => setP({ ...p, focusH: v })} />
          </NativeFRow>
        </div>
      </div>

      <div className="space-y-2">
        <div className="avero-micro">Detail dan sharpen</div>
        <div className="grid gap-2">
          <NativeFRow label="Sharpen" desc="kernel 3x3" busy={busy === "sharpen"} onApply={() => runFilter({ op: "sharpen", amount: p.amount }, "sharpen")}>
            <Row label="Amount" value={p.amount} min={0} max={8} step={0.1} onChange={(v) => setP({ ...p, amount: v })} />
          </NativeFRow>
          <NativeFRow label="Unsharp Mask" desc="blur + mask" busy={busy === "unsharp"} onApply={() => runFilter({ op: "unsharp", amount: p.unsharpAmt, radius: p.unsharpRad }, "unsharp")}>
            <Row label="Amount" value={p.unsharpAmt} min={0} max={8} step={0.1} onChange={(v) => setP({ ...p, unsharpAmt: v })} />
            <Row label="Radius" value={p.unsharpRad} min={1} max={10} onChange={(v) => setP({ ...p, unsharpRad: v })} />
          </NativeFRow>
        </div>
      </div>

      <div className="space-y-2">
        <div className="avero-micro">Artistik</div>
        <div className="grid gap-2">
          <NativeFRow label="Emboss" desc="tanpa param" busy={busy === "emboss"} onApply={() => runFilter({ op: "emboss" }, "emboss")} />
          <NativeFRow label="Find Edges" desc="invert sobel" busy={busy === "edges"} onApply={() => runFilter({ op: "findEdges" }, "edges")} />
          <NativeFRow label="Sobel" desc="gradien" busy={busy === "sobel"} onApply={() => runFilter({ op: "sobel" }, "sobel")} />
          <NativeFRow label="Oil Paint" desc="kuantisasi radius" busy={busy === "oil"} onApply={() => runFilter({ op: "oilPaint", radius: p.oilR, intensity: p.oilI }, "oil")}>
            <Row label="Radius" value={p.oilR} min={1} max={8} onChange={(v) => setP({ ...p, oilR: v })} />
            <Row label="Intensity" value={p.oilI} min={2} max={64} onChange={(v) => setP({ ...p, oilI: v })} />
          </NativeFRow>
          <NativeFRow label="Halftone" desc="dot size" busy={busy === "halftone"} onApply={() => runFilter({ op: "halftone", size: p.halftone }, "halftone")}>
            <Row label="Size" value={p.halftone} min={2} max={32} onChange={(v) => setP({ ...p, halftone: v })} />
          </NativeFRow>
          <NativeFRow label="Pixelate" desc="blok size" busy={busy === "pixel"} onApply={() => runFilter({ op: "pixelate", size: p.pixel }, "pixel")}>
            <Row label="Size" value={p.pixel} min={2} max={64} onChange={(v) => setP({ ...p, pixel: v })} />
          </NativeFRow>
        </div>
      </div>

      <div className="space-y-2">
        <div className="avero-micro">Sinematik</div>
        <div className="grid gap-2">
          <NativeFRow label="Vignette" desc="gelapkan tepi 0..1" busy={busy === "vignette"} onApply={() => runFilter({ op: "vignette", amount: p.vignette }, "vignette")}>
            <Row label="Amount" value={p.vignette} min={0} max={1} step={0.05} onChange={(v) => setP({ ...p, vignette: v })} />
          </NativeFRow>
          <NativeFRow label="Chroma" desc="geser R/B" busy={busy === "chroma"} onApply={() => runFilter({ op: "chroma", amount: p.chroma }, "chroma")}>
            <Row label="Amount" value={p.chroma} min={0} max={12} onChange={(v) => setP({ ...p, chroma: v })} />
          </NativeFRow>
          <NativeFRow label="Film Grain" desc="seed acak" busy={busy === "grain"} onApply={() => runFilter({ op: "grain", amount: p.grain }, "grain")}>
            <Row label="Amount" value={p.grain} min={0} max={64} onChange={(v) => setP({ ...p, grain: v })} />
          </NativeFRow>
        </div>
      </div>

      <div className="space-y-2">
        <div className="avero-micro flex items-center gap-1.5"><Leaf size={11} className="text-[#7ad69e]" /> Mode hemat RAM</div>
        <div className="grid gap-2">
          <NativeFRow label="Box Blur Ringan" desc="per ubin, tambahan <64KB" busy={busy === "boxLight"} onApply={() => runFilter({ op: "boxBlurLight", radius: p.box }, "boxLight")}>
            <Row label="Radius" value={p.box} min={0} max={16} onChange={(v) => setP({ ...p, box: v })} />
          </NativeFRow>
          <NativeFRow label="Gaussian Ringan" desc="sigma 0.1..8, per ubin" busy={busy === "gaussLight"} onApply={() => runFilter({ op: "gaussianLight", sigma: p.sigma }, "gaussLight")}>
            <Row label="Sigma" value={p.sigma} min={0.1} max={8} step={0.1} onChange={(v) => setP({ ...p, sigma: v })} />
          </NativeFRow>
          <NativeFRow label="Bilateral Ringan" desc="jaga tepi, sangat ringan" busy={busy === "bilat"} onApply={() => runFilter({ op: "bilateralLight", radius: p.median, sigmaColor: 30 }, "bilat")}>
            <Row label="Radius" value={p.median} min={1} max={4} onChange={(v) => setP({ ...p, median: v })} />
          </NativeFRow>
          <NativeFRow label="Unsharp Ringan" desc="per ubin hemat RAM" busy={busy === "unsharpLight"} onApply={() => runFilter({ op: "unsharpLight", amount: p.unsharpAmt, radius: p.unsharpRad }, "unsharpLight")}>
            <Row label="Amount" value={p.unsharpAmt} min={0} max={4} step={0.1} onChange={(v) => setP({ ...p, unsharpAmt: v })} />
            <Row label="Radius" value={p.unsharpRad} min={1} max={6} onChange={(v) => setP({ ...p, unsharpRad: v })} />
          </NativeFRow>
        </div>
        <div className="rounded-md bg-[#1a2b1f] px-2 py-1.5 text-[10px] text-[#7ad69e]">Hanya 2 penyangga baris, bukan salinan penuh. Untuk 8K hemat ~100MB.</div>
      </div>

      <div className="avero-card space-y-2 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Zap size={12} className="text-[#8fb6f5]" /> Antrean filter</div>
        <div className="text-[10px] text-[#6e6e78]">Antrekan beberapa filter lalu jalankan sekaligus. Centang mode ringan untuk memproses per ubin.</div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#a7a7b0]">
          <input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} className="accent-[#2f7cf6]" /> Mode ringan (hemat RAM)
        </label>
        <div className="flex flex-wrap gap-1">
          {[
            { k: "gaussian", op: { op: "gaussian" as const, sigma: p.sigma } },
            { k: "sharpen", op: { op: "sharpen" as const, amount: p.amount } },
            { k: "vignette", op: { op: "vignette" as const, amount: p.vignette } },
            { k: "grain", op: { op: "grain" as const, amount: 12 } },
          ].map((x) => (
            <button key={x.k} disabled={!!busy} onClick={() => setQueue([...queue, x.op as NativeFilterOp])} className="rounded bg-[#232327] px-2 py-1 text-[10px] text-white hover:bg-[#2c2c31] disabled:opacity-40">+ {x.k}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 font-mono text-[10px] text-[#a7a7b0]">{queue.length === 0 ? "Antrean kosong" : queue.map((o, i) => <span key={i} className="rounded bg-[#232327] px-1.5 py-0.5">{(o as any).op}</span>)}</div>
        <div className="flex gap-1.5">
          <button disabled={queue.length === 0 || !!busy} onClick={runQ} className="avero-btn-primary flex-1 rounded-md py-2 text-[11px] font-semibold text-white disabled:opacity-40">{busy === "pipeline" ? "Menjalankan..." : `Jalankan ${queue.length} filter`}</button>
          <button disabled={queue.length === 0 || !!busy} onClick={() => setQueue([])} className="rounded-md bg-[#232327] px-3 py-2 text-[11px] text-white hover:bg-[#2c2c31] disabled:opacity-40">Clear</button>
        </div>
      </div>

      <div className="border-t border-[#2c2c31] pt-3">
        <div className="avero-micro mb-2">Penumpuk filter non destruktif</div>
        <div className="flex flex-wrap gap-1">
          {addable.map((f) => (
            <button key={f.id} onClick={() => { addFilter(f.id); useAutomationStore.getState().pushStep(`Add ${f.label}`, { type: "filter/add", payload: { kind: f.id } }); }} className="flex items-center gap-1 rounded-md bg-[#232327] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#2c2c31]">
              <Plus size={11} /> {f.label}
            </button>
          ))}
        </div>
      </div>
      {filters.length === 0 && (<div className="rounded-md border border-dashed border-[#2c2c31] p-3 text-center text-[11px] text-[#6e6e78]">Belum ada filter stack. Tambahkan Gaussian atau Sharpen.</div>)}
      {[...filters].reverse().map((f) => (
        <div key={f.id} className="rounded-md border border-[#2c2c31] bg-[#161618] p-2">
          <div className="flex items-center gap-1.5">
            <input type="checkbox" checked={f.enabled} onChange={(e) => updateFilter(f.id, { enabled: e.target.checked })} className="accent-[#2f7cf6]" />
            <span className="flex-1 font-medium text-white">{f.name}</span>
            <button onClick={() => moveFilter(f.id, 1)} className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"><ChevronUp size={12} /></button>
            <button onClick={() => moveFilter(f.id, -1)} className="rounded p-1 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"><ChevronDown size={12} /></button>
            <button onClick={() => removeFilter(f.id)} className="rounded p-1 text-[#e5534b] hover:bg-[#232327]"><Trash2 size={12} /></button>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {(f.type === "gaussianBlur" || f.type === "boxBlur") && (<Row label="Radius" value={f.params.radius ?? 4} min={0} max={32} onChange={(v) => updateFilterParams(f.id, { radius: v })} />)}
            {f.type === "motionBlur" && (<><Row label="Radius" value={f.params.radius ?? 8} min={1} max={32} onChange={(v) => updateFilterParams(f.id, { radius: v })} /><Row label="Angle" value={f.params.angle ?? 0} min={0} max={180} onChange={(v) => updateFilterParams(f.id, { angle: v })} /></>)}
            {f.type === "sharpen" && (<Row label="Amount" value={f.params.amount ?? 60} min={0} max={200} onChange={(v) => updateFilterParams(f.id, { amount: v })} />)}
            {f.type === "unsharpMask" && (<><Row label="Amount" value={f.params.amount ?? 70} min={0} max={200} onChange={(v) => updateFilterParams(f.id, { amount: v })} /><Row label="Radius" value={f.params.radius ?? 2} min={1} max={10} onChange={(v) => updateFilterParams(f.id, { radius: v })} /></>)}
            {f.type === "highPass" && (<Row label="Radius" value={f.params.radius ?? 4} min={1} max={20} onChange={(v) => updateFilterParams(f.id, { radius: v })} />)}
            {f.type === "reduceNoise" && (<Row label="Strength" value={f.params.strength ?? 40} min={0} max={120} onChange={(v) => updateFilterParams(f.id, { strength: v })} />)}
            {f.type === "noise" && (<Row label="Amount" value={f.params.amount ?? 8} min={0} max={48} onChange={(v) => updateFilterParams(f.id, { amount: v })} />)}
            {f.type === "filmGrain" && (<Row label="Amount" value={f.params.amount ?? 18} min={0} max={60} onChange={(v) => updateFilterParams(f.id, { amount: v })} />)}
            {f.type === "pixelate" && (<Row label="Size" value={f.params.size ?? 8} min={2} max={48} onChange={(v) => updateFilterParams(f.id, { size: v })} />)}
            {f.type === "halftone" && (<Row label="Size" value={f.params.size ?? 6} min={3} max={20} onChange={(v) => updateFilterParams(f.id, { size: v })} />)}
            {f.type === "oilPaintLite" && (<Row label="Radius" value={f.params.radius ?? 3} min={1} max={12} onChange={(v) => updateFilterParams(f.id, { radius: v })} />)}
            {f.type === "tiltShift" && (<Row label="Blur" value={f.params.blur ?? 8} min={1} max={24} onChange={(v) => updateFilterParams(f.id, { blur: v })} />)}
            {f.type === "vignette" && (<Row label="Amount" value={f.params.amount ?? 45} min={0} max={100} onChange={(v) => updateFilterParams(f.id, { amount: v })} />)}
            {f.type === "chromaticAberration" && (<Row label="Amount" value={f.params.amount ?? 3} min={0} max={12} onChange={(v) => updateFilterParams(f.id, { amount: v })} />)}
            {(f.type === "emboss" || f.type === "findEdges") && (<div className="text-[10px] text-[#6e6e78]">Tanpa parameter. Atur via Opacity.</div>)}
            <Row label="Opacity" value={f.opacity} min={0} max={100} onChange={(v) => updateFilter(f.id, { opacity: v })} />
          </div>
        </div>
      ))}
    </div>
  );
}
