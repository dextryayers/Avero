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
  Pipette as Pipette2,
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
} from "lucide-react";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";
import clsx from "clsx";

interface ToolDef {
  id: ToolId;
  icon: any;
  label: string;
  shortcut: string;
  group: string;
}

const tools: ToolDef[] = [
  // Pilih - seleksi dan dokumen
  { id: "move", icon: Move, label: "Move dan Transform", shortcut: "V", group: "Pilih" },
  { id: "artboard", icon: LayoutDashboard, label: "Artboard", shortcut: "V", group: "Pilih" },
  { id: "select-rect", icon: MousePointer2, label: "Rect Select (M ganti ellipse/polygon)", shortcut: "M", group: "Pilih" },
  { id: "select-ellipse", icon: CircleDashed, label: "Ellipse Select", shortcut: "M", group: "Pilih" },
  { id: "single-row", icon: Minus, label: "Single Row Marquee", shortcut: "M", group: "Pilih" },
  { id: "single-column", icon: Minus, label: "Single Column Marquee", shortcut: "M", group: "Pilih" },
  { id: "select-lasso", icon: Lasso, label: "Lasso", shortcut: "L", group: "Pilih" },
  { id: "select-polygon", icon: Hexagon, label: "Polygon Lasso", shortcut: "L", group: "Pilih" },
  { id: "object-select", icon: Scan, label: "Object Selection", shortcut: "W", group: "Pilih" },
  { id: "quick-select", icon: Wand, label: "Quick Select", shortcut: "W", group: "Pilih" },
  { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", group: "Pilih" },
  { id: "crop", icon: Crop, label: "Crop dokumen", shortcut: "C", group: "Pilih" },
  { id: "perspective-crop", icon: Crop, label: "Perspective Crop", shortcut: "C", group: "Pilih" },
  { id: "slice", icon: Scissors, label: "Slice", shortcut: "C", group: "Pilih" },
  { id: "slice-select", icon: Copy, label: "Slice Select", shortcut: "C", group: "Pilih" },
  { id: "frame", icon: Frame, label: "Frame Tool", shortcut: "K", group: "Pilih" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", group: "Pilih" },
  { id: "color-sampler", icon: Pipette2, label: "Color Sampler", shortcut: "I", group: "Pilih" },
  { id: "ruler", icon: Ruler, label: "Ruler", shortcut: "I", group: "Pilih" },
  { id: "note", icon: StickyNote, label: "Note", shortcut: "I", group: "Pilih" },
  { id: "count", icon: Hash, label: "Count", shortcut: "I", group: "Pilih" },
  // Retouch - perbaikan foto
  { id: "spot-heal", icon: Bandage, label: "Spot Healing noda", shortcut: "J", group: "Retouch" },
  { id: "healing-brush", icon: Sparkles, label: "Healing Brush", shortcut: "J", group: "Retouch" },
  { id: "patch", icon: Layers, label: "Patch Tool", shortcut: "J", group: "Retouch" },
  { id: "content-move", icon: StretchHorizontal, label: "Content-Aware Move", shortcut: "J", group: "Retouch" },
  { id: "red-eye", icon: EyeOff, label: "Red Eye", shortcut: "J", group: "Retouch" },
  { id: "clone", icon: Stamp, label: "Clone Stamp (Alt+klik sumber)", shortcut: "S", group: "Retouch" },
  { id: "pattern-stamp", icon: Stamp, label: "Pattern Stamp", shortcut: "S", group: "Retouch" },
  { id: "history-brush", icon: RotateCcw, label: "History Brush", shortcut: "Y", group: "Retouch" },
  { id: "art-history-brush", icon: Paintbrush, label: "Art History Brush", shortcut: "Y", group: "Retouch" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B", group: "Retouch" },
  { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "B", group: "Retouch" },
  { id: "color-replacement", icon: Pipette, label: "Color Replacement", shortcut: "B", group: "Retouch" },
  { id: "mixer-brush", icon: Paintbrush, label: "Mixer Brush", shortcut: "B", group: "Retouch" },
  { id: "eraser", icon: Eraser, label: "Eraser dan Mask paint", shortcut: "E", group: "Retouch" },
  { id: "background-eraser", icon: Eraser, label: "Background Eraser", shortcut: "E", group: "Retouch" },
  { id: "magic-eraser", icon: Sparkles, label: "Magic Eraser", shortcut: "E", group: "Retouch" },
  { id: "blur", icon: Droplets, label: "Blur (R putar Sharpen, Smudge)", shortcut: "R", group: "Retouch" },
  { id: "sharpen", icon: Zap, label: "Sharpen", shortcut: "R", group: "Retouch" },
  { id: "smudge", icon: Waves, label: "Smudge, seret piksel", shortcut: "R", group: "Retouch" },
  { id: "dodge", icon: Sun, label: "Dodge, cerahkan (O putar)", shortcut: "O", group: "Retouch" },
  { id: "burn", icon: Moon, label: "Burn, gelapkan", shortcut: "O", group: "Retouch" },
  { id: "sponge", icon: Focus, label: "Sponge, saturasi lokal", shortcut: "O", group: "Retouch" },
  { id: "liquify", icon: Waves, label: "Liquify", shortcut: "O", group: "Retouch" },
  { id: "warp", icon: Blend, label: "Warp", shortcut: "O", group: "Retouch" },
  // Cat
  { id: "gradient", icon: Droplet, label: "Gradient (G putar Fill)", shortcut: "G", group: "Cat" },
  { id: "fill", icon: PaintBucket, label: "Paint Bucket, isi seleksi", shortcut: "G", group: "Cat" },
  // Vektor
  { id: "pen", icon: PenTool, label: "Pen, garis bebas", shortcut: "P", group: "Vektor" },
  { id: "curvature-pen", icon: PenLine, label: "Curvature Pen", shortcut: "P", group: "Vektor" },
  { id: "line", icon: Minus, label: "Line, garis lurus", shortcut: "P", group: "Vektor" },
  { id: "path-select", icon: MousePointer, label: "Path Selection", shortcut: "A", group: "Vektor" },
  { id: "direct-select", icon: MousePointer2, label: "Direct Selection", shortcut: "A", group: "Vektor" },
  { id: "text", icon: Type, label: "Text", shortcut: "T", group: "Vektor" },
  { id: "text-vertical", icon: Type, label: "Vertical Type", shortcut: "T", group: "Vektor" },
  { id: "shape-rect", icon: Square, label: "Shape Rect (U ganti)", shortcut: "U", group: "Vektor" },
  { id: "shape-ellipse", icon: Circle, label: "Shape Ellipse", shortcut: "U", group: "Vektor" },
  { id: "triangle-shape", icon: Triangle, label: "Triangle Shape", shortcut: "U", group: "Vektor" },
  { id: "shape-polygon", icon: Hexagon, label: "Shape Polygon", shortcut: "U", group: "Vektor" },
  { id: "shape-line", icon: Minus, label: "Shape Line", shortcut: "U", group: "Vektor" },
  { id: "shape-custom", icon: Sparkles, label: "Custom Shape", shortcut: "U", group: "Vektor" },
  // Navigasi
  { id: "hand", icon: Hand, label: "Hand", shortcut: "H", group: "Navigasi" },
  { id: "rotate-view", icon: RotateCcw, label: "Rotate View", shortcut: "R", group: "Navigasi" },
  { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", group: "Navigasi" },
  { id: "pan", icon: Hand, label: "Pan", shortcut: "H", group: "Navigasi" },
];

const GROUPS = ["Pilih", "Retouch", "Cat", "Vektor", "Navigasi"];

export default function ToolBar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="flex w-[56px] flex-col items-center gap-0.5 overflow-y-auto border-r border-[#2c2c31] bg-[#1c1c1f] py-2">
      {GROUPS.map((g, gi) => (
        <div key={g} className="flex w-full flex-col items-center">
          {gi > 0 && <div className="my-1.5 h-px w-[36px] bg-[#2c2c31]" />}
          <div className="avero-micro mb-1 px-1 text-center" style={{ fontSize: 8 }}>{g}</div>
          {tools
            .filter((t) => t.group === g)
            .map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  title={`${t.label} (${t.shortcut})`}
                  onClick={() => setTool(t.id)}
                  className={clsx(
                    "relative grid h-9 w-9 shrink-0 place-items-center rounded-md",
                    active
                      ? "bg-[#2f7cf6] text-white"
                      : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
                  )}
                >
                  <Icon size={16} strokeWidth={1.9} />
                  {active && (
                    <span className="absolute -left-[9px] h-5 w-[3px] rounded-r bg-[#8fb6f5]" />
                  )}
                </button>
              );
            })}
        </div>
      ))}
      <div className="mt-auto px-1 pb-1 text-center font-mono text-[8.5px] leading-tight text-[#6e6e78]">
        Ctrl+K
      </div>
    </div>
  );
}
