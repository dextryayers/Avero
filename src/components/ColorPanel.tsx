import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import Histogram from "./Histogram";

export default function ColorPanel() {
  const color = useProStore((s) => s.color);
  const setColor = useProStore((s) => s.setColor);
  const customSwatches = useProStore((s) => s.customSwatches);
  const addSwatch = useProStore((s) => s.addSwatch);
  const removeSwatch = useProStore((s) => s.removeSwatch);
  const brushColor = useEditorStore((s) => s.brushColor);
  const setBrush = useEditorStore((s) => s.setBrush);

  return (
    <div className="space-y-3 p-3 text-[12px]">
      <Histogram />
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="avero-micro">Swatches</h4>
          <button
            onClick={() => addSwatch(brushColor)}
            title={`Save current brush color ${brushColor} as a swatch`}
            className="avero-press rounded bg-[#232327] px-2 py-0.5 font-mono text-[10px] text-[#a7a7b0] hover:text-white"
          >
            + Save current
          </button>
        </div>
        {customSwatches.length === 0 ? (
          <div className="rounded border border-dashed border-[#2c2c31] p-2 text-center text-[11px] text-[#6e6e78]">
            No swatches yet. Pick a color, then save it here.
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
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
        )}
      </section>
      <section>
        <h4 className="mb-1.5 font-semibold text-white">Working space</h4>
        <div className="grid grid-cols-3 gap-1">
          {(["sRGB", "AdobeRGB", "ProPhoto"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setColor({ workingSpace: w })}
              className={`rounded px-2 py-1.5 text-[11px] ${color.workingSpace === w ? "bg-[#2f7cf6] text-white" : "bg-[#2c2c31] hover:bg-[#3a3a41]"}`}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1">
          {([8, 16] as const).map((b) => (
            <button
              key={b}
              onClick={() => setColor({ bitDepth: b })}
              className={`flex-1 rounded px-2 py-1 text-[11px] ${color.bitDepth === b ? "bg-[#2f7cf6] text-white" : "bg-[#2c2c31]"}`}
            >
              {b}-bit {b === 16 ? "(sim)" : ""}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-[#a7a7b0]">
          16-bit pipeline simulates precision for Phase 3. Full LittleCMS conversion lands in 1.0
          stabilization.
        </p>
      </section>
      <section className="space-y-1.5 rounded border border-[#2c2c31] bg-[#232327] p-2">
        <h4 className="font-semibold text-white">Soft proofing</h4>
        <label className="flex items-center justify-between text-[#c9c9d1]">
          Enable proof
          <input
            type="checkbox"
            checked={color.proofEnabled}
            onChange={(e) => setColor({ proofEnabled: e.target.checked })}
          />
        </label>
        <select
          value={color.proofProfile}
          onChange={(e) => setColor({ proofProfile: e.target.value as any })}
          className="w-full rounded bg-[#161618] px-2 py-1 text-white"
        >
          <option value="CMYK US Web Coated">CMYK US Web Coated</option>
          <option value="CMYK FOGRA51">CMYK FOGRA51</option>
        </select>
        <label className="flex items-center justify-between text-[#c9c9d1]">
          Gamut warning magenta
          <input
            type="checkbox"
            checked={color.gamutWarning}
            onChange={(e) => setColor({ gamutWarning: e.target.checked })}
          />
        </label>
      </section>
    </div>
  );
}
