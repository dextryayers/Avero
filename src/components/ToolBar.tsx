import {
  Brush,
  Circle,
  CircleDashed,
  Crop,
  Eraser,
  Hand,
  Hexagon,
  Lasso,
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
  { id: "move", icon: Move, label: "Move dan Transform", shortcut: "V", group: "Pilih" },
  { id: "select-rect", icon: MousePointer2, label: "Rect Select (M ganti ellipse)", shortcut: "M", group: "Pilih" },
  { id: "select-ellipse", icon: CircleDashed, label: "Ellipse Select", shortcut: "M", group: "Pilih" },
  { id: "select-lasso", icon: Lasso, label: "Lasso", shortcut: "L", group: "Pilih" },
  { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", group: "Pilih" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B", group: "Retouch" },
  { id: "spot-heal", icon: Bandage, label: "Spot Healing noda", shortcut: "J", group: "Retouch" },
  { id: "clone", icon: Stamp, label: "Clone Stamp (Alt+klik sumber)", shortcut: "S", group: "Retouch" },
  { id: "blur", icon: Droplets, label: "Blur (R putar Sharpen, Smudge)", shortcut: "R", group: "Retouch" },
  { id: "sharpen", icon: Zap, label: "Sharpen", shortcut: "R", group: "Retouch" },
  { id: "smudge", icon: Waves, label: "Smudge, seret piksel", shortcut: "R", group: "Retouch" },
  { id: "dodge", icon: Sun, label: "Dodge, cerahkan (O putar)", shortcut: "O", group: "Retouch" },
  { id: "burn", icon: Moon, label: "Burn, gelapkan", shortcut: "O", group: "Retouch" },
  { id: "sponge", icon: Focus, label: "Sponge, saturasi lokal", shortcut: "O", group: "Retouch" },
  { id: "eraser", icon: Eraser, label: "Eraser dan Mask paint", shortcut: "E", group: "Cat" },
  { id: "gradient", icon: Droplet, label: "Gradient (G putar Fill)", shortcut: "G", group: "Cat" },
  { id: "fill", icon: PaintBucket, label: "Paint Bucket, isi seleksi", shortcut: "G", group: "Cat" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", group: "Cat" },
  { id: "text", icon: Type, label: "Text", shortcut: "T", group: "Vektor" },
  { id: "shape-rect", icon: Square, label: "Shape Rect (U ganti)", shortcut: "U", group: "Vektor" },
  { id: "shape-ellipse", icon: Circle, label: "Shape Ellipse", shortcut: "U", group: "Vektor" },
  { id: "shape-polygon", icon: Hexagon, label: "Shape Polygon", shortcut: "U", group: "Vektor" },
  { id: "pen", icon: PenTool, label: "Pen, garis bebas", shortcut: "P", group: "Vektor" },
  { id: "line", icon: Minus, label: "Line, garis lurus", shortcut: "P", group: "Vektor" },
  { id: "crop", icon: Crop, label: "Crop dokumen (Enter terapkan)", shortcut: "C", group: "Dokumen" },
  { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", group: "Dokumen" },
  { id: "pan", icon: Hand, label: "Pan", shortcut: "H", group: "Dokumen" },
];

const GROUPS = ["Pilih", "Retouch", "Cat", "Vektor", "Dokumen"];

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
