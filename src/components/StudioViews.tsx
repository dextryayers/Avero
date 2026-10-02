import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { renderShapeToLayer } from "../engine/textShape";
import { TOOL_FAMILIES } from "./ToolBar";
import { notify } from "../ui/notify";
import ColorWheel, { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "./ColorWheel";
import SwatchesGrid from "./SwatchesGrid";
import { DockSlider } from "../ui/atoms";

const RECENT_COLORS_KEY = "avero-recent-colors";

function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    const arr = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x)).slice(0, 12) : [];
  } catch {
    return [];
  }
}

// ---- Colour: Affinity-style wheel + H/S/L + opacity, all live on brush ----
export function ColourView() {
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const setBrush = useEditorStore((s) => s.setBrush);
  const addSwatch = useProStore((s) => s.addSwatch);
  const [recents, setRecents] = useState<string[]>(() => loadRecentColors());
  const [r, g, b] = hexToRgb(brushColor);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Track the last picked colors persistently. Click any chip to paint with it.
  useEffect(() => {
    setRecents((prev) => {
      if (prev[0]?.toLowerCase() === brushColor.toLowerCase()) return prev;
      const next = [brushColor, ...prev.filter((c) => c.toLowerCase() !== brushColor.toLowerCase())].slice(0, 12);
      try {
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [brushColor]);

  const setHSL = (nh: number, ns: number, nl: number) => {
    const [nr, ng, nb] = hslToRgb(nh, ns, nl);
    setBrush({ color: rgbToHex(nr, ng, nb) });
  };

  const numCls =
    "h-6 w-full min-w-0 rounded border border-[#2c2c31] bg-[#101012] px-1 font-mono text-[11px] text-white outline-none focus:border-[#2f7cf6]";
  return (
    <div className="space-y-2.5 p-3">
      <div
        className="mx-auto w-fit rounded-full p-1.5"
        style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.5))" }}
      >
        <ColorWheel size={184} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            { k: "H", v: h, min: 0, max: 360, set: (v: number) => setHSL(v, s, l) },
            { k: "S", v: s, min: 0, max: 100, set: (v: number) => setHSL(h, v, l) },
            { k: "L", v: l, min: 0, max: 100, set: (v: number) => setHSL(h, s, v) },
          ] as const
        ).map((f) => (
          <label key={f.k} className="flex items-center gap-1 text-[10px] text-[#6e6e78]">
            {f.k}
            <input
              type="number"
              value={f.v}
              min={f.min}
              max={f.max}
              onChange={(e) => f.set(Number(e.target.value))}
              aria-label={`${f.k} value`}
              className={numCls}
            />
          </label>
        ))}
      </div>
      <DockSlider
        label="Opacity"
        value={brushOpacity}
        min={1}
        max={100}
        suffix="%"
        title="Brush opacity - number keys 1-0"
        onChange={(v) => setBrush({ opacity: v })}
      />
      <div>
        <div className="mb-1 text-[11px] font-medium text-[#8e8e98]">Recent</div>
        {recents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#2c2c31] px-2 py-1.5 text-center text-[10px] text-[#6e6e78]">
            Pick colors and they land here.
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-1">
            {recents.map((c) => (
              <button
                key={c}
                onClick={() => setBrush({ color: c })}
                title={`${c} - click to paint with it`}
                aria-label={`Paint with ${c}`}
                className={`h-5 rounded-md ring-1 transition-all hover:scale-110 hover:ring-2 hover:ring-white/60 ${
                  c.toLowerCase() === brushColor.toLowerCase() ? "ring-2 ring-[#2f7cf6]" : "ring-white/15"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-7 w-11 shrink-0 rounded-lg ring-1 ring-white/20" style={{ background: brushColor }} title="Current brush color" />
        <input
          key={brushColor}
          defaultValue={brushColor}
          spellCheck={false}
          onBlur={(e) => {
            if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) {
              const v = e.target.value.trim();
              setBrush({ color: v.startsWith("#") ? v : `#${v}` });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          title="Hex color, Enter to apply"
          aria-label="Hex color"
          className="h-7 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101012] px-2 font-mono text-[11px] uppercase tabular-nums text-white outline-none transition-colors focus:border-[#2f7cf6]"
        />
        <button
          onClick={() => addSwatch(brushColor)}
          title="Save to swatches"
          className="avero-press h-7 shrink-0 rounded-lg bg-[#2f7cf6] px-2.5 text-[11px] font-semibold text-white shadow-[0_2px_8px_rgba(47,124,246,0.4)] hover:bg-[#3b8bff]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---- Swatches: shared grid plus save-current ----
export function SwatchesView() {
  const brushColor = useEditorStore((s) => s.brushColor);
  const addSwatch = useProStore((s) => s.addSwatch);
  return (
    <div className="space-y-2 p-3">
      <button
        onClick={() => addSwatch(brushColor)}
        title={`Save current brush color ${brushColor}`}
        className="avero-press w-full rounded-lg bg-[#2f7cf6] py-1.5 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff]"
      >
        + Save current ({brushColor})
      </button>
      <SwatchesGrid />
      <p className="text-[10px] text-[#6e6e78]">Click paints with it. Right-click deletes it.</p>
    </div>
  );
}

// ---- Stroke: vector stroke width + color, live on the active shape ----
export function StrokeView() {
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const layers = useEditorStore((s) => s.layers);
  const shapeDefaults = useProStore((s) => s.shapeDefaults);
  const meta = layers.find((l) => l.id === activeLayerId);
  const spec = useProStore((s) => (activeLayerId ? s.shapeSpecs[activeLayerId] : undefined));

  const patch = (p: { fill?: string; stroke?: string; strokeWidth?: number }) => {
    const pro = useProStore.getState();
    const ed = useEditorStore.getState();
    const id = ed.activeLayerId;
    const cur = id ? pro.shapeSpecs[id] : undefined;
    if (id && cur) {
      const m = ed.layers.find((l) => l.id === id);
      if (!m || m.locked || !m.visible) {
        notify("Active layer is locked or hidden. Unlock it first.");
        return;
      }
      const next = { ...cur, ...p };
      pro.setShapeSpec(id, next);
      const c = layerManager.get(id);
      if (c) renderShapeToLayer(c, next);
      ed.markDirty();
      return;
    }
    pro.setShapeDefaults(p);
  };

  const stroke = spec?.stroke ?? shapeDefaults.stroke;
  const width = spec?.strokeWidth ?? shapeDefaults.strokeWidth;
  return (
    <div className="space-y-2.5 p-3 text-[11px]">
      {!spec && (
        <p className="text-[#6e6e78]">
          {meta ? "No shape selected - editing defaults for the next shape." : "Select a shape layer to edit its stroke live."}
        </p>
      )}
      <DockSlider
        label="Width"
        value={width}
        min={0}
        max={64}
        suffix="px"
        title="Stroke width"
        onChange={(v) => patch({ strokeWidth: v })}
      />
      <label className="flex items-center gap-2 text-[#a7a7b0]">
        Color
        <span className="group relative h-7 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-white/20 transition-all hover:ring-2 hover:ring-[#2f7cf6]" title="Stroke color">
          <span className="absolute inset-0" style={{ backgroundColor: stroke }} />
          <input
            type="color"
            value={stroke}
            onChange={(e) => patch({ stroke: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Stroke color"
          />
        </span>
        <span className="font-mono text-[11px] uppercase tabular-nums text-white">{stroke}</span>
      </label>
    </div>
  );
}

// ---- Brushes: every paint preset, searchable, one click to arm ----
export function BrushesView() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const [q, setQ] = useState("");
  const family = useMemo(() => TOOL_FAMILIES.find((f) => f.id === "brush"), []);
  const items = useMemo(() => {
    const list = family?.tools ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (t) => t.label.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle),
    );
  }, [family, q]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-[#2c2c31] p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brushes..."
          className="w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1 text-[11px] text-white outline-none placeholder:text-[#6e6e78] focus:border-[#2f7cf6]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={`${t.description} ${t.usage}`}
              className={`avero-press mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                active ? "bg-[#2f7cf6] text-white" : "text-[#c9c9d1] hover:bg-[#232327]"
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 truncate">{t.label}</span>
              <span className={`font-mono text-[9px] ${active ? "text-white/70" : "text-[#6e6e78]"}`}>
                {t.shortcut}
              </span>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="p-3 text-center text-[11px] text-[#6e6e78]">No brushes match.</div>
        )}
      </div>
      <div className="border-t border-[#2c2c31] p-2 font-mono text-[10px] text-[#6e6e78]">
        {items.length} brushes · {family?.tools.length ?? 0} total
      </div>
    </div>
  );
}
