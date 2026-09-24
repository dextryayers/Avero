import { useProStore } from "../stores/useProStore";
import { useEditorStore } from "../stores/useEditorStore";
import {
  clearSelectionMask,
  expandContractSelection,
  featherSelection,
  hasSelection,
  inverseSelection,
} from "../engine/selection";
import { useState } from "react";

export default function SelectionPanel() {
  const selKind = useProStore((s) => s.selKind);
  const setSelKind = useProStore((s) => s.setSelKind);
  const selFeather = useProStore((s) => s.selFeather);
  const selTolerance = useProStore((s) => s.selTolerance);
  const selExpand = useProStore((s) => s.selExpand);
  const setSelParams = useProStore((s) => s.setSelParams);
  const setTool = useEditorStore((s) => s.setTool);
  const tool = useEditorStore((s) => s.tool);
  const [tick, setTick] = useState(0);

  return (
    <div className="space-y-3 p-3 text-[12px]">
      <div>
        <h4 className="mb-1.5 font-semibold text-white">Selection tool</h4>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["rect", "Rect (M)", "select-rect"],
              ["ellipse", "Ellipse (M)", "select-ellipse"],
              ["lasso", "Lasso (L)", "select-lasso"],
              ["wand", "Wand (W)", "wand"],
            ] as const
          ).map(([k, label, t]) => (
            <button
              key={k}
              onClick={() => {
                setSelKind(k as any);
                setTool(t as any);
              }}
              className={`rounded px-2 py-1.5 text-[11px] ${
                selKind === k && (tool === t || (k === "rect" && tool === "select-rect"))
                  ? "bg-[#2f7cf6] text-white"
                  : "bg-[#2c2c31] text-[#c9c9d1] hover:bg-[#3a3a41]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 flex justify-between text-[#a7a7b0]">
          Feather <span className="font-mono text-white">{selFeather}px</span>
        </label>
        <input
          type="range"
          min={0}
          max={24}
          value={selFeather}
          onChange={(e) => setSelParams({ selFeather: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div>
        <label className="mb-1 flex justify-between text-[#a7a7b0]">
          Wand tolerance <span className="font-mono text-white">{selTolerance}</span>
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={selTolerance}
          onChange={(e) => setSelParams({ selTolerance: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <div>
        <label className="mb-1 flex justify-between text-[#a7a7b0]">
          Expand / Contract <span className="font-mono text-white">{selExpand}px</span>
        </label>
        <input
          type="range"
          min={-24}
          max={24}
          value={selExpand}
          onChange={(e) => setSelParams({ selExpand: Number(e.target.value) })}
          className="w-full"
        />
        <button
          onClick={() => {
            if (selExpand !== 0) expandContractSelection(selExpand);
            if (selFeather > 0) featherSelection(selFeather);
            setTick((t) => t + 1);
          }}
          className="mt-1 w-full rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
        >
          Apply expand + feather
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={() => {
            inverseSelection();
            setTick((t) => t + 1);
          }}
          className="rounded bg-[#232327] px-2 py-1.5 text-[11px] hover:bg-[#2c2c31]"
        >
          Inverse
        </button>
        <button
          onClick={() => {
            clearSelectionMask();
            setTick((t) => t + 1);
          }}
          className="rounded bg-[#232327] px-2 py-1.5 text-[11px] hover:bg-[#2c2c31]"
        >
          Deselect
        </button>
      </div>
      <button
        onClick={() => {
          expandContractSelection(-1);
          featherSelection(1);
          setTick((t) => t + 1);
        }}
        title="Haluskan tepi: ciutkan 1px lalu feather 1px"
        className="w-full rounded bg-[#2f7cf6] px-2 py-1.5 text-[11px] text-white hover:bg-[#2563d4]"
      >
        Refine edge (haluskan)
      </button>
      <div className="rounded border border-[#2c2c31] bg-[#232327] p-2 text-[11px] text-[#a7a7b0]">
        {hasSelection() || tick >= 0
          ? "Brush otomatis menghormati seleksi. Area luar seleksi dilindungi."
          : "Belum ada seleksi."}
        <br />
        Tips: drag di canvas dengan tool Rect/Lasso, klik dengan Wand.
      </div>
    </div>
  );
}
