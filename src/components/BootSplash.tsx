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
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((v) => (v + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBgIdx((v) => (v + 1) % 2), 4200);
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
      {/* Full bg dari public/img */}
      <div className="absolute inset-0">
        <img
          src="/img/1.jpg"
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ${bgIdx === 0 ? "opacity-100" : "opacity-0"}`}
        />
        <img
          src="/img/2.jpg"
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ${bgIdx === 1 ? "opacity-100" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80" />
        <div className="absolute inset-0 bg-[#0a0a0c]/30" />
        {/* subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Logo asli pojok kanan atas */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md">
        <img src="/logo.png" alt="AVERO" className="h-7 w-7 rounded-md object-cover ring-1 ring-white/10" />
        <div>
          <div className="text-[11px] font-bold tracking-wide text-white">AVERO STUDIO</div>
          <div className="font-mono text-[9px] text-white/60">v2.0.0 professional</div>
        </div>
      </div>

      {/* Tengah: card loading profesional di atas bg full */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="w-[480px] max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1f]/85 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <img src="/logo.png" alt="AVERO STUDIO" className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/10" />
            <div>
              <div className="text-[14px] font-bold tracking-wide text-white">AVERO STUDIO</div>
              <div className="font-mono text-[10.5px] text-white/50">v2.0.0 professional photo studio — ringan RAM, tiled pipeline</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-[11px] font-bold text-white">{pct}%</div>
              <div className="font-mono text-[9.5px] text-white/50">menyiapkan editor</div>
            </div>
          </div>

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

          {/* Animasi loading bar */}
          <div className="px-5">
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#2f7cf6] transition-all duration-300" style={{ width: `${pct}%` }} />
              {/* shimmer */}
              <div
                className="absolute inset-y-0 w-24 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{
                  left: `${Math.max(0, pct - 18)}%`,
                  opacity: pct < 100 ? 1 : 0,
                  animation: "avero-shimmer 1.2s ease-in-out infinite",
                }}
              />
              <div className="absolute inset-0 rounded-full bg-white/5" style={{ animation: pct < 100 ? "avero-pulse 1.8s ease-in-out infinite" : undefined }} />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-white/40">
              <span>{idx + 1}/{MODULES.length} modul</span>
              <span>{pct < 100 ? "memuat" : "siap"}</span>
            </div>
          </div>

          <div className="px-5 py-3 text-[11px] text-white/60">
            <span className="font-semibold text-white/90">Tips. </span>
            {TIPS[tipIdx]}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-5 py-2.5 font-mono text-[10px] text-white/40">
            <span>Offline. Non-destruktif. Tanpa akun. Ringan RAM tiled 512.</span>
            <span className="tabular-nums">{idx + 1}/{MODULES.length}</span>
          </div>
        </div>
      </div>

      {/* Bottom bar tipis */}
      <div className="relative z-10 h-1 w-full bg-white/5">
        <div className="h-full bg-[#2f7cf6] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <style>{`@keyframes avero-shimmer { 0% { transform: translateX(-40px); opacity:0 } 50% { opacity:1 } 100% { transform: translateX(120px); opacity:0 } } @keyframes avero-pulse { 0%,100% { opacity:0.2 } 50% { opacity:0.5 } }`}</style>
    </div>
  );
}
