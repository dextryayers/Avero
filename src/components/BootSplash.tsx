import { useEffect, useRef, useState } from "react";
import { checkBackend } from "../io/tauriIo";
import { useEditorStore } from "../stores/useEditorStore";

const BACKGROUNDS = ["/img/1.jpg", "/img/2.jpg"];

const STAGES = [
  { step: "Menyiapkan antarmuka", detail: "Merangkai workspace, panel, dan toolbar" },
  { step: "Menginisialisasi layer", detail: "Memuat manajer layer, mask, dan blend mode" },
  { step: "Menyiapkan kuas", detail: "Menyiapkan kuas, pen, dan alat gambar presisi" },
  { step: "Menyusun pipeline warna", detail: "Kalibrasi kurva, level, dan keseimbangan warna" },
  { step: "Memuat penumpuk penyesuaian", detail: "Menyiapkan 18 penyesuaian non destruktif" },
  { step: "Menyusun gudang filter", detail: "Menyiapkan 17 filter studio siap pakai" },
  { step: "Mengoptimalkan memori", detail: "Mode ubin untuk dokumen besar, hemat RAM" },
  { step: "Menyiapkan manajemen warna", detail: "Ruang kerja sRGB, Adobe RGB, ProPhoto" },
  { step: "Merapikan kanvas", detail: "Penggaris, panduan, dan kisi kanvas" },
  { step: "Memuat format proyek", detail: "Dukungan penuh berkas .avx" },
  { step: "Mengembalikan sesi", detail: "Memulihkan dokumen terakhir Anda" },
  { step: "Menyempurnakan detail", detail: "Sentuhan akhir sebelum siap dipakai" },
  { step: "Hampir selesai", detail: "Studio siap, semuanya sudah terpasang" },
];

const TIPS = [
  "Tekan Ctrl+K untuk membuka seluruh perintah dalam satu pencarian.",
  "Ctrl+S menyimpan proyek .avx utuh, lengkap dengan seluruh layer dan penyesuaian.",
  "Ctrl+E mengekspor PNG, JPG, WEBP, BMP, TIFF, atau SVG dengan satu klik.",
  "Tahan Space lalu seret untuk menggeser kanvas, scroll untuk zoom.",
  "Tekan V untuk memindahkan layer bebas di kanvas. Tahan Shift untuk snapping.",
  "Tekan B untuk kuas, E untuk penghapus, J untuk perapian, S untuk cap.",
  "Alt+klik menentukan sumber Clone Stamp agar menempel sempurna.",
  "Penumpuk penyesuaian dapat diurutkan ulang, disembunyikan, dan diubah opacitynya.",
  "Gunakan mode ubin otomatis untuk dokumen besar agar tetap ringan dan responsif.",
  "Tekan Ctrl+T untuk transformasi bebas: skala, putar, dan warp dalam satu aksi.",
  "Tekan Ctrl+Z kapan saja untuk mundur, Ctrl+Y untuk maju kembali.",
  "Simpan pekerjaan sesering mungkin, cukup tekan Ctrl+S.",
];

