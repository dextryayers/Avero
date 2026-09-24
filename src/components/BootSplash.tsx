import { useEffect, useState } from "react";
import { checkBackend } from "../io/tauriIo";
import { useEditorStore } from "../stores/useEditorStore";

const MODULES = [
  "Workspace dan shortcut",
  "Layer manager",
  "Brush engine",
  "Native C core v2 — 23 ops ringan RAM",
  "Native C++ filters v2 — 20 filters tiled",
  "Rust rayon histogram dan stats",
  "Rust pipeline orchestrator",
  "Adjustment pipeline",
  "Filter stack",
  "Color management",
  "Kanvas dan guides",
  "Proyek .avx utuh",
  "Sesi terakhir",
];

const TIPS = [
  "Ctrl+K membuka semua perintah. Native C/C++ ada di Adjust dan Filter.",
  "Ctrl+S simpan proyek .avx utuh. Semua layer dan edit kembali utuh.",
  "Ctrl+E export PNG, JPG, WEBP, BMP, SVG, TIFF. Matte putih untuk JPG.",
  "Native pipeline: antrekan ops C + filter C++ lalu jalankan satu IPC Rust.",
  "Alt+klik menentukan sumber Clone Stamp. Space+seret untuk pan.",
  "StatusBar: klik Stats untuk mean/std rayon, Bench untuk MP/s.",
  "Tombol V untuk move layer bebas di kanvas. Tahan Shift untuk snap.",
  "Space+seret untuk pan, scroll untuk zoom. Ruler di View menu.",
  "Equalize dan Dither hanya pakai LUT 256, tanpa duplikat gambar.",
  "Box Blur Light tiled 512, overhead <64KB vs full duplicate.",
];

export default function BootSplash({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((v) => (v + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    (async () => {
      try {
        const r = await checkBackend();
        if (alive) useEditorStore.getState().setBackend(r.ok ? "online" : "web-only", r.info);
      } catch {
        if (alive) useEditorStore.getState().setBackend("web-only", "Web preview");
      }
      for (let i = 0; i < MODULES.length; i++) {
        if (!alive) return;
        setIdx(i);
        await new Promise((r) => setTimeout(r, 120 + Math.random() * 110));
      }
      if (!alive) return;
      const wait = Math.max(0, 1900 - (Date.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      setFade(true);
      await new Promise((r) => setTimeout(r, 380));
      if (alive) onDone();
    })();
    return () => {
      alive = false;
    };
  }, [onDone]);

  const pct = Math.round(((idx + 1) / MODULES.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#0a0a0c] transition-opacity duration-500 ${fade ? "opacity-0" : "opacity-100"}`}
    >
      {/* Full bg kedua gambar side-by-side */}
      <div className="absolute inset-0 flex">
        <div className="relative flex-1 overflow-hidden">
          <img src="/img/1.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/35" />
        </div>
        <div className="relative flex-1 overflow-hidden">
          <img src="/img/2.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/35" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/75" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Logo asli pojok kanan atas */}
      <div className="absolute right-5 top-5 z-20 flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 px-3.5 py-2 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
        <img src="/logo.png" alt="AVERO" className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/10" />
        <div>
          <div className="text-[12px] font-bold tracking-wide text-white">AVERO STUDIO</div>
          <div className="font-mono text-[9px] text-white/60">v2.0.0 professional</div>
        </div>
      </div>

      {/* Kiri: kata kata + loading bar */}
      <div className="relative z-10 flex flex-1 items-center p-6 md:p-10">
        <div className="w-[520px] max-w-full">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2f7cf6] animate-pulse" />
              <span className="font-mono text-[10px] tracking-wider text-white/80">MEMUAT EDITOR • {pct}%</span>
            </div>
            <h1 className="mt-4 text-[28px] font-black leading-none tracking-tight text-white md:text-[32px]">
              AVERO STUDIO
            </h1>
            <p className="mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-white/70">
              Professional photo studio — ringan RAM, tiled pipeline. Workspace, layer, brush, 23 ops C dan 20 filters C++.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1f]/90 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="space-y-1.5 px-5 py-4 font-mono text-[11px]">
              {MODULES.slice(Math.max(0, idx - 2), idx + 1).map((m, i, arr) => {
                const isLast = i === arr.length - 1;
                return (
                  <div key={m} className={`flex items-center gap-2 ${isLast ? "text-white" : "text-white/40"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isLast ? "bg-[#2f7cf6] shadow-[0_0_8px_rgba(47,124,246,0.8)]" : "bg-white/20"}`} />
                    <span className="truncate">
                      {isLast ? "Memuat " : "Selesai "}
                      {m.toLowerCase()}
                      {isLast ? "..." : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Loading bar animasi di kiri */}
            <div className="px-5">
              <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#2f7cf6] transition-all duration-300" style={{ width: `${pct}%` }} />
                <div
                  className="absolute inset-y-0 w-28 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  style={{
                    left: `${Math.max(0, pct - 22)}%`,
                    opacity: pct < 100 ? 1 : 0,
                    animation: "avero-shimmer 1.1s ease-in-out infinite",
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-white/40">
                <span>{idx + 1}/{MODULES.length} modul</span>
                <span className="text-white/80">{pct}%</span>
              </div>
            </div>

            <div className="px-5 py-3 text-[11px] leading-relaxed text-white/60">
              <span className="font-semibold text-white/90">Tips. </span>
              {TIPS[tipIdx]}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-5 py-2.5 font-mono text-[10px] text-white/40">
              <span>Offline. Non-destruktif. Tanpa akun.</span>
              <span className="tabular-nums">{idx + 1}/{MODULES.length}</span>
            </div>
          </div>

          <div className="mt-3 font-mono text-[10px] text-white/30">
            Menampilkan kedua gambar dari <span className="text-white/60">/public/img/1.jpg</span> dan <span className="text-white/60">/public/img/2.jpg</span> sebagai background penuh.
          </div>
        </div>
      </div>

      {/* Bottom bar tipis penuh */}
      <div className="relative z-10 h-1 w-full bg-white/5">
        <div className="h-full bg-[#2f7cf6] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <style>{`@keyframes avero-shimmer { 0% { transform: translateX(-40px); opacity:0 } 50% { opacity:1 } 100% { transform: translateX(120px); opacity:0 } }`}</style>
    </div>
  );
}
