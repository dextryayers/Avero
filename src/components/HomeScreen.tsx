import { useState } from "react";
import { FolderOpen, ImagePlus, LayoutGrid, Sparkles, Trash2, X } from "lucide-react";
import { useHomeStore, resolveRecent, type RecentFile } from "../stores/useHomeStore";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";

const PRESETS = [
  { name: "Foto HD", w: 1920, h: 1080, desc: "Editing umum" },
  { name: "Foto 4K", w: 3840, h: 2160, desc: "Resolusi tinggi" },
  { name: "IG Post", w: 1080, h: 1080, desc: "Kotak 1:1" },
  { name: "IG Story", w: 1080, h: 1920, desc: "Vertikal 9:16" },
  { name: "Carousel", w: 1080, h: 1350, desc: "Portrait 4:5" },
  { name: "Kertas A4", w: 2480, h: 3508, desc: "Cetak 300dpi" },
];

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
  const [cw, setCw] = useState("1920");
  const [ch, setCh] = useState("1080");
  const [busy, setBusy] = useState<string | null>(null);

  function createNew(name: string, w: number, h: number) {
    layerManager.clear();
    newDocument(name, w, h);
    const id = useEditorStore.getState().activeLayerId;
    if (id) {
      layerManager.ensure(id, w, h);
      useProStore.getState().ensureTransform(id);
    }
    pushRecent({ name, path: null, thumb: null, full: null, w, h, size: null });
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

  return (
    <div className="flex min-h-0 flex-1 bg-[#14171d]">
      {/* Rel kiri ala Photoshop */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-[#2a3140] bg-[#191d25] p-5">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="AVERO" className="h-14 w-14 rounded-xl object-cover shadow-[0_0_30px_rgba(10,132,255,0.35)]" />
          <div>
            <div className="text-[16px] font-bold tracking-[0.14em] text-white">AVERO</div>
            <div className="text-[10px] tracking-[0.3em] text-[#8a94a6]">STUDIO</div>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <button
            onClick={() => createNew("Untitled", 1920, 1080)}
            className="flex w-full items-center gap-2 rounded-lg bg-[#0a84ff] px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0070e0]"
          >
            <ImagePlus size={16} /> Dokumen Baru
          </button>
          <button
            onClick={() => openImageViaDialog()}
            className="flex w-full items-center gap-2 rounded-lg bg-[#2a3140] px-3 py-2.5 text-[13px] text-white hover:bg-[#343d52]"
          >
            <FolderOpen size={16} /> Buka Gambar
          </button>
        </div>
        <div className="mt-5 rounded-lg border border-[#2a3140] bg-[#14171d] p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a94a6]">
            Ukuran kustom
          </div>
          <div className="flex items-center gap-1.5">
            <input value={cw} onChange={(e) => setCw(e.target.value.replace(/\D/g, ""))} className="w-full rounded bg-[#232a36] px-2 py-1.5 font-mono text-[12px] text-white" placeholder="Lebar" />
            <span className="text-[#8a94a6]">x</span>
            <input value={ch} onChange={(e) => setCh(e.target.value.replace(/\D/g, ""))} className="w-full rounded bg-[#232a36] px-2 py-1.5 font-mono text-[12px] text-white" placeholder="Tinggi" />
            <span className="font-mono text-[10px] text-[#8a94a6]">px</span>
          </div>
          <button
            onClick={() => {
              const w = Math.min(16384, Math.max(1, Number(cw) || 1920));
              const h = Math.min(16384, Math.max(1, Number(ch) || 1080));
              createNew(`Kustom ${w}x${h}`, w, h);
            }}
            className="mt-2 w-full rounded bg-[#2a3140] px-2 py-1.5 text-[12px] text-white hover:bg-[#343d52]"
          >
            Buat {cw || 1920}x{ch || 1080}
          </button>
        </div>
        <div className="mt-auto space-y-1 text-[10px] text-[#5b6577]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Offline • engine Rust lokal
          </div>
          <div>v0.1.0 • Ctrl+K semua aksi • Del hapus seleksi</div>
        </div>
      </div>

      {/* Konten utama */}
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-white">Terakhir dibuka</h3>
          {recents.length > 0 && (
            <button onClick={clearRecents} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#8a94a6] hover:bg-[#232a36] hover:text-white">
              <Trash2 size={12} /> Bersihkan
            </button>
          )}
        </div>
        {recents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2a3140] p-8 text-center text-[12px] text-[#8a94a6]">
            Belum ada file. Buka gambar atau buat dokumen baru untuk mulai berkarya.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {recents.map((r) => (
              <div key={r.id} className="group relative overflow-hidden rounded-xl border border-[#2a3140] bg-[#191d25] hover:border-[#0a84ff]">
                <button onClick={() => openRecent(r)} className="block w-full text-left" title={r.path ?? r.name}>
                  <div className="grid h-28 place-items-center overflow-hidden bg-[#0e1116]">
                    {r.thumb ? (
                      <img src={r.thumb} alt={r.name} className="max-h-28 w-full object-cover" />
                    ) : (
                      <LayoutGrid size={26} className="text-[#3a4358]" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-[12px] font-medium text-white">{r.name}</div>
                    <div className="font-mono text-[10px] text-[#8a94a6]">
                      {r.w}x{r.h} • {new Date(r.time).toLocaleDateString()}
                      {busy === r.id ? " • membuka..." : ""}
                    </div>
                  </div>
                </button>
                <button onClick={() => removeRecent(r.id)} title="Hapus dari daftar" className="absolute right-1.5 top-1.5 hidden rounded bg-black/70 p-1 text-white group-hover:block">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <h3 className="mb-2 mt-6 text-[14px] font-semibold text-white">Preset dokumen</h3>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => createNew(p.name, p.w, p.h)} className="rounded-xl border border-[#2a3140] bg-[#191d25] p-3 text-left hover:border-[#0a84ff]">
              <div className="grid h-16 place-items-center">
                <div className="rounded border-2 border-[#38a0ff]/70 bg-[#0a84ff]/10" style={{ width: Math.min(120, Math.max(28, (p.w / Math.max(p.w, p.h)) * 120)), height: Math.min(64, Math.max(20, (p.h / Math.max(p.w, p.h)) * 64)) }} />
              </div>
              <div className="mt-1 text-[12px] font-medium text-white">{p.name}</div>
              <div className="font-mono text-[10px] text-[#8a94a6]">{p.w}x{p.h} • {p.desc}</div>
            </button>
          ))}
        </div>

        <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-[14px] font-semibold text-white">
          <Sparkles size={14} className="text-[#38a0ff]" /> Pelajari dalam 1 menit
        </h3>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {[
            { t: "Hapus background 1 klik", d: "Tab AI, lalu Background Remover. 100% offline.", tab: "ai" },
            { t: "Edit non-destruktif", d: "Tab Adjust dan Filter bisa di-toggle dan reorder.", tab: "adjust" },
            { t: "Varian tanpa duplikat", d: "Tab Git: snapshot, branch, compare slider.", tab: "git" },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-[#2a3140] bg-[#191d25] p-3">
              <div className="text-[12px] font-medium text-white">{c.t}</div>
              <div className="mt-0.5 text-[11px] text-[#8a94a6]">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
