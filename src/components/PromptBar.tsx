import { useState } from "react";
import { parsePromptToActions } from "../engine/ai/prompt";
import { useProStore } from "../stores/useProStore";
import { useEditorStore } from "../stores/useEditorStore";
import { Sparkles } from "lucide-react";

export default function PromptBar() {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<string | null>(null);

  function run() {
    if (!q.trim()) return;
    const actions = parsePromptToActions(q);
    const pro = useProStore.getState();
    const ed = useEditorStore.getState();
    let applied = 0;
    actions.forEach((a) => {
      if (a.kind === "adjustment") {
        pro.addAdjustment(a.id as any);
        const last = useProStore.getState().adjustments[useProStore.getState().adjustments.length - 1];
        if (last && a.params) pro.updateAdjustmentParams(last.id, a.params as Record<string, number>);
        applied++;
      } else if (a.kind === "filter") {
        pro.addFilter(a.id as any);
        const last = useProStore.getState().filters[useProStore.getState().filters.length - 1];
        if (last && a.params) pro.updateFilterParams(last.id, a.params as Record<string, number>);
        applied++;
      } else if (a.kind === "color") {
        pro.setColor({ proofEnabled: true });
        applied++;
      } else if (a.kind === "ai") {
        setLog(`Aksi AI ${a.label} tersedia di tab AI. Klik tombolnya untuk eksekusi offline.`);
      } else if (a.kind === "tool") {
        ed.setTool(a.id as any);
        applied++;
      }
    });
    if (!log) setLog(`Diterapkan ${applied} aksi: ${actions.map((a) => a.label).join(", ")}`);
    setTimeout(() => useProStore.getState().bumpHistogram(), 50);
  }

  return (
    <div className="border-b border-[#3e3e42] bg-[#1d2530] px-3 py-1.5">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="shrink-0 text-[#7db8ff]" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLog(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder='Prompt to edit, contoh: "buat langit sunset dramatis" atau "hapus background"'
          className="w-full rounded bg-[#141a22] px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-[#7a8aa0]"
        />
        <button onClick={run} className="shrink-0 rounded bg-[#0a84ff] px-3 py-1.5 text-[11px] text-white hover:bg-[#0070e0]">
          Apply
        </button>
      </div>
      {log && <div className="mt-1 text-[11px] text-[#9fc3e8]">{log}</div>}
    </div>
  );
}
