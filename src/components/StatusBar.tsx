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
  const color = useProStore((s) => s.color);
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

  return (
    <div className="flex h-7 items-center gap-3 border-t border-[#3e3e42] bg-[#252526] px-3 text-[11px] text-[#a0a0a0]">
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
          className="rounded px-1.5 py-0.5 font-mono text-white hover:bg-[#3e3e42]"
        >
          {zoom}%
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("avero:fit-zoom"))}
          title="Fit ke layar"
          className="rounded px-1.5 py-0.5 hover:bg-[#3e3e42] hover:text-white"
        >
          Fit
        </button>
      </div>
      <span className="font-mono">
        {doc.width}x{doc.height} • {mp} MB • {tiles} tiles • {color.workingSpace} {color.bitDepth}
        -bit
      </span>
      <button
        onClick={toggleRulers}
        className="rounded px-1.5 py-0.5 hover:bg-[#3e3e42] hover:text-white"
      >
        Rulers {showRulers ? "on" : "off"}
      </button>
      {mem && <span className="font-mono">{mem}</span>}
      <span className="ml-auto max-w-[420px] truncate" title={backendInfo}>
        {backendInfo}
      </span>
      <span className={doc.dirty ? "text-amber-400" : "text-emerald-400"}>
        {doc.dirty ? "● Unsaved" : "Saved"}
      </span>
    </div>
  );
}
