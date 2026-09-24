import {
  Brush,
  Circle,
  Crop,
  Eraser,
  Hand,
  Lasso,
  MousePointer2,
  Move,
  Pipette,
  Square,
  Droplet,
  Type,
  Wand2,
  ZoomIn,
} from "lucide-react";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";
import clsx from "clsx";

const tools: { id: ToolId; icon: any; label: string; shortcut: string }[] = [
  { id: "move", icon: Move, label: "Move / Transform", shortcut: "V" },
  { id: "select-rect", icon: MousePointer2, label: "Rect Select", shortcut: "M" },
  { id: "select-lasso", icon: Lasso, label: "Lasso Select", shortcut: "L" },
  { id: "wand", icon: Wand2, label: "Magic Wand", shortcut: "W" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B" },
  { id: "eraser", icon: Eraser, label: "Eraser / Mask paint", shortcut: "E" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
  { id: "shape-rect", icon: Square, label: "Shape Rect / Polygon", shortcut: "U" },
  { id: "shape-ellipse", icon: Circle, label: "Shape Ellipse", shortcut: "O" },
  { id: "gradient", icon: Droplet, label: "Gradient (Fase 4)", shortcut: "G" },
  { id: "crop", icon: Crop, label: "Crop doc (Fase 4)", shortcut: "C" },
  { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z" },
  { id: "pan", icon: Hand, label: "Pan", shortcut: "H" },
];

export default function ToolBar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="flex w-[52px] flex-col items-center gap-1 overflow-y-auto border-r border-[#3e3e42] bg-[#252526] py-2">
      {tools.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            title={`${t.label} (${t.shortcut})`}
            onClick={() => setTool(t.id)}
            className={clsx(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors",
              active
                ? "bg-[#0a84ff] text-white"
                : "text-[#c5c5c5] hover:bg-[#3e3e42] hover:text-white",
            )}
          >
            <Icon size={17} strokeWidth={1.8} />
          </button>
        );
      })}
      <div className="mt-auto px-1 text-center text-[9px] leading-tight text-[#a0a0a0]">
        Ctrl+K
        <br />
        command
      </div>
    </div>
  );
}
