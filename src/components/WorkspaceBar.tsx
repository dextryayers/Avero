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
    <div className="flex items-center gap-1 border-b border-[#3e3e42] bg-[#202020] px-3 py-1 text-[11px]">
      {items.map((w) => (
        <button
          key={w.id}
          onClick={() => setWorkspace(w.id as any)}
          className={clsx("rounded px-2.5 py-1", active === w.id ? "bg-[#0a84ff] text-white" : "bg-[#2d2d2d] text-[#c5c5c5] hover:bg-[#3e3e42]")}
        >
          {w.label}
        </button>
      ))}
      <label className="ml-2 flex items-center gap-1.5 text-[#a0a0a0]">
        <input type="checkbox" checked={showPrompt} onChange={(e) => setShowPrompt(e.target.checked)} />
        Prompt bar
      </label>
      <span className="ml-auto hidden font-mono text-[10px] text-[#606060] md:block">Workspace tersimpan lokal • Ctrl+K semua aksi</span>
    </div>
  );
}
