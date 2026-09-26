import { useMemo, useState } from "react";
import {
  Brush,
  Circle,
  CircleDashed,
  Crop,
  Eraser,
  Hand,
  Hexagon,
  Lasso,
  Layers,
  MousePointer2,
  Move,
  Pipette,
  Square,
  Stamp,
  Droplet,
  Type,
  Wand2,
  ZoomIn,
  Bandage,
  Droplets,
  Sun,
  Moon,
  Waves,
  PaintBucket,
  PenTool,
  Minus,
  Focus,
  Zap,
  Ruler,
  StickyNote,
  Hash,
  PenLine,
  Pencil,
  Paintbrush,
  Sparkles,
  Scan,
  EyeOff,
  RotateCcw,
  Frame,
  LayoutDashboard,
  Scissors,
  Copy,
  Wand,
  Triangle,
  MousePointer,
  Blend,
  StretchHorizontal,
  SprayCan,
  Star,
  ArrowRight,
  Palette,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
} from "lucide-react";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";
import clsx from "clsx";

export interface ToolDef {
  id: ToolId;
  icon: any;
  label: string;
  shortcut: string;
  description: string;
  usage: string;
}

export interface ToolFamily {
  id: string;
  label: string;
  icon: any;
  shortcut: string;
  description: string;
  tools: ToolDef[];
}

