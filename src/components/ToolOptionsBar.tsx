import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

// Options bar kontekstual ala Photoshop: muncul di atas kanvas sesuai tool aktif.
export default function ToolOptionsBar({
  onApplyCrop,
  onCancelCrop,
}: {
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}) {
  const tool = useEditorStore((s) => s.tool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const setBrush = useEditorStore((s) => s.setBrush);
  const paintMask = useProStore((s) => s.paintMask);
  const gradTo = useProStore((s) => s.gradTo);
  const setGradTo = useProStore((s) => s.setGradTo);

  if (tool === "crop") {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#232b3d] bg-black/80 px-3 py-1.5 text-[11px] backdrop-blur">
        <span className="text-[#c5cddc]">Seret area, Enter terapkan, Esc batal</span>
        <button onClick={onApplyCrop} className="avero-btn-primary rounded-lg px-2.5 py-1 font-semibold text-white">
          Terapkan
        </button>
        <button onClick={onCancelCrop} className="rounded-lg bg-[#1b2130] px-2.5 py-1 text-white">
          Batal
        </button>
      </div>
    );
  }

  if (tool === "gradient") {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-[#232b3d] bg-black/80 px-3 py-1.5 text-[11px] backdrop-blur">
        <span className="text-[#c5cddc]">Gradasi ke:</span>
        {(["transparent", "white", "black"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGradTo(g)}
            className={`rounded-lg px-2 py-1 capitalize ${gradTo === g ? "bg-[#0a84ff] text-white" : "bg-[#1b2130] text-[#8a94a6]"}`}
          >
            {g === "transparent" ? "Transparan" : g === "white" ? "Putih" : "Hitam"}
          </button>
        ))}
        <span className="text-[#5b6577]">• seret di kanvas (Shift = 45°) • G = Fill</span>
      </div>
    );
  }

  const retouchHint: Partial<Record<string, string>> = {
    "spot-heal": "Klik / lukis di noda — J putar Clone • Size & Opacity = kekuatan",
    blur: "Lukis untuk haluskan — R putar Sharpen/Smudge",
    sharpen: "Lukis untuk pertajam detail — R putar",
    smudge: "Klik dulu untuk ambil warna, lalu seret — efek jari",
    dodge: "Lukis untuk cerahkan — O putar Burn/Sponge",
    burn: "Lukis untuk gelapkan — O putar",
    sponge: "Lukis untuk jenuhkan warna lokal — O putar",
    fill: "Klik area untuk isi warna brush • hormati seleksi • G kembali ke Gradient",
    pen: "Seret untuk garis bebas • P putar Line • Shift luruskan Line",
    line: "Seret untuk garis lurus (Shift = 45°) • P putar Pen",
    clone: "Alt+klik tentukan sumber, lalu lukis untuk mengklon",
  };

  if (retouchHint[tool]) {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-xl border border-[#232b3d] bg-black/80 px-3 py-1.5 text-[11px] text-[#c5cddc] backdrop-blur">
        <span className="truncate">{retouchHint[tool]}</span>
        <span className="hidden items-center gap-1.5 lg:flex">
          <label className="flex items-center gap-1 text-[#8a94a6]">
            Size
            <input
              type="range"
              min={1}
              max={200}
              value={brushSize}
              onChange={(e) => setBrush({ size: Number(e.target.value) })}
              className="h-1 w-20"
            />
            <span className="font-mono text-white">{brushSize}</span>
          </label>
          <label className="flex items-center gap-1 text-[#8a94a6]">
            Str
            <input
              type="range"
              min={1}
              max={100}
              value={brushOpacity}
              onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
              className="h-1 w-16"
            />
            <span className="font-mono text-white">{brushOpacity}%</span>
          </label>
        </span>
      </div>
    );
  }

  if (paintMask && (tool === "brush" || tool === "eraser")) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl border border-amber-700/60 bg-[#5a3a10]/90 px-3 py-1.5 text-[11px] text-amber-200">
        Mode paint MASK: Brush = tampilkan, Eraser = sembunyikan
      </div>
    );
  }

  return null;
}
