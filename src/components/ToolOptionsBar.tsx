import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { TOOL_LABEL } from "./ToolBar";

const BAR =
  "pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[94%] -translate-x-1/2 items-center gap-2.5 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-3 py-2 text-[11px] text-[#a7a7b0]";

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="truncate text-[#c9c9d1]">{children}</span>;
}

function Slider({ label, value, min, max, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-[#6e6e78]">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-16 accent-[#2f7cf6]" />
      <span className="w-8 font-mono text-white tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  );
}

// Contextual options bar: always visible above canvas for the active tool.
export default function ToolOptionsBar({
  onApplyCrop,
  onCancelCrop,
}: {
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}) {
  const tool = useEditorStore((s) => s.tool);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const brushHardness = useEditorStore((s) => s.brushHardness);
  const setBrush = useEditorStore((s) => s.setBrush);
  const paintMask = useProStore((s) => s.paintMask);
  const gradTo = useProStore((s) => s.gradTo);
  const setGradTo = useProStore((s) => s.setGradTo);
  const selTolerance = useProStore((s) => s.selTolerance);
  const selFeather = useProStore((s) => s.selFeather);
  const setSelParams = useProStore((s) => s.setSelParams);
  const name = TOOL_LABEL[tool] ?? tool;

  const retouchHint: Partial<Record<string, string>> = {
    "spot-heal": "Click or paint over blemishes. Press J to cycle heal tools.",
    "healing-brush": "Alt-click to set source, then paint for precise healing.",
    patch: "Drag source area onto target to patch.",
    "content-move": "Drag object, background fills automatically.",
    "content-fill": "Select area, click to fill with surrounding texture.",
    "red-eye": "Click red eyes to correct.",
    clone: "Alt-click sets source, then paint to clone.",
    "pattern-stamp": "Paint with the active pattern.",
    "history-brush": "Paint to restore from history state.",
    "art-history-brush": "Paint stylized artistic history strokes.",
    brush: "Free painting. Press B to cycle pencil / airbrush.",
    pencil: "Hard edge, no anti-alias. Pixel precise.",
    airbrush: "Soft spray. Hold to build up tone gradually.",
    "soft-brush": "Extra soft blending brush.",
    "overlay-brush": "Overlay blend contrast. Press B to cycle brushes.",
    "color-replacement": "Replace target hue while keeping luminance.",
    "mixer-brush": "Wet oil-paint color mixing.",
    eraser: "Erase pixels or mask. Press E to cycle erasers.",
    "background-eraser": "Erases only background colors near edge sample.",
    "magic-eraser": "Click a flat area to erase it at once.",
    "eraser-hard": "100% hard block eraser for pixel work.",
    blur: "Paint to soften. Press R to cycle sharpen / smudge.",
    "blur-iris": "Strong falloff blur for depth of field.",
    sharpen: "Paint to sharpen local detail.",
    "sharpen-edge": "Sharpens edges only, protects flat areas.",
    smudge: "Click to pick color first, then drag.",
    dodge: "Paint to lighten. Press O to cycle burn / sponge.",
    burn: "Paint to darken.",
    sponge: "Paint to adjust local saturation.",
    "vibrance-brush": "Smart saturation, protects skin tones.",
    liquify: "Drag to distort pixels locally.",
    warp: "Drag grid to bend the area.",
    "noise-reduction": "Paint to smooth noise while keeping edges.",
    fill: "Click area to fill with brush color. Respects selection. G toggles gradient.",
    "gradient-radial": "Drag outward from center for radial fill.",
    pen: "Drag for free path. Press P to cycle curvature / line.",
    "curvature-pen": "Click curve points, drag handles.",
    line: "Drag for straight line. Shift locks 45 degrees.",
    "select-polygon": "Click polygon points, double-click to close.",
    "quick-select": "Click subject to auto select + expand.",
    "object-select": "Click subject to auto select + expand.",
    "color-range": "Click a color to select it everywhere.",
    "select-subject": "One click auto-selects the subject.",
    frame: "Drag to create a placeholder frame.",
    ruler: "Drag to measure distance and angle.",
    note: "Click to attach a note.",
    count: "Click to add a count marker.",
    "color-sampler": "Click to sample a persistent color.",
    text: "Click canvas to start typing.",
    "text-vertical": "Click canvas for vertical text.",
    "shape-rect": "Drag for rectangle. Shift = square.",
    "shape-ellipse": "Drag for ellipse. Shift = circle.",
    "triangle-shape": "Drag for triangle.",
    "shape-polygon": "Drag for polygon.",
    "shape-line": "Drag for line shape.",
    "shape-star": "Drag for 5-point star.",
    "shape-arrow": "Drag for block arrow.",
    "shape-custom": "Drag for custom shape.",
    eyedropper: "Click canvas to pick a color.",
    "select-lasso": "Free drag to select. Close to start point.",
    "single-row": "Click to select 1px horizontal row.",
    "single-column": "Click to select 1px vertical column.",
    slice: "Drag to define an export slice.",
    "slice-select": "Click a slice to select it.",
    artboard: "Drag to create an artboard.",
    "path-select": "Click a path to select the whole path.",
    "direct-select": "Click an anchor point to edit it.",
    "rotate-view": "Drag to rotate canvas view.",
    zoom: "Click to zoom in, Alt-click to zoom out.",
    "perspective-crop": "Drag area then corners for perspective.",
  };

  const usesBrushSliders =
    tool === "brush" ||
    tool === "pencil" ||
    tool === "airbrush" ||
    tool === "soft-brush" ||
    tool === "overlay-brush" ||
    tool === "eraser" ||
    tool === "eraser-hard" ||
    tool === "clone" ||
    tool === "spot-heal" ||
    tool === "blur" ||
    tool === "blur-iris" ||
    tool === "sharpen" ||
    tool === "sharpen-edge" ||
    tool === "smudge" ||
    tool === "dodge" ||
    tool === "burn" ||
    tool === "sponge" ||
    tool === "vibrance-brush" ||
    tool === "healing-brush" ||
    tool === "mixer-brush" ||
    tool === "color-replacement" ||
    tool === "background-eraser" ||
    tool === "magic-eraser" ||
    tool === "history-brush" ||
    tool === "art-history-brush" ||
    tool === "pattern-stamp" ||
    tool === "content-move" ||
    tool === "content-fill" ||
    tool === "patch" ||
    tool === "red-eye" ||
    tool === "liquify" ||
    tool === "warp" ||
    tool === "noise-reduction";

  if (tool === "crop" || tool === "perspective-crop") {
    return (
      <div className={BAR}>
        <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>Drag area. Enter applies, Esc cancels.</Hint>
        <button onClick={onApplyCrop} className="avero-btn-primary rounded-md px-2.5 py-1 font-semibold text-white">
          Apply
        </button>
        <button onClick={onCancelCrop} className="rounded-md bg-[#232327] px-2.5 py-1 text-white hover:bg-[#2c2c31]">
          Cancel
        </button>
      </div>
    );
  }

  if (tool === "gradient" || tool === "gradient-radial" || tool === "fill") {
    return (
      <div className={BAR}>
        <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <span className="shrink-0 text-[#6e6e78]">Fill to</span>
        {(["transparent", "white", "black"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGradTo(g)}
            className={`rounded-md px-2 py-1 transition-colors ${gradTo === g ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white"}`}
          >
            {g === "transparent" ? "Transparent" : g === "white" ? "White" : "Black"}
          </button>
        ))}
        <Hint>Drag on canvas. G cycles modes.</Hint>
      </div>
    );
  }

  if (tool === "wand" || tool === "quick-select" || tool === "object-select" || tool === "color-range" || tool === "select-subject") {
    return (
      <div className={BAR}>
        <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>{retouchHint[tool] ?? "Click to auto select."}</Hint>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Tolerance" value={selTolerance} min={1} max={100} onChange={(v) => setSelParams({ selTolerance: v })} />
          <Slider label="Feather" value={selFeather} min={0} max={50} onChange={(v) => setSelParams({ selFeather: v })} suffix="px" />
        </span>
      </div>
    );
  }

  if (tool === "select-rect" || tool === "select-ellipse" || tool === "select-polygon" || tool === "select-lasso") {
    return (
      <div className={BAR}>
        <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>{retouchHint[tool] ?? "Drag to select. Shift adds, Alt subtracts."}</Hint>
        <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
          <Slider label="Feather" value={selFeather} min={0} max={50} onChange={(v) => setSelParams({ selFeather: v })} suffix="px" />
        </span>
      </div>
    );
  }

  if (retouchHint[tool]) {
    return (
      <div className={BAR}>
        <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>{retouchHint[tool]}</Hint>
        {usesBrushSliders && (
          <span className="hidden shrink-0 items-center gap-3 border-l border-[#2c2c31] pl-2.5 lg:flex">
            <Slider label="Size" value={brushSize} min={1} max={300} onChange={(v) => setBrush({ size: v })} />
            <Slider label="Hard" value={brushHardness} min={0} max={100} onChange={(v) => setBrush({ hardness: v })} suffix="%" />
            <Slider label="Strength" value={brushOpacity} min={1} max={100} onChange={(v) => setBrush({ opacity: v })} suffix="%" />
          </span>
        )}
      </div>
    );
  }

  if (paintMask && (tool === "brush" || tool === "eraser")) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-3 py-2 text-[11px] text-[#d9a441]">
        Mask paint mode. Brush reveals, Eraser hides.
      </div>
    );
  }

  // Default: always show tool name + light hint
  const generic = retouchHint[tool];
  if (generic) {
    return (
      <div className={BAR}>
        <span className="shrink-0 rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
        <Hint>{generic}</Hint>
      </div>
    );
  }

  return (
    <div className={BAR}>
      <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
      <Hint>
        {(tool as string) === "select-rect" || (tool as string) === "select-ellipse"
          ? "Drag to select. Shift adds, Alt subtracts. Feather in Select panel."
          : (tool as string) === "wand"
            ? "Click similar colors. Tolerance in Select panel."
            : (tool as string) === "move"
              ? "Drag layer. Shift snaps, Ctrl+T free transform."
              : (tool as string) === "hand"
                ? "Drag to pan canvas. Scroll to zoom."
                : "Select and drag on canvas to use this tool."}
      </Hint>
    </div>
  );
}
