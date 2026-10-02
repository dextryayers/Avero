import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Layers, Shapes, Sparkles, Trash2, Type } from "lucide-react";
import clsx from "clsx";
import {
  makeLayer,
  useEditorStore,
  type BlendMode,
  type LayerEffects,
  type LayerMeta,
} from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { renderTextFxToLayer } from "../engine/textShape";
import { askText, notify, showMessage } from "../ui/notify";
import { DockSlider, EmptyState, Kbd } from "../ui/atoms";

// ---------------------------------------------------------------------------
// Affinity-style dock tabs for the Layers view: Layers | Effects | Styles |
// Text | Assets. Every control below is live and fully working — no dead UI.
// ---------------------------------------------------------------------------

export type DockTab = "layers" | "effects" | "styles" | "text" | "assets";

export const DOCK_TABS: { id: DockTab; label: string; icon: typeof Layers }[] = [
  { id: "layers", label: "Layers", icon: Layers },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "styles", label: "Styles", icon: Bookmark },
  { id: "text", label: "Text", icon: Type },
  { id: "assets", label: "Assets", icon: Shapes },
];

export function DockTabBar({ value, onChange }: { value: DockTab; onChange: (t: DockTab) => void }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-[#2c2c31] bg-[#161618] px-2 py-1.5" role="tablist" aria-label="Layer studio">
      {DOCK_TABS.map((t) => {
        const Icon = t.icon;
        const on = value === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            title={`${t.label} — fully working panel`}
            className={clsx(
              "avero-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
              on ? "bg-[#2f7cf6] text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)]" : "text-[#8e8e98] hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon size={13} />
            <span className="hidden min-[380px]:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small atoms
// ---------------------------------------------------------------------------

function FxColor({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <span className="group relative flex shrink-0 cursor-pointer items-center gap-1.5" title={title}>
      <span
        className="h-5 w-7 rounded-md ring-1 ring-white/20 transition-all group-hover:ring-2 group-hover:ring-[#2f7cf6]"
        style={{ backgroundColor: safe }}
      />
      <span className="font-mono text-[10px] uppercase text-white tabular-nums">{safe}</span>
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={title}
      />
    </span>
  );
}

function FxToggle({ on, onClick, title }: { on: boolean; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={clsx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        on ? "bg-[#2f7cf6]" : "bg-[#2c2c31] hover:bg-[#3a3a41]",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Section({
  title,
  on,
  onToggle,
  children,
}: {
  title: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("rounded-xl border transition-colors", on ? "border-[#2f7cf6]/40 bg-[#1b1b1f]" : "border-[#2c2c31] bg-[#161618]")}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <FxToggle on={on} onClick={onToggle} title={`Toggle ${title}`} />
        <span className={clsx("text-[12px] font-bold", on ? "text-white" : "text-[#8e8e98]")}>{title}</span>
      </div>
      {on && <div className="space-y-2 px-2.5 pb-2.5">{children}</div>}
    </section>
  );
}

function useActiveLayer(): { meta: LayerMeta | undefined; id: string | null } {
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const layers = useEditorStore((s) => s.layers);
  return { meta: layers.find((l) => l.id === activeLayerId), id: activeLayerId };
}

function guardEditable(meta: LayerMeta | undefined): meta is LayerMeta {
  if (!meta) {
    void showMessage("No active layer.");
    return false;
  }
  if (meta.locked || !meta.visible) {
    notify("Active layer is locked or hidden. Unlock it first.");
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Effects: live drop shadow / glows / stroke on the active layer.
// ---------------------------------------------------------------------------

const EMPTY_FX: LayerEffects = {};

export function EffectsPanel() {
  const { meta } = useActiveLayer();
  const updateLayer = useEditorStore((s) => s.updateLayer);
  if (!meta) return <EmptyState title="No active layer" hint="Add or select a layer to edit its effects." />;
  const fx: LayerEffects = meta.fx ?? EMPTY_FX;
  const locked = meta.locked || !meta.visible;

  const patch = (p: Partial<LayerEffects>) => {
    if (!guardEditable(useEditorStore.getState().layers.find((l) => l.id === meta.id))) return;
    updateLayer(meta.id, { fx: { ...fx, ...p } });
  };
  const ds = fx.dropShadow ?? { enabled: false, color: "#000000", opacity: 45, blur: 24, dx: 0, dy: 12 };
  const og = fx.outerGlow ?? { enabled: false, color: "#38e1ff", opacity: 80, blur: 28 };
  const ig = fx.innerGlow ?? { enabled: false, color: "#ffffff", opacity: 60, blur: 12 };
  const st = fx.stroke ?? { enabled: false, color: "#ffffff", width: 6, opacity: 100 };

  return (
    <div className="avero-fade-in space-y-2 p-2">
      <div className="flex items-center justify-between px-1">
        <span className="truncate text-[11px] font-semibold text-white" title={meta.name}>
          FX · {meta.name}
        </span>
        <button
          onClick={() => patch({ dropShadow: undefined, outerGlow: undefined, innerGlow: undefined, stroke: undefined })}
          title="Remove every effect from this layer"
          className="rounded-md px-2 py-1 text-[10px] text-[#8e8e98] hover:bg-white/5 hover:text-white"
        >
          Reset all
        </button>
      </div>

      <Section title="Drop Shadow" on={!!ds.enabled} onToggle={() => patch({ dropShadow: { ...ds, enabled: !ds.enabled } })}>
        <div className="flex items-center justify-between">
          <FxColor value={ds.color} onChange={(v) => patch({ dropShadow: { ...ds, color: v } })} title="Shadow color" />
          <Kbd>shadow</Kbd>
        </div>
        <DockSlider label="Opacity" value={ds.opacity} min={0} max={100} suffix="%" disabled={locked} onChange={(v) => patch({ dropShadow: { ...ds, opacity: v } })} />
        <DockSlider label="Blur" value={ds.blur} min={0} max={120} suffix="px" disabled={locked} onChange={(v) => patch({ dropShadow: { ...ds, blur: v } })} />
        <DockSlider label="Offset X" value={ds.dx} min={-200} max={200} suffix="px" disabled={locked} onChange={(v) => patch({ dropShadow: { ...ds, dx: v } })} />
        <DockSlider label="Offset Y" value={ds.dy} min={-200} max={200} suffix="px" disabled={locked} onChange={(v) => patch({ dropShadow: { ...ds, dy: v } })} />
      </Section>

      <Section title="Outer Glow" on={!!og.enabled} onToggle={() => patch({ outerGlow: { ...og, enabled: !og.enabled } })}>
        <div className="flex items-center justify-between">
          <FxColor value={og.color} onChange={(v) => patch({ outerGlow: { ...og, color: v } })} title="Glow color" />
          <Kbd>glow</Kbd>
        </div>
        <DockSlider label="Opacity" value={og.opacity} min={0} max={100} suffix="%" disabled={locked} onChange={(v) => patch({ outerGlow: { ...og, opacity: v } })} />
        <DockSlider label="Size" value={og.blur} min={0} max={120} suffix="px" disabled={locked} onChange={(v) => patch({ outerGlow: { ...og, blur: v } })} />
      </Section>

      <Section title="Inner Glow" on={!!ig.enabled} onToggle={() => patch({ innerGlow: { ...ig, enabled: !ig.enabled } })}>
        <div className="flex items-center justify-between">
          <FxColor value={ig.color} onChange={(v) => patch({ innerGlow: { ...ig, color: v } })} title="Inner glow color" />
          <Kbd>inner</Kbd>
        </div>
        <DockSlider label="Opacity" value={ig.opacity} min={0} max={100} suffix="%" disabled={locked} onChange={(v) => patch({ innerGlow: { ...ig, opacity: v } })} />
        <DockSlider label="Size" value={ig.blur} min={0} max={60} suffix="px" disabled={locked} onChange={(v) => patch({ innerGlow: { ...ig, blur: v } })} />
      </Section>

      <Section title="Stroke" on={!!st.enabled} onToggle={() => patch({ stroke: { ...st, enabled: !st.enabled } })}>
        <div className="flex items-center justify-between">
          <FxColor value={st.color} onChange={(v) => patch({ stroke: { ...st, color: v } })} title="Stroke color" />
          <Kbd>outline</Kbd>
        </div>
        <DockSlider label="Width" value={st.width} min={1} max={64} suffix="px" disabled={locked} onChange={(v) => patch({ stroke: { ...st, width: v } })} />
        <DockSlider label="Opacity" value={st.opacity} min={0} max={100} suffix="%" disabled={locked} onChange={(v) => patch({ stroke: { ...st, opacity: v } })} />
      </Section>

      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        Live and non-destructive — rendered every frame, editable forever. When shadow and glow are both on, the shadow takes the single canvas shadow slot.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles: named FX + blend presets. Built-ins ship; customs persist locally.
// ---------------------------------------------------------------------------

interface LayerStylePreset {
  id: string;
  name: string;
  fx: LayerEffects;
  blendMode?: BlendMode;
  opacity?: number;
  custom: boolean;
}

const STYLE_KEY = "avero-layer-styles-v1";

const BUILTIN_STYLES: LayerStylePreset[] = [
  {
    id: "soft-shadow",
    name: "Soft Shadow",
    fx: { dropShadow: { enabled: true, color: "#000000", opacity: 45, blur: 24, dx: 0, dy: 12 } },
    custom: false,
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    fx: { outerGlow: { enabled: true, color: "#38e1ff", opacity: 85, blur: 32 } },
    custom: false,
  },
  {
    id: "stamp-outline",
    name: "Stamp Outline",
    fx: { stroke: { enabled: true, color: "#ffffff", width: 6, opacity: 100 } },
    custom: false,
  },
  {
    id: "lifted-card",
    name: "Lifted Card",
    fx: {
      dropShadow: { enabled: true, color: "#000000", opacity: 55, blur: 18, dx: 0, dy: 8 },
      innerGlow: { enabled: true, color: "#ffffff", opacity: 25, blur: 10 },
    },
    custom: false,
  },
  { id: "clean-slate", name: "Clean Slate", fx: {}, custom: false },
];

function loadCustomStyles(): LayerStylePreset[] {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LayerStylePreset[];
    return Array.isArray(arr) ? arr.filter((s) => s && s.custom) : [];
  } catch {
    return [];
  }
}

function fxPreviewFilter(fx: LayerEffects): string {
  const ds = fx.dropShadow;
  if (ds?.enabled) return `drop-shadow(${ds.dx / 3}px ${ds.dy / 3}px ${Math.min(12, ds.blur / 3)}px rgba(0,0,0,${(ds.opacity / 100).toFixed(2)}))`;
  const og = fx.outerGlow;
  if (og?.enabled) return `drop-shadow(0 0 ${Math.min(12, og.blur / 3)}px ${og.color})`;
  const ig = fx.innerGlow;
  if (ig?.enabled) return `drop-shadow(0 0 6px ${ig.color})`;
  return "none";
}

export function StylesPanel() {
  const { meta } = useActiveLayer();
  const [customs, setCustoms] = useState<LayerStylePreset[]>(() => loadCustomStyles());
  const presets = useMemo(() => [...BUILTIN_STYLES, ...customs], [customs]);

  function apply(p: LayerStylePreset) {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    const m = st.layers.find((l) => l.id === id);
    if (!guardEditable(m)) return;
    st.updateLayer(id!, {
      fx: JSON.parse(JSON.stringify(p.fx)) as LayerEffects,
      ...(p.blendMode ? { blendMode: p.blendMode } : {}),
      ...(p.opacity !== undefined ? { opacity: p.opacity } : {}),
    });
  }

  async function saveCurrent() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    const m = st.layers.find((l) => l.id === id);
    if (!guardEditable(m)) return;
    const name = await askText("Save style", "Style name:", `${m!.name} style`);
    if (!name || !name.trim()) return;
    const entry: LayerStylePreset = {
      id: `custom-${Date.now().toString(36)}`,
      name: name.trim().slice(0, 40),
      fx: JSON.parse(JSON.stringify(m!.fx ?? {})) as LayerEffects,
      blendMode: m!.blendMode,
      opacity: m!.opacity,
      custom: true,
    };
    const next = [...customs, entry];
    setCustoms(next);
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    void showMessage(`Style "${entry.name}" saved.`);
  }

  function removeCustom(id: string) {
    const next = customs.filter((c) => c.id !== id);
    setCustoms(next);
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="avero-fade-in space-y-2 p-2">
      <button
        onClick={() => void saveCurrent()}
        title="Save the active layer look (FX + blend + opacity) as a reusable style"
        className="avero-press w-full rounded-lg bg-[#2f7cf6] py-1.5 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff]"
      >
        + Save current look{meta ? ` (${meta.name})` : ""}
      </button>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-xl border border-[#2c2c31] bg-[#101012] transition-colors hover:border-[#2f7cf6]/60">
            <button onClick={() => apply(p)} title={`Apply "${p.name}" to the active layer`} className="block w-full p-2 text-left">
              <span
                className="grid h-12 place-items-center rounded-lg bg-[#1b1b1f] text-[20px] font-black text-white"
                style={{ filter: fxPreviewFilter(p.fx) }}
              >
                Ag
              </span>
              <span className="mt-1.5 block truncate text-[11px] font-semibold text-white">{p.name}</span>
              <span className="font-mono text-[9px] text-[#6e6e78]">{p.custom ? "custom" : "built-in"}</span>
            </button>
            {p.custom && (
              <button
                onClick={() => removeCustom(p.id)}
                title={`Delete "${p.name}"`}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-black/60 text-[#a7a7b0] opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        One click restyles the active layer — FX, blend and opacity included. Customs live on this device.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text styles: type presets applied to the active text layer (or defaults).
// ---------------------------------------------------------------------------

interface TextStylePreset {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  custom: boolean;
}

const TEXT_KEY = "avero-text-styles-v1";

const BUILTIN_TEXT: TextStylePreset[] = [
  { id: "display", name: "Display", fontFamily: "Georgia", fontSize: 120, color: "#ffffff", bold: true, italic: false, custom: false },
  { id: "title", name: "Title", fontFamily: "Inter", fontSize: 72, color: "#ffffff", bold: true, italic: false, custom: false },
  { id: "subtitle", name: "Subtitle", fontFamily: "Inter", fontSize: 40, color: "#c9c9d1", bold: false, italic: false, custom: false },
  { id: "body", name: "Body", fontFamily: "Inter", fontSize: 28, color: "#ececee", bold: false, italic: false, custom: false },
  { id: "caption", name: "Caption", fontFamily: "monospace", fontSize: 20, color: "#a7a7b0", bold: false, italic: false, custom: false },
  { id: "quote", name: "Quote", fontFamily: "Georgia", fontSize: 36, color: "#8fb6f5", bold: false, italic: true, custom: false },
];

function loadCustomText(): TextStylePreset[] {
  try {
    const raw = localStorage.getItem(TEXT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TextStylePreset[];
    return Array.isArray(arr) ? arr.filter((s) => s && s.custom) : [];
  } catch {
    return [];
  }
}

export function TextStylesPanel() {
  const textDefaults = useProStore((s) => s.textDefaults);
  const [customs, setCustoms] = useState<TextStylePreset[]>(() => loadCustomText());
  const presets = useMemo(() => [...BUILTIN_TEXT, ...customs], [customs]);

  function apply(p: TextStylePreset) {
    const ed = useEditorStore.getState();
    const pro = useProStore.getState();
    const id = ed.activeLayerId;
    const cur = id ? pro.textSpecs[id] : undefined;
    const fields = {
      fontFamily: p.fontFamily,
      fontSize: p.fontSize,
      color: p.color,
      bold: p.bold,
      italic: p.italic,
    };
    if (id && cur) {
      const m = ed.layers.find((l) => l.id === id);
      if (!guardEditable(m)) return;
      const next = { ...cur, ...fields };
      pro.setTextSpec(id, next);
      const c = layerManager.get(id);
      if (c) renderTextFxToLayer(c, next, next.fx ?? "none", next.x ?? 60, next.y ?? 120);
      ed.markDirty();
    } else {
      pro.setTextDefaults(fields);
      void showMessage(`"${p.name}" set as the default for the next text layer.`);
    }
  }

  async function saveCurrent() {
    const pro = useProStore.getState();
    const src = { ...textDefaults };
    const id = useEditorStore.getState().activeLayerId;
    const cur = id ? pro.textSpecs[id] : undefined;
    if (cur) Object.assign(src, { fontFamily: cur.fontFamily, fontSize: cur.fontSize, color: cur.color, bold: cur.bold, italic: cur.italic });
    const name = await askText("Save text style", "Style name:", "My style");
    if (!name || !name.trim()) return;
    const entry: TextStylePreset = { ...src, id: `ctext-${Date.now().toString(36)}`, name: name.trim().slice(0, 40), custom: true };
    const next = [...customs, entry];
    setCustoms(next);
    try {
      localStorage.setItem(TEXT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    void showMessage(`Text style "${entry.name}" saved.`);
  }

  function removeCustom(id: string) {
    const next = customs.filter((c) => c.id !== id);
    setCustoms(next);
    try {
      localStorage.setItem(TEXT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="avero-fade-in space-y-2 p-2">
      <button
        onClick={() => void saveCurrent()}
        title="Save the current type look as a reusable text style"
        className="avero-press w-full rounded-lg bg-[#2f7cf6] py-1.5 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff]"
      >
        + Save current type
      </button>
      <div className="space-y-1.5">
        {presets.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-xl border border-[#2c2c31] bg-[#101012] transition-colors hover:border-[#2f7cf6]/60">
            <button onClick={() => apply(p)} title={`Apply "${p.name}"`} className="block w-full p-2.5 text-left">
              <span
                className="block truncate text-white"
                style={{
                  fontFamily: p.fontFamily,
                  fontSize: 22,
                  fontWeight: p.bold ? 800 : 400,
                  fontStyle: p.italic ? "italic" : "normal",
                  color: p.color,
                }}
              >
                {p.name} — quick brown fox
              </span>
              <span className="mt-1 block font-mono text-[9px] text-[#6e6e78]">
                {p.fontFamily} · {p.fontSize}px · {p.color}{p.custom ? " · custom" : ""}
              </span>
            </button>
            {p.custom && (
              <button
                onClick={() => removeCustom(p.id)}
                title={`Delete "${p.name}"`}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/60 text-[#a7a7b0] opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        Applies to the active text layer live — or becomes the default for the next one.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assets: offline procedural patterns + gradients painted as real layers.
// (Affinity's Stock needs the cloud — AVERO is offline-first, so the studio
// ships built-in paintable assets instead. Everything here really works.)
// ---------------------------------------------------------------------------

type AssetKind = "checker" | "dots" | "stripes" | "grid" | "sunset" | "ocean" | "neon" | "mono" | "ember" | "frost";

const ASSETS: { id: AssetKind; name: string; group: "Pattern" | "Gradient" }[] = [
  { id: "checker", name: "Checker", group: "Pattern" },
  { id: "dots", name: "Dots", group: "Pattern" },
  { id: "stripes", name: "Stripes", group: "Pattern" },
  { id: "grid", name: "Blueprint", group: "Pattern" },
  { id: "sunset", name: "Sunset", group: "Gradient" },
  { id: "ocean", name: "Ocean", group: "Gradient" },
  { id: "neon", name: "Neon", group: "Gradient" },
  { id: "mono", name: "Mono", group: "Gradient" },
  { id: "ember", name: "Ember", group: "Gradient" },
  { id: "frost", name: "Frost", group: "Gradient" },
];

export function paintAsset(g: CanvasRenderingContext2D, w: number, h: number, kind: AssetKind): void {
  g.save();
  g.clearRect(0, 0, w, h);
  if (kind === "checker") {
    const s = 32;
    g.fillStyle = "#565660";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a3a41";
    for (let y = 0; y < h; y += s)
      for (let x = 0; x < w; x += s) if (((x + y) / s) % 2 === 0) g.fillRect(x, y, s, s);
  } else if (kind === "dots") {
    g.fillStyle = "#1b1b1f";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(143,182,245,0.55)";
    const s = 28;
    for (let y = s / 2; y < h; y += s)
      for (let x = s / 2; x < w; x += s) {
        g.beginPath();
        g.arc(x, y, 2.4, 0, Math.PI * 2);
        g.fill();
      }
  } else if (kind === "stripes") {
    g.fillStyle = "#232327";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2f7cf6";
    g.lineWidth = 10;
    g.globalAlpha = 0.5;
    for (let x = -h; x < w + h; x += 34) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + h, h);
      g.stroke();
    }
    g.globalAlpha = 1;
  } else if (kind === "grid") {
    g.fillStyle = "#16202c";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(56,160,255,0.4)";
    g.lineWidth = 1;
    const s = 32;
    g.beginPath();
    for (let x = 0; x <= w; x += s) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += s) {
      g.moveTo(0, y + 0.5);
      g.lineTo(w, y + 0.5);
    }
    g.stroke();
  } else {
    const stops: Record<string, [string, string, string]> = {
      sunset: ["#ff9a3c", "#ff3d68", "#5a30ff"],
      ocean: ["#0b3d5c", "#14708c", "#38e1ff"],
      neon: ["#0d0221", "#ff2fb3", "#38e1ff"],
      mono: ["#000000", "#6e6e78", "#ffffff"],
      ember: ["#1a0500", "#a8321f", "#ffb03c"],
      frost: ["#dfeefc", "#8fb6f5", "#ffffff"],
    };
    const [a, b, c] = stops[kind] ?? stops.sunset;
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, a);
    grad.addColorStop(0.55, b);
    grad.addColorStop(1, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }
  g.restore();
}

function AssetThumb({ kind }: { kind: AssetKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = 120;
    el.height = 76;
    const g = el.getContext("2d");
    if (g) paintAsset(g, 120, 76, kind);
  }, [kind]);
  return <canvas ref={ref} className="h-[76px] w-full rounded-lg" style={{ width: "100%" }} />;
}

export function AssetsPanel() {
  function add(kind: AssetKind, name: string) {
    const st = useEditorStore.getState();
    const l = makeLayer(`Asset ${name}`);
    const c = layerManager.ensure(l.id, st.doc.width, st.doc.height);
    paintAsset(c.getContext("2d")!, st.doc.width, st.doc.height, kind);
    st.addLayer(l);
    st.setActiveLayer(l.id);
    st.markDirty();
    useProStore.getState().bumpHistogram();
    void showMessage(`Asset "${name}" added as a new layer.`);
  }
  return (
    <div className="avero-fade-in space-y-2 p-2">
      {(["Pattern", "Gradient"] as const).map((group) => (
        <div key={group}>
          <div className="avero-micro px-1 pb-1.5 pt-1">{group}s</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ASSETS.filter((a) => a.group === group).map((a) => (
              <button
                key={a.id}
                onClick={() => add(a.id, a.name)}
                title={`Paint "${a.name}" onto a new layer at document size`}
                className="avero-press group overflow-hidden rounded-xl border border-[#2c2c31] bg-[#101012] p-1.5 text-left transition-colors hover:border-[#2f7cf6]/60"
              >
                <AssetThumb kind={a.id} />
                <span className="mt-1.5 block truncate px-0.5 text-[11px] font-semibold text-white">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        Offline built-ins — one click paints the asset onto a fresh layer at full document size.
      </p>
    </div>
  );
}
