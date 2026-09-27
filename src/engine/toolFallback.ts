import type { ToolId } from "../stores/useEditorStore";

// Fallback behavior for utility tools that do not paint pixels.
// Every workspace tool must do something visible and safe: select, measure,
// annotate, or explain the next step. No dead tools, no crashes.
export const UTILITY_TOOL_MESSAGE: Partial<Record<ToolId, string>> = {
  "slice-select": "Slice Select: click a slice to select it, drag to move it.",
  "color-sampler": "Color Sampler: click the canvas to pin a readout (max 8).",
  "sampler-avg": "Average Sampler: click to pin a 5x5 average readout.",
  "path-select": "Path Selection: click a vector/text layer to move the whole path.",
  "direct-select": "Direct Selection: drag on a shape layer to rotate its points.",
  pan: "Pan: drag to move the canvas view.",
  "rotate-view": "Rotate View: drag left/right to rotate the view. Double-click resets.",
  "curvature-pen": "Curvature Pen: drag on canvas to draw a smooth S-curve path.",
  artboard: "Artboard: drag to create a new artboard frame.",
  frame: "Frame: drag to create an image placeholder frame.",
  slice: "Slice: drag a rectangle to define an export slice.",
  ruler: "Ruler: drag to measure distance and angle.",
  "measure-angle": "Angle Measure: drag to measure angle from horizontal.",
  "measure-area": "Area Measure: drag a rectangle to measure W x H and area.",
  note: "Note: click to attach a note pin.",
  count: "Count: click to add a numbered marker.",
  "snap-toggle": "Snap Toggle: click canvas to toggle snapping on/off.",
  "zoom-fit": "Zoom Fit: click canvas to fit the document to screen.",
  "zoom-100": "Zoom 100%: click canvas for actual pixels.",
  "zoom-200": "Zoom 200%: click canvas for 2x detail.",
  "zoom-400": "Zoom 400%: click canvas for pixel inspection.",
};

export function utilityMessage(tool: ToolId): string {
  return UTILITY_TOOL_MESSAGE[tool] ?? "Tool ready. Click or drag on the canvas.";
}

export function isUtilityTool(tool: ToolId): boolean {
  return tool in UTILITY_TOOL_MESSAGE;
}
