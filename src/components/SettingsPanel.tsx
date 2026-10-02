import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Brush,
  Cpu,
  Gauge,
  HardDrive,
  Keyboard,
  Layout,
  MemoryStick,
  Monitor,
  Palette,
  RefreshCw,
  Settings2,
  Zap,
} from "lucide-react";
import { scanHardware, gpuLabel, type HardwareReport } from "../io/hardware";
import { resetGpuCache } from "../io/gpuCanvas";
import { useSettingsStore, effectiveTile, type EngineDevice, type PerfMode } from "../stores/useSettingsStore";
import { useShallow } from "zustand/shallow";
import { EDIT_SHORTCUTS } from "../app/shortcuts";
import { loadShortcuts } from "../stores/useWorkspaceStore";
import { Kbd } from "../ui/atoms";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { clearRecovery } from "../engine/recovery";
import { layerManager } from "../engine/layerManager";
import { showError, askConfirm } from "../ui/notify";
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

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="shrink-0 text-[#6e6e78]">{k}</span>
      <span className={clsx("truncate text-right font-medium text-white", mono && "font-mono tabular-nums")}>{v}</span>
    </div>
  );
}

function SectionHead({ title, info }: { title: string; info: string }) {
  return (
    <div className="mb-3">
      <div className="text-[14px] font-bold text-white">{title}</div>
      <div className="mt-0.5 max-w-[720px] text-[12px] leading-relaxed text-[#a7a7b0]">{info}</div>
    </div>
  );
}

type TabId = "hardware" | "engine" | "canvas" | "tools" | "shortcuts" | "workspace";

const TABS: { id: TabId; label: string; desc: string; icon: typeof Cpu }[] = [
  { id: "hardware", label: "Hardware", desc: "Device scan and score", icon: Cpu },
  { id: "engine", label: "Engine", desc: "Speed, device, tiles", icon: Gauge },
  { id: "canvas", label: "Canvas", desc: "Rulers, grid, zoom", icon: Layout },
  { id: "tools", label: "Tools", desc: "Brush defaults", icon: Brush },
  { id: "shortcuts", label: "Shortcuts", desc: "Every key, one table", icon: Keyboard },
  { id: "workspace", label: "Studio", desc: "Save, motion, storage", icon: Palette },
];

const TAB_INFO: Record<TabId, { title: string; info: string }> = {
  hardware: {
    title: "Hardware detection",
    info: "Live scan of CPU, memory and graphics. The score picks a safe starting preset, and Apply copies that preset into the Engine tab. Rescan after plugging in a GPU or closing heavy apps.",
  },
  engine: {
    title: "Render engine",
    info: "Controls how pixels are processed. Small tiles use less RAM per call but need more calls. Eco goes light early, Max keeps full quality longer. Changes apply instantly to the next stroke or filter.",
  },
  canvas: {
    title: "Canvas and view",
    info: "Defaults for new documents plus live view controls. Toggles marked live apply to the open document right away and are remembered for the next one.",
  },
  tools: {
    title: "Brush and tools",
    info: "Starting values for all 174 tools. Size, Hardness and Strength in the top options bar still override these per stroke. Use Apply to push the defaults into the current brush.",
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    info: "Every shortcut in one table, grouped by area. Single letters pick tools (Shift cycles the family); Ctrl combos edit, save and zoom. Shortcuts never fire while typing in a text field.",
  },
  workspace: {
    title: "Studio and storage",
    info: "Autosave, interface motion and local storage. Recovery snapshots protect against crashes. Nuke canvas is the emergency free for stuck GPU memory.",
  },
};