// Single source of truth. No visual duplicates: each family shows ONE button
// in the slim bar. Variants live in flyout + expandable sidebar with descriptions.
export const TOOL_FAMILIES: ToolFamily[] = [
  {
    id: "move",
    label: "Move",
    icon: Move,
    shortcut: "V",
    description: "Move layers and transform selection.",
    tools: [
      { id: "move", icon: Move, label: "Move Tool", shortcut: "V", description: "Move active layer. Shift snaps to guides.", usage: "Drag layer. Shift = snap. Ctrl+T = free transform." },
      { id: "artboard", icon: LayoutDashboard, label: "Artboard Tool", shortcut: "V", description: "Create and arrange artboards for multi-canvas work.", usage: "Drag to create an artboard." },
      { id: "path-select", icon: MousePointer, label: "Path Selection", shortcut: "A", description: "Select a whole vector path.", usage: "Click a path to select it." },
      { id: "direct-select", icon: MousePointer2, label: "Direct Selection", shortcut: "A", description: "Edit individual anchor points.", usage: "Click an anchor to edit." },
    ],
  },
  {
    id: "select",
    label: "Select",
    icon: MousePointer2,
    shortcut: "M",
    description: "Rectangular, elliptical and single-pixel selections.",
    tools: [
      { id: "select-rect", icon: MousePointer2, label: "Rectangular Marquee", shortcut: "M", description: "Rectangular selection. Shift adds, Alt subtracts.", usage: "Drag to select. Feather in Select panel." },
      { id: "select-ellipse", icon: CircleDashed, label: "Elliptical Marquee", shortcut: "M", description: "Elliptical selection for round areas.", usage: "Drag to select. Shift = circle." },
      { id: "single-row", icon: Minus, label: "Single Row Marquee", shortcut: "M", description: "Select a single 1px horizontal row.", usage: "Click a row to select it." },
      { id: "single-column", icon: Minus, label: "Single Column Marquee", shortcut: "M", description: "Select a single 1px vertical column.", usage: "Click a column to select it." },
    ],
  },
  {
    id: "lasso",
    label: "Lasso",
    icon: Lasso,
    shortcut: "L",
    description: "Freehand and polygonal selections.",
    tools: [
      { id: "select-lasso", icon: Lasso, label: "Lasso", shortcut: "L", description: "Freehand selection. Close path to finish.", usage: "Drag freely, release near start." },
      { id: "select-polygon", icon: Hexagon, label: "Polygonal Lasso", shortcut: "L", description: "Straight-edge polygon selection.", usage: "Click points, double-click to close." },
      { id: "object-select", icon: Scan, label: "Object Select", shortcut: "W", description: "Auto rectangular object detection.", usage: "Drag around an object." },
      { id: "quick-select", icon: Wand, label: "Quick Select", shortcut: "W", description: "Brush-based auto selection.", usage: "Paint over the subject." },
      { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", description: "Select similar colors by tolerance.", usage: "Click an area. Tolerance in Select panel." },
    ],
  },
  {
    id: "crop",
    label: "Crop",
    icon: Crop,
    shortcut: "C",
    description: "Crop, slice and frame the document.",
    tools: [
      { id: "crop", icon: Crop, label: "Crop", shortcut: "C", description: "Crop document. Enter applies, Esc cancels.", usage: "Drag area, Enter to apply." },
      { id: "perspective-crop", icon: Crop, label: "Perspective Crop", shortcut: "C", description: "Crop with perspective correction.", usage: "Drag area, adjust corners." },
      { id: "slice", icon: Scissors, label: "Slice", shortcut: "C", description: "Cut export slices.", usage: "Drag to define a slice." },
      { id: "slice-select", icon: Copy, label: "Slice Select", shortcut: "C", description: "Select and move slices.", usage: "Click a slice." },
      { id: "frame", icon: Frame, label: "Frame", shortcut: "K", description: "Placeholder frame for images.", usage: "Drag to create a frame." },
    ],
  },
  {
    id: "measure",
    label: "Measure",
    icon: Pipette,
    shortcut: "I",
    description: "Sample color, measure and annotate.",
    tools: [
      { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", description: "Pick a color from canvas.", usage: "Click canvas to sample." },
      { id: "color-sampler", icon: Pipette, label: "Color Sampler", shortcut: "I", description: "Persistent color readout point.", usage: "Click to place a sampler." },
      { id: "ruler", icon: Ruler, label: "Ruler", shortcut: "I", description: "Measure distance and angle.", usage: "Drag to measure." },
      { id: "note", icon: StickyNote, label: "Note", shortcut: "I", description: "Attach a note to canvas.", usage: "Click to add a note." },
      { id: "count", icon: Hash, label: "Count", shortcut: "I", description: "Count objects with numbered markers.", usage: "Click to add a count." },
    ],
  },
  {
    id: "brush",
    label: "Brush",
    icon: Brush,
    shortcut: "B",
    description: "Paint with distinct brush engines.",
    tools: [
      { id: "brush", icon: Brush, label: "Brush", shortcut: "B", description: "Soft round brush with smoothing.", usage: "Paint freely. [ ] = size." },
      { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "B", description: "Hard 1px edge, no anti-alias.", usage: "Pixel-precise strokes." },
      { id: "airbrush", icon: SprayCan, label: "Airbrush", shortcut: "B", description: "Soft spray buildup, low flow per dab.", usage: "Hold to build up tone." },
      { id: "soft-brush", icon: Paintbrush, label: "Soft Brush", shortcut: "B", description: "Extra-large feather for blending.", usage: "Blend and soften." },
      { id: "color-replacement", icon: Pipette, label: "Color Replacement", shortcut: "B", description: "Replace hue while keeping luminance.", usage: "Paint over target color." },
      { id: "mixer-brush", icon: Paintbrush, label: "Mixer Brush", shortcut: "B", description: "Wet oil-paint color mixing.", usage: "Paint to mix wet colors." },
    ],
  },
  {
    id: "eraser",
    label: "Eraser",
    icon: Eraser,
    shortcut: "E",
    description: "Erase with three different modes.",
    tools: [
      { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E", description: "Soft standard eraser. Paints mask when mask mode is on.", usage: "Drag to erase." },
      { id: "background-eraser", icon: Eraser, label: "Background Eraser", shortcut: "E", description: "Erases only colors similar to sampled edge.", usage: "Drag along background edge." },
      { id: "magic-eraser", icon: Sparkles, label: "Magic Eraser", shortcut: "E", description: "One-click flood erase of flat areas.", usage: "Click a flat area." },
      { id: "eraser-hard", icon: Eraser, label: "Hard Eraser", shortcut: "E", description: "100% hard block eraser for pixel work.", usage: "Drag for hard erase." },
    ],
  },
  {
    id: "heal",
    label: "Heal",
    icon: Bandage,
    shortcut: "J",
    description: "Remove spots, heal and fill content.",
    tools: [
      { id: "spot-heal", icon: Bandage, label: "Spot Healing", shortcut: "J", description: "Auto-blend spots with surroundings.", usage: "Click or paint over blemishes." },
      { id: "healing-brush", icon: Sparkles, label: "Healing Brush", shortcut: "J", description: "Alt-click source, precise healing.", usage: "Alt-click source, then paint." },
      { id: "patch", icon: Layers, label: "Patch", shortcut: "J", description: "Drag source area onto target.", usage: "Drag source to target." },
      { id: "content-move", icon: StretchHorizontal, label: "Content-Aware Move", shortcut: "J", description: "Move object, background auto-fills.", usage: "Drag an object." },
      { id: "content-fill", icon: Sparkles, label: "Content Fill", shortcut: "J", description: "Fill selection with surrounding texture.", usage: "Select area, click to fill." },
      { id: "red-eye", icon: EyeOff, label: "Red Eye", shortcut: "J", description: "One-click red-eye correction.", usage: "Click red eyes." },
    ],
  },
  {
    id: "stamp",
    label: "Stamp",
    icon: Stamp,
    shortcut: "S",
    description: "Clone, pattern and history painting.",
    tools: [
      { id: "clone", icon: Stamp, label: "Clone Stamp", shortcut: "S", description: "Alt-click source, paint exact copies.", usage: "Alt-click source, then paint." },
      { id: "pattern-stamp", icon: Stamp, label: "Pattern Stamp", shortcut: "S", description: "Paint with active pattern.", usage: "Paint with pattern." },
      { id: "history-brush", icon: RotateCcw, label: "History Brush", shortcut: "Y", description: "Restore from history snapshot.", usage: "Paint to restore." },
      { id: "art-history-brush", icon: Paintbrush, label: "Art History Brush", shortcut: "Y", description: "Artistic stylized history strokes.", usage: "Paint for artistic effect." },
    ],
  },
  {
    id: "tone",
    label: "Tone",
    icon: Sun,
    shortcut: "O",
    description: "Dodge, burn and local color.",
    tools: [
      { id: "dodge", icon: Sun, label: "Dodge", shortcut: "O", description: "Lighten locally with soft buildup.", usage: "Paint to lighten." },
      { id: "burn", icon: Moon, label: "Burn", shortcut: "O", description: "Darken locally with soft buildup.", usage: "Paint to darken." },
      { id: "sponge", icon: Focus, label: "Sponge", shortcut: "O", description: "Local saturation control.", usage: "Paint to saturate / desaturate." },
      { id: "vibrance-brush", icon: Palette, label: "Vibrance Brush", shortcut: "O", description: "Smart saturation protecting skin tones.", usage: "Paint to boost muted colors." },
    ],
  },
  {
    id: "detail",
    label: "Detail",
    icon: Droplets,
    shortcut: "R",
    description: "Blur, sharpen, smudge and distort.",
    tools: [
      { id: "blur", icon: Droplets, label: "Blur", shortcut: "R", description: "Soften with radius-based blur.", usage: "Paint to soften." },
      { id: "blur-iris", icon: Focus, label: "Iris Blur", shortcut: "R", description: "Strong center-falloff blur.", usage: "Paint for depth of field." },
      { id: "sharpen", icon: Zap, label: "Sharpen", shortcut: "R", description: "Local contrast sharpening.", usage: "Paint to sharpen detail." },
      { id: "sharpen-edge", icon: Zap, label: "Edge Sharpen", shortcut: "R", description: "Sharpen edges only, protects flat areas.", usage: "Paint over edges." },
      { id: "smudge", icon: Waves, label: "Smudge", shortcut: "R", description: "Drag pixels like wet paint.", usage: "Click to pick color, drag." },
      { id: "noise-reduction", icon: Waves, label: "Noise Reduction", shortcut: "R", description: "Smooth luminance noise preserving edges.", usage: "Paint over noisy areas." },
      { id: "liquify", icon: Waves, label: "Liquify", shortcut: "O", description: "Push pixels with distortion.", usage: "Drag to distort." },
      { id: "warp", icon: Blend, label: "Warp", shortcut: "O", description: "Grid-based flexible warp.", usage: "Drag grid to bend." },
    ],
  },
  {
    id: "paint",
    label: "Paint",
    icon: Droplet,
    shortcut: "G",
    description: "Gradient and fill tools.",
    tools: [
      { id: "gradient", icon: Droplet, label: "Linear Gradient", shortcut: "G", description: "Linear blend between foreground and target.", usage: "Drag to define direction." },
      { id: "gradient-radial", icon: Circle, label: "Radial Gradient", shortcut: "G", description: "Circular falloff gradient.", usage: "Drag from center outward." },
      { id: "fill", icon: PaintBucket, label: "Paint Bucket", shortcut: "G", description: "Tolerance flood fill respecting selection.", usage: "Click area to fill." },
    ],
  },
  {
    id: "vector",
    label: "Vector",
    icon: PenTool,
    shortcut: "P",
    description: "Pen paths and lines.",
    tools: [
      { id: "pen", icon: PenTool, label: "Pen", shortcut: "P", description: "Free bezier path.", usage: "Drag for free path." },
      { id: "curvature-pen", icon: PenLine, label: "Curvature Pen", shortcut: "P", description: "Click curve points with handles.", usage: "Click points, drag handles." },
      { id: "line", icon: Minus, label: "Line", shortcut: "P", description: "Straight line. Shift locks 45 degrees.", usage: "Drag for straight line." },
    ],
  },
  {
    id: "type",
    label: "Type",
    icon: Type,
    shortcut: "T",
    description: "Horizontal and vertical text.",
    tools: [
      { id: "text", icon: Type, label: "Horizontal Type", shortcut: "T", description: "Click canvas to type horizontally.", usage: "Click, then type." },
      { id: "text-vertical", icon: Type, label: "Vertical Type", shortcut: "T", description: "Vertical CJK-style text flow.", usage: "Click, then type vertically." },
    ],
  },
  {
    id: "shape",
    label: "Shape",
    icon: Square,
    shortcut: "U",
    description: "Vector shapes with full controls.",
    tools: [
      { id: "shape-rect", icon: Square, label: "Rectangle", shortcut: "U", description: "Rectangle. Shift = square.", usage: "Drag to draw." },
      { id: "shape-ellipse", icon: Circle, label: "Ellipse", shortcut: "U", description: "Oval. Shift = circle.", usage: "Drag to draw." },
      { id: "triangle-shape", icon: Triangle, label: "Triangle", shortcut: "U", description: "Three-point triangle.", usage: "Drag to draw." },
      { id: "shape-polygon", icon: Hexagon, label: "Polygon", shortcut: "U", description: "Multi-side polygon.", usage: "Drag to draw." },
      { id: "shape-line", icon: Minus, label: "Shape Line", shortcut: "U", description: "Vector line shape.", usage: "Drag to draw." },
      { id: "shape-star", icon: Star, label: "Star", shortcut: "U", description: "5-point vector star.", usage: "Drag to draw." },
      { id: "shape-arrow", icon: ArrowRight, label: "Arrow", shortcut: "U", description: "Block arrow shape.", usage: "Drag to draw." },
      { id: "shape-custom", icon: Sparkles, label: "Custom Shape", shortcut: "U", description: "Decorative custom shape.", usage: "Drag to draw." },
    ],
  },
  {
    id: "navigate",
    label: "Navigate",
    icon: Hand,
    shortcut: "H",
    description: "Pan, rotate and zoom the view.",
    tools: [
      { id: "hand", icon: Hand, label: "Hand", shortcut: "H", description: "Pan canvas. Scroll zooms.", usage: "Drag to pan." },
      { id: "pan", icon: Hand, label: "Pan (Alt)", shortcut: "H", description: "Alternate pan for stylus.", usage: "Drag to pan." },
      { id: "rotate-view", icon: RotateCcw, label: "Rotate View", shortcut: "R", description: "Non-destructive view rotation.", usage: "Drag to rotate view." },
      { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", description: "Click zoom in, Alt-click zoom out.", usage: "Click / Alt-click." },
    ],
  },
];

export const TOOL_LABEL: Record<string, string> = Object.fromEntries(
  TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => [t.id, t.label])),
);

export const TOOLS = TOOL_FAMILIES.flatMap((f) =>
  f.tools.map((t) => ({ id: t.id, icon: t.icon, label: t.label, shortcut: t.shortcut, group: f.label })),
);

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(
  TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => [t.id, t])),
);

