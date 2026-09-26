import { layerManager } from "./layerManager";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";

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
  return true;
}

export function doRedo(): boolean {
  const st = useEditorStore.getState();
  const entry = st.redoMeta();
  if (!entry) return false;
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
