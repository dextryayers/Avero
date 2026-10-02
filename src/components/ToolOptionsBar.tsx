import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pin, PinOff, SlidersHorizontal } from "lucide-react";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { TOOL_LABEL } from "./ToolBar";
import { layerManager } from "../engine/layerManager";
import { notify } from "../ui/notify";
import { renderShapeToLayer, renderTextFxToLayer } from "../engine/textShape";
import {
  clearSelectionMask,
  expandContractSelection,
  featherSelection,
  hasSelection,
  inverseSelection,
  restoreLastSelection,
} from "../engine/selection";
import {
  BRUSH_BLENDS,
  CROP_OVERLAY_PILLS,
  CROP_RATIO_PILLS,
  GRADIENT_MODE_PILLS,
  MEASURE_UNITS,
  PATTERN_MOTIFS,
  SEL_MODES,
  TOOL_HINT,
  TEXT_FONTS,
  topBarKindOf,
} from "../engine/toolOptions";

// ---------------------------------------------------------------------------
// Atom modern: divider, badge, hint, slider elegan, color chip, pills, toggle.
// ---------------------------------------------------------------------------

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-white/10" />;
}

function Name({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-gradient-to-b from-[#3b8bff] to-[#2568d8] px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)]">
      {children}
    </span>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden max-w-[220px] shrink truncate text-[11px] text-[#8e8e98] md:block" title={typeof children === "string" ? children : undefined}>
      {children}
    </span>
  );
}

function ModernSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
  title,
  resetValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
  title?: string;
  resetValue?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const pct = max === min ? 100 : ((value - min) / (max - min)) * 100;
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
    else setDraft(String(value));
    setEditing(false);
  };
  return (
    <label
      className="group flex shrink-0 cursor-default items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/5"
      title={title ?? `${label}: drag, arrow keys, or double-click the number to reset`}
      onDoubleClick={() => {
        if (resetValue !== undefined) onChange(resetValue);
      }}
    >
      <span className="text-[11px] font-medium text-[#8e8e98] transition-colors group-hover:text-[#c9c9d1]">{label}</span>
      <input
        type="range"
        aria-label={label}
        className="avero-slider h-4 w-20"
        style={{ ["--avero-fill" as string]: `${Math.max(0, Math.min(100, pct))}%` }}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(String(value));
              setEditing(false);
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-12 rounded-md border border-[#2f7cf6] bg-[#101012] px-1 py-0.5 font-mono text-[11px] text-white outline-none"
        />
      ) : (
        <button
          type="button"
          title="Click to type an exact value, double-click the slider to reset"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className="min-w-11 rounded-md bg-white/5 px-1.5 py-0.5 text-right font-mono text-[11px] text-white tabular-nums transition-colors hover:bg-[#2f7cf6]/30"
        >
          {value}
          {suffix}
        </button>
      )}
    </label>
  );
}

