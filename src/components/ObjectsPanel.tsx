import { useEffect } from "react";
import { useObjectStore } from "../stores/useObjectStore";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { restoreSelectionMask } from "../engine/selection";
import { askConfirm, askText } from "../ui/notify";
import { EmptyState } from "../ui/atoms";

// Plan5 Fase 7: Objects panel. Lists detected objects with label, confidence,
// and mask thumbnail. Click to select (marching ants), ctrl-click to pin.
// Delete removes the object layer. Rename uses the existing dialog.

export function ObjectsPanel() {
  const objects = useObjectStore((s) => s.objects);
  const selectedId = useObjectStore((s) => s.selectedId);
  const selectObject = useObjectStore((s) => s.selectObject);
  const removeObject = useObjectStore((s) => s.removeObject);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);

  // Prune entries whose layer was deleted elsewhere (layers panel, undo).
  useEffect(() => {
    const ids = new Set(layers.map((l) => l.id));
    const stale = objects.filter((o) => !ids.has(o.layerId));
    if (stale.length > 0) {
      for (const o of stale) removeObject(o.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.length]);

  async function handleSelect(id: string, multi: boolean) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    if (multi) {
      const cur = useObjectStore.getState().selectedId;
      if (cur === id) {
        selectObject(null);
        return;
      }
      selectObject(id);
      const layer = layers.find((l) => l.id === obj.layerId);
      if (layer) setActiveLayer(layer.id);
      return;
    }
    selectObject(id);
    const layer = layers.find((l) => l.id === obj.layerId);
    if (layer) setActiveLayer(layer.id);
    try {
      const canvas = layerManager.get(obj.layerId);
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = document.createElement("canvas");
      mask.width = canvas.width;
      mask.height = canvas.height;
      const mctx = mask.getContext("2d")!;
      const out = mctx.createImageData(mask.width, mask.height);
      for (let i = 0; i < idata.data.length; i += 4) {
        const a = idata.data[i + 3];
        if (a > 10) {
          out.data[i] = 255;
          out.data[i + 1] = 255;
          out.data[i + 2] = 255;
          out.data[i + 3] = 255;
        }
      }
      mctx.putImageData(out, 0, 0);
      restoreSelectionMask(mask.width, mask.height, mask);
      window.dispatchEvent(new Event("avero:selection-changed"));
    } catch {
      /* selection is a bonus */
    }
  }

  async function handleDelete(id: string) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    if (!(await askConfirm(`Delete object "${obj.label}"? This removes its layer.`))) return;
    layerManager.remove(obj.layerId);
    layerManager.removeMask(obj.layerId);
    removeLayer(obj.layerId);
    removeObject(id);
  }

  async function handleRename(id: string) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const layer = layers.find((l) => l.id === obj.layerId);
    if (!layer) return;
    const v = await askText("Rename object", "Object name:", layer.name);
    if (v && v.trim()) {
      updateLayer(obj.layerId, { name: v.trim().slice(0, 60) });
    }
  }

  if (objects.length === 0) {
    return (
      <EmptyState
        title="No objects yet"
        hint="Open a photo with Auto Segment on."
        action={{
          label: "Import photo",
          title: "Import a photo to detect objects from",
          onClick: () => {
            void import("../io/importImage").then(({ importImageAsLayer }) => importImageAsLayer());
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-1.5 p-2">
      {objects.map((obj) => {
        const layer = layers.find((l) => l.id === obj.layerId);
        const isActive = layer && activeLayerId === layer.id;
        const isSelected = selectedId === obj.id;
        return (
          <div
            key={obj.id}
            onClick={(e) => handleSelect(obj.id, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => handleRename(obj.id)}
            className={`group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
              isSelected
                ? "border-[#2f7cf6] bg-[#2f7cf6]/10"
                : isActive
                  ? "border-[#2c2c31] bg-[#232327]"
                  : "border-transparent hover:bg-white/5"
            }`}
          >
            {obj.thumb ? (
              <img src={obj.thumb} alt={obj.label} className="h-9 w-9 rounded object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded bg-[#232327] text-[10px] text-[#6e6e78]">
                {obj.label.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] text-white">{layer?.name ?? obj.label}</div>
              <div className="text-[10px] text-[#6e6e78]">
                {obj.label} · {Math.round(obj.confidence * 100)}%
              </div>
            </div>
            <div className="hidden gap-0.5 group-hover:flex">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRename(obj.id);
                }}
                className="rounded p-1 text-[#6e6e78] hover:bg-white/10 hover:text-white"
                title="Rename"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(obj.id);
                }}
                className="rounded p-1 text-[#6e6e78] hover:bg-red-900/30 hover:text-red-300"
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
