import { useEffect, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { isTauri, nativeBenchmark, nativeInfo, nativeStats, type NativeInfo } from "../io/nativeEngine";
import { layerManager } from "../engine/layerManager";

export default function StatusBar() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const doc = useEditorStore((s) => s.doc);
  const backendInfo = useEditorStore((s) => s.backendInfo);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const showRulers = useEditorStore((s) => s.showRulers);
  const tool = useEditorStore((s) => s.tool);
  const color = useProStore((s) => s.color);
  const showGrid = useProStore((s) => s.showGrid);
  const gridSize = useProStore((s) => s.gridSize);
  const snapEnabled = useProStore((s) => s.snapEnabled);
  const showGuides = useProStore((s) => s.showGuides);
  const layers = useEditorStore((s) => s.layers);
  const [mem, setMem] = useState<string>("");
  const [nat, setNat] = useState<NativeInfo | null>(null);
  const [bench, setBench] = useState<string>("");

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo().then(setNat).catch(() => setNat(null));
  }, []);

  async function runStats() {
    if (!isTauri()) { alert("Stats hanya di desktop."); return; }
    const st = useEditorStore.getState();
    const id = st.activeLayerId ?? st.layers[0]?.id;
    if (!id) return;
    const c = layerManager.get(id);
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const s = await nativeStats(d.data);
    alert(`Mean R ${s.mean_r.toFixed(1)} G ${s.mean_g.toFixed(1)} B ${s.mean_b.toFixed(1)}\nStd R ${s.std_r.toFixed(1)} G ${s.std_g.toFixed(1)} B ${s.std_b.toFixed(1)}\nPixels ${s.pixels}`);
  }

  async function runBench() {
    if (!isTauri()) return;
    setBench("bench...");
    try {
      const r = await nativeBenchmark(1920, 1080, 20);
      setBench(`${r.mpix_per_sec.toFixed(1)} MP/s`);
      setTimeout(() => setBench(""), 4000);
    } catch { setBench("gagal"); setTimeout(() => setBench(""), 2000); }
  }

  useEffect(() => {
    const t = setInterval(() => {
      try {
        const perf: any = performance as any;
        if (perf.memory) {
          const mb = perf.memory.usedJSHeapSize / 1024 / 1024;
          setMem(`${mb.toFixed(0)}MB heap`);
        } else {
          setMem("");
        }
      } catch {
        setMem("");
      }
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const mp = ((doc.width * doc.height * 4 * Math.max(1, layers.length)) / 1024 / 1024).toFixed(1);
  const tiles = Math.ceil(doc.width / 256) * Math.ceil(doc.height / 256);

  const chip =
    "rounded px-1.5 py-0.5 text-[#a7a7b0] hover:bg-[#2c2c31] hover:text-white";
  const chipOn = "rounded px-1.5 py-0.5 bg-[#2f7cf6] text-white";

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-[#2c2c31] bg-[#1c1c1f] px-3 text-[11px] text-[#6e6e78]">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={10}
          max={400}
          value={Math.min(400, zoom)}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-1 w-24"
        />
        <button
          onClick={() => setZoom(100)}
          className="rounded px-1.5 py-0.5 font-mono text-white hover:bg-[#2c2c31]"
        >
          {zoom}%
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("avero:fit-zoom"))}
          title="Fit ke layar"
          className={chip}
        >
          Fit
        </button>
      </div>
      <span className="hidden font-mono lg:block">
        {doc.width}x{doc.height} {mp} MB {tiles} tiles {color.workingSpace}{" "}
        {color.bitDepth}-bit {tool}
      </span>
      <button
        onClick={toggleRulers}
        className={showRulers ? chipOn : chip}
      >
        Rulers {showRulers ? "on" : "off"}
      </button>
      <button
        onClick={() => useProStore.getState().toggleGrid()}
        className={showGrid ? chipOn : chip}
        title="Toggle grid"
      >
        Grid {showGrid ? gridSize : "off"}
      </button>
      <button
        onClick={() => {
          const v = prompt("Grid size px (8-512):", String(gridSize));
          if (v) useProStore.getState().setGridSize(Number(v) || gridSize);
        }}
        className="hidden rounded px-1 py-0.5 font-mono hover:bg-[#2c2c31] hover:text-white xl:block"
        title="Ubah grid size"
      >
        {gridSize}px
      </button>
      <button
        onClick={() => useProStore.getState().toggleSnap()}
        className={snapEnabled ? chipOn : chip}
        title="Snap ke guides/grid/tengah (tahan Alt untuk bypass)"
      >
        Snap {snapEnabled ? "on" : "off"}
      </button>
      <button
        onClick={() => useProStore.getState().toggleGuides()}
        className={`hidden rounded px-1.5 py-0.5 sm:block ${
          showGuides ? chipOn : chip
        }`}
      >
        Guides {showGuides ? "on" : "off"}
      </button>
      {mem && <span className="hidden font-mono xl:block">{mem}</span>}
      <button
        onClick={runStats}
        className="hidden rounded border border-[#2c2c31] bg-[#232327] px-1.5 py-0.5 font-mono text-[#a7a7b0] hover:text-white md:block"
        title="Native Rust stats (rayon) layer aktif"
      >
        Stats
      </button>
      <button
        onClick={runBench}
        className="hidden rounded border border-[#2c2c31] bg-[#232327] px-1.5 py-0.5 font-mono text-[#a7a7b0] hover:text-white md:block"
        title="Benchmark C/C++ + Rust"
      >
        {bench || "Bench"}
      </button>
      <span
        className={`hidden max-w-[220px] truncate rounded border px-1.5 py-0.5 font-mono md:block ${
          nat?.ready ? "border-[#2c2c31] bg-[#232327] text-[#8fb6f5]" : "border-[#2c2c31] text-[#6e6e78]"
        }`}
        title={nat ? `${nat.c_engine} ${nat.c_version} | ${nat.cpp_engine} ${nat.cpp_version} | Rust ${nat.rust_version}` : "Native engine"}
      >
        {nat?.ready ? `C ${nat.c_version} • C++ ${nat.cpp_version} • Rust ${nat.rust_version}` : "Rust/TS"}
      </span>
      <span
        className="ml-auto hidden max-w-[300px] truncate md:block font-mono"
        title={backendInfo}
      >
        {doc.filePath ? doc.filePath.split(/[/\\]/).pop() : ""}
      </span>
      <span className={doc.dirty ? "text-[#d9a441]" : "text-[#6e6e78]"}>
        {doc.dirty ? "Belum disimpan" : "Tersimpan"}
      </span>
    </div>
  );
}
