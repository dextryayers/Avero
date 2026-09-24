import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";

export default function MaskPanel() {
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const masks = useProStore((s) => s.masks);
  const ensureMask = useProStore((s) => s.ensureMask);
  const updateMask = useProStore((s) => s.updateMask);
  const removeMaskEntry = useProStore((s) => s.removeMaskEntry);
  const paintMask = useProStore((s) => s.paintMask);
  const setPaintMask = useProStore((s) => s.setPaintMask);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const doc = useEditorStore((s) => s.doc);

  const active = layers.find((l) => l.id === activeLayerId);
  const m = activeLayerId ? masks[activeLayerId] : undefined;

  return (
    <div className="space-y-3 p-3 text-[12px]">
      <div className="rounded border border-[#3e3e42] bg-[#2d2d2d] p-2 text-[11px] text-[#a0a0a0]">
        Layer aktif: <span className="text-white">{active?.name ?? "-"}</span>
        <br />
        Mask putih tampil, hitam sembunyi. Paint dengan Brush putih dan Eraser hitam saat mode paint
        mask aktif.
      </div>
      {!m?.hasMask ? (
        <button
          onClick={() => {
            if (!activeLayerId) return;
            layerManager.ensureMask(activeLayerId, doc.width, doc.height);
            ensureMask(activeLayerId);
          }}
          disabled={!activeLayerId}
          className="w-full rounded bg-[#0a84ff] px-2 py-1.5 text-[12px] text-white hover:bg-[#0070e0] disabled:opacity-40"
        >
          Add layer mask
        </button>
      ) : (
        <>
          <label className="flex items-center justify-between text-[#c5c5c5]">
            <span>Enable mask</span>
            <input
              type="checkbox"
              checked={m.enabled}
              onChange={(e) =>
                activeLayerId && updateMask(activeLayerId, { enabled: e.target.checked })
              }
            />
          </label>
          <label className="flex items-center justify-between text-[#c5c5c5]">
            <span className={paintMask ? "text-white font-semibold" : ""}>Paint mask mode</span>
            <input
              type="checkbox"
              checked={paintMask}
              onChange={(e) => setPaintMask(e.target.checked)}
            />
          </label>
          <div>
            <label className="mb-1 flex justify-between text-[#a0a0a0]">
              Feather <span className="font-mono text-white">{m.feather}px</span>
            </label>
            <input
              type="range"
              min={0}
              max={24}
              value={m.feather}
              onChange={(e) =>
                activeLayerId && updateMask(activeLayerId, { feather: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 flex justify-between text-[#a0a0a0]">
              Density <span className="font-mono text-white">{m.density}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={m.density}
              onChange={(e) =>
                activeLayerId && updateMask(activeLayerId, { density: Number(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div>
            <label className="flex items-center justify-between text-[#c5c5c5]">
              <span>Clipping ke layer bawah</span>
              <input
                type="checkbox"
                checked={!!active?.clipped}
                onChange={(e) =>
                  activeLayerId && updateLayer(activeLayerId, { clipped: e.target.checked })
                }
              />
            </label>
            <p className="mt-1 text-[10px] text-[#a0a0a0]">
              Clipping tahap 1: flag tersimpan, full isolate masuk Fase 5 node graph.
            </p>
          </div>
          <button
            onClick={() => {
              if (!activeLayerId) return;
              layerManager.removeMask(activeLayerId);
              removeMaskEntry(activeLayerId);
              setPaintMask(false);
            }}
            className="w-full rounded bg-[#5a1f1f] px-2 py-1.5 text-[11px] text-white hover:bg-[#7a2828]"
          >
            Delete mask
          </button>
        </>
      )}
    </div>
  );
}
