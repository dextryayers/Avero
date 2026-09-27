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

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center bg-[#101012] p-4 transition-opacity duration-300 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-[720px] max-w-full">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="AVERO"
            className="h-9 w-9 rounded-md border border-[#2c2c31] object-cover"
          />
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-wide text-white">AVERO STUDIO</div>
            <div className="mt-1 font-mono text-[10px] tracking-wider text-[#6e6e78]">
              v2.0.0 PROFESSIONAL
            </div>
          </div>
          <div className="ml-auto text-right leading-none">
            <div className="font-mono text-[22px] font-bold tabular-nums text-white">{pct}</div>
            <div className="mt-1 font-mono text-[9px] tracking-widest text-[#6e6e78]">PERCENT</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {SAMPLES.map((s) => (
            <div
              key={s.src}
              className="overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]"
            >
              <div className="relative aspect-[16/10] bg-[#161618]">
                {!loaded[s.src] && <div className="absolute inset-0 bg-[#1c1c1f]" />}
                <img
                  src={s.src}
                  alt={s.label}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="flex items-center justify-between border-t border-[#2c2c31] px-3 py-2">
                <span className="text-[11px] font-semibold text-[#ececee]">{s.label}</span>
                <span className="font-mono text-[10px] text-[#6e6e78]">{s.sub}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border border-[#2c2c31] bg-[#1c1c1f]">
          <div className="flex items-center justify-between gap-3 border-b border-[#2c2c31] px-4 py-3">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-widest text-[#8fb6f5]">
                STEP {idx + 1}/{STAGES.length} {stage.step.toUpperCase()}
              </div>
              <div className="mt-1 truncate text-[12px] text-[#a7a7b0]">{stage.detail}</div>
            </div>
            <div className="shrink-0 font-mono text-[10px] tabular-nums text-[#6e6e78]">
              {idx + 1}/{STAGES.length}
            </div>
          </div>

          <div className="px-4 pt-3">
            <div className="h-[4px] overflow-hidden rounded-full bg-[#232327]">
              <div
                className="h-full rounded-full bg-[#2f7cf6] transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between py-2 font-mono text-[10px] tabular-nums text-[#6e6e78]">
              <span>{pct < 100 ? "Loading modules" : "Ready"}</span>
              <span>{pct}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-4 py-2.5">
            <span className="font-mono text-[9px] tracking-widest text-[#6e6e78]">TIP</span>
            <span key={tipIdx} className="truncate text-[11px] text-[#a7a7b0]">
              {TIPS[tipIdx]}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[#4a4a52]">
          <span>Offline</span>
          <span>Non destructive</span>
          <span>No account</span>
          <span className="tabular-nums">AVERO v2.0.0</span>
        </div>
      </div>
    </div>
  );
}
