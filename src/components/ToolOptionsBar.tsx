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

const BAR =
  "pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[94%] -translate-x-1/2 items-center gap-2.5 overflow-x-auto whitespace-nowrap rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-3 py-2 text-[11px] text-[#a7a7b0] [scrollbar-width:thin]";

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="min-w-0 shrink truncate text-[#c9c9d1]">{children}</span>;
}

function Slider({ label, value, min, max, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[#6e6e78]">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-16 accent-[#2f7cf6]" />
      <span className="w-10 font-mono text-white tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  );
}

function Pills<T extends string>({ options, value, onPick }: { options: readonly { id: T; label: string }[] | readonly T[]; value: T; onPick: (v: T) => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {(options as readonly { id: T; label: string }[]).map((o) => {
        const id = (typeof o === "string" ? o : o.id) as T;
        const label = typeof o === "string" ? o : o.label;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            className={`shrink-0 rounded-md px-2 py-1 transition-colors ${value === id ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white"}`}
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
      className={`avero-press shrink-0 rounded-md px-2 py-1 transition-colors ${on ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function Action({ label, onClick, title, primary }: { label: string; onClick: () => void; title?: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`avero-press shrink-0 rounded-md px-2.5 py-1 font-semibold transition-colors ${primary ? "bg-[#2f7cf6] text-white hover:bg-[#2563d4]" : "bg-[#232327] text-white hover:bg-[#2c2c31]"}`}
    >
      {label}
    </button>
  );
}

function ColorChip({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title={title}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-8 cursor-pointer rounded border border-[#2c2c31] bg-transparent"
      />
      <span className="font-mono uppercase text-white tabular-nums">{value}</span>
    </label>
  );
}

function Name({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{children}</span>
  );
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

// Contextual options bar: always visible above canvas for the active tool.
// Every control below is wired to a live store or engine action.
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

  const name = TOOL_LABEL[tool] ?? tool;
  const kind = topBarKindOf(tool);
  const hint = TOOL_HINT[tool] ?? "Use this tool on the canvas.";

  const maskBadge =
    paintMask && (kind === "paint" || kind === "eraser" || kind === "clone") ? (
      <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#d9a441] px-2 py-0.5 font-semibold text-[#d9a441]">
        MASK
        <button onClick={() => setPaintMask(false)} className="text-white hover:underline" title="Exit mask paint mode">
          Exit
        </button>
      </span>
    ) : null;

  const brushSliders = (
    <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
      <Slider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} />
      <Slider label="Hard" value={brushHardness} min={0} max={100} onChange={(v) => setBrush({ hardness: v })} suffix="%" />
      <Slider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" />
    </span>
  );

  // ---- paint: full brush console, all live in the stroke engine ----
  if (kind === "paint") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        {maskBadge}
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Brush color, shared by paint, shape, text and fill tools" />
        </span>
        {brushSliders}
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Flow" value={brushFlow} min={1} max={100} onChange={(v) => setBrush({ flow: v })} suffix="%" />
          <Slider label="Spacing" value={brushSpacing} min={1} max={200} onChange={(v) => setBrush({ spacing: v })} suffix="%" />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 min-[1500px]:flex">
          <Slider label="Jitter" value={brushJitter} min={0} max={100} onChange={(v) => setBrush({ jitter: v })} suffix="%" />
          <Slider label="Smooth" value={brushSmoothing} min={0} max={100} onChange={(v) => setBrush({ smoothing: v })} suffix="%" />
          <Slider label="Angle" value={brushAngle} min={-180} max={180} onChange={(v) => setBrush({ angle: v })} suffix="deg" />
          <Slider label="Round" value={brushRound} min={1} max={100} onChange={(v) => setBrush({ round: v })} suffix="%" />
          <label className="flex shrink-0 items-center gap-1.5 text-[#6e6e78]" title="Brush blend override. Normal uses each preset native blend.">
            Blend
            <select
              value={brushBlend}
              onChange={(e) => setBrush({ blend: e.target.value as GlobalCompositeOperation })}
              className="rounded-md border border-[#2c2c31] bg-[#232327] px-1.5 py-1 text-white"
            >
              {BRUSH_BLENDS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
        </span>
      </div>
    );
  }

  // ---- retouch: size, hardness, strength ----
  if (kind === "retouch") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        {brushSliders}
      </div>
    );
  }

  // ---- eraser: sliders plus photo-safe note plus clear action ----
  if (kind === "eraser") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        {maskBadge}
        <span className="hidden shrink-0 rounded-md border border-[#2f7cf6] px-2 py-0.5 text-[#7fb0ff] md:block" title="Erasers never touch photo pixels. They only lift paint strokes.">
          Photo-safe
        </span>
        {brushSliders}
        <span className="hidden shrink-0 border-l border-[#2c2c31] pl-2.5 lg:block">
          <Action
            label="Clear strokes"
            title="Erase every stroke on the active layer (photos stay intact). Asks first."
            onClick={() => {
              const ed = useEditorStore.getState();
              const id = ed.activeLayerId;
              if (!id) return;
              if (!window.confirm("Erase every stroke on the active layer? Photos stay intact. This can be undone.")) return;
              const snap = layerManager.snapshot(id);
              if (snap) ed.pushHistory({ label: "Clear strokes", layerId: id, snapshot: snap });
              const c = layerManager.ensure(id, ed.doc.width, ed.doc.height);
              c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
              ed.markDirty();
              useProStore.getState().bumpHistogram();
            }}
          />
        </span>
      </div>
    );
  }

  // ---- clone and heal: source workflow fully visible ----
  if (kind === "clone") {
    const needsHeal = tool === "healing-brush" || tool === "patch";
    const src = needsHeal ? healSource : cloneSource;
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        {maskBadge}
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} />
          <Slider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" />
        </span>
        {!needsHeal && (
          <span className="hidden shrink-0 border-l border-[#2c2c31] pl-2.5 md:block">
            <Toggle label={cloneAligned ? "Aligned" : "Non-aligned"} on={cloneAligned} onClick={() => setCloneAligned(!cloneAligned)} title="Aligned keeps the source offset across strokes. Non-aligned restarts it every stroke." />
          </span>
        )}
        <span className="hidden shrink-0 items-center gap-1.5 border-l border-[#2c2c31] pl-2.5 text-[#6e6e78] md:flex" title="Alt-click the canvas to move the source point.">
          Source {src ? `${Math.round(src.x)}, ${Math.round(src.y)}` : "not set"}
          {src && (
            <button
              onClick={() => (needsHeal ? setHealSource(null) : setCloneSource(null))}
              className="rounded-md bg-[#232327] px-2 py-1 text-white hover:bg-[#2c2c31]"
            >
              Clear
            </button>
          )}
        </span>
      </div>
    );
  }

  // ---- marquee and lasso: combine mode plus quick ops plus feather ----
  if (kind === "select-marquee") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <Pills options={SEL_MODES.map((m) => ({ id: m, label: m === "new" ? "New" : m === "add" ? "Add" : m === "subtract" ? "Sub" : "Inter" }))} value={selMode} onPick={setSelMode} />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Feather" value={selFeather} min={0} max={50} onChange={(v) => setSelParams({ selFeather: v })} suffix="px" />
          <Slider label="Expand" value={selExpand} min={-24} max={24} onChange={(v) => setSelParams({ selExpand: v })} suffix="px" />
        </span>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 md:flex">
          <Action label="Grow" title="Switch to Grow, then click the canvas." onClick={() => setTool("select-grow")} />
          <Action label="Shrink" title="Switch to Shrink, then click the canvas." onClick={() => setTool("select-shrink")} />
          <Action label="Inverse" title="Switch to Invert, then click the canvas." onClick={() => setTool("select-inverse-click")} />
        </span>
      </div>
    );
  }

  // ---- wand and auto select: tolerance plus feather plus mode ----
  if (kind === "select-auto") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <Pills options={SEL_MODES.map((m) => ({ id: m, label: m === "new" ? "New" : m === "add" ? "Add" : m === "subtract" ? "Sub" : "Inter" }))} value={selMode} onPick={setSelMode} />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Tolerance" value={selTolerance} min={1} max={100} onChange={(v) => setSelParams({ selTolerance: v })} />
          <Slider label="Feather" value={selFeather} min={0} max={50} onChange={(v) => setSelParams({ selFeather: v })} suffix="px" />
        </span>
      </div>
    );
  }

  // ---- one-click selection ops: run directly from the bar ----
  if (kind === "select-click") {
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
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        {action && (
          <span className="shrink-0 border-l border-[#2c2c31] pl-2.5">
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
          </span>
        )}
        <span className="hidden shrink-0 border-l border-[#2c2c31] pl-2.5 md:block">
          <Action label="Deselect" title="Clear the current selection." onClick={() => { clearSelectionMask(); refreshSelection(); }} />
        </span>
      </div>
    );
  }

  // ---- crop: ratio pills, overlay pills, apply, straighten ----
  if (kind === "crop") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <Pills options={CROP_RATIO_PILLS} value={tool as (typeof CROP_RATIO_PILLS)[number]["id"]} onPick={(v) => setTool(v)} />
        </span>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 lg:flex">
          {CROP_OVERLAY_PILLS.map((o) => (
            <button
              key={o.id}
              onClick={() => setCropOverlay(o.id === "crop-thirds" ? "thirds" : o.id === "crop-diagonal" ? "diagonal" : o.id === "crop-triangle-guide" ? "triangle" : o.id === "crop-golden-spiral" ? "spiral" : "center")}
              title={`Crop overlay: ${o.label}`}
              className={`shrink-0 rounded-md px-2 py-1 transition-colors ${cropOverlay === (o.id === "crop-thirds" ? "thirds" : o.id === "crop-diagonal" ? "diagonal" : o.id === "crop-triangle-guide" ? "triangle" : o.id === "crop-golden-spiral" ? "spiral" : "center") ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white"}`}
            >
              {o.label}
            </button>
          ))}
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 md:flex">
          <Slider label="Level" value={Math.round(viewRotate)} min={-45} max={45} onChange={(v) => setViewRotate(v)} suffix="deg" />
        </span>
        <span className="flex shrink-0 items-center gap-1.5 border-l border-[#2c2c31] pl-2.5">
          <Action label="Apply" primary onClick={onApplyCrop} title="Apply crop (Enter)." />
          <Action label="Cancel" onClick={onCancelCrop} title="Cancel crop (Esc)." />
        </span>
      </div>
    );
  }

  // ---- crop overlay tools: pick a guide, jump back to crop ----
  if (kind === "crop-overlay") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5">
          {CROP_OVERLAY_PILLS.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setCropOverlay(o.id === "crop-thirds" ? "thirds" : o.id === "crop-diagonal" ? "diagonal" : o.id === "crop-triangle-guide" ? "triangle" : o.id === "crop-golden-spiral" ? "spiral" : "center");
                setTool("crop");
              }}
              className={`shrink-0 rounded-md px-2 py-1 transition-colors ${tool === o.id ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white"}`}
            >
              {o.label}
            </button>
          ))}
        </span>
      </div>
    );
  }

  // ---- shape: live fill, stroke, width, sides, flip ----
  if (kind === "shape") {
    const fill = shapeSpec?.fill ?? shapeDefaults.fill;
    const stroke = shapeSpec?.stroke ?? shapeDefaults.stroke;
    const width = shapeSpec?.strokeWidth ?? shapeDefaults.strokeWidth;
    const sides = shapeSpec?.sides ?? 6;
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center gap-2 border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={fill} onChange={(v) => patchShape({ fill: v })} title="Shape fill. Edits the active shape, or the default for the next one." />
          <ColorChip value={stroke} onChange={(v) => patchShape({ stroke: v })} title="Shape stroke. Edits the active shape, or the default for the next one." />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Width" value={width} min={0} max={64} onChange={(v) => patchShape({ strokeWidth: v })} suffix="px" />
          <Slider label="Sides" value={sides} min={3} max={12} onChange={(v) => patchShape({ sides: v })} />
        </span>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 md:flex">
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
        </span>
      </div>
    );
  }

  // ---- text: live font controls for the active layer or the next one ----
  if (kind === "text") {
    const spec = textSpec ?? textDefaults;
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={spec.color} onChange={(v) => patchText({ color: v })} title="Text color. Edits the active text, or the default for the next one." />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <label className="flex shrink-0 items-center gap-1.5 text-[#6e6e78]" title="Font family.">
            Font
            <select
              value={spec.fontFamily}
              onChange={(e) => patchText({ fontFamily: e.target.value })}
              className="max-w-28 rounded-md border border-[#2c2c31] bg-[#232327] px-1.5 py-1 text-white"
            >
              {TEXT_FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <Slider label="Size" value={spec.fontSize} min={8} max={240} onChange={(v) => patchText({ fontSize: v })} suffix="px" />
        </span>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 md:flex">
          <Toggle label="B" on={spec.bold} onClick={() => patchText({ bold: !spec.bold })} title="Bold." />
          <Toggle label="I" on={spec.italic} onClick={() => patchText({ italic: !spec.italic })} title="Italic." />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 min-[1500px]:flex">
          <Slider label="Track" value={spec.tracking} min={-20} max={60} onChange={(v) => patchText({ tracking: v })} />
          <Slider label="Lead" value={Math.round(spec.leading * 100)} min={80} max={250} onChange={(v) => patchText({ leading: v / 100 })} suffix="%" />
        </span>
      </div>
    );
  }

  // ---- pen: width plus color, both live ----
  if (kind === "pen") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Pen ink color." />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Width" value={brushSize} min={1} max={120} onChange={(v) => setBrush({ size: v })} suffix="px" />
          <Slider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" />
        </span>
      </div>
    );
  }

  // ---- gradient: mode pills, target, reverse, dither ----
  if (kind === "gradient") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Gradient foreground color." />
        </span>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <Pills options={GRADIENT_MODE_PILLS} value={tool as (typeof GRADIENT_MODE_PILLS)[number]["id"]} onPick={(v) => setTool(v)} />
        </span>
        <span className="hidden shrink-0 items-center border-l border-[#2c2c31] pl-2.5 md:flex">
          <Pills
            options={[{ id: "transparent", label: "Transparent" }, { id: "white", label: "White" }, { id: "black", label: "Black" }] as const}
            value={gradTo}
            onPick={setGradTo}
          />
        </span>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Toggle label="Reverse" on={gradReverse} onClick={() => setGradReverse(!gradReverse)} title="Swap gradient direction." />
          <Toggle label="Dither" on={gradDither} onClick={() => setGradDither(!gradDither)} title="Anti-banding grain pass on every gradient." />
        </span>
      </div>
    );
  }

  // ---- fill: color, tolerance, contiguity, motif ----
  if (kind === "fill") {
    const usesMotif = tool === "pattern-fill" || tool === "fill-pattern-new" || tool === "pattern-stamp" || tool === "pattern-dots";
    const usesTol = tool === "fill" || tool === "bucket-contiguous" || tool === "bucket-global" || tool === "magic-eraser";
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Fill color." />
        </span>
        {usesTol && (
          <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
            <Slider label="Tolerance" value={selTolerance} min={1} max={100} onChange={(v) => setSelParams({ selTolerance: v })} />
            <Toggle label={fillContiguous ? "Connected" : "Global"} on={fillContiguous} onClick={() => setFillContiguous(!fillContiguous)} title="Connected fills neighbors only. Global fills every similar color." />
          </span>
        )}
        {usesMotif && (
          <span className="hidden shrink-0 items-center border-l border-[#2c2c31] pl-2.5 md:flex">
            <Pills options={PATTERN_MOTIFS.map((m) => ({ id: m, label: m[0].toUpperCase() + m.slice(1) }))} value={patternMotif} onPick={setPatternMotif} />
          </span>
        )}
      </div>
    );
  }

  // ---- measure and annotate: unit plus pin clearing ----
  if (kind === "measure") {
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
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        {usesUnit && (
          <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
            <Pills options={MEASURE_UNITS.map((u) => ({ id: u, label: u }))} value={measureUnit} onPick={setMeasureUnit} />
          </span>
        )}
        {isGrid && (
          <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
            <Slider label="Grid" value={gridSize} min={8} max={512} onChange={(v) => setGridSize(v)} suffix="px" />
            <Toggle label={showGrid ? "Grid on" : "Grid off"} on={showGrid} onClick={toggleGrid} title="Toggle the canvas grid." />
          </span>
        )}
        {tool === "snap-toggle" && (
          <span className="shrink-0 border-l border-[#2c2c31] pl-2.5">
            <Toggle label={snapEnabled ? "Snap on" : "Snap off"} on={snapEnabled} onClick={toggleSnap} title="Toggle snapping right now." />
          </span>
        )}
        {clearer && (
          <span className="hidden shrink-0 border-l border-[#2c2c31] pl-2.5 md:block">
            <Action label={clearer.label} onClick={() => { clearer.clear(); useEditorStore.getState().markDirty(); }} title="Remove all pins of this kind." />
          </span>
        )}
      </div>
    );
  }

  // ---- navigate: live zoom readout, rotate, one-click presets ----
  if (kind === "navigate") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="shrink-0 rounded-md bg-[#232327] px-2 py-1 font-mono text-white tabular-nums" title="Current canvas zoom.">
          {Math.round(zoom)}%
        </span>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 md:flex">
          <Action label="Fit" title="Fit the document on screen." onClick={() => setTool("zoom-fit")} />
          <Action label="50%" title="Zoom to 50 percent." onClick={() => setZoom(50)} />
          <Action label="100%" title="Jump to actual pixels." onClick={() => setZoom(100)} />
          <Action label="200%" title="Zoom to 200 percent." onClick={() => setZoom(200)} />
          <Action label="400%" title="Zoom to 400 percent." onClick={() => setZoom(400)} />
        </span>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Rotate" value={Math.round(viewRotate)} min={-180} max={180} onChange={(v) => setViewRotate(v)} suffix="deg" />
          <Action label="Reset" title="Reset view rotation to zero." onClick={() => setViewRotate(0)} />
        </span>
      </div>
    );
  }

  // ---- move: position info plus direct center action ----
  if (kind === "move") {
    if (tool === "align-center") {
      return (
        <div key={tool} className={`${BAR} avero-slide-in`}>
          <Name>{name}</Name>
          <Hint>{hint}</Hint>
          <span className="shrink-0 border-l border-[#2c2c31] pl-2.5">
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
          </span>
        </div>
      );
    }
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="hidden shrink-0 items-center gap-1 border-l border-[#2c2c31] pl-2.5 md:flex">
          <Action label="Center" title="Switch to Align Center." onClick={() => setTool("align-center")} />
        </span>
      </div>
    );
  }

  // ---- eyedropper: sample scope plus live color ----
  if (kind === "eyedropper") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <ColorChip value={brushColor} onChange={(v) => setBrush({ color: v })} title="Last picked color." />
        </span>
        <span className="flex shrink-0 items-center border-l border-[#2c2c31] pl-2.5">
          <Pills
            options={[{ id: "all", label: "All layers" }, { id: "current", label: "Current" }] as const}
            value={sampleMode}
            onPick={setSampleMode}
          />
        </span>
        <span className="hidden shrink-0 items-center border-l border-[#2c2c31] pl-2.5 md:flex">
          <Action
            label="Save swatch"
            title="Save the picked color to Color panel swatches."
            onClick={() => useProStore.getState().addSwatch(brushColor)}
          />
        </span>
      </div>
    );
  }

  // ---- click utilities: direct toggles where one exists ----
  if (tool === "snap-toggle") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="shrink-0 border-l border-[#2c2c31] pl-2.5">
          <Toggle label={snapEnabled ? "Snap on" : "Snap off"} on={snapEnabled} onClick={toggleSnap} title="Toggle snapping right now." />
        </span>
      </div>
    );
  }
  if (tool === "guide-clear") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="shrink-0 border-l border-[#2c2c31] pl-2.5">
          <Action label="Clear now" primary onClick={() => { useProStore.getState().clearGuides(); useEditorStore.getState().markDirty(); }} title="Remove all guides immediately." />
        </span>
      </div>
    );
  }
  if (tool === "grid-toggle") {
    return (
      <div key={tool} className={`${BAR} avero-slide-in`}>
        <Name>{name}</Name>
        <Hint>{hint}</Hint>
        <span className="shrink-0 border-l border-[#2c2c31] pl-2.5">
          <Toggle label={showGrid ? "Grid on" : "Grid off"} on={showGrid} onClick={toggleGrid} title="Toggle the canvas grid right now." />
        </span>
      </div>
    );
  }

  // Default click bar: specific hint, no dead controls.
  return (
    <div key={tool} className={`${BAR} avero-slide-in`}>
      <Name>{name}</Name>
      <Hint>{hint}</Hint>
    </div>
  );
}
