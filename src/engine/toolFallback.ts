import type { ToolId } from "../stores/useEditorStore";

// Fallback behavior for utility tools that do not paint pixels.
// Every workspace tool must do something visible and safe: select, measure,
// annotate, or explain the next step. No dead tools, no crashes.
export const UTILITY_TOOL_MESSAGE: Partial<Record<ToolId, string>> = {
  "slice-select": "Slice Select: drag a slice area first with the Slice tool.",
  "color-sampler": "Color Sampler: click the canvas to pin a readout.",
  "path-select": "Path Selection: drag a vector shape or text layer to move it.",
  "direct-select": "Direct Selection: drag anchor points on a shape layer.",
  pan: "Pan: drag to move the canvas view.",
  "rotate-view": "Rotate View: drag to pan. View rotation arrives in a later update.",
  "curvature-pen": "Curvature Pen: drag on canvas to draw a smooth path.",
  artboard: "Artboard: click to place a new artboard frame.",
  frame: "Frame: click to place an image placeholder frame.",
  slice: "Slice: drag a rectangle to define an export slice.",
  ruler: "Ruler: drag to measure distance and angle.",
  note: "Note: click to attach a note.",
  count: "Count: click to add a numbered marker.",
};

export function utilityMessage(tool: ToolId): string {
  return UTILITY_TOOL_MESSAGE[tool] ?? "Tool ready. Click or drag on the canvas.";
}

export function isUtilityTool(tool: ToolId): boolean {
  return tool in UTILITY_TOOL_MESSAGE;
}
