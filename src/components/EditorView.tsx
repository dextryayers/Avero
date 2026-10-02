import ToolBar from "./ToolBar";
import CanvasArea from "./CanvasArea";
import RightPanel from "./RightPanel";

// The full editor workspace (toolbar + canvas + right dock). Split into its
// own chunk via React.lazy so the first paint (Home screen) stays light and
// the heavy canvas engine loads only when the editor actually opens.
export default function EditorView() {
  return (
    <div className="flex min-h-0 flex-1">
      <ToolBar />
      <CanvasArea />
      <RightPanel />
    </div>
  );
}