export default function SettingsPanel({ onBack }: { onBack: () => void }) {
  // Granular subscription: re-renders only when a displayed setting changes,
  // never on unrelated store churn.
  const s = useSettingsStore(
    useShallow((st) => ({
      perfMode: st.perfMode,
      device: st.device,
      tileSize: st.tileSize,
      historyCap: st.historyCap,
      autosaveMin: st.autosaveMin,
      animations: st.animations,
      showRulersOnStart: st.showRulersOnStart,
      showGridOnStart: st.showGridOnStart,
      snapOnStart: st.snapOnStart,
      autoFitOnOpen: st.autoFitOnOpen,
      defaultBrushSize: st.defaultBrushSize,
      defaultHardness: st.defaultHardness,
      brushSmoothing: st.brushSmoothing,
      confirmDestructive: st.confirmDestructive,
      themeMode: st.themeMode,
      canvasQuality: st.canvasQuality,
      maxZoom: st.maxZoom,
      set: st.set,
      applyRecommendation: st.applyRecommendation,
      resetAll: st.resetAll,
    })),
  );
  const [report, setReport] = useState<HardwareReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [tab, setTab] = useState<TabId>("hardware");

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement?.tagName;
      if (e.key === "Escape" && ae !== "INPUT" && ae !== "TEXTAREA" && ae !== "SELECT") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const p = report?.profile ?? null;
  const rec = report?.recommend ?? null;
  const gpu = report?.gpu ?? null;
  const web = report?.web ?? null;
  const score = rec?.score ?? 0;
  const ring = 2 * Math.PI * 26;

  const memPct = useMemo(() => {
    if (!p || p.total_ram_mb <= 0) return 0;
    return (p.used_ram_mb / p.total_ram_mb) * 100;
  }, [p]);

  function applyRec() {
    if (!rec) return;
    s.applyRecommendation({ mode: rec.mode, device: rec.device, tile: rec.tile, history_cap: rec.history_cap });
    s.set({
      perfMode: (rec.mode === "eco" || rec.mode === "balanced" || rec.mode === "max" ? rec.mode : "balanced") as PerfMode,
      device: (rec.device === "cpu" || rec.device === "gpu" ? rec.device : "auto") as EngineDevice,
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  }

  const info = TAB_INFO[tab];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#101012]">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#2c2c31] bg-[#1c1c1f] px-4">
        <button
          onClick={onBack}
          title="Back (Esc)"
          className="avero-press flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#161618] px-2.5 text-[12px] font-medium text-[#c9c9d1] hover:border-[#3a3a41] hover:text-white"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#2f7cf6] text-white">
            <Settings2 size={16} />
          </span>
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-wide text-white">SETTINGS</div>
            <div className="mt-1 text-[10px] text-[#6e6e78]">Control Center, hardware scan plus full engine control</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded border border-[#2c2c31] bg-[#101012] px-2 py-1 font-mono text-[10px] text-[#a7a7b0] sm:flex">
            {report?.webOnly ? "WEB" : "NATIVE"} · tile {report ? report.renderTile : "--"}
            {report?.fastPath ? " · fast" : " · lean"}
          </span>
          <button
            onClick={() => void rescan()}
            disabled={busy}
            className="avero-press flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#161618] px-3 text-[12px] font-medium text-[#c9c9d1] hover:border-[#3a3a41] hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Scanning" : "Rescan"}
          </button>
          <button
            onClick={async () => {
              if (await askConfirm("Reset all settings to defaults?")) s.resetAll();
            }}
            className="hidden h-8 items-center rounded-md bg-[#232327] px-3 text-[12px] text-[#a7a7b0] hover:text-white sm:flex"
          >
            Reset defaults
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[208px] shrink-0 flex-col gap-1 border-r border-[#2c2c31] bg-[#1c1c1f] p-3">
          <div className="avero-micro px-2 pb-1 pt-1">Sections</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.desc}
              className={clsx(
                "avero-lift rounded-md px-3 py-2 text-left",
                tab === t.id ? "bg-[#2f7cf6] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <span className="flex items-center gap-2 text-[12px] font-semibold">
                <t.icon size={14} /> {t.label}
              </span>
              <span className={clsx("mt-0.5 block text-[10.5px]", tab === t.id ? "text-white/70" : "text-[#6e6e78]")}>
                {t.desc}
              </span>
            </button>
          ))}
          <div className="mt-auto rounded-lg border border-[#2c2c31] bg-[#161618] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
              <Zap size={12} className="text-[#8fb6f5]" /> Tip
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#a7a7b0]">
              {rec ? rec.reason : "Run Rescan to get a preset recommendation for this device."}
            </div>
            {rec && (
              <button
                onClick={applyRec}
                className="avero-btn-primary mt-2 flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[11px] font-semibold text-white"
              >
                <Zap size={12} /> {applied ? "Applied" : `Apply ${rec.mode} preset`}
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="avero-fade-in mx-auto w-full max-w-[1020px] p-5" key={tab}>
            <SectionHead title={info.title} info={info.info} />
            {tab === "hardware" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <Gauge size={14} className="text-[#8fb6f5]" /> Hardware score
                  </div>
                  <div className="mt-1 text-[11px] text-[#6e6e78]">0 to 100 from CPU cores plus RAM plus GPU presence.</div>
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
                      onClick={applyRec}
                      className="avero-press avero-btn-primary mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold text-white"
                    >
                      <Zap size={13} /> {applied ? "Applied" : `Apply ${rec.mode} preset`}
                    </button>
                  )}
                  <div className="mt-2 font-mono text-[10px] leading-relaxed text-[#6e6e78]">
                    auto bands: eco up to 41, balanced 42 to 71, max from 72
                  </div>
                </div>

                <div className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <Cpu size={14} className="text-[#8fb6f5]" /> Processor and memory
                  </div>
                  <div className="mt-1 text-[11px] text-[#6e6e78]">Native values come from Rust sysinfo, web values from the browser.</div>
                  <div className="mt-2.5 space-y-2">
                    <Row k="CPU" v={p ? p.cpu_brand : busy ? "Scanning..." : "Unknown"} />
                    <Row k="Cores / threads" v={p ? `${p.cpu_cores} / ${p.cpu_threads}` : "--"} mono />
                    <Row k="System" v={p ? `${p.os} ${p.arch}` : "--"} mono />
                    <Row k="Cores (web)" v={web ? String(web.cores) : "--"} mono />
                    <Row k="Device RAM" v={web?.deviceMemoryGb ? `${web.deviceMemoryGb} GB` : p ? `${p.total_ram_mb} MB` : "--"} mono />
                    <div>
                      <div className="mb-1 flex justify-between font-mono text-[10px] tabular-nums text-[#6e6e78]">
                        <span>RAM used</span>
                        <span>{p ? `${p.used_ram_mb} / ${p.total_ram_mb} MB` : "--"}</span>
                      </div>
                      <Bar pct={memPct} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between font-mono text-[10px] tabular-nums text-[#6e6e78]">
                        <span>App heap</span>
                        <span>{p ? `${p.app_rss_mb} MB` : "--"}</span>
                      </div>
                      <Bar pct={p && p.total_ram_mb > 0 ? (p.app_rss_mb / p.total_ram_mb) * 100 : 0} />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <Monitor size={14} className="text-[#8fb6f5]" /> Graphics, WebGPU and WebGL
                  </div>
                  <div className="mt-1 text-[11px] text-[#6e6e78]">WebGPU maps to Vulkan, Metal or DirectX 12. WebGL maps to OpenGL or ANGLE.</div>
                  <div className="mt-2.5 space-y-2">
                    <Row k="Detected" v={gpu ? gpuLabel(gpu) : "Scanning..."} />
                    <div className="truncate font-mono text-[10px] text-[#6e6e78]">{gpu?.description ?? ""}</div>
                    <Row k="Backend" v={gpu ? gpu.backend : "--"} mono />
                    <Row k="Vendor" v={gpu?.vendor || web?.webglVendor || "--"} />
                    <Row k="Native render" v={`tile ${report ? report.renderTile : "--"} ${report?.fastPath ? "fast" : "lean"}`} mono />
                    <Row k="Max texture" v={web?.maxTexture ? `${web.maxTexture}px` : "--"} mono />
                    <Row k="Screen" v={web ? `${web.screenW}x${web.screenH} @${web.dpr}x${web.touch ? " touch" : ""}` : "--"} mono />
                    {!gpu?.available && (
                      <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[10.5px] leading-snug text-[#6e6e78]">
                        No WebGPU here, so WebGL fallback is active and the editor uses the CPU tiled path. RTX, RX and iGPUs appear automatically when WebGPU is present.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <MemoryStick size={14} className="text-[#8fb6f5]" /> Platform
                  </div>
                  <div className="mt-1 text-[11px] text-[#6e6e78]">Where the app runs and how many threads the engine may use.</div>
                  <div className="mt-2.5 space-y-2">
                    <Row k="Mode" v={report?.webOnly ? "Web (browser)" : "Tauri native"} />
                    <Row k="Threads" v={report ? String(report.rayonThreads) : "--"} mono />
                    <Row k="UA" v={web ? web.ua.slice(0, 64) : "--"} />
                    <Row k="Heap live" v={web?.heapMb ? `${web.heapMb} MB` : "--"} mono />
                    <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[10.5px] leading-snug text-[#6e6e78]">
                      Web scan uses cores, device memory, WebGL renderer, heap and screen. Native scan adds Rust sysinfo plus render caps when running in Tauri.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "engine" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <MemoryStick size={14} className="text-[#8fb6f5]" /> Engine
                  </div>
                  <div className="text-[11px] text-[#6e6e78]">Pick speed vs quality. Effective values show what the canvas really uses.</div>
                  <Seg<PerfMode>
                    label="Performance mode"
                    value={s.perfMode}
                    onPick={(v) => s.set({ perfMode: v })}
                    options={[
                      { id: "auto", label: "Auto", hint: "Follows recommendation plus doc size" },
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
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <Monitor size={14} className="text-[#8fb6f5]" /> Render quality
                  </div>
                  <div className="text-[11px] text-[#6e6e78]">Draft previews fast while painting, Best renders full quality every frame.</div>
                  <Seg<"draft" | "balanced" | "best">
                    label="Canvas quality"
                    value={s.canvasQuality}
                    onPick={(v) => s.set({ canvasQuality: v })}
                    options={[
                      { id: "draft", label: "Draft", hint: "Fast preview while painting" },
                      { id: "balanced", label: "Balanced", hint: "Default full quality on release" },
                      { id: "best", label: "Best", hint: "Always full pipeline, slower on low end PCs" },
                    ]}
                  />
                  <Seg<number>
                    label="Max zoom"
                    value={s.maxZoom}
                    onPick={(v) => s.set({ maxZoom: v })}
                    options={[
                      { id: 400, label: "400%" },
                      { id: 800, label: "800%" },
                      { id: 1600, label: "1600%" },
                      { id: 3200, label: "3200%" },
                    ]}
                  />
                  <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[10.5px] leading-snug text-[#6e6e78]">
                    Draft skips adjust and filter passes while a stroke is wet (same fast path the canvas already uses). Best forces full quality every frame.
                  </div>
                  <button
                    onClick={() => {
                      resetGpuCache();
                      void rescan();
                    }}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-[#232327] text-[11px] text-white hover:bg-[#2c2c31]"
                  >
                    <RefreshCw size={12} /> Flush GPU cache plus rescan
                  </button>
                </div>
              </div>
            )}

            {tab === "canvas" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="text-[12px] font-bold text-white">View defaults (live)</div>
                  <div className="text-[11px] text-[#6e6e78]">These apply to the open document now and are remembered for new ones.</div>
                  <Toggle on={s.showRulersOnStart} onFlip={() => s.set({ showRulersOnStart: !s.showRulersOnStart })} label="Rulers on start" desc="Pixel rulers plus guide drag" />
                  <Toggle on={s.showGridOnStart} onFlip={() => s.set({ showGridOnStart: !s.showGridOnStart })} label="Grid on start" desc="Pro grid overlay for alignment" />
                  <Toggle on={s.snapOnStart} onFlip={() => s.set({ snapOnStart: !s.snapOnStart })} label="Snap on start" desc="Guides plus grid plus center snap" />
                  <Toggle on={s.autoFitOnOpen} onFlip={() => s.set({ autoFitOnOpen: !s.autoFitOnOpen })} label="Auto-fit on open" desc="Fit document after open and drop" />
                  <CanvasLiveControls />
                </div>
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="text-[12px] font-bold text-white">Theme plus guides</div>
                  <div className="text-[11px] text-[#6e6e78]">Look of the studio plus helpers drawn over the canvas.</div>
                  <Seg<"dark" | "light">
                    label="Interface theme"
                    value={s.themeMode}
                    onPick={(v) => {
                      s.set({ themeMode: v });
                      useEditorStore.getState().theme !== v && useEditorStore.setState({ theme: v });
                    }}
                    options={[
                      { id: "dark", label: "Dark", hint: "Studio dark (default)" },
                      { id: "light", label: "Light", hint: "Bright review mode" },
                    ]}
                  />
                  <GuideControls />
                </div>
              </div>
            )}

            {tab === "tools" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="text-[12px] font-bold text-white">Brush defaults (apply to all 174 tools)</div>
                  <div className="text-[11px] text-[#6e6e78]">Starting point for every brush family. Per-stroke sliders still win.</div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                      Default size <span className="font-mono text-white">{s.defaultBrushSize}px</span>
                    </div>
                    <input type="range" min={1} max={300} value={s.defaultBrushSize} onChange={(e) => s.set({ defaultBrushSize: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                      Default hardness <span className="font-mono text-white">{s.defaultHardness}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={s.defaultHardness} onChange={(e) => s.set({ defaultHardness: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                      Stroke smoothing <span className="font-mono text-white">{s.brushSmoothing}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={s.brushSmoothing} onChange={(e) => s.set({ brushSmoothing: Number(e.target.value) })} className="w-full" />
                    <div className="mt-1 font-mono text-[10px] text-[#6e6e78]">Higher means steadier long strokes with slightly more lag.</div>
                  </div>
                  <button
                    onClick={() => {
                      useEditorStore.getState().setBrush({ size: s.defaultBrushSize, hardness: s.defaultHardness });
                    }}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-[#232327] text-[11px] text-white hover:bg-[#2c2c31]"
                  >
                    <Brush size={12} /> Apply defaults to current brush
                  </button>
                </div>
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="text-[12px] font-bold text-white">Safety</div>
                  <div className="text-[11px] text-[#6e6e78]">Confirmations before pixels are merged or filled for good.</div>
                  <Toggle on={s.confirmDestructive} onFlip={() => s.set({ confirmDestructive: !s.confirmDestructive })} label="Confirm destructive ops" desc="Merge, flatten and pattern fill ask first" />
                  <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[10.5px] leading-snug text-[#6e6e78]">
                    All 174 tools share Size, Hardness and Strength from the top options bar. These defaults reset the bar for every family at once.
                  </div>
                </div>
              </div>
            )}

            {tab === "workspace" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="text-[12px] font-bold text-white">Studio</div>
                  <div className="text-[11px] text-[#6e6e78]">Autosave protects work, motion keeps the interface alive.</div>
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
                  <Toggle on={s.animations} onFlip={() => s.set({ animations: !s.animations })} label="Playful interface motion" desc="Bouncy popups, sliding toggles, animated meters" />
                </div>
                <div className="space-y-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                    <HardDrive size={14} className="text-[#8fb6f5]" /> Storage and recovery
                  </div>
                  <div className="text-[11px] text-[#6e6e78]">Local keys only, nothing leaves this device.</div>
                  <button
                    onClick={async () => {
                      if (await askConfirm("Discard the autosaved recovery snapshot?")) clearRecovery();
                    }}
                    className="flex h-8 w-full items-center justify-center rounded-md bg-[#232327] text-[11px] text-white hover:bg-[#2c2c31]"
                  >
                    Clear recovery snapshot
                  </button>
                  <button
                    onClick={async () => {
                      if (!(await askConfirm("Clear all layer pixels plus history? Document resets to blank."))) return;
                      layerManager.clear();
                      useEditorStore.getState().newDocument("Untitled", 1920, 1080);
                    }}
                    className="flex h-8 w-full items-center justify-center rounded-md border border-red-900 bg-[#2a1414] text-[11px] text-red-200 hover:bg-[#3a1a1a]"
                  >
                    Nuke canvas (free GPU/RAM)
                  </button>
                  <div className="font-mono text-[10px] leading-relaxed text-[#6e6e78]">
                    settings key avero-settings-v2 · workspace avero-workspace · recovery avero-recovery
                  </div>
                </div>
              </div>
            )}

            {tab === "shortcuts" && <ShortcutsView />}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-[#2c2c31] bg-[#1c1c1f] px-4 py-2 font-mono text-[10px] text-[#6e6e78]">
        <span>Esc goes back</span>
        <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
        <span>Ctrl+, toggles Settings</span>
        <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
        <span className="hidden sm:block">Changes save instantly to this device</span>
        <span className="ml-auto hidden md:block">avero-settings-v2</span>
      </div>
    </div>
  );
}

function shortcutGroup(combo: string, label: string): string {
  if (/^(Ctrl\+(S|O|E|K|N|W)|Ctrl\+Shift\+(S|O|E))/.test(combo) || label === "Settings") return "File & app";
  if (/^(Ctrl\+(\+|-|0|1)|Ctrl\+R|Ctrl\+;|')/.test(combo) || /Levels|Curves|Zoom|Rulers|Guides|Grid/.test(label)) return "View & adjust";
  if (/^(\[|Shift\+\[|1\.\.0|X \/ D|Space|Arrows|,|\.)/.test(combo) || /Brush|Hardness|Opacity|Colors|Hand|Nudge|Rotate/.test(label)) return "Brush & canvas";
  return "Edit & history";
}

function ShortcutsView() {
  const groups = useMemo(() => {
    const map = new Map<string, typeof EDIT_SHORTCUTS>();
    for (const sc of EDIT_SHORTCUTS) {
      const g = shortcutGroup(sc.combo, sc.label);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(sc);
    }
    return ["Edit & history", "File & app", "View & adjust", "Brush & canvas"]
      .filter((g) => map.has(g))
      .map((g) => ({ name: g, items: map.get(g)! }));
  }, []);
  const toolKeys = useMemo(() => {
    const entries = Object.entries(loadShortcuts());
    entries.sort((a, b) => a[1].localeCompare(b[1]));
    return entries;
  }, []);
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {groups.map((g) => (
        <div key={g.name} className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
          <div className="text-[12px] font-bold text-white">{g.name}</div>
          <div className="mb-2 text-[11px] text-[#6e6e78]">{g.items.length} shortcuts</div>
          <div className="overflow-hidden rounded-md border border-[#2c2c31]">
            {g.items.map((sc, i) => (
              <div
                key={`${sc.combo}-${sc.label}`}
                className={`flex items-center gap-3 px-2.5 py-1.5 text-[11px] ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}
              >
                <Kbd className="min-w-20 justify-center">{sc.combo}</Kbd>
                <span className="shrink-0 font-semibold text-white">{sc.label}</span>
                <span className="truncate text-[#6e6e78]">{sc.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
        <div className="text-[12px] font-bold text-white">Tool keys</div>
        <div className="mb-2 text-[11px] text-[#6e6e78]">
          Single letters pick tools. Shift+letter cycles the family. Change them in the toolbar flyout.
        </div>
        <div className="grid max-h-[320px] grid-cols-2 gap-1 overflow-y-auto pr-1 sm:grid-cols-3">
          {toolKeys.map(([tool, key]) => (
            <div key={tool} className="flex items-center justify-between gap-2 rounded-md bg-[#101012] px-2 py-1 text-[10.5px]">
              <span className="truncate text-[#a7a7b0]" title={tool}>{tool}</span>
              <Kbd>{key}</Kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CanvasLiveControls() {
  const zoom = useEditorStore((st) => st.zoom);
  const setZoom = useEditorStore((st) => st.setZoom);
  const viewRotate = useEditorStore((st) => st.viewRotate);
  const setViewRotate = useEditorStore((st) => st.setViewRotate);
  const showGrid = useProStore((st) => st.showGrid);
  const gridSize = useProStore((st) => st.gridSize);
  return (
    <div className="space-y-2 rounded-md border border-[#2c2c31] bg-[#101012] p-2.5">
      <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
        Zoom <span className="font-mono text-white">{zoom}%</span>
      </div>
      <input type="range" min={10} max={800} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
      <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
        View rotate <span className="font-mono text-white">{viewRotate}°</span>
      </div>
      <input type="range" min={0} max={359} value={viewRotate} onChange={(e) => setViewRotate(Number(e.target.value))} className="w-full" />
      <div className="flex gap-1">
        <button onClick={() => window.dispatchEvent(new Event("avero:fit-zoom"))} className="flex-1 rounded bg-[#232327] px-2 py-1 text-[11px] text-white hover:bg-[#2c2c31]">Fit</button>
        <button onClick={() => setZoom(100)} className="flex-1 rounded bg-[#232327] px-2 py-1 text-[11px] text-white hover:bg-[#2c2c31]">100%</button>
        <button onClick={() => setViewRotate(0)} className="flex-1 rounded bg-[#232327] px-2 py-1 text-[11px] text-white hover:bg-[#2c2c31]">0°</button>
      </div>
      <div className="font-mono text-[10px] text-[#6e6e78]">grid {showGrid ? "on" : "off"} · {gridSize}px</div>
    </div>
  );
}

function GuideControls() {
  // Granular subscriptions + getState actions: immune to histogram ticks,
  // transform nudges and other hot pro-store churn.
  const showGuides = useProStore((st) => st.showGuides);
  const showGrid = useProStore((st) => st.showGrid);
  const snapEnabled = useProStore((st) => st.snapEnabled);
  const gridSize = useProStore((st) => st.gridSize);
  const guidesH = useProStore((st) => st.guidesH);
  const guidesV = useProStore((st) => st.guidesV);
  const slices = useProStore((st) => st.slices);
  const notes = useProStore((st) => st.notes);
  const samplers = useProStore((st) => st.samplers);
  const measures = useProStore((st) => st.measures);
  const pro = useProStore.getState();
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button onClick={() => pro.toggleGuides()} className={clsx("flex-1 rounded px-2 py-1.5 text-[11px]", showGuides ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0]")}>
          Guides {showGuides ? "on" : "off"}
        </button>
        <button onClick={() => pro.toggleGrid()} className={clsx("flex-1 rounded px-2 py-1.5 text-[11px]", showGrid ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0]")}>
          Grid {showGrid ? "on" : "off"}
        </button>
        <button onClick={() => pro.toggleSnap()} className={clsx("flex-1 rounded px-2 py-1.5 text-[11px]", snapEnabled ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0]")}>
          Snap {snapEnabled ? "on" : "off"}
        </button>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
          Grid size <span className="font-mono text-white">{gridSize}px</span>
        </div>
        <input type="range" min={8} max={256} value={gridSize} onChange={(e) => pro.setGridSize(Number(e.target.value))} className="w-full" />
      </div>
      <div className="flex gap-1">
        <button onClick={() => pro.clearGuides()} className="flex-1 rounded bg-[#232327] px-2 py-1.5 text-[11px] text-[#a7a7b0] hover:text-white">Clear guides ({guidesH.length + guidesV.length})</button>
        <button onClick={() => pro.clearSlices()} className="flex-1 rounded bg-[#232327] px-2 py-1.5 text-[11px] text-[#a7a7b0] hover:text-white">Clear slices ({slices.length})</button>
      </div>
      <div className="flex gap-1">
        <button onClick={() => pro.clearNotes()} className="flex-1 rounded bg-[#232327] px-2 py-1.5 text-[11px] text-[#a7a7b0] hover:text-white">Notes ({notes.length})</button>
        <button onClick={() => pro.clearSamplers()} className="flex-1 rounded bg-[#232327] px-2 py-1.5 text-[11px] text-[#a7a7b0] hover:text-white">Samplers ({samplers.length})</button>
        <button onClick={() => pro.clearMeasures()} className="flex-1 rounded bg-[#232327] px-2 py-1.5 text-[11px] text-[#a7a7b0] hover:text-white">Measures ({measures.length})</button>
      </div>
    </div>
  );
}
