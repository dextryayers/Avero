import { useEffect, useMemo, useState } from "react";
import { checkBackend } from "../io/tauriIo";
import { useEditorStore } from "../stores/useEditorStore";

const MODULES = [
  "Menghubungkan Rust engine",
  "Memuat workspace & shortcut",
  "Menyiapkan layer manager",
  "Mengompilasi brush engine",
  "Memuat adjustment pipeline",
  "Memuat filter stack GPU",
  "Menyiapkan color management",
  "Menyiapkan AI lokal offline",
  "Menyiapkan kanvas & guides",
  "Memulihkan sesi terakhir",
];

const TIPS = [
  "Tips: Tekan Ctrl+K untuk semua aksi — open, export, filter, AI.",
  "Tips: M bolak-balik Rect/Ellipse select, U putar Shape tools.",
  "Tips: Alt+klik untuk tentukan sumber Clone Stamp.",
  "Tips: Seret file gambar dari Explorer langsung ke kanvas.",
  "Tips: Tab Adjust & Filter 100% non-destruktif dan bisa reorder.",
];

export default function BootSplash({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);
  const [engine, setEngine] = useState("Menghubungkan…");
  const tip = useMemo(() => TIPS[Math.floor(Date.now() / 3000) % TIPS.length], []);
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((v) => (v + 1) % TIPS.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    (async () => {
      // Tahap nyata pertama: cek backend
      try {
        const r = await checkBackend();
        if (!alive) return;
        setEngine(r.ok ? r.info : "Mode web (Rust tidak terdeteksi)");
        useEditorStore.getState().setBackend(r.ok ? "online" : "web-only", r.info);
      } catch {
        if (alive) {
          setEngine("Mode web");
          useEditorStore.getState().setBackend("web-only", "Web preview");
        }
      }
      // Animasi modul ala Photoshop — cepat tapi terbaca
      for (let i = 0; i < MODULES.length; i++) {
        if (!alive) return;
        setIdx(i);
        await new Promise((r) => setTimeout(r, 130 + Math.random() * 120));
      }
      if (!alive) return;
      const wait = Math.max(0, 2100 - (Date.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      setFade(true);
      await new Promise((r) => setTimeout(r, 450));
      if (alive) onDone();
    })();
    return () => {
      alive = false;
    };
  }, [onDone]);

  const pct = Math.round(((idx + 1) / MODULES.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-[80] grid place-items-center bg-[#05070b] p-4 transition-opacity duration-500 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#0a84ff]/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[420px] rounded-full bg-[#38e1ff]/10 blur-[100px]" />
      </div>

      <div className="animate-fade-up relative w-[460px] max-w-full overflow-hidden rounded-2xl border border-[#232b3d] bg-gradient-to-b from-[#141a27] to-[#0b0e14] shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
        {/* Top accent line */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#0a84ff] via-[#38e1ff] to-[#0a84ff]" />

        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <img
              src="/logo.png"
              alt="AVERO STUDIO"
              className="animate-glow-pulse h-20 w-20 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-[19px] font-extrabold tracking-[0.18em] text-white">
                AVERO
              </div>
              <div className="text-[11px] font-semibold tracking-[0.42em] text-[#38a0ff]">
                STUDIO
              </div>
              <div className="mt-1.5 text-[11px] text-[#8a94a6]">
                Professional Photo Studio • v2.0.0 • offline-first
              </div>
            </div>
            <div className="rounded-md border border-[#232b3d] bg-black/40 px-2 py-1 font-mono text-[10px] text-[#8a94a6]">
              {pct}%
            </div>
          </div>

          {/* Module loader ala Photoshop */}
          <div className="mt-5 space-y-1.5 font-mono text-[11px]">
            {MODULES.slice(Math.max(0, idx - 3), idx + 1).map((m, i, arr) => {
              const isLast = i === arr.length - 1;
              return (
                <div
                  key={m}
                  className={`flex items-center gap-2 ${
                    isLast ? "text-white" : "text-[#5b6577]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isLast ? "bg-[#38e1ff] shadow-[0_0_8px_#38e1ff]" : "bg-[#2a3140]"
                    }`}
                  />
                  <span className="truncate">
                    {isLast ? "▸ " : "✓ "} {m}…
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="mt-4 h-[6px] overflow-hidden rounded-full bg-[#1b2130]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0a84ff] to-[#38e1ff] transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#5b6577]">
            <span className="truncate">{engine}</span>
            <span>
              {idx + 1}/{MODULES.length}
            </span>
          </div>

          {/* Tips rotator */}
          <div className="mt-4 rounded-lg border border-[#232b3d] bg-black/30 px-3 py-2 text-[11px] text-[#c5cddc]">
            <span className="font-semibold text-[#38e1ff]">AVERO </span>
            {TIPS[tipIdx] ?? tip}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#1c2333] bg-black/40 px-5 py-2.5 text-[10px] text-[#5b6577]">
          <span>© 2026 AVERO STUDIO • Open Source • Non-destruktif</span>
          <span className="font-mono">build stable</span>
        </div>
      </div>
    </div>
  );
}
