import { layerManager } from "./layerManager";
import { useEditorStore, type LayerMeta } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { shouldRecreateStrokeLayer, shouldRemoveStrokeLayer } from "./strokeHistory";

// Shared undo/redo with pixel restore. Undo captures the AFTER state onto the
// future entry so redo can actually repaint (previously redo only touched
// metadata and the canvas never changed).
export function doUndo(): boolean {
  const st = useEditorStore.getState();
  const entry = st.undoMeta();
  if (!entry) return false;
  const after = layerManager.snapshot(entry.layerId);
  const afterMask = layerManager.snapshotMask(entry.layerId);
  layerManager.restore(entry.layerId, entry.snapshot);
  if (entry.maskSnapshot !== undefined) layerManager.restoreMask(entry.layerId, entry.maskSnapshot);
  useEditorStore.setState((s) => ({
    future: s.future.map((f, i) => (i === 0 ? { ...f, redoSnapshot: after, maskRedoSnapshot: afterMask } : f)),
  }));
  st.markDirty();
  useProStore.getState().bumpHistogram();
  // One item per layer: undoing a fresh stroke removes its layer instead of
  // leaving an empty shell in the stack.
  if (shouldRemoveStrokeLayer(entry, st.layers.map((l) => l.id), st.layers.length) && entry.createdLayerId) {
    const cid = entry.createdLayerId;
    try {
      layerManager.remove(cid);
      layerManager.removeMask(cid);
      useProStore.getState().removeTransform(cid);
      useEditorStore.getState().removeLayer(cid);
    } catch {
      /* layer already gone */
    }
  }
  return true;
}

export function doRedo(): boolean {
  const st = useEditorStore.getState();
  const entry = st.redoMeta();
  if (!entry) return false;
  // One item per layer: recreate the stroke layer first so pixel restore
  // has a canvas, then reselect it like a fresh stroke would.
  if (entry.createdLayer && shouldRecreateStrokeLayer(entry, st.layers.map((l) => l.id))) {
    try {
      const spec = entry.createdLayer;
      const meta: LayerMeta = {
        id: entry.createdLayerId as string,
        name: spec.name,
        visible: true,
        locked: false,
        lockPixels: false,
        lockPosition: false,
        opacity: spec.opacity,
        fillOpacity: 100,
        blendMode: spec.blendMode as LayerMeta["blendMode"],
        kind: spec.kind,
      };
      useEditorStore.getState().addLayer(meta);
      layerManager.ensure(entry.createdLayerId as string, st.doc.width, st.doc.height);
    } catch {
      /* fall through to plain restore */
    }
  }
  layerManager.restore(entry.layerId, entry.redoSnapshot ?? entry.snapshot);
  const m = entry.maskRedoSnapshot !== undefined ? entry.maskRedoSnapshot : entry.maskSnapshot;
  if (m !== undefined) layerManager.restoreMask(entry.layerId, m);
  st.markDirty();
  useProStore.getState().bumpHistogram();
  return true;
}

// Jump the history stack to a target index (used by the History panel).
// Target -1 = pristine (undo all), otherwise undo/redo step by step.
export function jumpToHistory(target: number): void {
  let guard = 0;
  while (useEditorStore.getState().history.length - 1 > target && guard++ < 100) {
    if (!doUndo()) break;
  }
  while (useEditorStore.getState().history.length - 1 < target && guard++ < 200) {
    if (!doRedo()) break;
  }
}
