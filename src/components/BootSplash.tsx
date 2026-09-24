import { useEffect, useState } from "react";
import { checkBackend } from "../io/tauriIo";
import { useEditorStore } from "../stores/useEditorStore";

const MODULES = [
  "Workspace dan shortcut",
  "Layer manager",
  "Brush engine",
  "Native C core",
  "Native C++ filters",
  "Rust FFI bridge",
  "Adjustment pipeline",
  "Filter stack",
  "Color management",
  "Kanvas dan guides",
  "Proyek .avx",
  "Sesi terakhir",
];

const TIPS = [
  "Ctrl+K membuka semua perintah.",
  "Ctrl+S simpan proyek .avx utuh.",
  "Ctrl+E export PNG, JPG, WEBP, BMP, SVG, TIFF.",
  "Alt+klik menentukan sumber Clone Stamp.",
  "Seret file gambar ke kanvas untuk membuka.",
  "Adjust dan Filter tersimpan non-destruktif.",
  "Tombol V untuk move layer bebas di kanvas.",
  "Space+seret untuk pan, scroll untuk zoom.",
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
      await new Promise((r) => setTimeout(r, 350));
      if (alive) onDone();
    })();
    return () => {
      alive = false;
    };
  }, [onDone]);

  const pct = Math.round(((idx + 1) / MODULES.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-[80] grid place-items-center bg-[#101012] p-4 transition-opacity duration-300 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-[420px] max-w-full rounded-lg border border-[#2c2c31] bg-[#1c1c1f]">
        <div className="flex items-center gap-3 border-b border-[#2c2c31] px-5 py-4">
          <img src="/logo.png" alt="AVERO STUDIO" className="h-11 w-11 rounded-md object-cover" />
          <div>
            <div className="text-[14px] font-bold tracking-wide text-white">AVERO STUDIO</div>
            <div className="font-mono text-[10.5px] text-[#6e6e78]">v2.0.0 professional photo studio</div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-mono text-[11px] text-white">{pct}%</div>
            <div className="font-mono text-[9.5px] text-[#6e6e78]">menyiapkan editor</div>
          </div>
        </div>

        <div className="space-y-1.5 px-5 py-4 font-mono text-[11px]">
          {MODULES.slice(Math.max(0, idx - 2), idx + 1).map((m, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <div key={m} className={`flex items-center gap-2 ${isLast ? "text-white" : "text-[#6e6e78]"}`}>
                <span className={`h-1 w-1 rounded-full ${isLast ? "bg-[#2f7cf6]" : "bg-[#3a3a41]"}`} />
                <span className="truncate">
                  {isLast ? "Memuat " : "Selesai "}
                  {m.toLowerCase()}
                  {isLast ? "..." : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-5">
          <div className="h-1 overflow-hidden rounded-full bg-[#2c2c31]">
            <div className="h-full rounded-full bg-[#2f7cf6] transition-all duration-200" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="px-5 py-3 text-[11px] text-[#6e6e78]">
          <span className="font-semibold text-[#a7a7b0]">Tips. </span>
          {TIPS[tipIdx]}
        </div>

          <div className="flex items-center justify-between border-t border-[#2c2c31] px-5 py-2.5 font-mono text-[10px] text-[#6e6e78]">
            <span>Offline. Non-destruktif. Tanpa akun.</span>
            <span>
              {idx + 1}/{MODULES.length}
            </span>
          </div>
      </div>
    </div>
  );
}
