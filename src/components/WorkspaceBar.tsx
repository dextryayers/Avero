import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { Brush, Camera, PenTool, Minimize2 } from "lucide-react";
import clsx from "clsx";

const items = [
  { id: "retouching", label: "Retouch", icon: Brush },
  { id: "photography", label: "Photo", icon: Camera },
  { id: "design", label: "Design", icon: PenTool },
  { id: "minimal", label: "Minimal", icon: Minimize2 },
] as const;

export default function WorkspaceBar() {
  const active = useWorkspaceStore((s) => s.active);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3 py-1.5 text-[11px]">
      <span className="mr-2 hidden items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#6e6e78] sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-[#2f7cf6]" /> Workspace
      </span>
      {items.map((w) => {
        const Icon = w.icon;
        return (
          <button
            key={w.id}
            onClick={() => setWorkspace(w.id as any)}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
              active === w.id
                ? "bg-[#2f7cf6] text-white shadow-[0_2px_8px_rgba(47,124,246,0.3)]"
                : "bg-[#1c1c1f] text-[#a7a7b0] border border-[#2c2c31] hover:text-white hover:bg-[#232327] hover:border-[#3a3a41]",
            )}
          >
            <Icon size={12} /> {w.label}
          </button>
        );
      })}
    </div>
  );
}
