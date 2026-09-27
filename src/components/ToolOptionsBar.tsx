import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { TOOL_LABEL } from "./ToolBar";
import { IS_CROP_TOOL, distortOf, isPaintTool, retouchModeOf } from "../engine/toolPresets";

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
    "clone-mirror": "Alt-click source, paint mirrored copy.",
    "clone-rotate": "Alt-click source, paint 90deg rotated copy.",
    "pattern-stamp": "Paint with the active pattern.",
    "pattern-fill": "Click layer to fill with repeating pattern.",
    "texture-stamp": "Paint grain weave texture.",
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
    "curvature-pen": "Drag for smooth S-curve path.",
    line: "Drag for straight line. Shift locks 45 degrees.",
    "select-polygon": "Click polygon points, double-click to close.",
    "magnetic-lasso": "Drag around edges, auto snap + expand.",
    "select-rounded": "Drag rounded-rectangle selection.",
    "wand-plus": "Wand + auto-grow 2px.",
    "wand-minus": "Wand + auto-shrink 2px.",
    "select-grow": "Click to grow selection +4px.",
    "select-shrink": "Click to shrink selection -4px.",
    "quick-select": "Click subject to auto select + expand.",
    "object-select": "Click subject to auto select + expand.",
    "color-range": "Click a color to select it everywhere.",
    "select-subject": "One click auto-selects the subject.",
    "exposure-brush": "Paint to lift local exposure. Size and Strength apply.",
    "warmth-brush": "Paint to warm local color.",
    "fade-brush": "Paint for a soft matte fade.",
    "contrast-brush": "Paint for local midtone contrast.",
    "posterize-brush": "Paint for a four level graphic tone.",
    "threshold-brush": "Paint for a black and white snap.",
    "hue-brush": "Paint to rotate hue gently.",
    "invert-brush": "Paint for a local invert blend.",
    "desat-brush": "Paint to pull saturation out.",
    "grain-brush": "Paint for fine film grain.",
    "pixelate-brush": "Paint for a local mosaic.",
    "vignette-brush": "Paint to darken dab edges.",
    "light-highlights": "Lift only bright tones.",
    "light-shadows": "Open only dark tones.",
    "light-temp": "Warm/cool local white balance.",
    "light-tint": "Green-magenta local tint.",
    "light-clarity": "Midtone local contrast.",
    "light-dehaze": "Cut haze, deepen blacks.",
    "light-saturate": "Boost local saturation.",
    "light-levels": "Stretch local levels.",
    "detail-grain-remove": "Smooth grain preserving edges.",
    "detail-sharpen-more": "Stronger edge sharpen.",
    "detail-blur-more": "Extra strong soften.",
    "detail-tilt": "Miniature tilt blur falloff.",
    "detail-lens": "Creamy circular lens blur.",
    "detail-motion": "Directional motion streak.",
    "heal-dust": "Tiny dust spot heal.",
    "heal-wrinkle": "Gentle wrinkle soften.",
    "heal-blemish": "Stronger blemish blend.",
    "heal-sky": "Wide soft sky clean.",
    "heal-skin": "Edge-safe skin smooth.",
    "heal-object": "Content erase for objects.",
    "sketch-charcoal": "Grainy charcoal, multiply blend.",
    "sketch-pastel": "Soft pastel with scatter.",
    "sketch-marker": "Flat saturated marker.",
    "sketch-highlighter": "Translucent highlight glaze.",
    "sketch-ink": "Crisp ink line.",
    "sketch-felt": "Soft felt tip.",
    "sketch-neon": "Additive glow stroke.",
    "sketch-chalk": "Dusty chalk scatter.",
    "art-oil": "Thick oil with wet mix.",
    "art-watercolor": "Translucent wash.",
    "art-knife": "Flat knife scrape.",
    "art-smear": "Finger smear.",
    "art-glaze": "Thin glaze.",
    "art-impasto": "Heavy impasto punch.",
    "art-canvas": "Weave texture stamp.",
    "art-poster": "Graphic posterize stroke.",
    "distort-twirl": "Twirl clockwise. Paint to spin.",
    "distort-twirl-ccw": "Twirl counter-clockwise.",
    "distort-pinch": "Pull toward center.",
    "distort-ripple": "Sine ripple displacement.",
    "distort-wave": "Horizontal wave shift.",
    "distort-zigzag": "Sharp zigzag offset.",
    "distort-spherize": "Spherical bulge.",
    "distort-crystal": "Faceted crystal blocks.",
    "crop-169": "Crop locked 16:9. Enter applies.",
    "crop-43": "Crop locked 4:3. Enter applies.",
    "crop-11": "Square crop 1:1. Enter applies.",
    "crop-32": "Crop locked 3:2. Enter applies.",
    "crop-free": "Free crop. Enter applies.",
    "crop-straighten": "Crop + auto-level (resets view rotate).",
    "shape-rounded": "Drag rounded rectangle.",
    "shape-diamond": "Drag diamond.",
    "shape-heart": "Drag heart.",
    "shape-hexagon": "Drag hexagon.",
    "shape-burst": "Drag 12-spike burst.",
    "shape-donut": "Drag ring donut.",
    "text-outline": "Click for hollow outline text.",
    "text-glow": "Click for soft glow text.",
    "text-shadow": "Click for drop-shadow text.",
    "text-arc": "Click for arched banner text.",
    "ai-bg-remove": "Click subject: select + mask background.",
    "ai-subject": "Click to select subject.",
    "ai-upscale": "Click to upscale document 2x.",
    "ai-denoise": "Click to add Reduce-Noise filter.",
    "ai-colorize": "Click to add Vibrance + LUT.",
    "ai-sky": "Click to add sky enhance preset.",
    "zoom-fit": "Click canvas to fit screen.",
    "zoom-100": "Click for 100% actual pixels.",
    "zoom-200": "Click for 200%.",
    "zoom-400": "Click for 400% pixels.",
    "measure-angle": "Drag to measure angle.",
    "measure-area": "Drag rect for W x H + area.",
    "sampler-avg": "Click for 5x5 average pin.",
    "snap-toggle": "Click to toggle snapping.",
    frame: "Drag to create a placeholder frame.",
    ruler: "Drag to measure distance and angle.",
    note: "Click to pin a note.",
    count: "Click to add a numbered marker.",
    "color-sampler": "Click to pin a color readout.",
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
    "slice-select": "Click slice to select, drag to move.",
    artboard: "Drag to create an artboard.",
    "path-select": "Auto-selects vector layer, drag to move whole path.",
    "direct-select": "Drag left/right to rotate active shape.",
    "rotate-view": "Drag left/right to rotate view. Double-click resets.",
    zoom: "Click to zoom in, Alt-click to zoom out.",
    "perspective-crop": "Drag area then corners for perspective.",
  };

  const usesBrushSliders =
    isPaintTool(tool) ||
    retouchModeOf(tool) !== null ||
    distortOf(tool) !== null ||
    tool === "eraser" ||
    tool === "eraser-hard" ||
    tool === "clone" ||
    tool === "clone-mirror" ||
    tool === "clone-rotate" ||
    tool === "spot-heal" ||
    tool === "blur" ||
    tool === "sharpen" ||
    tool === "smudge" ||
    tool === "dodge" ||
    tool === "burn" ||
    tool === "sponge" ||
    tool === "healing-brush" ||
    tool === "background-eraser" ||
    tool === "magic-eraser" ||
    tool === "history-brush" ||
    tool === "art-history-brush" ||
    tool === "pattern-stamp" ||
    tool === "texture-stamp" ||
    tool === "content-move" ||
    tool === "content-fill" ||
    tool === "patch" ||
    tool === "red-eye" ||
    tool === "liquify" ||
    tool === "warp" ||
    tool === "noise-reduction";

  if ((IS_CROP_TOOL as Set<string>).has(tool)) {
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

  if (
    tool === "select-rect" ||
    tool === "select-ellipse" ||
    tool === "select-polygon" ||
    tool === "select-lasso" ||
    tool === "select-rounded" ||
    tool === "magnetic-lasso"
  ) {
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

  const fallbackMap: Record<string, string> = {
    "slice-select": "Click a slice to select it, drag to move it.",
    "color-sampler": "Click the canvas to pin a persistent color readout (max 8).",
    "sampler-avg": "Click for 5x5 average color pin.",
    "path-select": "Auto-selects vector layer, drag to move the whole path.",
    "direct-select": "Drag left/right to rotate the active shape.",
    pan: "Drag to pan the canvas view. Scroll zooms.",
    "rotate-view": "Drag left/right to rotate view. Double-click resets.",
    "curvature-pen": "Drag on canvas to draw a smooth S-curve path.",
    artboard: "Drag to create a new artboard frame.",
    frame: "Drag to create an image placeholder frame.",
    slice: "Drag a rectangle to define an export slice.",
    ruler: "Drag to measure distance and angle.",
    "measure-angle": "Drag to measure angle from horizontal.",
    "measure-area": "Drag rectangle for W x H + area.",
    note: "Click to pin a note.",
    count: "Click to add a numbered marker.",
    "snap-toggle": "Click canvas to toggle snapping.",
    "zoom-fit": "Click canvas to fit screen.",
    "zoom-100": "Click for 100%.",
    "zoom-200": "Click for 200%.",
    "zoom-400": "Click for 400%.",
  };

  return (
    <div className={BAR}>
      <span className="rounded-md bg-[#2f7cf6] px-2 py-0.5 font-semibold text-white">{name}</span>
      <Hint>
        {fallbackMap[tool] ??
          ((tool as string) === "select-rect" || (tool as string) === "select-ellipse"
            ? "Drag to select. Shift adds, Alt subtracts. Feather in Select panel."
            : (tool as string) === "wand"
              ? "Click similar colors. Tolerance in Select panel."
              : (tool as string) === "move"
                ? "Drag layer. Shift snaps, Ctrl+T free transform."
                : (tool as string) === "hand"
                  ? "Drag to pan canvas. Scroll to zoom."
                  : "Select and drag on canvas to use this tool.")}
      </Hint>
    </div>
  );
}
