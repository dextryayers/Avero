import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

// Options bar kontekstual ala Photoshop: muncul di atas kanvas
// sesuai tool aktif. Aksi crop dioper dari CanvasArea via props.
export default function ToolOptionsBar({
  onApplyCrop,
  onCancelCrop,
}: {
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}) {
  const tool = useEditorStore((s) => s.tool);
  const paintMask = useProStore((s) => s.paintMask);
  const gradTo = useProStore((s) => s.gradTo);
  const setGradTo = useProStore((s) => s.setGradTo);

  if (tool === "crop") {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/75 px-3 py-1.5 text-[11px]">
        <span className="text-[#c5c5c5]">Seret area, Enter terapkan, Esc batal</span>
        <button onClick={onApplyCrop} className="rounded bg-[#0a84ff] px-2.5 py-1 text-white">
          Terapkan
        </button>
        <button onClick={onCancelCrop} className="rounded bg-[#3e3e42] px-2.5 py-1">
          Batal
        </button>
      </div>
    );
  }

  if (tool === "gradient") {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-black/75 px-3 py-1.5 text-[11px]">
        <span className="text-[#c5c5c5]">Gradasi ke:</span>
        {(["transparent", "white", "black"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGradTo(g)}
            className={`rounded px-2 py-1 capitalize ${gradTo === g ? "bg-[#0a84ff] text-white" : "bg-[#3e3e42] text-[#c5c5c5]"}`}
          >
            {g === "transparent" ? "Transparan" : g === "white" ? "Putih" : "Hitam"}
          </button>
        ))}
        <span className="text-[#8a94a6]">• seret di kanvas (Shift = 45°)</span>
      </div>
    );
  }

  if (tool === "clone") {
    return (
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1.5 text-[11px] text-[#c5c5c5]">
        Alt+klik tentukan sumber, lalu lukis untuk mengklon
      </div>
    );
  }

  if (paintMask && (tool === "brush" || tool === "eraser")) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-[#5a3a10]/90 px-3 py-1.5 text-[11px] text-amber-200">
        Mode paint MASK: Brush = tampilkan, Eraser = sembunyikan
      </div>
    );
  }

  return null;
}
