import {
  Brush,
  Crop,
  Eraser,
  Hand,
  MousePointer2,
  Move,
  Pipette,
  Square,
  Droplet,
  Type,
  ZoomIn,
} from "lucide-react";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";
import clsx from "clsx";

const tools: { id: ToolId; icon: any; label: string; shortcut: string }[] = [
  { id: "move", icon: Move, label: "Move", shortcut: "V" },
  { id: "select-rect", icon: MousePointer2, label: "Select", shortcut: "M" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
  { id: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I" },
  { id: "text", icon: Type, label: "Text (Fase 2)", shortcut: "T" },
  { id: "shape-rect", icon: Square, label: "Shape (Fase 2)", shortcut: "U" },
  { id: "gradient", icon: Droplet, label: "Gradient (Fase 2)", shortcut: "G" },
  { id: "crop", icon: Crop, label: "Crop (Fase 2)", shortcut: "C" },
  { id: "zoom", icon: ZoomIn, label: "Zoom", shortcut: "Z" },
  { id: "pan", icon: Hand, label: "Pan", shortcut: "H" },
];

export default function ToolBar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="flex w-[52px] flex-col items-center gap-1 border-r border-[#3e3e42] bg-[#252526] py-2">
      {tools.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            title={`${t.label} (${t.shortcut})`}
            onClick={() => setTool(t.id)}
            className={clsx(
              "grid h-9 w-9 place-items-center rounded-md transition-colors",
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
