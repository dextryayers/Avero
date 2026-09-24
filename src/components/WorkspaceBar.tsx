import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import clsx from "clsx";

const items = [
  { id: "retouching", label: "Retouch" },
  { id: "photography", label: "Photo" },
  { id: "design", label: "Design" },
  { id: "minimal", label: "Minimal" },
] as const;

export default function WorkspaceBar() {
  const active = useWorkspaceStore((s) => s.active);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const showPrompt = useWorkspaceStore((s) => s.showPrompt);
  const setShowPrompt = useWorkspaceStore((s) => s.setShowPrompt);

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[#2c2c31] bg-[#161618] px-3 py-1.5 text-[11px]">
      <span className="mr-1 hidden font-mono text-[10px] uppercase tracking-wider text-[#6e6e78] sm:block">
        Workspace
      </span>
      {items.map((w) => (
        <button
          key={w.id}
          onClick={() => setWorkspace(w.id as any)}
          className={clsx(
            "rounded-md px-3 py-1 font-medium",
            active === w.id
              ? "bg-[#2f7cf6] text-white"
              : "bg-[#1c1c1f] text-[#a7a7b0] border border-[#2c2c31] hover:text-white hover:bg-[#232327]",
          )}
        >
          {w.label}
        </button>
      ))}
      <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[#6e6e78]">
        <input
          type="checkbox"
          checked={showPrompt}
          onChange={(e) => setShowPrompt(e.target.checked)}
          className="accent-[#2f7cf6]"
        />
        Prompt bar
      </label>
      <span className="ml-auto hidden font-mono text-[10px] text-[#6e6e78] md:block">
        Tersimpan lokal Retouch / Photo / Design / Minimal
      </span>
    </div>
  );
}
