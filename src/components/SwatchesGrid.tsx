import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

// Shared swatch grid: click paints with the color, right-click deletes it.
export default function SwatchesGrid({ columns = 8 }: { columns?: number }) {
  const customSwatches = useProStore((s) => s.customSwatches);
  const removeSwatch = useProStore((s) => s.removeSwatch);
  const setBrush = useEditorStore((s) => s.setBrush);

  return (
    <div className="space-y-2.5">
      {customSwatches.length === 0 ? (
        <div className="rounded border border-dashed border-[#2c2c31] p-2 text-center text-[11px] text-[#6e6e78]">
          No swatches yet. Pick a color, then save it here.
        </div>
      ) : (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
          {customSwatches.map((c) => (
            <button
              key={c}
              onClick={() => setBrush({ color: c })}
              onContextMenu={(e) => {
                e.preventDefault();
                removeSwatch(c);
              }}
              title={`${c} - click to paint with it, right-click to delete`}
              className="h-6 rounded border border-[#2c2c31] hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f7cf6]"
              style={{ background: c }}
            />
          ))}
        </div>
      )}
      {CURATED_SETS.map((set) => (
        <div key={set.label}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e78]">{set.label}</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
            {set.colors.map((c) => (
              <button
                key={c}
                onClick={() => setBrush({ color: c })}
                title={`${c} - click to paint with it`}
                aria-label={`Paint with ${c}`}
                className="h-6 rounded border border-[#2c2c31] hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f7cf6]"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Curated professional starting palettes. Click any chip to paint with it.
const CURATED_SETS: { label: string; colors: string[] }[] = [
  {
    label: "Essentials",
    colors: ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"],
  },
  {
    label: "Skin tones",
    colors: ["#ffdbac", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3836", "#3b2820", "#ffe0d6"],
  },
  {
    label: "Neon",
    colors: ["#ff2fb3", "#ff6b35", "#ffe74c", "#7cf29c", "#38e1ff", "#2f7cf6", "#9d4edd", "#f8f7ff"],
  },
  {
    label: "Pastel",
    colors: ["#ffc8dd", "#ffafcc", "#bde0fe", "#a2d2ff", "#c8f7c5", "#fdffb6", "#ffd6a5", "#e4c1f9"],
  },
];
