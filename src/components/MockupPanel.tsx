import { useState } from "react";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { autoQuad, warpToQuad, type Quad } from "../engine/mockup";
import { getCompositeCanvas } from "./CanvasArea";

export default function MockupPanel() {
  const doc = useEditorStore((s) => s.doc);
  const [quad, setQuad] = useState<Quad>(() => autoQuad(1920, 1080));
  const [log, setLog] = useState<string | null>(null);

  function apply() {
    const comp = getCompositeCanvas();
    if (!comp) {
      setLog("Composite belum siap");
      return;
    }
    // sumber = layer aktif (desain), tujuan = quad di dokumen
    const st = useEditorStore.getState();
    const id = st.activeLayerId ?? st.layers[0]?.id;
    if (!id) return;
    const src = layerManager.get(id);
    if (!src) return;
    const warped = warpToQuad(src, doc.width, doc.height, {
      x0: quad.x0 * (doc.width / 1920),
      x1: quad.x1 * (doc.width / 1920),
      x2: quad.x2 * (doc.width / 1920),
      x3: quad.x3 * (doc.width / 1920),
      y0: quad.y0 * (doc.height / 1080),
      y1: quad.y1 * (doc.height / 1080),
      y2: quad.y2 * (doc.height / 1080),
      y3: quad.y3 * (doc.height / 1080),
    });
    const l = makeLayer(`Mockup ${st.layers.length + 1}`);
    layerManager.ensure(l.id, doc.width, doc.height);
    layerManager.get(l.id)!.getContext("2d")!.drawImage(warped, 0, 0);
    st.addLayer(l);
    setLog("Desain di-warp ke perspektif mockup sebagai layer baru.");
  }

  return (
    <div className="space-y-2 p-3 text-[12px]">
      <div className="rounded border border-[#2c2c31] bg-[#232327] p-2 text-[11px] text-[#a7a7b0]">
        Drag desain (layer aktif) ke quad mockup kaos/botol/buku. Atur 4 titik lalu Apply.
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {(["x0", "y0", "x1", "y1", "x2", "y2", "x3", "y3"] as const).map((k) => (
          <label key={k} className="text-[11px] text-[#a7a7b0]">
            {k}
            <input
              type="number"
              value={Math.round(quad[k])}
              onChange={(e) => setQuad({ ...quad, [k]: Number(e.target.value) })}
              className="mt-0.5 w-full rounded bg-[#161618] px-2 py-1 font-mono text-white"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setQuad(autoQuad(1920, 1080))}
          className="rounded bg-[#2c2c31] px-2 py-1.5"
        >
          Auto deteksi
        </button>
        <button onClick={apply} className="rounded bg-[#2f7cf6] px-2 py-1.5 text-white">
          Apply mockup
        </button>
      </div>
      {log && <div className="rounded bg-[#1c1c1f] p-2 text-[11px] text-[#a7a7b0]">{log}</div>}
    </div>
  );
}
