import { useEffect, useState } from "react";
import { Layers, Palette } from "lucide-react";
import ToolBar from "./ToolBar";
import CanvasArea from "./CanvasArea";
import RightPanel from "./RightPanel";
import ColorDock from "./ColorDock";

function loadDockFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "0";
  } catch {
    return false;
  }
}

function saveDockFlag(key: string, hidden: boolean) {
  try {
    localStorage.setItem(key, hidden ? "0" : "1");
  } catch {
    /* ignore */
  }
}

// The full editor workspace (toolbar + canvas + right dock). Split into its
// own chunk via React.lazy so the first paint (Home screen) stays light and
// the heavy canvas engine loads only when the editor actually opens.
//
// Right dock: dual column on wide windows (Layers stack left, Color stack in
// front on the right), legacy single column below 1100px so the canvas keeps
// room. Each column collapses independently with persisted prefs.
export default function EditorView() {
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth < 1100,
  );
  const [leftHidden, setLeftHidden] = useState(() => loadDockFlag("avero:dock-left"));
  const [rightHidden, setRightHidden] = useState(() => loadDockFlag("avero:dock-right"));

  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  function toggleLeft() {
    setLeftHidden((v) => {
      saveDockFlag("avero:dock-left", !v);
      return !v;
    });
  }

  function toggleRight() {
    setRightHidden((v) => {
      saveDockFlag("avero:dock-right", !v);
      return !v;
    });
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

  return (
    <div className="flex min-h-0 flex-1">
      <ToolBar />
      <CanvasArea />
      {!leftHidden && <RightPanel dual onToggleLeft={toggleLeft} />}
      {!rightHidden && <ColorDock onToggle={toggleRight} />}
      {leftHidden && rightHidden && (
        <div className="flex w-[44px] shrink-0 flex-col items-center gap-2 border-l border-[#2c2c31] bg-[#1c1c1f] py-2">
          <button
            onClick={toggleLeft}
            title="Show Layers column"
            className="grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
          >
            <Layers size={14} />
          </button>
          <button
            onClick={toggleRight}
            title="Show Color column"
            className="grid h-7 w-7 place-items-center rounded-md text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
          >
            <Palette size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
