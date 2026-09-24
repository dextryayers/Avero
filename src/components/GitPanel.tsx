import { useState } from "react";
import { useGitStore } from "../stores/useGitStore";
import { useEditorStore } from "../stores/useEditorStore";
import { getCompositeCanvas } from "./CanvasArea";

export default function GitPanel() {
  const snaps = useGitStore((s) => s.snaps);
  const branches = useGitStore((s) => s.branches);
  const activeBranch = useGitStore((s) => s.activeBranch);
  const snapshot = useGitStore((s) => s.snapshot);
  const createBranch = useGitStore((s) => s.createBranch);
  const switchBranch = useGitStore((s) => s.switchBranch);
  const compareA = useGitStore((s) => s.compareA);
  const compareB = useGitStore((s) => s.compareB);
  const setCompare = useGitStore((s) => s.setCompare);
  const [pos, setPos] = useState(50);

  function takeSnapshot() {
    const comp = getCompositeCanvas();
    const layers = useEditorStore.getState().layers.length;
    let thumb = "";
    if (comp) {
      const t = document.createElement("canvas");
      t.width = 192;
      t.height = Math.max(1, Math.round((192 * comp.height) / Math.max(1, comp.width)));
      t.getContext("2d")!.drawImage(comp, 0, 0, t.width, t.height);
      thumb = t.toDataURL("image/jpeg", 0.72);
    }
    const label = prompt("Nama snapshot:", `Edit ${snaps.filter((s) => s.branch === activeBranch).length + 1}`) ?? `Edit ${snaps.length + 1}`;
    snapshot(label, thumb, layers);
  }

  const a = snaps.find((s) => s.id === compareA);
  const b = snaps.find((s) => s.id === compareB);

  return (
    <div className="space-y-2.5 p-3 text-[12px]">
      <div className="flex items-center gap-1.5">
        <select value={activeBranch} onChange={(e) => switchBranch(e.target.value)} className="flex-1 rounded bg-[#1e1e1e] px-2 py-1.5 text-white">
          {branches.map((br) => (
            <option key={br} value={br}>{br}</option>
          ))}
        </select>
        <button onClick={() => { const n = prompt("Nama varian baru:"); if (n) createBranch(n); }} className="rounded bg-[#0a84ff] px-2 py-1.5 text-white">+Branch</button>
        <button onClick={takeSnapshot} className="rounded bg-[#2d7a3a] px-2 py-1.5 text-white">Snapshot</button>
      </div>

      <div className="max-h-52 space-y-1.5 overflow-y-auto">
        {snaps.filter((s) => s.branch === activeBranch).length === 0 && (
          <div className="rounded border border-dashed border-[#3e3e42] p-3 text-center text-[11px] text-[#a0a0a0]">
            Belum ada snapshot di branch ini. Coba 3 versi edit tanpa duplicate file.
          </div>
        )}
        {snaps.filter((s) => s.branch === activeBranch).map((s) => (
          <div key={s.id} className="flex gap-2 rounded border border-[#3e3e42] bg-[#2a2a2a] p-1.5">
            {s.thumb ? <img src={s.thumb} alt={s.label} className="h-12 w-20 rounded object-cover" /> : <div className="grid h-12 w-20 place-items-center rounded bg-[#1e1e1e] text-[10px]">no img</div>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-white">{s.label}</div>
              <div className="font-mono text-[10px] text-[#a0a0a0]">{new Date(s.time).toLocaleTimeString()} • {s.layersCount} layers</div>
              <div className="mt-0.5 flex gap-1">
                <button onClick={() => setCompare(s.id, compareB)} className={`rounded px-1.5 py-0.5 text-[10px] ${compareA === s.id ? "bg-[#0a84ff] text-white" : "bg-[#3e3e42]"}`}>A</button>
                <button onClick={() => setCompare(compareA, s.id)} className={`rounded px-1.5 py-0.5 text-[10px] ${compareB === s.id ? "bg-[#0a84ff] text-white" : "bg-[#3e3e42]"}`}>B</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {a && b && (
        <div className="rounded border border-[#3e3e42] bg-[#1e1e1e] p-2">
          <div className="mb-1 flex justify-between text-[11px]"><span>{a.label}</span><span>{b.label}</span></div>
          <div className="relative h-36 overflow-hidden rounded">
            {b.thumb && <img src={b.thumb} alt="B" className="absolute inset-0 h-full w-full object-cover" />}
            {a.thumb && <img src={a.thumb} alt="A" className="absolute inset-0 h-full object-cover" style={{ width: `${pos}%`, objectFit: "cover", clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
            <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="absolute bottom-1 left-2 right-2 w-[calc(100%-16px)]" />
          </div>
          <button onClick={() => setCompare(null, null)} className="mt-1 w-full rounded bg-[#3e3e42] px-2 py-1 text-[11px]">Tutup compare</button>
        </div>
      )}
    </div>
  );
}