export default function BootSplash({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);
  const [bgIdx, setBgIdx] = useState(0);
  const [bgReady, setBgReady] = useState(false);
  const [pulse, setPulse] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    BACKGROUNDS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((v) => (v + 1) % TIPS.length), 4200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBgIdx((v) => (v + 1) % BACKGROUNDS.length), 5200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setPulse((v) => !v), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    (async () => {
      try {
        const r = await checkBackend();
        if (alive && mounted.current) useEditorStore.getState().setBackend(r.ok ? "online" : "web-only", r.info);
      } catch {
        if (alive && mounted.current) useEditorStore.getState().setBackend("web-only", "Pratinjau web");
      }
      for (let i = 0; i < STAGES.length; i++) {
        if (!alive) return;
        setIdx(i);
        await new Promise((r) => setTimeout(r, 150 + Math.random() * 130));
      }
      if (!alive) return;
      const wait = Math.max(0, 2100 - (Date.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      setFade(true);
      await new Promise((r) => setTimeout(r, 460));
      if (alive) onDone();
    })();
    return () => {
      alive = false;
    };
  }, [onDone]);

  const pct = Math.min(100, Math.round(((idx + 1) / STAGES.length) * 100));
  const stage = STAGES[idx];
  const doneCount = idx + 1;

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#0a0a0c] transition-opacity duration-700 ${fade ? "opacity-0" : "opacity-100"}`}
    >
      {/* Latar foto, tampil satu per satu dengan crossfade */}
      <div className="absolute inset-0">
        {BACKGROUNDS.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            onLoad={() => setBgReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ease-in-out ${
              bgIdx === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/55 to-black/90" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_45%,rgba(47,124,246,0.16),transparent_55%)]" />
        {!bgReady && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#101012] via-[#1c1c1f] to-[#101012]" />
        )}
      </div>

      {/* Logo asli pojok kanan atas */}
      <div className="absolute right-6 top-6 z-20 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/50 px-4 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <img src="/logo.png" alt="AVERO STUDIO" className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/15" />
        <div>
          <div className="text-[12.5px] font-extrabold tracking-wide text-white">AVERO STUDIO</div>
          <div className="font-mono text-[9.5px] tracking-[0.14em] text-white/55">v2.0.0 PROFESSIONAL</div>
        </div>
      </div>

      {/* Kiri: kata kata + loading bar */}
      <div className="relative z-10 flex flex-1 items-center p-7 md:p-12">
        <div className="w-[560px] max-w-full">
          <div className="mb-7">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-black/40 px-3.5 py-1.5 backdrop-blur-md">
              <span className={`h-1.5 w-1.5 rounded-full bg-[#2f7cf6] ${pulse ? "opacity-100 shadow-[0_0_10px_rgba(47,124,246,0.9)]" : "opacity-30"}`} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/85">
                Menyiapkan studio · {pct}%
              </span>
            </div>
            <h1 className="mt-5 text-[34px] font-black leading-[1.02] tracking-tight text-white md:text-[44px]">
              AVERO <span className="text-[#5fa2ff]">STUDIO</span>
            </h1>
            <p className="mt-2.5 max-w-[440px] text-[13px] leading-relaxed text-white/65">
              Studio foto profesional untuk menjelajah warna, lapisan, dan detail. Membuka perangkat Anda sepenuhnya,
              sepenuhnya offline, siap dalam hitungan detik.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#161618]/92 shadow-[0_26px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="border-b border-white/8 px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5fa2ff]" />
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[#5fa2ff]">
                      Tahap {doneCount} dari {STAGES.length}
                    </span>
                  </div>
                  <div className="truncate text-[15px] font-bold leading-tight text-white">{stage.step}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-white/55">{stage.detail}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[26px] font-black leading-none tabular-nums text-white">{pct}</div>
                  <div className="font-mono text-[9px] tracking-[0.18em] text-white/45">PERSEN</div>
                </div>
              </div>
            </div>

            <div className="px-6 pt-4">
              <div className="relative h-2.5 overflow-hidden rounded-full bg-white/8 ring-1 ring-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#2f7cf6] to-[#5fa2ff] transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute inset-y-0 w-32 rounded-full bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  style={{
                    left: `${Math.max(0, pct - 26)}%`,
                    opacity: pct < 100 ? 1 : 0,
                    animation: "avero-shimmer 1.15s ease-in-out infinite",
                  }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-white/45">
                <span className="tabular-nums">
                  {doneCount}/{STAGES.length} modul dimuat
                </span>
                <span className="flex items-center gap-1.5 text-white/75 tabular-nums">
                  <span className="h-1 w-1 rounded-full bg-[#7ad69e]" />
                  {pct < 100 ? "Memuat" : "Siap"}
                </span>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="mb-2 flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-[#5fa2ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-white/45">Tips Studio</span>
              </div>
              <div className="min-h-[34px] text-[12px] leading-relaxed text-white/70 transition-opacity duration-500">
                {TIPS[tipIdx]}
              </div>
              <div className="mt-2 flex gap-1">
                {TIPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === tipIdx ? "w-5 bg-[#5fa2ff]" : "w-1.5 bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/8 bg-black/30 px-6 py-3 font-mono text-[10px] text-white/45">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7ad69e]" />
                Offline · Non destruktif · Tanpa akun
              </span>
              <span className="tracking-[0.14em] tabular-nums">AVERO v2.0.0</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 font-mono text-[10px] text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            <span>Sedang menyiapkan studio foto Anda</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </div>
      </div>

      {/* Bottom bar tipis penuh */}
      <div className="relative z-10 h-1.5 w-full bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-[#2f7cf6] to-[#5fa2ff] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <style>{`@keyframes avero-shimmer { 0% { transform: translateX(-48px); opacity:0 } 50% { opacity:1 } 100% { transform: translateX(140px); opacity:0 } }`}</style>
    </div>
  );
}
