import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { renderShapeToLayer, renderTextToLayer } from "../engine/textShape";

export default function TextShapePanel() {
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const layers = useEditorStore((s) => s.layers);
  const textSpecs = useProStore((s) => s.textSpecs);
  const shapeSpecs = useProStore((s) => s.shapeSpecs);
  const setTextSpec = useProStore((s) => s.setTextSpec);
  const setShapeSpec = useProStore((s) => s.setShapeSpec);

  const active = layers.find((l) => l.id === activeLayerId);
  const tspec = activeLayerId ? textSpecs[activeLayerId] : undefined;
  const sspec = activeLayerId ? shapeSpecs[activeLayerId] : undefined;

  function applyText(patch: Partial<NonNullable<typeof tspec>>) {
    if (!activeLayerId || !tspec) return;
    const next = { ...tspec, ...patch };
    setTextSpec(activeLayerId, next);
    const c = layerManager.get(activeLayerId);
    if (c) renderTextToLayer(c, next);
    useEditorStore.getState().markDirty();
    useProStore.getState().bumpHistogram();
  }

  function applyShape(patch: Partial<NonNullable<typeof sspec>>) {
    if (!activeLayerId || !sspec) return;
    const next = { ...sspec, ...patch };
    setShapeSpec(activeLayerId, next);
    const c = layerManager.get(activeLayerId);
    if (c) renderShapeToLayer(c, next);
    useEditorStore.getState().markDirty();
    useProStore.getState().bumpHistogram();
  }

  return (
    <div className="space-y-3 p-3 text-[12px]">
      <div className="text-[11px] text-[#a0a0a0]">
        Layer <span className="text-white">{active?.name ?? "-"}</span> ({active?.kind ?? "raster"}
        ). Klik canvas dengan Text/Shape tool untuk buat layer baru, lalu edit di sini.
      </div>
      {tspec && (
        <section className="space-y-1.5 rounded border border-[#3e3e42] bg-[#2a2a2a] p-2">
          <h4 className="font-semibold text-white">Text</h4>
          <textarea
            value={tspec.text}
            onChange={(e) => applyText({ text: e.target.value })}
            rows={2}
            className="w-full rounded bg-[#1e1e1e] px-2 py-1 text-white"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-[#a0a0a0]">
              Font
              <input
                value={tspec.fontFamily}
                onChange={(e) => applyText({ fontFamily: e.target.value })}
                className="mt-0.5 w-full rounded bg-[#1e1e1e] px-2 py-1 text-white"
              />
            </label>
            <label className="text-[#a0a0a0]">
              Size
              <input
                type="number"
                value={tspec.fontSize}
                onChange={(e) => applyText({ fontSize: Number(e.target.value) })}
                className="mt-0.5 w-full rounded bg-[#1e1e1e] px-2 py-1 font-mono text-white"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={tspec.color}
              onChange={(e) => applyText({ color: e.target.value })}
              className="h-7 w-10"
            />
            <label className="flex items-center gap-1 text-[#c5c5c5]">
              <input
                type="checkbox"
                checked={tspec.bold}
                onChange={(e) => applyText({ bold: e.target.checked })}
              />{" "}
              Bold
            </label>
            <label className="flex items-center gap-1 text-[#c5c5c5]">
              <input
                type="checkbox"
                checked={tspec.italic}
                onChange={(e) => applyText({ italic: e.target.checked })}
              />{" "}
              Italic
            </label>
          </div>
          <label className="text-[#a0a0a0]">
            Tracking {tspec.tracking}px
            <input
              type="range"
              min={-4}
              max={24}
              value={tspec.tracking}
              onChange={(e) => applyText({ tracking: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="text-[#a0a0a0]">
            Leading {tspec.leading}
            <input
              type="range"
              min={0.8}
              max={2.4}
              step={0.05}
              value={tspec.leading}
              onChange={(e) => applyText({ leading: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </section>
      )}
      {sspec && (
        <section className="space-y-1.5 rounded border border-[#3e3e42] bg-[#2a2a2a] p-2">
          <h4 className="font-semibold text-white">Shape</h4>
          <div className="flex gap-1">
            {(["rect", "ellipse", "polygon"] as const).map((k) => (
              <button
                key={k}
                onClick={() => applyShape({ kind: k })}
                className={`flex-1 rounded px-2 py-1 text-[11px] ${sspec.kind === k ? "bg-[#0a84ff] text-white" : "bg-[#3e3e42]"}`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="flex-1 text-[#a0a0a0]">
              Fill
              <input
                type="color"
                value={sspec.fill}
                onChange={(e) => applyShape({ fill: e.target.value })}
                className="h-7 w-full"
              />
            </label>
            <label className="flex-1 text-[#a0a0a0]">
              Stroke
              <input
                type="color"
                value={sspec.stroke}
                onChange={(e) => applyShape({ stroke: e.target.value })}
                className="h-7 w-full"
              />
            </label>
          </div>
          <label className="text-[#a0a0a0]">
            Stroke {sspec.strokeWidth}px
            <input
              type="range"
              min={0}
              max={24}
              value={sspec.strokeWidth}
              onChange={(e) => applyShape({ strokeWidth: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          {sspec.kind === "polygon" && (
            <label className="text-[#a0a0a0]">
              Sides {sspec.sides}
              <input
                type="range"
                min={3}
                max={12}
                value={sspec.sides}
                onChange={(e) => applyShape({ sides: Number(e.target.value) })}
                className="w-full"
              />
            </label>
          )}
          <label className="text-[#a0a0a0]">
            Rotation {sspec.rotation}°
            <input
              type="range"
              min={0}
              max={360}
              value={sspec.rotation}
              onChange={(e) => applyShape({ rotation: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </section>
      )}
      {!tspec && !sspec && (
        <div className="rounded border border-dashed border-[#3e3e42] p-3 text-center text-[11px] text-[#a0a0a0]">
          Pilih layer text atau shape untuk edit. Buat baru via toolbar T / U / O.
        </div>
      )}
    </div>
  );
}
