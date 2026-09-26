import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { TOOL_LABEL } from "./ToolBar";

const BAR =
  "pointer-events-auto absolute left-1/2 top-3 z-20 flex max-w-[94%] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-white/10 bg-[#161618]/92 px-3 py-2 text-[11px] text-[#a7a7b0] shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl";

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="truncate text-[#c9c9d1]">{children}</span>;
}

function Slider({ label, value, min, max, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[#6e6e78]">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-16 accent-[#2f7cf6]" />
      <span className="w-8 font-mono text-white tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  );
}

// Options bar kontekstual ala editor profesional: selalu tampil di atas kanvas sesuai tool aktif.
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
  const name = TOOL_LABEL[tool] ?? tool;

  const retouchHint: Partial<Record<string, string>> = {
    "spot-heal": "Klik atau lukis pada noda. J untuk Healing Brush, Patch, Red Eye.",
    "healing-brush": "Alt klik sumber, lalu lukis untuk penyembuhan presisi.",
    patch: "Seret area sumber ke target untuk patch.",
    "content-move": "Seret objek, latar mengisi otomatis.",
    "red-eye": "Klik mata merah untuk koreksi.",
    clone: "Alt klik menentukan sumber, lalu lukis untuk mengklon.",
    "pattern-stamp": "Lukis dengan pola aktif.",
    "history-brush": "Lukis untuk mengembalikan ke keadaan sebelumnya.",
    "art-history-brush": "Lukis dengan sapuan artistik dari riwayat.",
    brush: "Lukis bebas. B berpindah Pencil dan Mixer Brush.",
    pencil: "Garis keras tanpa anti-alias.",
    "color-replacement": "Ganti warna target sambil mempertahankan terang gelap.",
    "mixer-brush": "Campur warna seperti cat minyak.",
    eraser: "Hapus piksel atau mask. E berpindah Background Eraser.",
    "background-eraser": "Hapus latar dengan sampling warna tepi.",
    "magic-eraser": "Klik area datar untuk menghapus sekaligus.",
    blur: "Lukis untuk menghaluskan. R berpindah Sharpen dan Smudge.",
    sharpen: "Lukis untuk mempertajam detail.",
    smudge: "Klik dulu untuk mengambil warna, lalu seret.",
    dodge: "Lukis untuk mencerahkan. O berpindah Burn dan Sponge.",
    burn: "Lukis untuk menggelapkan.",
    sponge: "Lukis untuk menjenuhkan warna lokal.",
    liquify: "Seret untuk mendistorsi piksel secara lokal.",
    warp: "Seret kisi untuk melenturkan area.",
    fill: "Klik area untuk mengisi warna brush. Menghormati seleksi. G kembali Gradient.",
    pen: "Seret untuk garis bebas. P berpindah Curvature Pen dan Line.",
    "curvature-pen": "Klik untuk titik lengkung, seret untuk handle.",
    line: "Seret untuk garis lurus. Shift mengunci 45 derajat.",
    "select-polygon": "Klik titik polygon, double klik untuk menutup.",
    "quick-select": "Seret untuk seleksi cepat.",
    "object-select": "Seret area untuk memilih objek otomatis.",
    frame: "Seret untuk membuat bingkai placeholder.",
    ruler: "Seret untuk mengukur jarak dan sudut.",
    note: "Klik untuk menempel catatan.",
    count: "Klik untuk menambah hitungan.",
    "color-sampler": "Klik untuk sampel warna.",
    text: "Klik di kanvas untuk mulai mengetik.",
    "text-vertical": "Klik di kanvas untuk teks vertikal.",
    "shape-rect": "Seret untuk kotak. Shift untuk persegi.",
    "shape-ellipse": "Seret untuk oval. Shift untuk lingkaran.",
    "triangle-shape": "Seret untuk segitiga.",
    "shape-polygon": "Seret untuk poligon.",
    "shape-line": "Seret untuk garis bentuk.",
    "shape-custom": "Seret untuk bentuk kustom.",
    eyedropper: "Klik untuk mengambil warna dari kanvas.",
    "select-lasso": "Seret bebas untuk seleksi. Tutup ke titik awal.",
    "single-row": "Seret horizontal untuk memilih 1 baris piksel.",
    "single-column": "Seret vertikal untuk memilih 1 kolom piksel.",
    slice: "Seret untuk memotong irisan ekspor.",
    "slice-select": "Klik irisan untuk memilih.",
    artboard: "Seret untuk membuat artboard.",
    "path-select": "Klik path untuk memilih keseluruhan.",
    "direct-select": "Klik titik anchor untuk mengedit.",
    "rotate-view": "Seret untuk memutar tampilan kanvas.",
    zoom: "Klik untuk zoom in, Alt klik untuk zoom out.",
    "perspective-crop": "Seret area lalu sudut untuk perspektif.",
  };

  const usesBrushSliders =
    tool === "brush" ||
    tool === "pencil" ||
    tool === "eraser" ||
    tool === "clone" ||
    tool === "spot-heal" ||
    tool === "blur" ||
    tool === "sharpen" ||
    tool === "smudge" ||
    tool === "dodge" ||
    tool === "burn" ||
    tool === "sponge" ||
    tool === "healing-brush" ||
    tool === "mixer-brush" ||
    tool === "color-replacement" ||
    tool === "background-eraser" ||
    tool === "magic-eraser" ||
    tool === "history-brush" ||
    tool === "art-history-brush" ||
    tool === "pattern-stamp" ||
    tool === "content-move" ||
    tool === "patch" ||
    tool === "red-eye";

  if (tool === "crop" || tool === "perspective-crop") {
    return (
      <div className={BAR}>
        <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>Seret area. Enter terapkan, Esc batal.</Hint>
        <button onClick={onApplyCrop} className="avero-btn-primary rounded-md px-2.5 py-1 font-semibold text-white">
          Terapkan
        </button>
        <button onClick={onCancelCrop} className="rounded-md bg-[#232327] px-2.5 py-1 text-white hover:bg-[#2c2c31]">
          Batal
        </button>
      </div>
    );
  }

  if (tool === "gradient" || tool === "fill") {
    return (
      <div className={BAR}>
        <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <span className="shrink-0 text-[#6e6e78]">Isi ke</span>
        {(["transparent", "white", "black"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGradTo(g)}
            className={`rounded-md px-2 py-1 transition-colors ${gradTo === g ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white"}`}
          >
            {g === "transparent" ? "Transparan" : g === "white" ? "Putih" : "Hitam"}
          </button>
        ))}
        <Hint>Seret di kanvas. G berpindah mode.</Hint>
      </div>
    );
  }

  if (retouchHint[tool]) {
    return (
      <div className={BAR}>
        <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>{retouchHint[tool]}</Hint>
        {usesBrushSliders && (
          <span className="hidden shrink-0 items-center gap-3 border-l border-white/10 pl-2.5 lg:flex">
            <Slider label="Ukuran" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} />
            <Slider label="Kekuatan" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" />
          </span>
        )}
      </div>
    );
  }

  if (paintMask && (tool === "brush" || tool === "eraser")) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-xl border border-[#5a3a10] bg-[#2c2313]/95 px-3 py-2 text-[11px] text-[#f0c674] shadow-lg backdrop-blur-md">
        Mode paint MASK. Brush menampilkan, Eraser menyembunyikan.
      </div>
    );
  }

  // Default: tetap tampilkan nama tool + hint ringan agar opsi selalu terlihat profesional
  const generic = retouchHint[tool];
  if (generic) {
    return (
      <div className={BAR}>
        <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>{generic}</Hint>
      </div>
    );
  }

  return (
    <div className={BAR}>
      <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
      <Hint>
        {tool === "select-rect" || tool === "select-ellipse"
          ? "Seret untuk seleksi. Shift tambah, Alt kurang. Feather di panel Seleksi."
          : tool === "wand"
            ? "Klik area warna serupa. Toleransi di panel Seleksi."
            : tool === "move"
              ? "Seret layer. Shift snapping, Ctrl+T transformasi bebas."
              : tool === "hand"
                ? "Seret untuk menggeser kanvas. Scroll untuk zoom."
                : "Pilih dan seret di kanvas untuk menggunakan tool ini."}
      </Hint>
    </div>
  );
}
