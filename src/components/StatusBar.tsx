import { useEffect, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { isTauri, nativeBenchmark, nativeInfo, nativeStats, gpuReport, type NativeInfo } from "../io/nativeEngine";
import { gpuBackend } from "../io/gpuBackend";
import { clearRenderPools, layerManager } from "../engine/layerManager";
import { showMessage, showError, askText } from "../ui/notify";
import { smartBudget } from "../io/memoryManager";
import { useHomeStore } from "../stores/useHomeStore";

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
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const [mem, setMem] = useState<string>("");
  const [nat, setNat] = useState<NativeInfo | null>(null);
  const [bench, setBench] = useState<string>("");
  const [ramMode, setRamMode] = useState<string>("");
  const [gpu, setGpu] = useState<string>("GPU…");

  useEffect(() => {
    if (!isTauri()) return;
    nativeInfo().then(setNat).catch(() => setNat(null));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await gpuBackend();
        if (alive) setGpu(`${b.label} · ${b.osApi.split(" via ")[0]}`);
      } catch {
        if (alive) setGpu("CPU");
      }
      try {
        if (isTauri()) {
          const r = await gpuReport();
          if (alive && r) setGpu((g) => `${g} · ${r.rayon_threads}thr`);
        }
      } catch {
        /* keep web backend label */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function runStats() {
    if (!isTauri()) { await showMessage("Stats is only available in the desktop app.", "AVERO STUDIO"); return; }
    const st = useEditorStore.getState();
    const id = st.activeLayerId ?? st.layers[0]?.id;
    if (!id) return;
    const c = layerManager.get(id);
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    try {
      // Sample max 512px side for stats to avoid multi-MB IPC + RAM spike.
      const maxSide = 512;
      const sc = Math.min(1, maxSide / Math.max(c.width, c.height));
      const tw = Math.max(1, Math.round(c.width * sc));
      const th = Math.max(1, Math.round(c.height * sc));
      const tmp = document.createElement("canvas");
      tmp.width = tw;
      tmp.height = th;
      tmp.getContext("2d")!.drawImage(c, 0, 0, tw, th);
      const d = tmp.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, tw, th);
      const s = await nativeStats(d.data);
      await showMessage(
        `Mean R ${s.mean_r.toFixed(1)} G ${s.mean_g.toFixed(1)} B ${s.mean_b.toFixed(1)}\nStd R ${s.std_r.toFixed(1)} G ${s.std_g.toFixed(1)} B ${s.std_b.toFixed(1)}\nPixels ${s.pixels} (sampled ${tw}x${th})`,
        "Layer Stats",
      );
    } catch (e) {
      await showError(String(e));
    }
  }

  async function runBench() {
    if (!isTauri()) return;
    setBench("bench...");
    try {
      const r = await nativeBenchmark(1920, 1080, 20);
      setBench(`${r.mpix_per_sec.toFixed(1)} MP/s`);
      setTimeout(() => setBench(""), 4000);
    } catch { setBench("failed"); setTimeout(() => setBench(""), 2000); }
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await smartBudget(doc.width, doc.height, Math.max(1, layers.length));
        if (alive) setRamMode(`${b.mode} ${b.tile ? `tile ${b.tile}` : "direct"} hist ${b.historyCap}`);
      } catch {
        if (alive) setRamMode("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [doc.width, doc.height, layers.length]);

  const mp = ((doc.width * doc.height * 4 * Math.max(1, layers.length)) / 1024 / 1024).toFixed(1);
  const tiles = Math.ceil(doc.width / 256) * Math.ceil(doc.height / 256);

  const chip =
    "rounded-md px-1.5 py-0.5 text-[#a7a7b0] transition-colors hover:bg-[#2c2c31] hover:text-white";
  const chipOn = "rounded-md px-1.5 py-0.5 bg-[#2f7cf6] text-white shadow-[0_2px_8px_rgba(47,124,246,0.4)]";

  return (
    <div className="flex h-7 shrink-0 items-center gap-0 divide-x divide-[#232327] border-t border-[#2c2c31] bg-[#1c1c1f] px-3 text-[11px] text-[#6e6e78] [&>*:nth-child(n+2)]:pl-3">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={10}
          max={400}
          value={Math.min(400, zoom)}
          onChange={(e) => setZoom(Number(e.target.value))}
          title={`Zoom ${zoom}% — Ctrl++ / Ctrl+-`}
          aria-label="Zoom"
          className="avero-slider w-24"
          style={{ ["--avero-fill" as string]: `${((Math.min(400, zoom) - 10) / 390) * 100}%` }}
        />
        <button
          onClick={() => setZoom(100)}
          title="Set zoom 100% (Ctrl+1)"
          className="rounded-md px-1.5 py-0.5 font-mono tabular-nums text-white transition-colors hover:bg-[#2c2c31]"
        >
          {zoom}%
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("avero:fit-zoom"))}
          title="Fit to screen"
          className={chip}
        >
          Fit
        </button>
      </div>
      <span className="hidden font-mono lg:block">
        {doc.width}x{doc.height} {mp} MB {tiles} tiles {color.workingSpace}{" "}
        {color.bitDepth}-bit {tool}
      </span>
      {(() => {
        const al = layers.find((l) => l.id === activeLayerId);
        return al ? (
          <span className="hidden max-w-[220px] truncate font-mono text-[#c9c9d1] xl:block" title={`Active layer: ${al.name} (${al.kind}, opacity ${al.opacity}%, ${al.blendMode})`}>
            {al.name} · {al.kind} · {al.opacity}%
          </span>
        ) : null;
      })()}
      <span className="hidden font-mono tabular-nums xl:block" title="Brush size and strength">
        B{brushSize}/{brushOpacity}%
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
        onClick={async () => {
          const v = await askText("Grid Size", "Grid size in px (8-512):", String(gridSize), "e.g. 64");
          if (v !== null && v !== "") {
            const n = Math.max(8, Math.min(512, Number(v) || gridSize));
            useProStore.getState().setGridSize(n);
          }
        }}
        className="hidden rounded px-1 py-0.5 font-mono hover:bg-[#2c2c31] hover:text-white xl:block"
        title="Change grid size"
      >
        {gridSize}px
      </button>
      <button
        onClick={() => useProStore.getState().toggleSnap()}
        className={snapEnabled ? chipOn : chip}
        title="Snap to guides/grid/center (hold Alt to bypass)"
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
        onClick={async () => {
          try {
            clearRenderPools();
            const freed = useHomeStore.getState().stripHeavyRecents();
            const mb = freed > 0 ? `, freed ${(freed / 1024 / 1024).toFixed(1)}MB recents` : "";
            await showMessage(`Render pools cleared${mb}. Heavy work stays in Rust.`, "Memory Trim");
          } catch (e) {
            await showError(String(e));
          }
        }}
        className="hidden rounded border border-[#2c2c31] bg-[#232327] px-1.5 py-0.5 font-mono text-[#a7a7b0] hover:text-white md:block"
        title="Clear render pools and old recent image bytes"
      >
        Trim
      </button>
      {ramMode && (
        <span className="hidden font-mono xl:block" title="Smart RAM mode from the Rust budget">
          {ramMode}
        </span>
      )}
      <button
        onClick={runStats}
        className="hidden rounded border border-[#2c2c31] bg-[#232327] px-1.5 py-0.5 font-mono text-[#a7a7b0] hover:text-white md:block"
        title="Active layer color statistics"
      >
        Stats
      </button>
      <button
        onClick={runBench}
        className="hidden rounded border border-[#2c2c31] bg-[#232327] px-1.5 py-0.5 font-mono text-[#a7a7b0] hover:text-white md:block"
        title="Benchmark processing speed"
      >
        {bench || "Bench"}
      </button>
      <span
        className={`hidden max-w-[220px] truncate rounded border px-1.5 py-0.5 font-mono md:block ${
          nat?.ready ? "border-[#2c2c31] bg-[#232327] text-[#8fb6f5]" : "border-[#2c2c31] text-[#6e6e78]"
        }`}
        title={nat ? `C + C++ + Rust image engine ready (${nat.c_engine} ${nat.c_version} / ${nat.cpp_engine} ${nat.cpp_version})` : "Web preview"}
      >
        {nat?.ready ? `Engine v2 · ready` : "Web preview"}
      </span>
      <span
        className="hidden max-w-[260px] truncate rounded border border-[#2c2c31] bg-[#232327] px-1.5 py-0.5 font-mono text-[#8fb6f5] md:block"
        title="Active GPU backend: WebGPU maps to Vulkan (Linux) / DirectX 12 (Windows) / Metal (macOS); WebGL2 maps to OpenGL/ANGLE"
      >
        {gpu}
      </span>
      <span
        className="ml-auto hidden max-w-[300px] truncate md:block font-mono"
        title={backendInfo}
      >
        {doc.filePath ? doc.filePath.split(/[/\\]/).pop() : ""}
      </span>
      <span className={doc.dirty ? "text-[#d9a441]" : "text-[#6e6e78]"}>
        {doc.dirty ? "Unsaved" : "Saved"}
      </span>
    </div>
  );
}
