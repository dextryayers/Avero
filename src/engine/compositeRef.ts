// Tiny accessor for the latest composited document canvas.
//
// Lives in its own dependency-free module so chrome code (TitleBar, panels,
// export io, palette) can read the composite WITHOUT importing the heavy
// CanvasArea component. That keeps CanvasArea code-splittable behind
// React.lazy while every reader stays on the main chunk.
export function getCompositeCanvas(): HTMLCanvasElement | null {
  try {
    return (window as unknown as { __avero_comp?: HTMLCanvasElement | null }).__avero_comp ?? null;
  } catch {
    return null;
  }
}

export function setCompositeCanvas(c: HTMLCanvasElement | null): void {
  try {
    (window as unknown as { __avero_comp?: HTMLCanvasElement | null }).__avero_comp = c;
  } catch {
    /* ignore */
  }
}
