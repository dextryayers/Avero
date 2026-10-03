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
    return <div className="p-3 text-[12px] text-[#a7a7b0]">Select a layer first.</div>;

  const v = t ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

  function num(field: keyof typeof v, val: number) {
    ensureTransform(activeLayerId!);
    updateTransform(activeLayerId!, { [field]: val } as never);
  }

  function setBothScale(s: number) {
    const c = Math.max(0.05, Math.min(8, s));
    ensureTransform(activeLayerId!);
    updateTransform(activeLayerId!, { scaleX: c, scaleY: c } as never);
  }

  const uni = Math.abs(v.scaleX) > 0 && Math.abs(v.scaleX - Math.abs(v.scaleY)) < 0.001
    ? Math.abs(v.scaleX)
    : null;
  const rotNorm = ((Math.round(v.rotation) % 360) + 360) % 360;

  return (
    <div className="space-y-2 p-3 text-[12px]">
      <div className="rounded-lg border border-[#2f7cf6]/30 bg-[#2f7cf6]/10 px-2.5 py-2 text-[11px] leading-relaxed text-[#c9d8f5]">
        Layer <span className="font-semibold text-white">{active.name}</span> is flexible.
        Drag with Move, resize with the scale slider, and use free 360 rotation below.
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
      </div>
      <button
        onClick={() => {
          ensureTransform(activeLayerId);
          updateTransform(activeLayerId, { x: 0, y: 0 });
        }}
        className="w-full rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
      >
        Center on canvas
      </button>

      <div>
        <label className="mb-1 flex justify-between text-[#a7a7b0]">
          Uniform size <span className="font-mono text-white">{uni !== null ? `${uni.toFixed(2)}x` : `${Math.abs(v.scaleX).toFixed(2)}x / ${Math.abs(v.scaleY).toFixed(2)}x`}</span>
        </label>
        <input
          type="range"
          min={5}
          max={400}
          value={Math.round((uni ?? Math.max(Math.abs(v.scaleX), Math.abs(v.scaleY))) * 100)}
          onChange={(e) => setBothScale(Number(e.target.value) / 100)}
          className="avero-slider w-full"
        />
        <div className="mt-1 grid grid-cols-3 gap-1">
          <button
            onClick={() => setBothScale(0.5)}
            className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
          >
            50%
          </button>
          <button
            onClick={() => setBothScale(1)}
            className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
          >
            100%
          </button>
          <button
            onClick={() => setBothScale(2)}
            className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
          >
            200%
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[#a7a7b0]">
          Scale X ({v.scaleX.toFixed(2)})
          <input
            type="range"
            min={-4}
            max={4}
            step={0.05}
            value={Math.max(-4, Math.min(4, v.scaleX))}
            onChange={(e) => num("scaleX", Number(e.target.value))}
            className="avero-slider mt-1 w-full"
          />
        </label>
        <label className="text-[#a7a7b0]">
          Scale Y ({v.scaleY.toFixed(2)})
          <input
            type="range"
            min={-4}
            max={4}
            step={0.05}
            value={Math.max(-4, Math.min(4, v.scaleY))}
            onChange={(e) => num("scaleY", Number(e.target.value))}
            className="avero-slider mt-1 w-full"
          />
        </label>
      </div>

      <div>
        <label className="mb-1 flex justify-between text-[#a7a7b0]">
          Free 360 rotation <span className="font-mono text-white">{Math.round(v.rotation)} deg ({rotNorm} normalized)</span>
        </label>
        <input
          type="range"
          min={-360}
          max={360}
          value={Math.max(-360, Math.min(360, Math.round(v.rotation)))}
          onChange={(e) => num("rotation", Number(e.target.value))}
          className="avero-slider w-full"
        />
        <label className="mt-1 block text-[#a7a7b0]">
          Type degrees
          <input
            type="number"
            step={1}
            value={Math.round(v.rotation)}
            onChange={(e) => num("rotation", Number(e.target.value))}
            className="mt-0.5 w-full rounded bg-[#161618] px-2 py-1 font-mono text-white"
          />
        </label>
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
          onClick={() => updateTransform(activeLayerId, { rotation: v.rotation + 90 })}
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Rotate +90
        </button>
        <button
          onClick={() => updateTransform(activeLayerId, { rotation: v.rotation - 90 })}
          className="rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Rotate -90
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
      <p className="text-[10px] leading-relaxed text-[#a7a7b0]">
        Non destructive: source pixels are never changed. Move with Move or the keyboard arrows,
        scale and rotate here. Rotation is free and normalized from 0 to 360 at render time.
      </p>
    </div>
  );
}
