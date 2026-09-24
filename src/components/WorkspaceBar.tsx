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
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[#1c2333] bg-[#0b0e14] px-3 py-1.5 text-[11px]">
      <span className="mr-1 hidden font-mono text-[10px] uppercase tracking-wider text-[#3d465c] sm:block">Workspace</span>
      {items.map((w) => (
        <button
          key={w.id}
          onClick={() => setWorkspace(w.id as any)}
          className={clsx(
            "rounded-lg px-3 py-1.5 font-medium transition",
            active === w.id
              ? "bg-gradient-to-r from-[#0a84ff] to-[#00c2ff] text-white shadow-[0_4px_16px_rgba(10,132,255,0.35)]"
              : "bg-[#141a27] text-[#8a94a6] ring-1 ring-[#1c2333] hover:text-white",
          )}
        >
          {w.label}
        </button>
      ))}
      <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[#5b6577]">
        <input
          type="checkbox"
          checked={showPrompt}
          onChange={(e) => setShowPrompt(e.target.checked)}
          className="accent-[#0a84ff]"
        />
        Prompt bar
      </label>
      <span className="ml-auto hidden font-mono text-[10px] text-[#3d465c] md:block">
        Tersimpan lokal • Retouch / Photo / Design / Minimal
      </span>
    </div>
  );
}
