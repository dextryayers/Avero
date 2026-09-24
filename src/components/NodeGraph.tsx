import { useState } from "react";
import { useNodeStore } from "../stores/useNodeStore";
import { useProStore } from "../stores/useProStore";

const kindColor: Record<string, string> = {
  input: "#2d7a3a",
  adjust: "#0a84ff",
  filter: "#7a4fd0",
  blend: "#b07a1f",
  output: "#505050",
};

export default function NodeGraph() {
  const enabled = useNodeStore((s) => s.enabled);
  const toggle = useNodeStore((s) => s.toggle);
  const nodes = useNodeStore((s) => s.nodes);
  const edges = useNodeStore((s) => s.edges);
  const autoFromStack = useNodeStore((s) => s.autoFromStack);
  const moveNode = useNodeStore((s) => s.moveNode);
  const selected = useNodeStore((s) => s.selected);
  const setSelected = useNodeStore((s) => s.setSelected);
  const connect = useNodeStore((s) => s.connect);
  const addNode = useNodeStore((s) => s.addNode);
  const removeNode = useNodeStore((s) => s.removeNode);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);

  if (!enabled) {
    return (
      <div className="border-b border-[#3e3e42] bg-[#191d24] px-3 py-1.5 text-[11px] text-[#a0a0a0]">
        Node graph nonaktif. Layer stack dipakai.
        <button
          onClick={() => {
            toggle();
            autoFromStack();
          }}
          className="ml-2 rounded bg-[#7a4fd0] px-2 py-0.5 text-white"
        >
          Aktifkan node view
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-[#7a4fd0] bg-[#14161d]">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px]">
        <span className="font-semibold text-white">Node graph</span>
        <span className="text-[#a0a0a0]">
          {nodes.length} nodes • {edges.length} links • auto-convert dari stack
        </span>
        <button
          onClick={autoFromStack}
          className="ml-1 rounded bg-[#3e3e42] px-2 py-0.5 hover:bg-[#505050]"
        >
          Rebuild
        </button>
        <button
          onClick={() => addNode("adjust", "Adjust")}
          className="rounded bg-[#0a84ff] px-2 py-0.5 text-white"
        >
          +Adjust
        </button>
        <button
          onClick={() => addNode("filter", "Filter")}
          className="rounded bg-[#7a4fd0] px-2 py-0.5 text-white"
        >
          +Filter
        </button>
        {selected && (
          <button
            onClick={() => removeNode(selected)}
            className="rounded bg-[#5a1f1f] px-2 py-0.5 text-white"
          >
            Hapus node
          </button>
        )}
        <button onClick={toggle} className="ml-auto rounded bg-[#2a2a2a] px-2 py-0.5">
          Tutup
        </button>
      </div>
      <div
        className="relative h-[220px] overflow-hidden"
        onMouseMove={(e) => {
          if (!drag) return;
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          moveNode(drag.id, e.clientX - r.left - drag.dx, e.clientY - r.top - drag.dy);
        }}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <svg className="absolute inset-0 h-full w-full">
          {edges.map((e) => {
            const a = nodes.find((n) => n.id === e.from);
            const b = nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            return (
              <line
                key={e.id}
                x1={a.x + 96}
                y1={a.y + 24}
                x2={b.x}
                y2={b.y + 24}
                stroke="#7a8aa0"
                strokeWidth={1.6}
              />
            );
          })}
        </svg>
        {nodes.map((n) => (
          <div
            key={n.id}
            onMouseDown={(e) => {
              const r = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
              setDrag({ id: n.id, dx: e.clientX - r.left - n.x, dy: e.clientY - r.top - n.y });
              setSelected(n.id);
            }}
            onDoubleClick={() => {
              if (selected && selected !== n.id) connect(selected, n.id);
            }}
            title="Drag pindah, double-klik dari node terpilih untuk connect"
            className={`absolute w-24 rounded-md border p-1.5 text-[10px] ${selected === n.id ? "border-white" : "border-[#3e3e42]"}`}
            style={{ left: n.x, top: n.y, background: kindColor[n.kind] ?? "#333" }}
          >
            <div className="font-semibold text-white">{n.label}</div>
            <div className="font-mono text-[9px] text-white/70">{n.kind}</div>
            {n.kind === "adjust" && n.refId && <ToggleAdjust refId={n.refId} />}
            {n.kind === "filter" && n.refId && <ToggleFilter refId={n.refId} />}
          </div>
        ))}
      </div>
      <div className="px-3 pb-1.5 text-[10px] text-[#7a8aa0]">
        Klik node untuk pilih, double-klik node lain untuk sambung. Toggle di node mematikan
        adjustment/filter asli secara live.
      </div>
    </div>
  );
}

function ToggleAdjust({ refId }: { refId: string }) {
  const adj = useProStore((s) => s.adjustments.find((a) => a.id === refId));
  const update = useProStore((s) => s.updateAdjustment);
  if (!adj) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        update(refId, { enabled: !adj.enabled });
      }}
      className="mt-1 w-full rounded bg-black/40 px-1 py-0.5 text-white"
    >
      {adj.enabled ? "ON" : "OFF"}
    </button>
  );
}

function ToggleFilter({ refId }: { refId: string }) {
  const f = useProStore((s) => s.filters.find((x) => x.id === refId));
  const update = useProStore((s) => s.updateFilter);
  if (!f) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        update(refId, { enabled: !f.enabled });
      }}
      className="mt-1 w-full rounded bg-black/40 px-1 py-0.5 text-white"
    >
      {f.enabled ? "ON" : "OFF"}
    </button>
  );
}