function Pills<T extends string>({ options, value, onPick }: { options: readonly { id: T; label: string }[] | readonly T[]; value: T; onPick: (v: T) => void }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/30 p-0.5">
      {(options as readonly { id: T; label: string }[]).map((o) => {
        const id = (typeof o === "string" ? o : o.id) as T;
        const label = typeof o === "string" ? o : o.label;
        const on = value === id;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium transition-all ${
              on ? "bg-[#2f7cf6] text-white shadow-[0_2px_8px_rgba(47,124,246,0.5)]" : "text-[#8e8e98] hover:bg-white/5 hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}

function Toggle({ label, on, onClick, title }: { label: string; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`avero-press flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
        on ? "bg-[#2f7cf6]/20 text-[#8fb6f5] ring-1 ring-[#2f7cf6]/50" : "bg-white/5 text-[#8e8e98] hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full transition-colors ${on ? "bg-[#3b8bff]" : "bg-[#4a4a52]"}`} />
      {label}
    </button>
  );
}

function Action({ label, onClick, title, primary }: { label: string; onClick: () => void; title?: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`avero-press shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        primary
          ? "bg-[#2f7cf6] text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff]"
          : "bg-white/5 text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function ColorChip({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  return (
    <span className="group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/5" title={title}>
      <span
        className="checkerboard relative h-5 w-7 overflow-hidden rounded-md ring-1 ring-white/20 transition-all group-hover:ring-2 group-hover:ring-[#2f7cf6]"
        style={{ backgroundColor: value }}
      >
        <span className="absolute inset-0 rounded-md" style={{ backgroundColor: value }} />
      </span>
      <span className="font-mono text-[11px] uppercase text-white tabular-nums">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={title}
      />
    </span>
  );
}

function IconBtn({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`avero-press grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${
        active ? "bg-[#2f7cf6]/20 text-[#8fb6f5]" : "text-[#8e8e98] hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** Horizontal pill tray without a rough scrollbar: smooth scroll + edge fade. */
function PillTray({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="avero-fade-x flex max-w-[280px] shrink items-center gap-0.5 overflow-x-auto rounded-full bg-black/30 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Interactive auto-hide: collapses while painting on canvas, returns on tool
// change / chip click / hover. Pin disables auto-hide entirely.
// ---------------------------------------------------------------------------

const AUTOHIDE_KEY = "avero-topbar-autohide";
const AUTOHIDE_DELAY = 3200;

function useTopBarVisibility(tool: string) {
  const [autoHide, setAutoHide] = useState(() => {
    try {
      return localStorage.getItem(AUTOHIDE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const hoverRef = useRef(false);
  const autoRef = useRef(autoHide);
  autoRef.current = autoHide;

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const armTimer = () => {
    clearTimer();
    if (!autoRef.current) return;
    timer.current = window.setTimeout(() => {
      if (!hoverRef.current) setCollapsed(true);
    }, AUTOHIDE_DELAY);
  };

  // Tool change: briefly reveal, close the More panel, then idle-hide.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      armTimer();
      return;
    }
    setCollapsed(false);
    setMoreOpen(false);
    armTimer();
    // Intentionally depends only on tool: armTimer is ref-stable.
  }, [tool]);

  // Canvas click/paint: collapse for space (only when auto-hide is on).
  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      if (!autoRef.current || hoverRef.current) return;
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.("canvas")) setCollapsed(true);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => () => clearTimer(), []);
  useEffect(() => {
    try {
      localStorage.setItem(AUTOHIDE_KEY, autoHide ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!autoHide) {
      clearTimer();
      setCollapsed(false);
    } else {
      armTimer();
    }
    // Intentionally depends only on autoHide: the timer lives in a ref.
  }, [autoHide]);

  return {
    autoHide,
    setAutoHide,
    collapsed,
    setCollapsed,
    moreOpen,
    setMoreOpen,
    onEnter: () => {
      hoverRef.current = true;
      clearTimer();
    },
    onLeave: () => {
      hoverRef.current = false;
      armTimer();
    },
    expand: () => {
      clearTimer();
      setCollapsed(false);
    },
  };
}

// Patch the active shape spec live (re-render included). Falls back to the
// shape defaults when no shape layer is active, so the control always works.
function patchShape(patch: Record<string, string | number>) {
  const ed = useEditorStore.getState();
  const pro = useProStore.getState();
  const id = ed.activeLayerId;
  const cur = id ? pro.shapeSpecs[id] : undefined;
  if (id && cur) {
    const meta = ed.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const next = { ...cur, ...patch };
    pro.setShapeSpec(id, next);
    const c = layerManager.get(id);
    if (c) renderShapeToLayer(c, next);
    ed.markDirty();
    return;
  }
  const d: Record<string, string | number> = {};
  if (typeof patch.fill === "string") d.fill = patch.fill;
  if (typeof patch.stroke === "string") d.stroke = patch.stroke;
  if (typeof patch.strokeWidth === "number") d.strokeWidth = patch.strokeWidth;
  pro.setShapeDefaults(d);
}

// Same live pattern for text: active text layer re-renders, otherwise the
// defaults for the next text layer update.
function patchText(patch: Record<string, string | number | boolean>) {
  const ed = useEditorStore.getState();
  const pro = useProStore.getState();
  const id = ed.activeLayerId;
  const cur = id ? pro.textSpecs[id] : undefined;
  if (id && cur) {
    const meta = ed.layers.find((l) => l.id === id);
    if (!meta || meta.locked || !meta.visible) {
      notify("Active layer is locked or hidden. Unlock it first.");
      return;
    }
    const next = { ...cur, ...patch };
    pro.setTextSpec(id, next);
    const c = layerManager.get(id);
    if (c) renderTextFxToLayer(c, next, next.fx ?? "none", next.x ?? 60, next.y ?? 120);
    ed.markDirty();
    return;
  }
  const d: Record<string, string | number | boolean> = {};
  for (const k of ["fontFamily", "fontSize", "color", "bold", "italic", "tracking", "leading"] as const) {
    if (patch[k] !== undefined) (d as Record<string, unknown>)[k] = patch[k];
  }
  pro.setTextDefaults(d);
}

function refreshSelection() {
  useEditorStore.getState().markDirty();
  useProStore.getState().bumpHistogram();
  window.dispatchEvent(new Event("avero:selection-changed"));
}

function overlayKindOf(id: string): "thirds" | "diagonal" | "triangle" | "spiral" | "center" {
  if (id === "crop-diagonal") return "diagonal";
  if (id === "crop-triangle-guide") return "triangle";
  if (id === "crop-golden-spiral") return "spiral";
  if (id === "crop-center-dot") return "center";
  return "thirds";
}

// Contextual options bar: floating glass pill above canvas for the active tool.
// Every control is wired to a live store or engine action. Auto-hide keeps the
// canvas distraction-free: painting collapses the bar, tool change or the mini
// chip brings it back, Pin disables hiding entirely.
export default function ToolOptionsBar({
  onApplyCrop,
  onCancelCrop,
}: {
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const brushHardness = useEditorStore((s) => s.brushHardness);
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushFlow = useEditorStore((s) => s.brushFlow);
  const brushSpacing = useEditorStore((s) => s.brushSpacing);
  const brushJitter = useEditorStore((s) => s.brushJitter);
  const brushSmoothing = useEditorStore((s) => s.brushSmoothing);
  const brushAngle = useEditorStore((s) => s.brushAngle);
  const brushRound = useEditorStore((s) => s.brushRound);
  const brushBlend = useEditorStore((s) => s.brushBlend);
  const setBrush = useEditorStore((s) => s.setBrush);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const viewRotate = useEditorStore((s) => s.viewRotate);
  const setViewRotate = useEditorStore((s) => s.setViewRotate);
  const paintMask = useProStore((s) => s.paintMask);
  const setPaintMask = useProStore((s) => s.setPaintMask);
  const gradTo = useProStore((s) => s.gradTo);
  const setGradTo = useProStore((s) => s.setGradTo);
  const gradReverse = useProStore((s) => s.gradReverse);
  const setGradReverse = useProStore((s) => s.setGradReverse);
  const gradDither = useProStore((s) => s.gradDither);
  const setGradDither = useProStore((s) => s.setGradDither);
  const patternMotif = useProStore((s) => s.patternMotif);
  const setPatternMotif = useProStore((s) => s.setPatternMotif);
  const measureUnit = useProStore((s) => s.measureUnit);
  const setMeasureUnit = useProStore((s) => s.setMeasureUnit);
  const sampleMode = useProStore((s) => s.sampleMode);
  const setSampleMode = useProStore((s) => s.setSampleMode);
  const fillContiguous = useProStore((s) => s.fillContiguous);
  const setFillContiguous = useProStore((s) => s.setFillContiguous);
  const cloneAligned = useProStore((s) => s.cloneAligned);
  const setCloneAligned = useProStore((s) => s.setCloneAligned);
  const cloneSource = useProStore((s) => s.cloneSource);
  const setCloneSource = useProStore((s) => s.setCloneSource);
  const healSource = useProStore((s) => s.healSource);
  const setHealSource = useProStore((s) => s.setHealSource);
  const selMode = useProStore((s) => s.selMode);
  const setSelMode = useProStore((s) => s.setSelMode);
  const selTolerance = useProStore((s) => s.selTolerance);
  const selFeather = useProStore((s) => s.selFeather);
  const selExpand = useProStore((s) => s.selExpand);
  const setSelParams = useProStore((s) => s.setSelParams);
  const cropOverlay = useProStore((s) => s.cropOverlay);
  const setCropOverlay = useProStore((s) => s.setCropOverlay);
  const gridSize = useProStore((s) => s.gridSize);
  const setGridSize = useProStore((s) => s.setGridSize);
  const toggleGrid = useProStore((s) => s.toggleGrid);
  const showGrid = useProStore((s) => s.showGrid);
  const snapEnabled = useProStore((s) => s.snapEnabled);
  const toggleSnap = useProStore((s) => s.toggleSnap);
  const textDefaults = useProStore((s) => s.textDefaults);
  const shapeDefaults = useProStore((s) => s.shapeDefaults);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const shapeSpec = useProStore((s) => (activeLayerId ? s.shapeSpecs[activeLayerId] : undefined));
  const textSpec = useProStore((s) => (activeLayerId ? s.textSpecs[activeLayerId] : undefined));

  const { autoHide, setAutoHide, collapsed, setCollapsed, moreOpen, setMoreOpen, onEnter, onLeave, expand } =
    useTopBarVisibility(tool);

  // Enter applies crop, Esc cancels - sent from the global keyboard handler.
  const applyRef = useRef(onApplyCrop);
  const cancelRef = useRef(onCancelCrop);
  applyRef.current = onApplyCrop;
  cancelRef.current = onCancelCrop;
  useEffect(() => {
    const apply = () => applyRef.current();
    const cancel = () => cancelRef.current();
    window.addEventListener("avero:crop-apply", apply);
    window.addEventListener("avero:crop-cancel", cancel);
    return () => {
      window.removeEventListener("avero:crop-apply", apply);
      window.removeEventListener("avero:crop-cancel", cancel);
    };
  }, []);

  const name = TOOL_LABEL[tool] ?? tool;
  const kind = topBarKindOf(tool);
  const hint = TOOL_HINT[tool] ?? "Use this tool on the canvas.";

  const maskBadge =
    paintMask && (kind === "paint" || kind === "eraser" || kind === "clone") ? (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#d9a441]/15 px-2 py-1 text-[11px] font-semibold text-[#d9a441] ring-1 ring-[#d9a441]/40">
        MASK
        <button onClick={() => setPaintMask(false)} className="text-white/70 hover:text-white hover:underline" title="Exit mask paint mode">
          Exit
        </button>
      </span>
    ) : null;

  // ---- per-tool bar content: main (always visible) + more (bottom panel) ----
  let main: React.ReactNode = null;
  let more: React.ReactNode = null;
  let summary = "";

  if (kind === "paint") {
    summary = `Size ${brushSize} · ${brushOpacity}%`;
    main = (
      <>
        <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Brush color - shared by paint, shape, text, fill (click to change)" />
        <Divider />
        <ModernSlider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} title="Brush size - [ / ]" resetValue={24} />
        <ModernSlider label="Hard" value={brushHardness} min={0} max={100} onChange={(v) => setBrush({ hardness: v })} suffix="%" title="Edge hardness - Shift+[ / ]" resetValue={80} />
        <ModernSlider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" title="Strength/opacity - number keys 1-0" resetValue={100} />
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <ModernSlider label="Flow" value={brushFlow} min={1} max={100} onChange={(v) => setBrush({ flow: v })} suffix="%" title="Ink flow per dab - Shift+digits" resetValue={100} />
        <ModernSlider label="Spacing" value={brushSpacing} min={1} max={200} onChange={(v) => setBrush({ spacing: v })} suffix="%" title="Distance between dabs" resetValue={18} />
        <ModernSlider label="Jitter" value={brushJitter} min={0} max={100} onChange={(v) => setBrush({ jitter: v })} suffix="%" title="Randomize size/alpha per dab" resetValue={0} />
        <ModernSlider label="Smooth" value={brushSmoothing} min={0} max={100} onChange={(v) => setBrush({ smoothing: v })} suffix="%" title="Stroke stabilizer" resetValue={35} />
        <ModernSlider label="Angle" value={brushAngle} min={-180} max={180} onChange={(v) => setBrush({ angle: v })} suffix="°" title="Calligraphy nib angle" resetValue={0} />
        <ModernSlider label="Round" value={brushRound} min={1} max={100} onChange={(v) => setBrush({ round: v })} suffix="%" title="Nib roundness" resetValue={100} />
        <label className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] text-[#8e8e98] hover:bg-white/5" title="Brush blend override. Normal uses each preset's native blend.">
          Blend
          <select
            value={brushBlend}
            onChange={(e) => setBrush({ blend: e.target.value as GlobalCompositeOperation })}
            className="rounded-lg border border-white/10 bg-[#101012] px-1.5 py-1 text-[11px] text-white outline-none focus:border-[#2f7cf6]"
          >
            {BRUSH_BLENDS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>
      </div>
    );
  } else if (kind === "retouch") {
    summary = `Size ${brushSize} · ${brushOpacity}%`;
    main = (
      <>
        <ModernSlider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} title="Brush size - [ / ]" resetValue={24} />
        <ModernSlider label="Hard" value={brushHardness} min={0} max={100} onChange={(v) => setBrush({ hardness: v })} suffix="%" title="Edge hardness - Shift+[ / ]" resetValue={80} />
        <ModernSlider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" title="Strength - number keys 1-0" resetValue={100} />
      </>
    );
  } else if (kind === "eraser") {
    summary = `Size ${brushSize} · ${brushOpacity}%`;
    main = (
      <>
        <span className="hidden shrink-0 rounded-full bg-[#2f7cf6]/15 px-2 py-1 text-[10px] font-semibold text-[#8fb6f5] ring-1 ring-[#2f7cf6]/40 sm:block" title="The eraser never touches photo pixels. It only lifts paint strokes.">
          Photo-safe
        </span>
        <ModernSlider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} title="Eraser size - [ / ]" resetValue={24} />
        <ModernSlider label="Hard" value={brushHardness} min={0} max={100} onChange={(v) => setBrush({ hardness: v })} suffix="%" title="Edge hardness" resetValue={80} />
        <ModernSlider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" title="Strength - number keys 1-0" resetValue={100} />
        <Action
          label="Clear strokes"
          title="Erase every stroke on the active layer (photos stay intact). Asks first."
          onClick={() => {
            const ed = useEditorStore.getState();
            const id = ed.activeLayerId;
            if (!id) return;
            const meta = ed.layers.find((l) => l.id === id);
            if (!meta || meta.locked || !meta.visible) {
              notify("Active layer is locked or hidden. Unlock it first.");
              return;
            }
            // Plan4 Fase 1.1: the paper is never a valid clear target. Clearing
            // the Background layer would punch a transparent hole in the canvas.
            if (meta.kind === "background") {
              notify("Background paper is protected. Clear strokes works on paint layers.");
              return;
            }
            if (!window.confirm("Erase every stroke on the active layer? Photos stay intact. This can be undone.")) return;
            const snap = layerManager.snapshot(id);
            if (snap) ed.pushHistory({ label: "Clear strokes", layerId: id, snapshot: snap });
            const c = layerManager.ensure(id, ed.doc.width, ed.doc.height);
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            ed.markDirty();
            useProStore.getState().bumpHistogram();
          }}
        />
      </>
    );
  } else if (kind === "clone") {
    const needsHeal = tool === "healing-brush" || tool === "patch";
    const src = needsHeal ? healSource : cloneSource;
    summary = src ? `Src ${Math.round(src.x)},${Math.round(src.y)}` : "Alt-click for source";
    main = (
      <>
        <ModernSlider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} title="Stamp size - [ / ]" resetValue={24} />
        <ModernSlider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" title="Strength - number keys 1-0" resetValue={100} />
        {!needsHeal && (
          <Toggle label={cloneAligned ? "Aligned" : "Non-aligned"} on={cloneAligned} onClick={() => setCloneAligned(!cloneAligned)} title="Aligned keeps the source offset across strokes. Non-aligned restarts it every stroke." />
        )}
      </>
    );
    more = (
      <span className="flex items-center gap-1.5 text-[11px] text-[#8e8e98]" title="Alt-click the canvas to move the source point.">
        Source {src ? `${Math.round(src.x)}, ${Math.round(src.y)}` : "not set"}
        {src && (
          <button
            onClick={() => (needsHeal ? setHealSource(null) : setCloneSource(null))}
            className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white hover:bg-white/10"
          >
            Clear
          </button>
        )}
      </span>
    );
  } else if (kind === "select-marquee") {
    summary = `Feather ${selFeather}px`;
    main = (
      <>
        <Pills options={SEL_MODES.map((m) => ({ id: m, label: m === "new" ? "New" : m === "add" ? "Add" : m === "subtract" ? "Sub" : "Inter" }))} value={selMode} onPick={setSelMode} />
        <Divider />
        <Action label="Grow" title="Switch to Grow, then click the canvas." onClick={() => setTool("select-grow")} />
        <Action label="Shrink" title="Switch to Shrink, then click the canvas." onClick={() => setTool("select-shrink")} />
        <Action label="Inverse" title="Switch to Invert, then click the canvas." onClick={() => setTool("select-inverse-click")} />
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <ModernSlider label="Feather" value={selFeather} min={0} max={50} onChange={(v) => setSelParams({ selFeather: v })} suffix="px" title="Soften the selection edge" resetValue={0} />
        <ModernSlider label="Expand" value={selExpand} min={-24} max={24} onChange={(v) => setSelParams({ selExpand: v })} suffix="px" title="Grow/shrink the selection" resetValue={0} />
      </div>
    );
  } else if (kind === "select-auto") {
    summary = `Tol ${selTolerance}`;
    main = (
      <Pills options={SEL_MODES.map((m) => ({ id: m, label: m === "new" ? "New" : m === "add" ? "Add" : m === "subtract" ? "Sub" : "Inter" }))} value={selMode} onPick={setSelMode} />
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <ModernSlider label="Tolerance" value={selTolerance} min={1} max={100} onChange={(v) => setSelParams({ selTolerance: v })} title="Wand color tolerance" resetValue={32} />
        <ModernSlider label="Feather" value={selFeather} min={0} max={50} onChange={(v) => setSelParams({ selFeather: v })} suffix="px" title="Soften the edge" resetValue={0} />
      </div>
    );
  } else if (kind === "select-click") {
    const runMap: Record<string, { label: string; run: () => void }> = {
      "select-grow": { label: "Grow +4px", run: () => expandContractSelection(4) },
      "select-shrink": { label: "Shrink -4px", run: () => expandContractSelection(-4) },
      "select-grow-2": { label: "Grow +2px", run: () => expandContractSelection(2) },
      "select-grow-8": { label: "Grow +8px", run: () => expandContractSelection(8) },
      "select-feather": { label: "Feather 6px", run: () => featherSelection(6) },
      "select-feather-2": { label: "Feather 2px", run: () => featherSelection(2) },
      "select-feather-4": { label: "Feather 4px", run: () => featherSelection(4) },
      "select-feather-12": { label: "Feather 12px", run: () => featherSelection(12) },
      "select-border": { label: "Smooth border", run: () => { expandContractSelection(-4); featherSelection(2); } },
      "select-border-4": { label: "Border 4px", run: () => { expandContractSelection(-4); featherSelection(2); } },
      "select-border-12": { label: "Border 12px", run: () => { expandContractSelection(-12); featherSelection(2); } },
      "select-inverse-click": { label: "Invert now", run: () => inverseSelection() },
      "select-last": {
        label: "Restore now",
        run: () => {
          restoreLastSelection();
          refreshSelection();
        },
      },
    };
    const action = runMap[tool as string];
    summary = action?.label ?? "";
    main = (
      <>
        {action && (
          <Action
            label={action.label}
            primary
            title={hasSelection() ? "Run this selection op right now." : "Needs a selection first. Drag a marquee or lasso."}
            onClick={() => {
              if (tool !== "select-last" && tool !== "select-inverse-click" && !hasSelection()) return;
              action.run();
              refreshSelection();
            }}
          />
        )}
        <Action label="Deselect" title="Clear the current selection (Ctrl+D)." onClick={() => { clearSelectionMask(); refreshSelection(); }} />
      </>
    );
  } else if (kind === "crop") {
    summary = "Enter applies · Esc cancels";
    main = (
      <>
        <PillTray title="Crop ratios - scroll to see them all">
          <Pills options={CROP_RATIO_PILLS} value={tool as (typeof CROP_RATIO_PILLS)[number]["id"]} onPick={(v) => setTool(v)} />
        </PillTray>
        <ModernSlider label="Level" value={Math.round(viewRotate)} min={-45} max={45} onChange={(v) => setViewRotate(v)} suffix="°" title="Straighten the horizon" resetValue={0} />
        <Action label="Apply" primary onClick={onApplyCrop} title="Apply crop (Enter)." />
        <Action label="Cancel" onClick={onCancelCrop} title="Cancel crop (Esc)." />
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-0.5">
        {CROP_OVERLAY_PILLS.map((o) => (
          <button
            key={o.id}
            onClick={() => setCropOverlay(overlayKindOf(o.id))}
            title={`Crop overlay: ${o.label}`}
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${cropOverlay === overlayKindOf(o.id) ? "bg-[#2f7cf6] text-white" : "text-[#8e8e98] hover:bg-white/5 hover:text-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  } else if (kind === "crop-overlay") {
    summary = "Pick a guide";
    main = (
      <PillTray title="Composition guides">
        {CROP_OVERLAY_PILLS.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              setCropOverlay(overlayKindOf(o.id));
              setTool("crop");
            }}
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${tool === o.id ? "bg-[#2f7cf6] text-white" : "text-[#8e8e98] hover:bg-white/5 hover:text-white"}`}
          >
            {o.label}
          </button>
        ))}
      </PillTray>
    );
  } else if (kind === "shape") {
    const fill = shapeSpec?.fill ?? shapeDefaults.fill;
    const stroke = shapeSpec?.stroke ?? shapeDefaults.stroke;
    const width = shapeSpec?.strokeWidth ?? shapeDefaults.strokeWidth;
    const sides = shapeSpec?.sides ?? 6;
    summary = `Width ${width}px`;
    main = (
      <>
        <ColorChip value={fill} onChange={(v) => patchShape({ fill: v })} title="Shape fill. Edits the active shape, or the default for the next one." />
        <ColorChip value={stroke} onChange={(v) => patchShape({ stroke: v })} title="Shape stroke. Edits the active shape, or the default for the next one." />
        <Divider />
        <ModernSlider label="Width" value={width} min={0} max={64} onChange={(v) => patchShape({ strokeWidth: v })} suffix="px" title="Stroke width" resetValue={0} />
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <ModernSlider label="Sides" value={sides} min={3} max={12} onChange={(v) => patchShape({ sides: v })} title="Polygon side count" resetValue={6} />
        <Action
          label="Flip H"
          title="Mirror the active shape horizontally."
          onClick={() => {
            const ed = useEditorStore.getState();
            const id = ed.activeLayerId;
            if (!id) return;
            const meta = ed.layers.find((l) => l.id === id);
            if (!meta || meta.locked || !meta.visible) {
              notify("Active layer is locked or hidden. Unlock it first.");
              return;
            }
            const pro = useProStore.getState();
            pro.ensureTransform(id);
            const cur = pro.transforms[id] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
            pro.updateTransform(id, { scaleX: cur.scaleX * -1 });
            ed.markDirty();
          }}
        />
        <Action
          label="Flip V"
          title="Mirror the active shape vertically."
          onClick={() => {
            const ed = useEditorStore.getState();
            const id = ed.activeLayerId;
            if (!id) return;
            const meta = ed.layers.find((l) => l.id === id);
            if (!meta || meta.locked || !meta.visible) {
              notify("Active layer is locked or hidden. Unlock it first.");
              return;
            }
            const pro = useProStore.getState();
            pro.ensureTransform(id);
            const cur = pro.transforms[id] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
            pro.updateTransform(id, { scaleY: cur.scaleY * -1 });
            ed.markDirty();
          }}
        />
      </div>
    );
  } else if (kind === "text") {
    const spec = textSpec ?? textDefaults;
    summary = `${spec.fontSize}px`;
    main = (
      <>
        <ColorChip value={spec.color} onChange={(v) => patchText({ color: v })} title="Text color. Edits the active text, or the default for the next one." />
        <Divider />
        <label className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] text-[#8e8e98] hover:bg-white/5" title="Font family.">
          Font
          <select
            value={spec.fontFamily}
            onChange={(e) => patchText({ fontFamily: e.target.value })}
            className="max-w-28 rounded-lg border border-white/10 bg-[#101012] px-1.5 py-1 text-[11px] text-white outline-none focus:border-[#2f7cf6]"
          >
            {TEXT_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <ModernSlider label="Size" value={spec.fontSize} min={8} max={240} onChange={(v) => patchText({ fontSize: v })} suffix="px" title="Font size" resetValue={48} />
        <Toggle label="B" on={spec.bold} onClick={() => patchText({ bold: !spec.bold })} title="Bold." />
        <Toggle label="I" on={spec.italic} onClick={() => patchText({ italic: !spec.italic })} title="Italic." />
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <ModernSlider label="Track" value={spec.tracking} min={-20} max={60} onChange={(v) => patchText({ tracking: v })} title="Letter spacing" resetValue={0} />
        <ModernSlider label="Lead" value={Math.round(spec.leading * 100)} min={80} max={250} onChange={(v) => patchText({ leading: v / 100 })} suffix="%" title="Line spacing" resetValue={120} />
      </div>
    );
  } else if (kind === "pen") {
    summary = `Width ${brushSize}px`;
    main = (
      <>
        <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Pen ink color." />
        <Divider />
        <ModernSlider label="Width" value={brushSize} min={1} max={120} onChange={(v) => setBrush({ size: v })} suffix="px" title="Line width - [ / ]" resetValue={24} />
        <ModernSlider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" title="Strength - number keys 1-0" resetValue={100} />
      </>
    );
  } else if (kind === "gradient") {
    summary = "Drag for direction";
    main = (
      <>
        <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Gradient foreground color." />
        <Divider />
        <PillTray title="Gradient mode">
          <Pills options={GRADIENT_MODE_PILLS} value={tool as (typeof GRADIENT_MODE_PILLS)[number]["id"]} onPick={(v) => setTool(v)} />
        </PillTray>
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <Pills
          options={[{ id: "transparent", label: "Transparent" }, { id: "white", label: "White" }, { id: "black", label: "Black" }] as const}
          value={gradTo}
          onPick={setGradTo}
        />
        <Toggle label="Reverse" on={gradReverse} onClick={() => setGradReverse(!gradReverse)} title="Swap gradient direction." />
        <Toggle label="Dither" on={gradDither} onClick={() => setGradDither(!gradDither)} title="Anti-banding grain pass on every gradient." />
      </div>
    );
  } else if (kind === "fill") {
    const usesMotif = tool === "pattern-fill" || tool === "fill-pattern-new" || tool === "pattern-stamp" || tool === "pattern-dots";
    const usesTol = tool === "fill" || tool === "bucket-contiguous" || tool === "bucket-global" || tool === "magic-eraser";
    summary = `Tol ${selTolerance}`;
    main = (
      <>
        <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Fill color (Alt+Backspace = fill FG)." />
        {usesTol && (
          <>
            <Divider />
            <ModernSlider label="Tolerance" value={selTolerance} min={1} max={100} onChange={(v) => setSelParams({ selTolerance: v })} title="Color tolerance" resetValue={32} />
            <Toggle label={fillContiguous ? "Connected" : "Global"} on={fillContiguous} onClick={() => setFillContiguous(!fillContiguous)} title="Connected fills neighbors only. Global fills every similar color." />
          </>
        )}
        {usesMotif && (
          <>
            <Divider />
            <Pills options={PATTERN_MOTIFS.map((m) => ({ id: m, label: m[0].toUpperCase() + m.slice(1) }))} value={patternMotif} onPick={setPatternMotif} />
          </>
        )}
      </>
    );
  } else if (kind === "measure") {
    const clearMap: Record<string, { label: string; clear: () => void }> = {
      note: { label: "Clear notes", clear: () => useProStore.getState().clearNotes() },
      "note-color": { label: "Clear notes", clear: () => useProStore.getState().clearNotes() },
      count: { label: "Clear counts", clear: () => useProStore.getState().clearCounts() },
      "count-auto": { label: "Clear counts", clear: () => useProStore.getState().clearCounts() },
      "color-sampler": { label: "Clear pins", clear: () => useProStore.getState().clearSamplers() },
      "sampler-avg": { label: "Clear pins", clear: () => useProStore.getState().clearSamplers() },
      "sampler-3x3": { label: "Clear pins", clear: () => useProStore.getState().clearSamplers() },
      "sampler-11x11": { label: "Clear pins", clear: () => useProStore.getState().clearSamplers() },
      ruler: { label: "Clear lines", clear: () => useProStore.getState().clearMeasures() },
      "measure-angle": { label: "Clear lines", clear: () => useProStore.getState().clearMeasures() },
      "measure-area": { label: "Clear lines", clear: () => useProStore.getState().clearMeasures() },
      protractor: { label: "Clear lines", clear: () => useProStore.getState().clearMeasures() },
      "ruler-triple": { label: "Clear lines", clear: () => useProStore.getState().clearMeasures() },
      "measure-dpi": { label: "Clear lines", clear: () => useProStore.getState().clearMeasures() },
      "guide-mid": { label: "Clear guides", clear: () => useProStore.getState().clearGuides() },
      "guide-thirds": { label: "Clear guides", clear: () => useProStore.getState().clearGuides() },
      "guide-clear-one": { label: "Clear guides", clear: () => useProStore.getState().clearGuides() },
      "guide-clear": { label: "Clear guides", clear: () => useProStore.getState().clearGuides() },
    };
    const clearer = clearMap[tool as string];
    const isGrid = tool === "grid-toggle" || tool === "grid-pixel";
    const usesUnit = tool === "ruler" || tool === "measure-angle" || tool === "measure-area" || tool === "protractor" || tool === "ruler-triple";
    summary = clearer?.label ?? "";
    main = (
      <>
        {usesUnit && <Pills options={MEASURE_UNITS.map((u) => ({ id: u, label: u }))} value={measureUnit} onPick={setMeasureUnit} />}
        {isGrid && (
          <>
            <ModernSlider label="Grid" value={gridSize} min={8} max={512} onChange={(v) => setGridSize(v)} suffix="px" title="Grid size" resetValue={64} />
            <Toggle label={showGrid ? "Grid on" : "Grid off"} on={showGrid} onClick={toggleGrid} title="Show/hide the grid." />
          </>
        )}
        {tool === "snap-toggle" && (
          <Toggle label={snapEnabled ? "Snap on" : "Snap off"} on={snapEnabled} onClick={toggleSnap} title="Toggle snapping right now." />
        )}
        {clearer && (
          <Action label={clearer.label} onClick={() => { clearer.clear(); useEditorStore.getState().markDirty(); }} title="Remove all pins of this kind." />
        )}
      </>
    );
  } else if (kind === "navigate") {
    summary = `${Math.round(zoom)}%`;
    main = (
      <>
        <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 font-mono text-[11px] text-white tabular-nums" title="Current canvas zoom.">
          {Math.round(zoom)}%
        </span>
        <Action label="Fit" title="Fit the document on screen (Ctrl+0)." onClick={() => setTool("zoom-fit")} />
        <Action label="100%" title="Actual pixels (Ctrl+1)." onClick={() => setZoom(100)} />
        <Action label="200%" title="Zoom to 200 percent." onClick={() => setZoom(200)} />
      </>
    );
    more = (
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <Action label="50%" title="Zoom to 50 percent." onClick={() => setZoom(50)} />
        <Action label="400%" title="Zoom to 400 percent." onClick={() => setZoom(400)} />
        <ModernSlider label="Rotate" value={Math.round(viewRotate)} min={-180} max={180} onChange={(v) => setViewRotate(v)} suffix="°" title="Rotate the view (, / . /)" resetValue={0} />
        <Action label="Reset" title="Reset rotation to zero (/)." onClick={() => setViewRotate(0)} />
      </div>
    );
  } else if (kind === "move") {
    if (tool === "align-center") {
      summary = "Center the layer";
      main = (
        <Action
          label="Center Now"
          primary
          title="Center the active layer immediately."
          onClick={() => {
            const ed = useEditorStore.getState();
            const id = ed.activeLayerId;
            if (!id) {
              notify("Align Center: no active layer.");
              return;
            }
            const meta = ed.layers.find((l) => l.id === id);
            if (!meta || meta.locked || !meta.visible) {
              notify("Active layer is locked or hidden. Unlock it first.");
              return;
            }
            const pro = useProStore.getState();
            const snap = layerManager.snapshot(id);
            pro.ensureTransform(id);
            if (snap) ed.pushHistory({ label: "Align center", layerId: id, snapshot: snap });
            pro.updateTransform(id, { x: 0, y: 0 });
            ed.markDirty();
            pro.bumpHistogram();
          }}
        />
      );
    } else {
      summary = "Drag the layer";
      main = <Action label="Center" title="Switch to Align Center." onClick={() => setTool("align-center")} />;
    }
  } else if (kind === "eyedropper") {
    summary = brushColor.toUpperCase();
    main = (
      <>
        <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Last picked color." />
        <Divider />
        <Pills
          options={[{ id: "all", label: "All layers" }, { id: "current", label: "Current" }] as const}
          value={sampleMode}
          onPick={setSampleMode}
        />
        <Action
          label="Save swatch"
          title="Save the color to Color panel swatches."
          onClick={() => useProStore.getState().addSwatch(brushColor)}
        />
      </>
    );
  } else {
    if (tool === "snap-toggle") {
      summary = snapEnabled ? "Snap on" : "Snap off";
      main = <Toggle label={snapEnabled ? "Snap on" : "Snap off"} on={snapEnabled} onClick={toggleSnap} title="Toggle snapping right now." />;
    } else if (tool === "guide-clear") {
      summary = "Hapus guides";
      main = <Action label="Clear now" primary onClick={() => { useProStore.getState().clearGuides(); useEditorStore.getState().markDirty(); }} title="Remove all guides immediately." />;
    } else if (tool === "grid-toggle") {
      summary = showGrid ? "Grid on" : "Grid off";
      main = <Toggle label={showGrid ? "Grid on" : "Grid off"} on={showGrid} onClick={toggleGrid} title="Show/hide the grid right now." />;
    } else {
      main = null;
    }
  }

  // ---- mini chip when collapsed: compact, elegant, one click reopens ----
  if (collapsed) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
        <button
          onClick={expand}
          onMouseEnter={expand}
          title={`${name} - click to reveal options${autoHide ? " (auto-hide is on, click Pin to lock)" : ""}`}
          className="avero-chip-in pointer-events-auto mt-2.5 flex max-w-[94%] items-center gap-2 rounded-full border border-white/10 bg-[#1b1b1f]/90 py-1.5 pl-2.5 pr-1.5 text-[11px] shadow-[0_8px_28px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-colors hover:border-[#2f7cf6]/50"
        >
          <span className="rounded-full bg-[#2f7cf6] px-2 py-0.5 font-bold text-white">{name}</span>
          {summary && <span className="truncate font-mono text-[#8e8e98] tabular-nums">{summary}</span>}
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/5 text-[#c9c9d1]">
            <ChevronDown size={13} />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
      <div className="pointer-events-auto mt-2.5 max-w-[96%]" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <div
          key={tool}
          className="avero-drop-in flex max-w-full items-center gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1f]/90 py-1.5 pl-2 pr-1.5 text-[11px] text-[#a7a7b0] shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <Name>{name}</Name>
          <Hint>{hint}</Hint>
          {maskBadge}
          {maskBadge && <Divider />}
          {main}
          {more && (
            <>
              <Divider />
              <button
                onClick={() => setMoreOpen((v) => !v)}
                title={moreOpen ? "Hide advanced options" : "Show Flow, Spacing, Jitter, Smooth, Angle, Round, Blend"}
                className={`avero-press flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${moreOpen ? "bg-[#2f7cf6] text-white" : "bg-white/5 text-[#c9c9d1] hover:bg-white/10 hover:text-white"}`}
              >
                <SlidersHorizontal size={12} />
                More
                {moreOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </>
          )}
          <Divider />
          <IconBtn
            onClick={() => setAutoHide(!autoHide)}
            title={autoHide ? "Auto-hide on: the bar hides while painting. Click to lock it (Pin)." : "Bar locked visible. Click to enable auto-hide."}
            active={!autoHide}
          >
            {autoHide ? <PinOff size={13} /> : <Pin size={13} />}
          </IconBtn>
          <IconBtn onClick={() => setCollapsed(true)} title="Collapse the bar (click the chip to reopen)">
            <ChevronUp size={13} />
          </IconBtn>
        </div>
        {more && moreOpen && (
          <div className="avero-popover-in mx-auto mt-1.5 w-fit max-w-full rounded-2xl border border-white/10 bg-[#1b1b1f]/95 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            {more}
          </div>
        )}
      </div>
    </div>
  );
}
