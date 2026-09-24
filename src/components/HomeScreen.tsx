import { useMemo, useState } from "react";
import {
  FolderOpen,
  ImagePlus,
  LayoutGrid,
  Trash2,
  X,
  Search,
  Clock,
  Star,
  BookOpen,
  Plus,
  Monitor,
  Printer,
  Smartphone,
  Globe,
  Film,
  FileBox,
} from "lucide-react";
import { useHomeStore, resolveRecent, type RecentFile } from "../stores/useHomeStore";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { openAvxProject } from "../io/projectIo";
import { pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";
import clsx from "clsx";

type PresetCat = "Foto" | "Print" | "Art" | "Web" | "Mobile" | "Film";

const PRESETS: Record<PresetCat, { name: string; w: number; h: number; desc: string }[]> = {
  Foto: [
    { name: "Foto HD", w: 1920, h: 1080, desc: "Editing umum 16:9" },
    { name: "Foto 4K", w: 3840, h: 2160, desc: "Resolusi tinggi" },
    { name: "Portrait 4:5", w: 1080, h: 1350, desc: "Carousel IG" },
    { name: "Square 1:1", w: 1080, h: 1080, desc: "IG Post" },
    { name: "Story 9:16", w: 1080, h: 1920, desc: "Vertikal penuh" },
    { name: "Landscape 3:2", w: 3000, h: 2000, desc: "Cetak foto" },
  ],
  Print: [
    { name: "A4 300dpi", w: 2480, h: 3508, desc: "Dokumen cetak" },
    { name: "A3 300dpi", w: 3508, h: 4960, desc: "Poster kecil" },
    { name: "Letter", w: 2550, h: 3300, desc: "US Letter" },
    { name: "Kartu Nama", w: 1050, h: 600, desc: "90 x 50mm" },
  ],
  Art: [
    { name: "Kanvas HD", w: 1920, h: 1080, desc: "Lukis digital" },
    { name: "Kanvas 4K", w: 3840, h: 2160, desc: "Detail tinggi" },
    { name: "Square Art", w: 2048, h: 2048, desc: "Ilustrasi" },
  ],
  Web: [
    { name: "Hero Web", w: 1920, h: 1080, desc: "Landing page" },
    { name: "Banner 1200", w: 1200, h: 628, desc: "OG dan Ads" },
    { name: "Thumbnail YT", w: 1280, h: 720, desc: "16:9" },
  ],
  Mobile: [
    { name: "IG Story", w: 1080, h: 1920, desc: "9:16" },
    { name: "Wallpaper HP", w: 1440, h: 3088, desc: "Layar penuh" },
    { name: "App Cover", w: 1024, h: 1024, desc: "Icon dan cover" },
  ],
  Film: [
    { name: "FHD Video", w: 1920, h: 1080, desc: "Frame film" },
    { name: "2K DCI", w: 2048, h: 1080, desc: "Sinema" },
    { name: "Vertical Film", w: 1080, h: 1920, desc: "Shorts dan Reels" },
  ],
};

const CAT_ICON: Record<PresetCat, any> = {
  Foto: Monitor,
  Print: Printer,
  Art: Star,
  Web: Globe,
  Mobile: Smartphone,
  Film: Film,
};

function drawDataUrlToActive(dataUrl: string, w: number, h: number) {
  const img = new Image();
  img.onload = () => {
    const id =
      useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
    if (!id) return;
    layerManager.ensure(id, w, h);
    layerManager.drawImageToLayer(id, img, w, h);
    useEditorStore.getState().markDirty();
    useProStore.getState().bumpHistogram();
  };
  img.src = dataUrl;
}

export async function openImageViaDialog(): Promise<boolean> {
  try {
    const path = await pickImageToOpen();
    if (!path) return false;
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    const st = useEditorStore.getState();
    st.openDocument(path.split(/[/\\]/).pop() ?? "Image", info.width, info.height, path, info.file_size);
    layerManager.clear();
    useHomeStore.getState().pushRecent({
      name: path.split(/[/\\]/).pop() ?? "Image",
      path,
      thumb: dataUrl,
      full: dataUrl.length < 2_500_000 ? dataUrl : null,
      w: info.width,
      h: info.height,
      size: info.file_size,
    });
    setTimeout(() => drawDataUrlToActive(dataUrl, info.width, info.height), 60);
    useHomeStore.getState().setHome(false);
    return true;
  } catch (e) {
    console.error(e);
    alert(`Gagal membuka gambar: ${String(e)}`);
    return false;
  }
}

export default function HomeScreen() {
  const recents = useHomeStore((s) => s.recents);
  const setHome = useHomeStore((s) => s.setHome);
  const removeRecent = useHomeStore((s) => s.removeRecent);
  const clearRecents = useHomeStore((s) => s.clearRecents);
  const pushRecent = useHomeStore((s) => s.pushRecent);
  const newDocument = useEditorStore((s) => s.newDocument);
  const [cat, setCat] = useState<PresetCat>("Foto");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [dn, setDn] = useState("Untitled-1");
  const [dw, setDw] = useState("1920");
  const [dh, setDh] = useState("1080");
  const [bg, setBg] = useState<"white" | "black" | "transparent">("white");

  function createNew(name: string, w: number, h: number) {
    layerManager.clear();
    newDocument(name, w, h);
    const id = useEditorStore.getState().activeLayerId;
    if (id) {
      const c = layerManager.ensure(id, w, h);
      if (bg !== "transparent") {
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = bg === "white" ? "#ffffff" : "#000000";
        ctx.fillRect(0, 0, w, h);
      }
      useProStore.getState().ensureTransform(id);
    }
    pushRecent({ name, path: null, thumb: null, full: null, w, h, size: null });
    setShowNew(false);
    setHome(false);
  }

  async function openRecent(r: RecentFile) {
    if (busy) return;
    setBusy(r.id);
    try {
      const res = await resolveRecent(r);
      if (!res) {
        alert("File sesi ini sudah tidak tersedia. Buka ulang dari disk.");
        return;
      }
      const st = useEditorStore.getState();
      st.openDocument(r.name, res.w, res.h, r.path, r.size);
      layerManager.clear();
      setTimeout(() => drawDataUrlToActive(res.dataUrl, res.w, res.h), 60);
      setHome(false);
    } catch (e) {
      alert(`Gagal membuka: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const filteredPresets = useMemo(() => {
    const list = PRESETS[cat];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    const all = Object.values(PRESETS).flat();
    return all.filter((p) => p.name.toLowerCase().includes(q) || `${p.w}x${p.h}`.includes(q));
  }, [cat, query]);

  const filteredRecents = useMemo(() => {
    if (!query.trim()) return recents;
    return recents.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
  }, [recents, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#161618]">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#2c2c31] bg-[#1c1c1f] px-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="AVERO" className="h-9 w-9 rounded-md object-cover" />
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-wide text-white">AVERO STUDIO</div>
            <div className="mt-0.5 font-mono text-[9px] text-[#6e6e78]">v2.0.0</div>
          </div>
        </div>
        <div className="relative ml-4 hidden w-[320px] md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e78]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari file, preset, tutorial"
            className="w-full rounded-md border border-[#2c2c31] bg-[#161618] py-2 pl-8 pr-3 text-[12px] text-white outline-none placeholder:text-[#6e6e78] focus:border-[#2f7cf6]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => openAvxProject().catch((e) => alert(`Gagal membuka proyek: ${String(e)}`))}
            className="flex items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3.5 py-2 text-[12.5px] text-white hover:bg-[#2c2c31]"
            title="Buka proyek .avx"
          >
            <FileBox size={15} /> Proyek
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="avero-btn-primary flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12.5px] font-semibold text-white"
          >
            <Plus size={15} /> Baru
          </button>
          <button
            onClick={() => openImageViaDialog()}
            className="flex items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3.5 py-2 text-[12.5px] text-white hover:bg-[#2c2c31]"
          >
            <FolderOpen size={15} /> Buka
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[196px] shrink-0 flex-col gap-1 border-r border-[#2c2c31] bg-[#1c1c1f] p-3">
          {[
            { id: "home", label: "Beranda", icon: LayoutGrid, active: true },
            { id: "recent", label: "Terbaru", icon: Clock, active: false },
            { id: "learn", label: "Belajar", icon: BookOpen, active: false },
          ].map((n) => (
            <button
              key={n.id}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[12.5px]",
                n.active ? "bg-[#232327] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <n.icon size={16} /> {n.label}
            </button>
          ))}
          <div className="mt-3 border-t border-[#2c2c31] pt-3">
            <div className="avero-micro mb-1.5 px-2">Kategori</div>
            {(Object.keys(PRESETS) as PresetCat[]).map((c) => {
              const Icon = CAT_ICON[c];
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px]",
                    cat === c ? "bg-[#232327] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
                  )}
                >
                  <Icon size={14} /> {c}
                  <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">{PRESETS[c].length}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto rounded-md border border-[#2c2c31] bg-[#161618] p-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white">
              <Star size={13} className="text-[#8fb6f5]" /> Proyek .avx
            </div>
            <div className="mt-1 text-[10.5px] leading-relaxed text-[#6e6e78]">
              Simpan seluruh dokumen: layer, mask, adjust, filter. Buka lagi utuh.
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-white">
              <Clock size={14} className="text-[#8fb6f5]" /> Terbaru
              <span className="rounded bg-[#232327] px-1.5 py-0.5 font-mono text-[10px] text-[#a7a7b0]">{filteredRecents.length}</span>
            </h3>
            {recents.length > 0 && (
              <button onClick={clearRecents} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#6e6e78] hover:text-white">
                <Trash2 size={12} /> Bersihkan
              </button>
            )}
          </div>
          {filteredRecents.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed border-[#2c2c31] p-8 text-center">
              <img src="/logo.png" alt="" className="h-11 w-11 rounded-md object-cover opacity-70" />
              <div className="mt-2 text-[12.5px] font-semibold text-white">Mulai karya pertama</div>
              <div className="mt-0.5 max-w-[420px] text-[11.5px] text-[#6e6e78]">
                Buka foto atau proyek .avx, atau buat dokumen baru. File muncul di sini otomatis.
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setShowNew(true)} className="avero-btn-primary rounded-md px-3.5 py-2 text-[12px] font-semibold text-white">
                  Buat Baru
                </button>
                <button onClick={() => openImageViaDialog()} className="rounded-md bg-[#232327] px-3.5 py-2 text-[12px] text-white hover:bg-[#2c2c31]">
                  Buka Gambar
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRecents.map((r) => (
                <div key={r.id} className="group relative overflow-hidden rounded-md border border-[#2c2c31] bg-[#1c1c1f] hover:border-[#3a3a41]">
                  <button onClick={() => openRecent(r)} className="block w-full text-left" title={r.path ?? r.name}>
                    <div className="grid h-[128px] place-items-center overflow-hidden bg-[#101012]">
                      {r.thumb ? (
                        <img src={r.thumb} alt={r.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid place-items-center">
                          <LayoutGrid size={24} className="text-[#3a3a41]" />
                          <span className="mt-1 font-mono text-[10px] text-[#6e6e78]">{r.w}x{r.h}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="truncate text-[12px] font-semibold text-white">{r.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[#6e6e78]">
                        {r.w}x{r.h} {new Date(r.time).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        {busy === r.id ? " membuka" : ""}
                      </div>
                    </div>
                  </button>
                  <button onClick={() => removeRecent(r.id)} title="Hapus dari daftar" className="absolute right-1.5 top-1.5 hidden rounded bg-black/70 p-1.5 text-white hover:bg-[#e5534b] group-hover:block">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-[13px] font-bold text-white">
            <ImagePlus size={14} className="text-[#8fb6f5]" /> Preset {cat}
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPresets.map((p) => (
              <button
                key={p.name}
                onClick={() => createNew(p.name, p.w, p.h)}
                className="rounded-md border border-[#2c2c31] bg-[#1c1c1f] p-3 text-left hover:border-[#3a3a41]"
              >
                <div className="grid h-[72px] place-items-center rounded bg-[#101012]">
                  <div
                    className="rounded-sm border border-[#3a3a41] bg-[#232327]"
                    style={{
                      width: Math.min(130, Math.max(30, (p.w / Math.max(p.w, p.h)) * 130)),
                      height: Math.min(58, Math.max(20, (p.h / Math.max(p.w, p.h)) * 58)),
                    }}
                  />
                </div>
                <div className="mt-2 text-[12px] font-semibold text-white">{p.name}</div>
                <div className="font-mono text-[10px] text-[#6e6e78]">{p.w}x{p.h} {p.desc}</div>
              </button>
            ))}
          </div>

          <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-[13px] font-bold text-white">
            <BookOpen size={14} className="text-[#8fb6f5]" /> Pelajari dalam 1 menit
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { t: "Masking presisi", d: "Select, feather, refine edge, paint mask.", tag: "Select" },
              { t: "Retouch natural", d: "Spot Heal (J), Dodge dan Burn (O), Blur halus.", tag: "Retouch" },
              { t: "Grade sinematik", d: "Exposure, HSL, Vignette, Grain.", tag: "Color" },
              { t: "Varian tanpa duplikat", d: "Tab Git: snapshot, branch, compare slider.", tag: "Git" },
              { t: "Simpan proyek .avx", d: "Ctrl+S menyimpan layer dan edit utuh.", tag: "Project" },
              { t: "Export banyak format", d: "PNG, JPG, WEBP, BMP, SVG, TIFF.", tag: "Export" },
            ].map((c) => (
              <div key={c.t} className="rounded-md border border-[#2c2c31] bg-[#1c1c1f] p-3.5">
                <span className="rounded bg-[#232327] px-1.5 py-0.5 text-[10px] font-semibold text-[#8fb6f5]">{c.tag}</span>
                <div className="mt-1.5 text-[12px] font-semibold text-white">{c.t}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-[#6e6e78]">{c.d}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 pb-2 text-center font-mono text-[10px] text-[#4a4a52]">
            AVERO STUDIO v2.0.0. Offline. Non-destruktif. Ctrl+K semua aksi.
          </div>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" onClick={() => setShowNew(false)}>
          <div
            className="w-[500px] max-w-full overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-[#2c2c31] px-5 py-3.5">
              <img src="/logo.png" alt="" className="h-8 w-8 rounded-md object-cover" />
              <div>
                <div className="text-[13px] font-bold text-white">Dokumen Baru</div>
                <div className="text-[10.5px] text-[#6e6e78]">Preset dan ukuran kustom</div>
              </div>
              <button onClick={() => setShowNew(false)} className="ml-auto rounded p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <label className="block">
                <span className="avero-micro mb-1 block">Nama dokumen</span>
                <input value={dn} onChange={(e) => setDn(e.target.value)} className="w-full rounded-md border border-[#2c2c31] bg-[#161618] px-3 py-2 text-[12.5px] text-white outline-none focus:border-[#2f7cf6]" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="avero-micro mb-1 block">Lebar (px)</span>
                  <input value={dw} onChange={(e) => setDw(e.target.value.replace(/\D/g, ""))} className="w-full rounded-md border border-[#2c2c31] bg-[#161618] px-3 py-2 font-mono text-[12.5px] text-white outline-none focus:border-[#2f7cf6]" />
                </label>
                <label className="block">
                  <span className="avero-micro mb-1 block">Tinggi (px)</span>
                  <input value={dh} onChange={(e) => setDh(e.target.value.replace(/\D/g, ""))} className="w-full rounded-md border border-[#2c2c31] bg-[#161618] px-3 py-2 font-mono text-[12.5px] text-white outline-none focus:border-[#2f7cf6]" />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRESETS) as PresetCat[]).slice(0, 3).flatMap((c) => PRESETS[c].slice(0, 2)).slice(0, 6).map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setDn(p.name);
                      setDw(String(p.w));
                      setDh(String(p.h));
                    }}
                    className="rounded-md border border-[#2c2c31] bg-[#161618] px-2 py-1.5 text-left hover:border-[#3a3a41]"
                  >
                    <div className="truncate text-[11px] font-semibold text-white">{p.name}</div>
                    <div className="font-mono text-[10px] text-[#6e6e78]">{p.w}x{p.h}</div>
                  </button>
                ))}
              </div>
              <div>
                <span className="avero-micro mb-1.5 block">Background</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["white", "black", "transparent"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBg(b)}
                      className={clsx(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] capitalize",
                        bg === b ? "border-[#2f7cf6] bg-[#2f7cf6]/10 text-white" : "border-[#2c2c31] text-[#a7a7b0] hover:text-white",
                      )}
                    >
                      <span className={clsx("h-4 w-4 rounded-sm border border-[#3a3a41]", b === "white" ? "bg-white" : b === "black" ? "bg-black" : "bg-[#3a3a41]")} />
                      {b === "white" ? "Putih" : b === "black" ? "Hitam" : "Transparan"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-5 py-3.5">
              <span className="font-mono text-[11px] text-[#6e6e78]">
                {dw || 0} x {dh || 0} px
              </span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setShowNew(false)} className="rounded-md bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]">
                  Batal
                </button>
                <button
                  onClick={() => {
                    const w = Math.min(16384, Math.max(1, Number(dw) || 1920));
                    const h = Math.min(16384, Math.max(1, Number(dh) || 1080));
                    createNew(dn.trim() || "Untitled", w, h);
                  }}
                  className="avero-btn-primary rounded-md px-5 py-2 text-[12px] font-semibold text-white"
                >
                  Buat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
