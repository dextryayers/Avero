import { useEffect, useRef, useState } from "react";
import { Layers, Palette } from "lucide-react";
import ToolBar from "./ToolBar";
import CanvasArea from "./CanvasArea";
import RightPanel from "./RightPanel";
import ColorDock from "./ColorDock";
import {
  DOCK_DEFAULT_SPLIT,
  DOCK_DEFAULT_TOTAL,
  clampSplit,
  clampTotal,
  splitWidths,
} from "../engine/dockSize";

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "0";
  } catch {
    return false;
  }
}

function saveFlag(key: string, hidden: boolean) {
  try {
    localStorage.setItem(key, hidden ? "0" : "1");
  } catch {
    /* ignore */
  }
}

function loadNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function saveNumber(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

// The full editor workspace (toolbar + canvas + right dock). Split into its
// own chunk via React.lazy so the first paint (Home screen) stays light and
// the heavy canvas engine loads only when the editor actually opens.
//
// Right dock, left to right: Color stack first, Layers stack far right.
// Wide windows show both columns with drag resize (outer edge resizes the
// whole dock, middle divider splits Color and Layers). Narrow windows below
// 1100px fall back to the legacy single column so the canvas keeps room.
// Each column collapses independently with persisted prefs.
export default function EditorView() {
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth < 1100,
  );
  const [leftHidden, setLeftHidden] = useState(() => loadFlag("avero:dock-left"));
  const [rightHidden, setRightHidden] = useState(() => loadFlag("avero:dock-right"));
  const [dockWidth, setDockWidth] = useState(() =>
    clampTotal(loadNumber("avero:dock-width", DOCK_DEFAULT_TOTAL)),
  );
  const [split, setSplit] = useState(() =>
    clampSplit(loadNumber("avero:dock-split", DOCK_DEFAULT_SPLIT), DOCK_DEFAULT_TOTAL),
  );
  const dragRef = useRef<null | {
    mode: "total" | "split";
    startX: number;
    startTotal: number;
    startSplit: number;
  }>(null);

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  function toggleLeft() {
    setLeftHidden((v) => {
      saveFlag("avero:dock-left", !v);
      return !v;
    });
  }

  function toggleRight() {
    setRightHidden((v) => {
      saveFlag("avero:dock-right", !v);
      return !v;
    });
  }

  function onHandleDown(mode: "total" | "split", e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startTotal: dockWidth, startSplit: split };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "total") {
        setDockWidth(clampTotal(d.startTotal + (d.startX - ev.clientX)));
      } else {
        const leftPx = d.startTotal * d.startSplit + (ev.clientX - d.startX);
        setSplit(clampSplit(leftPx / d.startTotal, d.startTotal));
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (d) {
        if (d.mode === "total") {
          setDockWidth((w) => {
            saveNumber("avero:dock-width", w);
            return w;
          });
        } else {
          setSplit((s) => {
            saveNumber("avero:dock-split", s);
            return s;
          });
        }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  if (narrow) {
    return (
      <div className="flex min-h-0 flex-1">
        <ToolBar />
        <CanvasArea />
        <RightPanel />
      </div>
    );
  }

  // Color first, Layers far right. A single visible column takes the full width.
  const bothVisible = !leftHidden && !rightHidden;
  const { left: colorW, right: layersW } = splitWidths(dockWidth, split);
  const singleW = clampTotal(dockWidth);

  return (
    <div className="flex min-h-0 flex-1">
      <ToolBar />
      <CanvasArea />
      {(!leftHidden || !rightHidden) && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize side dock"
          title="Drag to resize the side dock"
          onMouseDown={(e) => onHandleDown("total", e)}
          className="w-1.5 shrink-0 cursor-col-resize self-stretch bg-transparent transition-colors hover:bg-[#2f7cf6]/60 active:bg-[#2f7cf6]"
        />
      )}
      {!leftHidden && <ColorDock onToggle={toggleLeft} width={bothVisible ? colorW : singleW} />}
      {bothVisible && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Color and Layers columns"
          title="Drag to resize the Color and Layers columns"
          onMouseDown={(e) => onHandleDown("split", e)}
          className="w-1.5 shrink-0 cursor-col-resize self-stretch bg-transparent transition-colors hover:bg-[#2f7cf6]/60 active:bg-[#2f7cf6]"
        />
      )}
      {!rightHidden && <RightPanel dual onToggleLayers={toggleRight} width={bothVisible ? layersW : singleW} />}
      {leftHidden && rightHidden && (
        <div className="flex w-[44px] shrink-0 flex-col items-center gap-2 border-l border-[#2c2c31] bg-[#1c1c1f] py-2">
          <button
            onClick={toggleLeft}
            title="Show Color column"
            className="grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
          >
            <Palette size={14} />
          </button>
          <button
            onClick={toggleRight}
            title="Show Layers column"
            className="grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
          >
            <Layers size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
