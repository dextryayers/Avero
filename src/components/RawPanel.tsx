import { useProStore } from "../stores/useProStore";

function Row({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-0.5 flex justify-between text-[11px] text-[#a7a7b0]">
        {label} <span className="font-mono text-white">{display}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function RawPanel() {
  const raw = useProStore((s) => s.raw);
  const setRaw = useProStore((s) => s.setRaw);
  const resetRaw = useProStore((s) => s.resetRaw);
  const bump = useProStore((s) => s.bumpHistogram);

  function set(p: Partial<typeof raw>) {
    setRaw(p);
    // render ulang histogram via tick debounced ringan
    setTimeout(() => bump(), 30);
  }

  return (
    <div className="space-y-2 p-3 text-[12px]">
      <div className="rounded border border-[#2c2c31] bg-[#232327] p-2 text-[11px] text-[#a7a7b0]">
        {raw.isRaw ? (
          <>
            RAW: <span className="text-white">{raw.fileName}</span>. Edit non-destructive, terapkan
            ke composite.
          </>
        ) : (
          <>
            Panel Develop bekerja untuk foto apapun. Buka CR2 NEF ARW RAF DNG, gambar didekode otomatis
            preview bila didukung, jika tidak tetap bisa develop JPEG PNG.
          </>
        )}
      </div>
      <Row
        label="Exposure"
        value={raw.exposure}
        display={`${raw.exposure.toFixed(2)} EV`}
        min={-5}
        max={5}
        step={0.1}
        onChange={(v) => set({ exposure: v })}
      />
      <Row
        label="Temperature"
        value={raw.temperature}
        display={`${Math.round(raw.temperature)}K`}
        min={2000}
        max={12000}
        step={50}
        onChange={(v) => set({ temperature: v })}
      />
      <Row
        label="Tint"
        value={raw.tint}
        display={`${Math.round(raw.tint)}`}
        min={-100}
        max={100}
        onChange={(v) => set({ tint: v })}
      />
      <Row
        label="Highlights"
        value={raw.highlights}
        display={`${Math.round(raw.highlights)}`}
        min={-100}
        max={100}
        onChange={(v) => set({ highlights: v })}
      />
      <Row
        label="Shadows"
        value={raw.shadows}
        display={`${Math.round(raw.shadows)}`}
        min={-100}
        max={100}
        onChange={(v) => set({ shadows: v })}
      />
      <Row
        label="Whites"
        value={raw.whites}
        display={`${Math.round(raw.whites)}`}
        min={-100}
        max={100}
        onChange={(v) => set({ whites: v })}
      />
      <Row
        label="Blacks"
        value={raw.blacks}
        display={`${Math.round(raw.blacks)}`}
        min={-100}
        max={100}
        onChange={(v) => set({ blacks: v })}
      />
      <button
        onClick={() => {
          resetRaw();
          bump();
        }}
        className="w-full rounded bg-[#2c2c31] px-2 py-1.5 text-[11px] hover:bg-[#3a3a41]"
      >
        Reset develop
      </button>
    </div>
  );
}
