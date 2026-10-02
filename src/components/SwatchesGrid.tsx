import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

// Shared swatch grid: click paints with the color, right-click deletes it.
export default function SwatchesGrid({ columns = 8 }: { columns?: number }) {
  const customSwatches = useProStore((s) => s.customSwatches);
  const removeSwatch = useProStore((s) => s.removeSwatch);
  const setBrush = useEditorStore((s) => s.setBrush);

  if (customSwatches.length === 0) {
    return (
      <div className="rounded border border-dashed border-[#2c2c31] p-2 text-center text-[11px] text-[#6e6e78]">
        No swatches yet. Pick a color, then save it here.
      </div>
    );
  }
  return (
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
          className="h-6 rounded border border-[#2c2c31] hover:border-white"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
