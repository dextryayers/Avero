import { useEffect, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { isTauri, nativeInfo, nativeMemoryBudget, type NativeInfo } from "../io/nativeEngine";
import { estimateCanvasMB, snapshotMemory, formatMB } from "../io/memoryManager";
import { Cpu, Leaf, Gauge, Layers } from "lucide-react";

export default function NativeLabPanel() {
  const doc = useEditorStore((s) => s.doc);
  const layers = useEditorStore((s) => s.layers);
  const [nat, setNat] = useState<NativeInfo | null>(null);
  const [budget, setBudget] = useState<Awaited<ReturnType<typeof nativeMemoryBudget>> | null>(null);
  const snap = snapshotMemory(doc.width, doc.height, layers.length);

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo().then(setNat).catch(() => setNat(null));
    nativeMemoryBudget(doc.width, doc.height, layers.length).then(setBudget).catch(() => setBudget(null));
  }, [doc.width, doc.height, layers.length]);

  return (
    <div className="space-y-3 p-2 text-[12px]">
      <div className="avero-card overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-[#2c2c31] bg-[#161618] px-3 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#2f7cf6] text-white"><Cpu size={14} /></span>
          <div>
            <div className="text-[11.5px] font-bold text-white">Native Lab</div>
            <div className="font-mono text-[10px] text-[#6e6e78]">C • C++ • Rust • TS</div>
          </div>
          <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] ${nat?.ready ? "bg-[#232327] text-[#8fb6f5]" : "bg-[#2c2c31] text-[#6e6e78]"}`}>{nat?.ready ? "ready" : "web"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 text-[11px]">
          <div className="rounded-md border border-[#2c2c31] bg-[#1c1c1f] p-2">
            <div className="flex items-center gap-1 text-[#6e6e78]"><Layers size={11} /> Kanvas</div>
            <div className="font-mono text-white">{doc.width}×{doc.height} • {layers.length} layer</div>
            <div className="font-mono text-[#a7a7b0]">{formatMB(estimateCanvasMB(doc.width, doc.height, layers.length))} total</div>
          </div>
          <div className="rounded-md border border-[#2c2c31] bg-[#1c1c1f] p-2">
            <div className="flex items-center gap-1 text-[#6e6e78]"><Gauge size={11} /> Heap JS</div>
            <div className="font-mono text-white">{snap.heapMB ? formatMB(snap.heapMB) : "—"}</div>
            <div className="font-mono text-[#a7a7b0]">{formatMB(snap.totalMB)} total</div>
          </div>
          <div className="col-span-2 rounded-md border border-[#2c2c31] bg-[#161618] p-2">
            <div className="text-[11px] font-semibold text-white">Rekomendasi RAM</div>
            <div className={`mt-1 rounded px-2 py-1 font-mono text-[10px] ${snap.recommendation === "critical" ? "bg-[#3a2f14] text-amber-200" : snap.recommendation === "light" ? "bg-[#1a2b45] text-[#8fb6f5]" : "bg-[#1a2b1f] text-[#7ad69e]"}`}>{snap.message}</div>
            {budget && (
              <div className="mt-1.5 grid grid-cols-2 gap-1 font-mono text-[10px] text-[#6e6e78]">
                <span>Full {budget.total_mb.toFixed(1)} MB</span>
                <span>Light {budget.light_total_mb.toFixed(1)} MB</span>
                <span className="col-span-2 text-[#8fb6f5]">Hemat {budget.light_saving_mb.toFixed(1)} MB dengan tiled 512</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="avero-card p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Leaf size={12} className="text-[#7ad69e]" /> Ringan RAM</div>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[#a7a7b0]">
          <li><span className="font-semibold text-white">C in-place</span> — 0 alokasi baru, hanya LUT 768B atau histogram 1KB.</li>
          <li><span className="font-semibold text-white">C++ tiled</span> — tile 512, overhead &lt;64KB vs full duplicate {budget ? formatMB(budget.bytes_per_layer/1024/1024) : "—"}.</li>
          <li><span className="font-semibold text-white">Rust pipeline</span> — ping-pong 2 buffer, reuse, rayon par.</li>
          <li><span className="font-semibold text-white">TS light</span> — canvas tiled, yield tiap 8 tile agar UI tetap responsif.</li>
        </ul>
      </div>

      <div className="rounded-md border border-[#2c2c31] bg-[#161618] p-2.5">
        <div className="text-[11px] font-semibold text-white">Engine</div>
        <div className="mt-1 space-y-1 font-mono text-[10px] text-[#6e6e78]">
          <div>C: {nat?.c_engine ?? "—"} {nat?.c_version ?? ""} — 23 ops</div>
          <div>C++: {nat?.cpp_engine ?? "—"} {nat?.cpp_version ?? ""} — 20 filters</div>
          <div>Rust: {nat?.rust_version ?? "—"} — pipeline, histogram, stats, benchmark</div>
          <div>TS: invoke + tiledRenderer + memoryManager</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {nat?.features.slice(0, 2).map((f) => (
            <span key={f} className="rounded bg-[#232327] px-1.5 py-0.5 font-mono text-[9px] text-[#a7a7b0]">{f.slice(0, 42)}…</span>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-dashed border-[#2c2c31] p-3 text-center text-[11px] text-[#6e6e78]">
        Tip: untuk foto 45MP (8192×5464), Full pipeline ~537MB, Light ~273MB — hemat ~264MB.
      </div>
    </div>
  );
}
