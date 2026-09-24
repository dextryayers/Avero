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
  // Select
  { id: "move", icon: Move, label: "Move / Transform", shortcut: "V", group: "Navigasi & Select" },
  { id: "select-rect", icon: MousePointer2, label: "Rect Select (M ganti ellipse)", shortcut: "M", group: "Navigasi & Select" },
  { id: "select-ellipse", icon: CircleDashed, label: "Ellipse Select", shortcut: "M", group: "Navigasi & Select" },
  { id: "select-lasso", icon: Lasso, label: "Lasso", shortcut: "L", group: "Navigasi & Select" },
  { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W", group: "Navigasi & Select" },
  // Retouch pro
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B", group: "Retouch" },
  { id: "spot-heal", icon: Bandage, label: "Spot Healing (noda/jerawat)", shortcut: "J", group: "Retouch" },
  { id: "clone", icon: Stamp, label: "Clone Stamp (Alt+klik sumber)", shortcut: "S", group: "Retouch" },
  { id: "blur", icon: Droplets, label: "Blur (R putar Sharpen/Smudge)", shortcut: "R", group: "Retouch" },
  { id: "sharpen", icon: Zap, label: "Sharpen", shortcut: "R", group: "Retouch" },
  { id: "smudge", icon: Waves, label: "Smudge (seret piksel)", shortcut: "R", group: "Retouch" },
  { id: "dodge", icon: Sun, label: "Dodge — cerahkan (O putar)", shortcut: "O", group: "Retouch" },
  { id: "burn", icon: Moon, label: "Burn — gelapkan", shortcut: "O", group: "Retouch" },
  { id: "sponge", icon: Focus, label: "Sponge — saturasi lokal", shortcut: "O", group: "Retouch" },
  // Paint
  { id: "eraser", icon: Eraser, label: "Eraser / Mask paint", shortcut: "E", group: "Paint" },
  { id: "gradient", icon: Droplet, label: "Gradient (G putar Fill)", shortcut: "G", group: "Paint" },
  { id: "fill", icon: PaintBucket, label: "Paint Bucket (fill seleksi)", shortcut: "G", group: "Paint" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", group: "Paint" },
  // Vector & teks
  { id: "text", icon: Type, label: "Text", shortcut: "T", group: "Vektor & Teks" },
  { id: "shape-rect", icon: Square, label: "Shape Rect (U ganti)", shortcut: "U", group: "Vektor & Teks" },
  { id: "shape-ellipse", icon: Circle, label: "Shape Ellipse", shortcut: "U", group: "Vektor & Teks" },
  { id: "shape-polygon", icon: Hexagon, label: "Shape Polygon", shortcut: "U", group: "Vektor & Teks" },
  { id: "pen", icon: PenTool, label: "Pen — garis bebas (klik-seret)", shortcut: "P", group: "Vektor & Teks" },
  { id: "line", icon: Minus, label: "Line — garis lurus", shortcut: "P", group: "Vektor & Teks" },
  // Doc
  { id: "crop", icon: Crop, label: "Crop doc (Enter terapkan)", shortcut: "C", group: "Dokumen" },
  { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z", group: "Dokumen" },
  { id: "pan", icon: Hand, label: "Pan", shortcut: "H", group: "Dokumen" },
];

const GROUPS = ["Navigasi & Select", "Retouch", "Paint", "Vektor & Teks", "Dokumen"];

export default function ToolBar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="flex w-[58px] flex-col items-center gap-0.5 overflow-y-auto border-r border-[#1c2333] bg-[#0e1219] py-2">
      {GROUPS.map((g, gi) => (
        <div key={g} className="flex w-full flex-col items-center">
          {gi > 0 && <div className="my-1.5 h-px w-[38px] bg-[#1c2333]" />}
          <div className="mb-1 px-1 text-center text-[7.5px] font-semibold uppercase leading-tight tracking-wider text-[#3d465c]">
            {g.split(" ")[0]}
          </div>
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
                    "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all",
                    active
                      ? "bg-gradient-to-br from-[#0a84ff] to-[#00c2ff] text-white shadow-[0_4px_16px_rgba(10,132,255,0.45)]"
                      : "text-[#8a94a6] hover:bg-[#1b2130] hover:text-white",
                  )}
                >
                  <Icon size={16} strokeWidth={1.9} />
                  {active && (
                    <span className="absolute -left-[9px] h-5 w-[3px] rounded-r bg-[#38e1ff]" />
                  )}
                </button>
              );
            })}
        </div>
      ))}
      <div className="mt-auto px-1 pb-1 text-center text-[8.5px] leading-tight text-[#3d465c]">
        Ctrl+K
        <br />
        aksi
      </div>
    </div>
  );
}
