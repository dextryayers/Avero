import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

// Options bar kontekstual ala Photoshop: tampil di atas kanvas sesuai tool aktif.
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
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-3 py-1.5 text-[11px]">
        <span className="text-[#a7a7b0]">Seret area. Enter terapkan, Esc batal.</span>
        <button onClick={onApplyCrop} className="avero-btn-primary rounded-md px-2.5 py-1 font-semibold text-white">
          Terapkan
        </button>
        <button onClick={onCancelCrop} className="rounded-md bg-[#232327] px-2.5 py-1 text-white">
          Batal
        </button>
      </div>
    );
  }

  if (tool === "gradient") {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-3 py-1.5 text-[11px]">
        <span className="text-[#a7a7b0]">Gradasi ke:</span>
        {(["transparent", "white", "black"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGradTo(g)}
            className={`rounded-md px-2 py-1 capitalize ${gradTo === g ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0]"}`}
          >
            {g === "transparent" ? "Transparan" : g === "white" ? "Putih" : "Hitam"}
          </button>
        ))}
        <span className="text-[#6e6e78]">Seret di kanvas. G ganti Fill.</span>
      </div>
    );
  }

  const retouchHint: Partial<Record<string, string>> = {
    "spot-heal": "Klik atau lukis pada noda. J ganti Clone. Size dan Str mengatur kekuatan.",
    blur: "Lukis untuk menghaluskan. R ganti Sharpen dan Smudge.",
    sharpen: "Lukis untuk mempertajam detail.",
    smudge: "Klik dulu untuk mengambil warna, lalu seret.",
    dodge: "Lukis untuk mencerahkan. O ganti Burn dan Sponge.",
    burn: "Lukis untuk menggelapkan.",
    sponge: "Lukis untuk menjenuhkan warna lokal.",
    fill: "Klik area untuk isi warna brush. Menghormati seleksi. G kembali ke Gradient.",
    pen: "Seret untuk garis bebas. P ganti Line.",
    line: "Seret untuk garis lurus. Shift mengunci 45 derajat.",
    clone: "Alt+klik menentukan sumber, lalu lukis untuk mengklon.",
  };

  if (retouchHint[tool]) {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-3 py-1.5 text-[11px] text-[#a7a7b0]">
        <span className="truncate">{retouchHint[tool]}</span>
        <span className="hidden items-center gap-1.5 lg:flex">
          <label className="flex items-center gap-1 text-[#6e6e78]">
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
          <label className="flex items-center gap-1 text-[#6e6e78]">
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
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-[#5a3a10] bg-[#2c2313] px-3 py-1.5 text-[11px] text-[#d9a441]">
        Mode paint MASK. Brush menampilkan, Eraser menyembunyikan.
      </div>
    );
  }

  return null;
}
