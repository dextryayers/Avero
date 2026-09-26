import { useEffect, useMemo, useState } from "react";
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
  Layers,
  Wand2,
  Sparkles,
  Zap,
  Image as ImageIcon,
  ArrowRight,
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
    const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
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
  const [view, setView] = useState<"home" | "recent" | "learn">("home");

  const [dn, setDn] = useState("Untitled-1");
  const [dw, setDw] = useState("1920");
  const [dh, setDh] = useState("1080");
  const [bg, setBg] = useState<"white" | "black" | "transparent">("white");

  useEffect(() => {
    if (!showNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNew(false);
      if (e.key === "Enter") createNew(dn.trim() || "Untitled", Math.max(1, parseInt(dw) || 1920), Math.max(1, parseInt(dh) || 1080));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNew, dn, dw, dh]);

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
    <div className="flex min-h-0 flex-1 flex-col bg-[#101012]">
      {/* Top bar profesional */}
      <div className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[#2c2c31] bg-[#1c1c1f]/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="AVERO" className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10" />
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-wide text-white">AVERO STUDIO</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-[#6e6e78]">
              <span className="rounded bg-[#232327] px-1 py-0.5 text-[#8fb6f5]">v2.0.0</span> professional
            </div>
          </div>
        </div>
        <div className="relative ml-6 hidden w-[360px] md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e78]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari file, preset 1920x1080, tutorial"
            className="w-full rounded-full border border-[#2c2c31] bg-[#161618] py-2 pl-8 pr-3 text-[12px] text-white outline-none placeholder:text-[#6e6e78] focus:border-[#2f7cf6] focus:bg-[#1c1c1f]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-[#6e6e78] lg:block">Ctrl+K semua aksi • Ctrl+S .avx</span>
          <button
            onClick={() => openAvxProject().catch((e) => alert(`Gagal membuka proyek: ${String(e)}`))}
            className="flex items-center gap-1.5 rounded-full border border-[#2c2c31] bg-[#232327] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-[#2c2c31] hover:border-[#3a3a41] transition-colors"
          >
            <FileBox size={14} /> Proyek .avx
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="avero-btn-primary flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(47,124,246,0.3)]"
          >
            <Plus size={14} /> Baru
          </button>
          <button
            onClick={() => openImageViaDialog()}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#161618] hover:bg-[#ececee] transition-colors"
          >
            <FolderOpen size={14} /> Buka
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar kategori */}
        <div className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-[#2c2c31] bg-[#1c1c1f] p-3">
          <div className="mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-bold tracking-wider text-white">
            <LayoutGrid size={14} className="text-[#8fb6f5]" /> Studio
          </div>
          {[
            { id: "home", label: "Beranda", icon: LayoutGrid },
            { id: "recent", label: "Terbaru", icon: Clock, count: recents.length },
            { id: "learn", label: "Belajar", icon: BookOpen },
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id as any)}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] font-medium transition-colors",
                view === n.id ? "bg-[#2f7cf6] text-white shadow-[0_2px_8px_rgba(47,124,246,0.3)]" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <n.icon size={16} /> {n.label}
              {(n as any).count > 0 && <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[10px]">{(n as any).count}</span>}
            </button>
          ))}
          <div className="mt-3 border-t border-[#2c2c31] pt-3">
            <div className="avero-micro mb-1.5 px-2">Kategori preset</div>
            {(Object.keys(PRESETS) as PresetCat[]).map((c) => {
              const Icon = CAT_ICON[c];
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] transition-colors",
                    cat === c ? "bg-[#232327] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
                  )}
                >
                  <Icon size={14} /> {c}
                  <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">{PRESETS[c].length}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto space-y-2">
            <button
              onClick={() => openAvxProject().catch((e) => alert(`Gagal membuka proyek: ${String(e)}`))}
              className="w-full rounded-xl border border-[#2c2c31] bg-gradient-to-br from-[#1a2b45] to-[#161618] p-3 text-left transition-all hover:border-[#2f7cf6]/50 hover:from-[#1e3457]"
            >
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-white">
                <Layers size={13} className="text-[#8fb6f5]" /> Proyek .avx
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#a7a7b0]">
                Simpan seluruh dokumen: layer, mask, adjust, filter. Buka lagi utuh tanpa hilang.
              </div>
              <div className="mt-2 flex gap-1">
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white">Ctrl+S</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white">Ctrl+Shift+S</span>
              </div>
            </button>
            <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-2.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-white"><Zap size={12} className="text-[#8fb6f5]" /> Ringan RAM</div>
              <div className="mt-1 text-[10.5px] text-[#6e6e78]">Proses per ubin otomatis, ringan RAM</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#101012]">
          {/* Hero */}
          {view === "home" && (
          <div className="relative overflow-hidden border-b border-[#2c2c31] bg-[#1c1c1f]">
            <img src="/img/1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.08]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1c1c1f] via-[#1c1c1f]/80 to-transparent" />
            <div className="relative flex items-center gap-4 px-6 py-5">
              <div className="flex-1">
                <div className="text-[18px] font-bold leading-tight text-white">Mulai karya baru</div>
                <div className="mt-1 max-w-[560px] text-[12.5px] leading-relaxed text-[#a7a7b0]">
                  Buka foto, proyek .avx, atau preset. Semua tersimpan otomatis di Terbaru. Seret file dari Explorer langsung ke kanvas.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setShowNew(true)} className="avero-btn-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-white">
                    <ImagePlus size={14} /> Buat dokumen <ArrowRight size={12} />
                  </button>
                  <button onClick={() => openImageViaDialog()} className="inline-flex items-center gap-1.5 rounded-full border border-[#2c2c31] bg-[#232327] px-4 py-2 text-[12px] font-medium text-white hover:bg-[#2c2c31]">
                    <FolderOpen size={14} /> Buka gambar
                  </button>
                  <button onClick={() => openAvxProject().catch((e) => alert(String(e)))} className="inline-flex items-center gap-1.5 rounded-full border border-[#2c2c31] bg-[#161618] px-4 py-2 text-[12px] text-[#a7a7b0] hover:text-white">
                    <FileBox size={14} /> Buka .avx
                  </button>
                </div>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[10px] text-white/60 backdrop-blur">Ctrl+K palette</div>
                <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[10px] text-white/60 backdrop-blur">Space+drag pan</div>
              </div>
            </div>
          </div>
          )}

          <div className="p-5">
            {view !== "learn" && (<>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[13px] font-bold text-white">
                <Clock size={14} className="text-[#8fb6f5]" /> Terbaru
                <span className="rounded-full bg-[#232327] px-2 py-0.5 font-mono text-[10px] text-[#a7a7b0]">{filteredRecents.length}</span>
                {query && <span className="font-mono text-[10px] text-[#6e6e78]">filter "{query}"</span>}
              </h3>
              {recents.length > 0 && (
                <button onClick={clearRecents} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-[#6e6e78] hover:bg-[#232327] hover:text-white">
                  <Trash2 size={12} /> Bersihkan
                </button>
              )}
            </div>
            {filteredRecents.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-[#2c2c31] bg-[#1c1c1f] p-10 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#232327]"><ImageIcon size={24} className="text-[#6e6e78]" /></div>
                <div className="mt-3 text-[13px] font-bold text-white">Mulai karya pertama</div>
                <div className="mt-1 max-w-[420px] text-[11.5px] text-[#6e6e78]">Buka foto atau proyek .avx, atau buat dokumen baru. File muncul di sini otomatis. Seret gambar ke jendela juga bisa.</div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setShowNew(true)} className="avero-btn-primary rounded-full px-4 py-2 text-[12px] font-semibold text-white">Buat Baru</button>
                  <button onClick={() => openImageViaDialog()} className="rounded-full border border-[#2c2c31] bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]">Buka Gambar</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredRecents.map((r) => (
                  <div key={r.id} className="group relative overflow-hidden rounded-xl border border-[#2c2c31] bg-[#1c1c1f] transition-all hover:border-[#3a3a41] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:-translate-y-0.5">
                    <button onClick={() => openRecent(r)} className="block w-full text-left" title={r.path ?? r.name}>
                      <div className="relative grid h-[140px] place-items-center overflow-hidden bg-[#0a0a0c]">
                        {r.thumb ? (
                          <img src={r.thumb} alt={r.name} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                        ) : (
                          <div className="grid place-items-center">
                            <LayoutGrid size={28} className="text-[#3a3a41]" />
                            <span className="mt-1 font-mono text-[10px] text-[#6e6e78]">{r.w}x{r.h}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="absolute bottom-1.5 left-1.5 hidden rounded-full bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-white group-hover:block">{r.w}x{r.h}</span>
                      </div>
                      <div className="p-3">
                        <div className="truncate text-[12px] font-semibold text-white">{r.name}</div>
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-[#6e6e78]">
                          <span>{new Date(r.time).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                          {busy === r.id && <span className="rounded bg-[#2f7cf6] px-1 py-0.5 text-white">membuka</span>}
                        </div>
                      </div>
                    </button>
                    <button onClick={() => removeRecent(r.id)} title="Hapus dari daftar" className="absolute right-1.5 top-1.5 hidden rounded-full bg-black/70 p-1.5 text-white hover:bg-[#e5534b] group-hover:block">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </>)}

            {view === "home" && (<>
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-[13px] font-bold text-white">
              <ImagePlus size={14} className="text-[#8fb6f5]" /> Preset {cat}
              <span className="rounded-full bg-[#232327] px-2 py-0.5 font-mono text-[10px] text-[#a7a7b0]">{filteredPresets.length}</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredPresets.map((p) => (
                <button
                  key={p.name}
                  onClick={() => createNew(p.name, p.w, p.h)}
                  className="group rounded-xl border border-[#2c2c31] bg-[#1c1c1f] p-3 text-left transition-all hover:border-[#3a3a41] hover:bg-[#1e1e22] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
                >
                  <div className="grid h-[80px] place-items-center rounded-lg bg-[#101012] ring-1 ring-white/5">
                    <div
                      className="rounded-sm border border-white/10 bg-[#232327] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform group-hover:scale-[1.02]"
                      style={{
                        width: Math.min(130, Math.max(30, (p.w / Math.max(p.w, p.h)) * 130)),
                        height: Math.min(64, Math.max(20, (p.h / Math.max(p.w, p.h)) * 64)),
                      }}
                    />
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-white">
                    {p.name} <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8fb6f5]" />
                  </div>
                  <div className="font-mono text-[10px] text-[#6e6e78]">{p.w}x{p.h} • {p.desc}</div>
                </button>
              ))}
            </div>
            </>)}

            {view !== "recent" && (<>
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-[13px] font-bold text-white">
              <BookOpen size={14} className="text-[#8fb6f5]" /> Pelajari dalam 1 menit
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { t: "Masking presisi", d: "Select, feather, refine edge, paint mask. Tahan Shift untuk tambah seleksi.", tag: "Select", icon: Wand2 },
                { t: "Retouch natural", d: "Spot Heal (J), Healing Brush, Clone Stamp (S), Patch. Alt+klik sumber.", tag: "Retouch", icon: Sparkles },
                { t: "Grade sinematik", d: "Exposure, HSL, Vibrance, Warmth, Vignette, Grain. Proses per ubin hemat RAM.", tag: "Color", icon: Star },
                { t: "Varian tanpa duplikat", d: "Tab Git: snapshot, branch, compare slider untuk eksplor varian.", tag: "Git", icon: Layers },
                { t: "Simpan proyek .avx", d: "Ctrl+S menyimpan layer dan edit utuh. Buka lagi 100% sama.", tag: "Project", icon: FileBox },
                { t: "Export banyak format", d: "PNG, JPG, WEBP, BMP, SVG, TIFF. Matte dan skala fleksibel.", tag: "Export", icon: Globe },
              ].map((c) => (
                <div key={c.t} className="group rounded-xl border border-[#2c2c31] bg-[#1c1c1f] p-4 transition-colors hover:border-[#3a3a41] hover:bg-[#1e1e22]">
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#232327] text-[#8fb6f5]"><c.icon size={12} /></span>
                    <span className="rounded-full bg-[#232327] px-2 py-0.5 text-[10px] font-semibold text-[#8fb6f5]">{c.tag}</span>
                  </div>
                  <div className="mt-2 text-[12px] font-semibold text-white">{c.t}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-[#6e6e78]">{c.d}</div>
                </div>
              ))}
            </div>
            </>)}
            <div className="mt-8 flex items-center justify-center gap-2 pb-2 font-mono text-[10px] text-[#4a4a52]">
              <span>AVERO STUDIO v2.0.0</span>
              <span className="h-1 w-1 rounded-full bg-[#3a3a41]" />
              <span>Offline</span>
              <span className="h-1 w-1 rounded-full bg-[#3a3a41]" />
              <span>Non-destruktif</span>
              <span className="h-1 w-1 rounded-full bg-[#3a3a41]" />
              <span>Ctrl+K semua aksi</span>
            </div>
          </div>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="w-[520px] max-w-full overflow-hidden rounded-xl border border-[#2c2c31] bg-[#1c1c1f] shadow-[0_20px_60px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-[#2c2c31] px-5 py-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#2f7cf6] text-white"><ImagePlus size={18} /></div>
              <div>
                <div className="text-[13px] font-bold text-white">Dokumen Baru</div>
                <div className="text-[10.5px] text-[#6e6e78]">Preset dan ukuran kustom • ringan RAM, proses per ubin</div>
              </div>
              <button onClick={() => setShowNew(false)} className="ml-auto rounded-full p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              <label className="col-span-3">
                <span className="avero-micro mb-1 block">Nama dokumen</span>
                <input value={dn} onChange={(e) => setDn(e.target.value)} className="w-full rounded-lg border border-[#2c2c31] bg-[#161618] px-3 py-2 text-[12.5px] text-white outline-none focus:border-[#2f7cf6]" />
              </label>
              <label>
                <span className="avero-micro mb-1 block">Lebar</span>
                <input value={dw} onChange={(e) => setDw(e.target.value)} className="w-full rounded-lg border border-[#2c2c31] bg-[#161618] px-3 py-2 font-mono text-[12.5px] text-white outline-none focus:border-[#2f7cf6]" />
              </label>
              <label>
                <span className="avero-micro mb-1 block">Tinggi</span>
                <input value={dh} onChange={(e) => setDh(e.target.value)} className="w-full rounded-lg border border-[#2c2c31] bg-[#161618] px-3 py-2 font-mono text-[12.5px] text-white outline-none focus:border-[#2f7cf6]" />
              </label>
              <label>
                <span className="avero-micro mb-1 block">Latar</span>
                <select value={bg} onChange={(e) => setBg(e.target.value as any)} className="w-full rounded-lg border border-[#2c2c31] bg-[#161618] px-2 py-2 text-[12.5px] text-white outline-none">
                  <option value="white">Putih</option>
                  <option value="black">Hitam</option>
                  <option value="transparent">Transparan</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-4 py-3">
              <span className="font-mono text-[10px] text-[#6e6e78]">{dw}x{dh} • {bg}</span>
              <div className="ml-auto flex gap-2">
                <button onClick={() => setShowNew(false)} className="rounded-full bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]">Batal</button>
                <button onClick={() => createNew(dn.trim() || "Untitled", Math.max(1, parseInt(dw) || 1920), Math.max(1, parseInt(dh) || 1080))} className="avero-btn-primary rounded-full px-5 py-2 text-[12px] font-semibold text-white">Buat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
