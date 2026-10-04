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
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-3 py-1.5 text-[11px]">
      <span className="mr-2 hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#6e6e78] sm:flex">
        Workspace
      </span>
      {items.map((w) => {
        const Icon = w.icon;
        return (
          <button
            key={w.id}
            onClick={() => setWorkspace(w.id as any)}
            title={`Switch to ${w.label} workspace`}
            aria-pressed={active === w.id}
            className={clsx(
              "flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f7cf6]",
              active === w.id
                ? "border-[#2f7cf6] bg-[#2f7cf6] text-white"
                : "border-[#2c2c31] bg-transparent text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white",
            )}
          >
            <Icon size={12} /> {w.label}
          </button>
        );
      })}
    </div>
  );
}
