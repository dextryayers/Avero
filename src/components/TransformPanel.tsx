import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

export default function TransformPanel() {
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const layers = useEditorStore((s) => s.layers);
  const transforms = useProStore((s) => s.transforms);
  const ensureTransform = useProStore((s) => s.ensureTransform);
  const updateTransform = useProStore((s) => s.updateTransform);

  const active = layers.find((l) => l.id === activeLayerId);
  const t = activeLayerId ? transforms[activeLayerId] : undefined;

  if (!activeLayerId || !active)
    return <div className="p-3 text-[12px] text-[#a7a7b0]">Pilih layer dulu.</div>;

  const v = t ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

  function num(field: keyof typeof v, val: number) {
    ensureTransform(activeLayerId!);
    updateTransform(activeLayerId!, { [field]: val } as any);
  }

  return (
    <div className="space-y-2 p-3 text-[12px]">
      <div className="text-[11px] text-[#a7a7b0]">
        Layer <span className="text-white">{active.name}</span>. Drag dengan Move tool untuk geser.
        Nilai presisi di sini.
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[#a7a7b0]">
          X
          <input
            type="number"
            value={Math.round(v.x)}
            onChange={(e) => num("x", Number(e.target.value))}
            className="mt-0.5 w-full rounded bg-[#161618] px-2 py-1 font-mono text-white"
          />
        </label>
        <label className="text-[#a7a7b0]">
          Y
          <input
            type="number"
            value={Math.round(v.y)}
            onChange={(e) => num("y", Number(e.target.value))}
            className="mt-0.5 w-full rounded bg-[#161618] px-2 py-1 font-mono text-white"
          />
        </label>
        <label className="text-[#a7a7b0]">
          Scale X
          <input
            type="number"
            step={0.05}
            value={v.scaleX}
            onChange={(e) => num("scaleX", Number(e.target.value))}
            className="mt-0.5 w-full rounded bg-[#161618] px-2 py-1 font-mono text-white"
          />
        </label>
        <label className="text-[#a7a7b0]">
          Scale Y
          <input
            type="number"
            step={0.05}
            value={v.scaleY}
            onChange={(e) => num("scaleY", Number(e.target.value))}
            className="mt-0.5 w-full rounded bg-[#161618] px-2 py-1 font-mono text-white"
          />
        </label>
      </div>
      <div>
        <label className="mb-1 flex justify-between text-[#a7a7b0]">
          Rotation <span className="font-mono text-white">{v.rotation}°</span>
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          value={v.rotation}
          onChange={(e) => num("rotation", Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={() =>
            updateTransform(activeLayerId, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 })
          }
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Reset
        </button>
        <button
          onClick={() => updateTransform(activeLayerId, { scaleX: v.scaleX * -1 })}
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Flip H
        </button>
        <button
          onClick={() => updateTransform(activeLayerId, { scaleY: v.scaleY * -1 })}
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Flip V
        </button>
        <button
          onClick={() => updateTransform(activeLayerId, { rotation: (v.rotation + 90) % 360 })}
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Putar +90°
        </button>
        <button
          onClick={() => updateTransform(activeLayerId, { rotation: (v.rotation - 90) % 360 })}
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Putar -90°
        </button>
        <button
          onClick={() =>
            updateTransform(activeLayerId, { scaleX: Math.abs(v.scaleX), scaleY: Math.abs(v.scaleY) })
          }
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Unflip
        </button>
      </div>
      <p className="text-[10px] text-[#a7a7b0]">
        Perspective dan warp penuh masuk Fase 5. Scale dan rotate sudah non-destructive.
      </p>
    </div>
  );
}
