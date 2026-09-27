import { useEffect, useRef, useState } from "react";
import { checkBackend } from "../io/tauriIo";
import { useEditorStore } from "../stores/useEditorStore";

const SAMPLES = [
  { src: "/img/1.jpg", label: "Sample 01", sub: "img/1.jpg" },
  { src: "/img/2.jpg", label: "Sample 02", sub: "img/2.jpg" },
];

const STAGES = [
  { step: "Interface", detail: "Workspace, panels, toolbar" },
  { step: "Layers", detail: "Layer and mask manager" },
  { step: "Paint tools", detail: "Brush, pen, healing" },
  { step: "Color pipeline", detail: "Levels, curves, balance" },
  { step: "Adjustments", detail: "18 non destructive items" },
  { step: "Filters", detail: "17 studio filters" },
  { step: "Memory", detail: "Tiled mode, low RAM use" },
  { step: "Session", detail: "Restore last document" },
];

const TIPS = [
  "Ctrl+K opens command search.",
  "Ctrl+S saves full .avx project.",
  "Ctrl+E exports to 6 formats.",
  "Space + drag pans the canvas.",
  "B brush, E eraser, J heal, S stamp.",
  "Alt+click sets clone source.",
  "Ctrl+Z undo, Ctrl+Y redo.",
  "Tiled mode keeps large files light.",
];

export default function BootSplash({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);
  const [bgIdx, setBgIdx] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    SAMPLES.forEach((s) => {
      const img = new Image();
      img.src = s.src;
      img.onload = () => {
        if (mounted.current) setLoaded((p) => ({ ...p, [s.src]: true }));
      };
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTipIdx((v) => (v + 1) % TIPS.length), 3600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBgIdx((v) => (v + 1) % SAMPLES.length), 3400);
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
        if (alive && mounted.current) useEditorStore.getState().setBackend("web-only", "Web preview");
      }
      for (let i = 0; i < STAGES.length; i++) {
        if (!alive) return;
        setIdx(i);
        await new Promise((r) => setTimeout(r, 170 + Math.random() * 110));
      }
      if (!alive) return;
      const wait = Math.max(0, 1600 - (Date.now() - t0));
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

  const pct = Math.min(100, Math.round(((idx + 1) / STAGES.length) * 100));
  const stage = STAGES[idx];
  const sample = SAMPLES[bgIdx];

  return (
    <div
      className={`fixed inset-0 z-[80] overflow-hidden bg-[#0a0a0c] transition-opacity duration-300 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      {SAMPLES.map((s, i) => (
        <img
          key={s.src}
          src={s.src}
          alt={s.label}
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            bgIdx === i ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-black/60" />

      <div className="absolute inset-x-0 top-0 flex items-center gap-3 border-b border-white/10 bg-black/55 px-5 py-3">
        <img
          src="/logo.png"
          alt="AVERO"
          className="h-8 w-8 rounded-md border border-white/15 object-cover"
        />
        <div className="leading-none">
          <div className="text-[13px] font-bold tracking-wide text-white">AVERO STUDIO</div>
          <div className="mt-1 font-mono text-[9px] tracking-widest text-white/55">
            v2.0.0 PROFESSIONAL
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {SAMPLES.map((s, i) => (
              <button
                key={s.src}
                onClick={() => setBgIdx(i)}
                title={s.label}
                className={`h-1.5 rounded-full transition-all ${
                  bgIdx === i ? "w-6 bg-white" : "w-1.5 bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
          <div className="text-right leading-none">
            <div className="font-mono text-[20px] font-bold tabular-nums text-white">{pct}</div>
            <div className="mt-1 font-mono text-[8px] tracking-widest text-white/50">PERCENT</div>
          </div>
        </div>
      </div>

      <div className="absolute left-5 top-20 rounded-md border border-white/15 bg-black/55 px-3 py-2">
        <div className="text-[12px] font-semibold text-white">{sample.label}</div>
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-white/60">
          {sample.sub} {bgIdx + 1}/{SAMPLES.length}
          {!loaded[sample.src] ? " loading" : ""}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#101012]">
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-widest text-[#8fb6f5]">
              STEP {idx + 1}/{STAGES.length} {stage.step.toUpperCase()}
            </div>
            <div className="mt-1 truncate text-[12px] text-[#a7a7b0]">{stage.detail}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[10px] tabular-nums text-[#6e6e78]">
              {idx + 1}/{STAGES.length} modules
            </div>
            <div className="mt-1 font-mono text-[10px] tabular-nums text-white">{pct}%</div>
          </div>
        </div>

        <div className="px-5 pt-2">
          <div className="flex gap-1">
            {STAGES.map((s, i) => (
              <div
                key={s.step}
                title={s.step}
                className={`h-[6px] flex-1 rounded-full ${
                  i < idx + 1 ? "bg-[#2f7cf6]" : "bg-[#232327]"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#232327]">
            <div
              className="h-full rounded-full bg-[#2f7cf6] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between py-2 font-mono text-[10px] tabular-nums text-[#6e6e78]">
            <span>{pct < 100 ? "Loading modules" : "Ready"}</span>
            <span>
              {sample.label} {sample.sub}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-5 py-2.5">
          <span className="shrink-0 font-mono text-[9px] tracking-widest text-[#6e6e78]">TIP</span>
          <span key={tipIdx} className="truncate text-[11px] text-[#a7a7b0]">
            {TIPS[tipIdx]}
          </span>
          <span className="ml-auto hidden shrink-0 gap-3 font-mono text-[10px] text-[#4a4a52] sm:flex">
            <span>Offline</span>
            <span>Non destructive</span>
            <span>No account</span>
          </span>
        </div>
      </div>
    </div>
  );
}
