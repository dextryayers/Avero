import { useEffect, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

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
