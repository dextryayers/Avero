import { useEditorStore } from "../stores/useEditorStore";

export default function StatusBar() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const doc = useEditorStore((s) => s.doc);
  const backendInfo = useEditorStore((s) => s.backendInfo);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const showRulers = useEditorStore((s) => s.showRulers);

  const mp = ((doc.width * doc.height * 4) / 1024 / 1024).toFixed(1);

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
      </div>
      <span className="font-mono">
        {doc.width}x{doc.height} • {mp} MB • sRGB 8bit
      </span>
      <button
        onClick={toggleRulers}
        className="rounded px-1.5 py-0.5 hover:bg-[#3e3e42] hover:text-white"
      >
        Rulers {showRulers ? "on" : "off"}
      </button>
      <span className="ml-auto max-w-[420px] truncate" title={backendInfo}>
        {backendInfo}
      </span>
      <span className={doc.dirty ? "text-amber-400" : "text-emerald-400"}>
        {doc.dirty ? "● Unsaved" : "Saved"}
      </span>
    </div>
  );
}
