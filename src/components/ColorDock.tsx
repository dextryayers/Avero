import { useState } from "react";
import { Brush, LayoutGrid, Palette, PenLine, Pipette } from "lucide-react";
import clsx from "clsx";
import { BrushesView, ColourView, StrokeView, SwatchesView } from "./StudioViews";
import ColorPanel from "./ColorPanel";

export type ColorDockTab = "colour" | "swatches" | "stroke" | "brushes" | "color";

const DOCK_TABS = [
  { id: "colour", label: "Colour", icon: Palette, hint: "Colour studio. Pick and tune the working color." },
  { id: "swatches", label: "Swatch", icon: LayoutGrid, hint: "Swatches. Save and reuse favorite colors." },
  { id: "stroke", label: "Stroke", icon: PenLine, hint: "Stroke studio. Width and style for lines and shapes." },
  { id: "brushes", label: "Brush", icon: Brush, hint: "Brushes. Presets with size, flow and blend options." },
  { id: "color", label: "Color", icon: Pipette, hint: "Color picker. Sample values and set foreground color." },
] as const;

// Front Color column of the dual column dock. It owns Colour, Swatches,
// Stroke, Brushes and the Color panel while RightPanel owns Layers and
// friends on its left. The active tab persists across reloads.
export default function ColorDock({ onToggle, width }: { onToggle: () => void; width?: number }) {
  const [tab, setTabState] = useState<ColorDockTab>(() => {
    try {
      const v = localStorage.getItem("avero:dock-righttab");
      if (v === "swatches" || v === "stroke" || v === "brushes" || v === "color") return v;
    } catch {
      /* ignore */
    }
    return "colour";
  });

  function setTab(t: ColorDockTab) {
    setTabState(t);
    try {
      localStorage.setItem("avero:dock-righttab", t);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="avero-contain flex shrink-0 flex-col border-l border-[#2c2c31] bg-[#1c1c1f]"
      style={width ? { width } : undefined}
    >
      <div className="flex items-center gap-2 border-b border-[#2c2c31] bg-[#161618] px-2.5 py-2">
        <span className="avero-micro">Color</span>
        <button
          onClick={onToggle}
          title="Hide Color column"
          aria-pressed={false}
          className="grid h-6 w-6 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
        >
          <Palette size={13} />
        </button>
      </div>
      <div className="grid grid-cols-5 border-b border-[#2c2c31] bg-[#161618]" role="tablist" aria-label="Color studio">
        {DOCK_TABS.map((t) => {
          const Icon = t.icon;
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              title={t.hint}
              className={clsx(
                "avero-lift flex flex-col items-center gap-0.5 whitespace-nowrap border-b-2 px-1 pb-1.5 pt-2 text-[9px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f7cf6]",
                selected
                  ? "border-[#2f7cf6] bg-[#1c1c1f] font-semibold text-white"
                  : "border-transparent text-[#6e6e78] hover:text-white",
              )}
            >
              <Icon size={13} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="avero-fade-in min-h-0 flex-1 overflow-y-auto" key={tab}>
        {tab === "colour" && <ColourView />}
        {tab === "swatches" && <SwatchesView />}
        {tab === "stroke" && <StrokeView />}
        {tab === "brushes" && <BrushesView />}
        {tab === "color" && <ColorPanel />}
      </div>
    </div>
  );
}