export const FAMILY_OF: Record<string, string> = Object.fromEntries(
  TOOL_FAMILIES.flatMap((f) => f.tools.map((t) => [t.id, f.id])),
);

export default function ToolBar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOL_FAMILIES;
    return TOOL_FAMILIES.map((f) => ({
      ...f,
      tools: f.tools.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.id.includes(q),
      ),
    })).filter((f) => f.tools.length > 0);
  }, [query]);

  function pickFamily(f: ToolFamily) {
    if (openFamily === f.id) {
      // second click cycles variants
      const idx = f.tools.findIndex((t) => t.id === tool);
      const next = f.tools[(idx + 1) % f.tools.length];
      setTool(next.id);
    } else {
      setOpenFamily(f.id);
      if (!f.tools.some((t) => t.id === tool)) setTool(f.tools[0].id);
    }
  }

  return (
    <div className="flex shrink-0">
      {/* Slim icon bar - one button per family, no duplicates */}
      <div className="flex w-[56px] flex-col items-center gap-0.5 overflow-y-auto border-r border-[#2c2c31] bg-[#1c1c1f] py-2">
        {TOOL_FAMILIES.map((f) => {
          const Icon = f.icon;
          const active = FAMILY_OF[tool] === f.id;
          const variantCount = f.tools.length;
          return (
            <button
              key={f.id}
              title={`${f.label} - ${f.description}`}
              onClick={() => pickFamily(f)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpenFamily(openFamily === f.id ? null : f.id);
                setExpanded(true);
              }}
              className={clsx(
                "relative grid h-9 w-9 shrink-0 place-items-center rounded-md",
                active ? "bg-[#2f7cf6] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <Icon size={16} strokeWidth={1.9} />
              {variantCount > 1 && (
                <span className="absolute bottom-[2px] right-[3px] h-0 w-0 border-b-[6px] border-l-[6px] border-b-[#6e6e78] border-l-transparent" />
              )}
              {active && <span className="absolute -left-[9px] h-5 w-[3px] rounded-r bg-[#8fb6f5]" />}
            </button>
          );
        })}
        <button
          title={expanded ? "Collapse tool panel" : "Expand tool panel with descriptions"}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 grid h-8 w-9 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
        >
          {expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="mt-auto px-1 pb-1 text-center font-mono text-[8.5px] leading-tight text-[#6e6e78]">
          Ctrl+K
        </div>
      </div>

      {/* Expandable sidebar with descriptions, search, collapsible groups */}
      {expanded && (
        <div className="flex w-[264px] flex-col border-r border-[#2c2c31] bg-[#161618]">
          <div className="flex items-center gap-2 border-b border-[#2c2c31] p-2">
            <Search size={13} className="shrink-0 text-[#6e6e78]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-[#6e6e78]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {filtered.map((f) => {
              const isCollapsed = !!collapsed[f.id];
              const isActiveFamily = FAMILY_OF[tool] === f.id;
              return (
                <div key={f.id} className="mb-1 rounded-lg border border-[#232327] bg-[#1c1c1f]">
                  <button
                    onClick={() => setCollapsed((s) => ({ ...s, [f.id]: !s[f.id] }))}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <f.icon size={14} className={isActiveFamily ? "text-[#8fb6f5]" : "text-[#a7a7b0]"} />
                    <span className="flex-1 text-[12px] font-semibold text-white">{f.label}</span>
                    <span className="rounded bg-[#232327] px-1 font-mono text-[9px] text-[#a7a7b0]">{f.shortcut}</span>
                    <ChevronDown
                      size={13}
                      className={clsx("text-[#6e6e78] transition-transform", isCollapsed && "-rotate-90")}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="px-1.5 pb-1.5">
                      <div className="mb-1.5 px-1 text-[10.5px] leading-snug text-[#6e6e78]">{f.description}</div>
                      {f.tools.map((t) => {
                        const Icon = t.icon;
                        const active = tool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTool(t.id)}
                            title={`${t.label} (${t.shortcut}) - ${t.usage}`}
                            className={clsx(
                              "mb-1 w-full rounded-md border px-2 py-1.5 text-left transition-colors",
                              active
                                ? "border-[#2f7cf6] bg-[#2f7cf6]/15"
                                : "border-transparent hover:border-[#2c2c31] hover:bg-[#232327]",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Icon size={14} className={active ? "text-white" : "text-[#a7a7b0]"} />
                              <span className={clsx("flex-1 text-[12px]", active ? "text-white" : "text-[#c9c9d1]")}>
                                {t.label}
                              </span>
                              <span className="font-mono text-[9px] text-[#6e6e78]">{t.shortcut}</span>
                            </div>
                            <div className="mt-0.5 pl-6 text-[10.5px] leading-snug text-[#6e6e78]">{t.description}</div>
                            <div className="mt-0.5 pl-6 font-mono text-[9.5px] text-[#5a5a63]">{t.usage}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-3 text-center text-[12px] text-[#6e6e78]">No tools match “{query}”.</div>
            )}
          </div>
          <div className="border-t border-[#2c2c31] p-2 text-[10px] leading-snug text-[#6e6e78]">
            Click a family icon to select. Click again to cycle variants. Right-click opens this panel.
          </div>
        </div>
      )}

      {/* Flyout for current family when sidebar closed */}
      {!expanded && openFamily && (
        <div className="w-[220px] border-r border-[#2c2c31] bg-[#161618] p-1.5">
          {(() => {
            const f = TOOL_FAMILIES.find((x) => x.id === openFamily);
            if (!f) return null;
            return (
              <div>
                <div className="mb-1 px-1 pt-1 text-[11px] font-semibold text-white">{f.label}</div>
                <div className="mb-2 px-1 text-[10.5px] text-[#6e6e78]">{f.description}</div>
                {f.tools.map((t) => {
                  const Icon = t.icon;
                  const active = tool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTool(t.id)}
                      className={clsx(
                        "mb-1 w-full rounded-md px-2 py-1.5 text-left",
                        active ? "bg-[#2f7cf6] text-white" : "text-[#c9c9d1] hover:bg-[#232327]",
                      )}
                      title={`${t.description} ${t.usage}`}
                    >
                      <div className="flex items-center gap-2 text-[12px]">
                        <Icon size={14} />
                        <span className="flex-1">{t.label}</span>
                      </div>
                      <div className={clsx("mt-0.5 text-[10px]", active ? "text-white/70" : "text-[#6e6e78]")}>
                        {t.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
