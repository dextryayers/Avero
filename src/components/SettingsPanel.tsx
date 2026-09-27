import { useEffect, useState } from "react";
import { Cpu, Gauge, MemoryStick, Monitor, RefreshCw, Settings2, X, Zap } from "lucide-react";
import { scanHardware, gpuLabel, type HardwareReport } from "../io/hardware";
import { resetGpuCache } from "../io/gpuCanvas";
import { useSettingsStore, effectiveTile, type EngineDevice, type PerfMode } from "../stores/useSettingsStore";
import { showError } from "../ui/notify";
import clsx from "clsx";

function Seg<T extends string | number>({
  options,
  value,
  onPick,
  label,
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onPick: (v: T) => void;
  label: string;
}) {
  return (
    <div>
      <div className="avero-micro mb-1.5">{label}</div>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-md border border-[#2c2c31] bg-[#101012] p-1">
        {options.map((o) => (
          <button
            key={String(o.id)}
            onClick={() => onPick(o.id)}
            title={o.hint}
            className={clsx(
              "avero-press rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
              value === o.id ? "bg-[#2f7cf6] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onFlip, label, desc }: { on: boolean; onFlip: () => void; label: string; desc: string }) {
  return (
    <button onClick={onFlip} className="flex w-full items-center gap-3 rounded-md border border-[#2c2c31] bg-[#101012] px-3 py-2.5 text-left">
      <span className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-[#2f7cf6]" : "bg-[#2c2c31]")}>
        <span
          className={clsx(
            "avero-knob absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            on ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span>
        <span className="block text-[12px] font-semibold text-white">{label}</span>
        <span className="block text-[11px] text-[#6e6e78]">{desc}</span>
      </span>
    </button>
  );
}

function Bar({ pct }: { pct: number }) {
  const c = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#232327]">
      <div className="avero-bar h-full rounded-full bg-[#2f7cf6] transition-all duration-500" style={{ width: `${c}%` }} />
    </div>
  );
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettingsStore();
  const [report, setReport] = useState<HardwareReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  async function rescan() {
    setBusy(true);
    try {
      resetGpuCache();
      const power = useSettingsStore.getState().device === "cpu" ? "low-power" : "high-performance";
      const r = await scanHardware(power);
      setReport(r);
    } catch (e) {
      await showError(`Hardware scan failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void rescan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p = report?.profile ?? null;
  const rec = report?.recommend ?? null;
  const gpu = report?.gpu ?? null;
  const score = rec?.score ?? 0;
  const ring = 2 * Math.PI * 26;

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div
        className="avero-pop w-[680px] max-w-full overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#2c2c31] px-5 py-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#2f7cf6] text-white">
            <Settings2 size={16} />
          </span>
          <div>
            <div className="text-[13px] font-bold text-white">Control Center</div>
            <div className="text-[11px] text-[#6e6e78]">Hardware scan plus full engine control</div>
          </div>
          <button
            onClick={() => void rescan()}
            disabled={busy}
            className="avero-press ml-auto flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#101012] px-3 text-[11px] text-[#a7a7b0] hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Scanning" : "Rescan"}
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
            <X size={15} />
          </button>
        </div>

        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2">
          <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold text-white">
              <Gauge size={14} className="text-[#8fb6f5]" /> Hardware score
            </div>
            <div className="mt-3 flex items-center gap-4">
              <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                <circle cx="36" cy="36" r="26" fill="none" stroke="#232327" strokeWidth="7" />
                <circle
                  cx="36"
                  cy="36"
                  r="26"
                  fill="none"
                  stroke="#2f7cf6"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={ring}
                  strokeDashoffset={ring - (ring * score) / 100}
                  className="transition-all duration-700"
                />
              </svg>
              <div>
                <div className="font-mono text-[26px] font-bold tabular-nums text-white">{rec ? score : "--"}</div>
                <div className="font-mono text-[10px] text-[#6e6e78]">0 to 100</div>
              </div>
              <div className="min-w-0 flex-1 text-[11px] leading-snug text-[#a7a7b0]">
                {rec ? rec.reason : busy ? "Scanning hardware..." : "No recommendation yet."}
              </div>
            </div>
            {rec && (
              <button
                onClick={() => {
                  s.applyRecommendation({ mode: rec.mode, device: rec.device, tile: rec.tile, history_cap: rec.history_cap });
                  s.set({
                    perfMode: (rec.mode === "eco" || rec.mode === "balanced" || rec.mode === "max" ? rec.mode : "balanced") as PerfMode,
                    device: (rec.device === "cpu" || rec.device === "gpu" ? rec.device : "auto") as EngineDevice,
                  });
                  setApplied(true);
                  setTimeout(() => setApplied(false), 2500);
                }}
                className="avero-press avero-btn-primary mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold text-white"
              >
                <Zap size={13} /> {applied ? "Applied" : `Apply ${rec.mode} preset`}
              </button>
            )}
          </div>

          <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold text-white">
              <Cpu size={14} className="text-[#8fb6f5]" /> Processor and memory
            </div>
            <div className="mt-2.5 space-y-2 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#6e6e78]">CPU</span>
                <span className="truncate text-right font-medium text-white">{p ? p.cpu_brand : busy ? "..." : "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6e6e78]">Cores and threads</span>
                <span className="font-mono tabular-nums text-white">{p ? `${p.cpu_cores} / ${p.cpu_threads}` : "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6e6e78]">System</span>
                <span className="font-mono text-white">{p ? `${p.os} ${p.arch}` : "--"}</span>
              </div>
              <div>
                <div className="mb-1 flex justify-between font-mono text-[10px] tabular-nums text-[#6e6e78]">
                  <span>RAM used</span>
                  <span>{p ? `${p.used_ram_mb} / ${p.total_ram_mb} MB` : "--"}</span>
                </div>
                <Bar pct={p && p.total_ram_mb > 0 ? (p.used_ram_mb / p.total_ram_mb) * 100 : 0} />
              </div>
              <div>
                <div className="mb-1 flex justify-between font-mono text-[10px] tabular-nums text-[#6e6e78]">
                  <span>App footprint</span>
                  <span>{p ? `${p.app_rss_mb} MB` : "--"}</span>
                </div>
                <Bar pct={p && p.total_ram_mb > 0 ? (p.app_rss_mb / p.total_ram_mb) * 100 : 0} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold text-white">
              <Monitor size={14} className="text-[#8fb6f5]" /> Graphics
            </div>
            <div className="mt-2.5 space-y-2 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-[#6e6e78]">Detected</span>
                <span className="truncate text-right font-medium text-white">{gpu ? gpuLabel(gpu) : "..."}</span>
              </div>
              <div className="truncate text-right font-mono text-[10px] text-[#6e6e78]">
                {gpu?.description ?? ""}
              </div>
              <div className="flex justify-between">
                <span className="text-[#6e6e78]">Backend</span>
                <span className="font-mono text-white">{gpu ? gpu.backend : "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6e6e78]">Native render</span>
                <span className="font-mono text-white">
                  tile {report ? report.renderTile : "--"} {report?.fastPath ? "fast" : ""}
                </span>
              </div>
              {!gpu?.available && (
                <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[10.5px] leading-snug text-[#6e6e78]">
                  No WebGPU adapter here, the editor uses the CPU tiled path. RTX, RX, and Intel or AMD iGPUs appear automatically when WebGPU is present.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#161618] p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold text-white">
              <MemoryStick size={14} className="text-[#8fb6f5]" /> Engine
            </div>
            <Seg<PerfMode>
              label="Performance mode"
              value={s.perfMode}
              onPick={(v) => s.set({ perfMode: v })}
              options={[
                { id: "auto", label: "Auto", hint: "Thresholds follow tile and history settings" },
                { id: "eco", label: "Eco", hint: "256px tiles, light path early, history max 4" },
                { id: "balanced", label: "Balanced", hint: "Standard thresholds, history max 8" },
                { id: "max", label: "Max", hint: "1024px tiles, full pipeline longer" },
              ]}
            />
            <Seg<EngineDevice>
              label="Compute device"
              value={s.device}
              onPick={(v) => {
                s.set({ device: v });
                void resetGpuCache();
              }}
              options={[
                { id: "auto", label: "Auto", hint: "High performance adapter when present" },
                { id: "cpu", label: "CPU", hint: "Force the lean CPU tiled path" },
                { id: "gpu", label: "GPU", hint: "Prefer the discrete GPU adapter" },
              ]}
            />
            <Seg<256 | 512 | 1024>
              label={`Render tile, effective ${effectiveTile()}`}
              value={s.tileSize}
              onPick={(v) => s.set({ tileSize: v })}
              options={[
                { id: 256, label: "256", hint: "Smallest RAM per call, more calls" },
                { id: 512, label: "512", hint: "Balanced default" },
                { id: 1024, label: "1024", hint: "Fewer calls, more RAM per call" },
              ]}
            />
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                History cap <span className="font-mono text-white">{s.historyCap}</span>
              </div>
              <input
                type="range"
                min={4}
                max={30}
                value={s.historyCap}
                onChange={(e) => s.set({ historyCap: Number(e.target.value) })}
                className="w-full"
              />
              <div className="mt-1 font-mono text-[10px] text-[#6e6e78]">Large files clamp this down automatically.</div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#161618] p-4 md:col-span-2">
            <div className="text-[12px] font-bold text-white">Studio</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Seg<number>
                label="Crash recovery autosave"
                value={s.autosaveMin}
                onPick={(v) => s.set({ autosaveMin: v })}
                options={[
                  { id: 0, label: "Off" },
                  { id: 1, label: "1 min" },
                  { id: 2, label: "2 min" },
                  { id: 5, label: "5 min" },
                ]}
              />
              <Toggle
                on={s.animations}
                onFlip={() => s.set({ animations: !s.animations })}
                label="Playful interface motion"
                desc="Bouncy popups, sliding toggles, animated meters"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
