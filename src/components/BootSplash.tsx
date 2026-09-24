import { useEffect, useState } from "react";
import { checkBackend } from "../io/tauriIo";
import { useEditorStore } from "../stores/useEditorStore";

const STEPS = ["Memuat workspace", "Menghubungkan Rust engine", "Menyiapkan kanvas"];

// Loading screen saat boot: progress jujur mengikuti tahap init nyata,
// minimal tampil 1 detik agar logo terbaca, lalu fade out.
export default function BootSplash({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [fade, setFade] = useState(false);
  const [engine, setEngine] = useState("...");

  useEffect(() => {
    let alive = true;
    const t0 = Date.now();
    (async () => {
      setStep(0);
      await new Promise((r) => setTimeout(r, 280));
      if (!alive) return;
      setStep(1);
      try {
        const r = await checkBackend();
        if (!alive) return;
        setEngine(r.ok ? r.info : "Mode web");
        useEditorStore.getState().setBackend(r.ok ? "online" : "web-only", r.info);
      } catch {
        if (alive) setEngine("Mode web");
      }
      if (!alive) return;
      setStep(2);
      const wait = Math.max(0, 1000 - (Date.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      setFade(true);
      await new Promise((r) => setTimeout(r, 420));
      if (alive) onDone();
    })();
    return () => {
      alive = false;
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[80] grid place-items-center bg-[#101319] transition-opacity duration-500 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-[340px] text-center">
        <img
          src="/logo.png"
          alt="AVERO"
          className="mx-auto h-28 w-28 rounded-2xl object-cover shadow-[0_0_60px_rgba(10,132,255,0.45)]"
        />
        <div className="mt-4 text-[17px] font-bold tracking-[0.2em] text-white">AVERO STUDIO</div>
        <div className="mt-1 text-[11px] text-[#8a94a6]">Open source photo editor • v0.1.0 • offline</div>
        <div className="mt-5 h-1 overflow-hidden rounded bg-[#232a36]">
          <div
            className="h-full rounded bg-gradient-to-r from-[#0a84ff] to-[#38e1ff] transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 font-mono text-[10px] text-[#8a94a6]">
          {STEPS[step]} • {engine}
        </div>
      </div>
    </div>
  );
}
