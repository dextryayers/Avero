import { useState } from "react";
import { useAiStore } from "../stores/useAiStore";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { createJob } from "../engine/ai/runtime";
import { backgroundRemoveAlpha, autoSubjectMask } from "../engine/ai/segment";
import { inpaintSelection, upscaleLayer, colorTransfer } from "../engine/ai/restore";
import { selectionMaskCanvas, drawRectSelection } from "../engine/selection";
import { getCompositeCanvas } from "./CanvasArea";

function useActiveLayerCanvas() {
  const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
  if (!id) return null;
  const doc = useEditorStore.getState().doc;
  return { id, canvas: layerManager.ensure(id, doc.width, doc.height) };
}

export default function AiPanel() {
  const models = useAiStore((s) => s.models);
  const jobs = useAiStore((s) => s.jobs);
  const pushJob = useAiStore((s) => s.pushJob);
  const updateJob = useAiStore((s) => s.updateJob);
  const removeJob = useAiStore((s) => s.removeJob);
  const setResult = useAiStore((s) => s.setResult);
  const lastResult = useAiStore((s) => s.lastResult);
  const [tol, setTol] = useState(42);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: (job: ReturnType<typeof createJob>) => Promise<string>) {
    const job = createJob(label);
    pushJob(job);
    setBusy(job.id);
    try {
      const msg = await fn(job);
      setResult(msg);
      updateJob(job.id, { progress: 100 });
      setTimeout(() => removeJob(job.id), 4000);
    } catch (e) {
      setResult(`Gagal: ${String(e)}`);
      updateJob(job.id, { progress: 0 });
    } finally {
      setBusy(null);
      useProStore.getState().bumpHistogram();
    }
  }

  return (
    <div className="space-y-3 p-3 text-[12px]">
      <div className="rounded border border-[#2c2c31] bg-[#1c1c1f] p-2 text-[11px] text-[#c9c9d1]">
        AI lokal 100% offline. Heuristik aktif tanpa download. Slot ONNX siap di folder model untuk
        akurasi setara cloud.
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <button
          disabled={!!busy}
          onClick={() =>
            run("Background remover", async (job) => {
              const active = useActiveLayerCanvas();
              if (!active) throw new Error("Tidak ada layer");
              const snap = layerManager.snapshot(active.id);
              if (snap)
                useEditorStore.getState().pushHistory({
                  label: "AI background remove",
                  layerId: active.id,
                  snapshot: snap,
                });
              updateJob(job.id, { progress: 6 });
              const out = await backgroundRemoveAlpha(active.canvas, tol, (p) =>
                updateJob(job.id, { progress: p }),
              );
              const ctx = active.canvas.getContext("2d")!;
              ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
              ctx.drawImage(out, 0, 0);
              useEditorStore.getState().markDirty();
              return `Background dihapus toleransi ${tol}. Sisa edge bisa rapikan dengan Eraser.`;
            })
          }
          className="rounded bg-[#2f7cf6] px-2 py-2 text-white hover:bg-[#2563d4] disabled:opacity-50"
        >
          1-klik hapus background
        </button>
        <label className="flex justify-between text-[11px] text-[#a7a7b0]">
          Toleransi <span className="font-mono text-white">{tol}</span>
        </label>
        <input
          type="range"
          min={12}
          max={110}
          value={tol}
          onChange={(e) => setTol(Number(e.target.value))}
          className="w-full"
        />

        <div className="grid grid-cols-2 gap-1.5">
          <button
            disabled={!!busy}
            onClick={() =>
              run("Auto select subject", async (job) => {
                const comp = getCompositeCanvas();
                if (!comp) throw new Error("Composite belum siap");
                updateJob(job.id, { progress: 10 });
                const mask = await autoSubjectMask(comp, (p) => updateJob(job.id, { progress: p }));
                const sel = selectionMaskCanvas();
                const doc = useEditorStore.getState().doc;
                if (sel && sel.width === doc.width && sel.height === doc.height) {
                  const sctx = sel.getContext("2d")!;
                  sctx.clearRect(0, 0, sel.width, sel.height);
                  sctx.drawImage(mask, 0, 0, sel.width, sel.height);
                } else {
                  drawRectSelection(doc.width, doc.height, {
                    x: doc.width * 0.2,
                    y: doc.height * 0.15,
                    w: doc.width * 0.6,
                    h: doc.height * 0.7,
                  });
                  const sel2 = selectionMaskCanvas();
                  if (sel2) {
                    const sctx = sel2.getContext("2d")!;
                    sctx.clearRect(0, 0, sel2.width, sel2.height);
                    sctx.drawImage(mask, 0, 0, sel2.width, sel2.height);
                  }
                }
                return "Subjek diseleksi. Brush kini terlindungi di luar subjek.";
              })
            }
            className="rounded bg-[#2f7cf6] px-2 py-2 text-white hover:bg-[#2563d4] disabled:opacity-50"
          >
            Select subject
          </button>
          <button
            disabled={!!busy}
            onClick={() =>
              run("Inpaint erase", async (job) => {
                const active = useActiveLayerCanvas();
                if (!active) throw new Error("Tidak ada layer");
                const snap = layerManager.snapshot(active.id);
                if (snap)
                  useEditorStore
                    .getState()
                    .pushHistory({ label: "AI inpaint", layerId: active.id, snapshot: snap });
                await inpaintSelection(active.canvas, selectionMaskCanvas(), 6, (p) =>
                  updateJob(job.id, { progress: p }),
                );
                useEditorStore.getState().markDirty();
                return "Area seleksi/transparan diisi dari tetangga.";
              })
            }
            className="rounded bg-[#5a5a64] px-2 py-2 text-white hover:bg-[#4a4a52] disabled:opacity-50"
          >
            Generative erase
          </button>
          <button
            disabled={!!busy}
            onClick={() =>
              run("Upscale 2x", async (job) => {
                const st = useEditorStore.getState();
                const active = useActiveLayerCanvas();
                if (!active) throw new Error("Tidak ada layer");
                const up = await upscaleLayer(active.canvas, 2, (p) =>
                  updateJob(job.id, { progress: p }),
                );
                const l = makeLayer(`Upscale 2x ${st.layers.length + 1}`);
                // dokumen tetap, taruh hasil upscale sebagai layer baru di-scale fit
                layerManager.ensure(l.id, st.doc.width, st.doc.height);
                const c = layerManager.ensure(l.id, st.doc.width, st.doc.height);
                c.getContext("2d")!.drawImage(up, 0, 0, c.width, c.height);
                st.addLayer({ ...l });
                return "Upscale 2x dibuat sebagai layer baru.";
              })
            }
            className="rounded bg-[#2c2c31] px-2 py-2 hover:bg-[#3a3a41] disabled:opacity-50"
          >
            Upscale 2x
          </button>
          <button
            disabled={!!busy}
            onClick={() =>
              run("Color transfer", async (job) => {
                const comp = getCompositeCanvas();
                const refUrl = useAiStore.getState().autoColorRef;
                if (!comp) throw new Error("Composite belum siap");
                if (!refUrl) throw new Error("Upload referensi dulu di bawah");
                updateJob(job.id, { progress: 20 });
                const refImg = new Image();
                refImg.src = refUrl;
                await refImg.decode();
                const tmp = document.createElement("canvas");
                tmp.width = 256;
                tmp.height = 256;
                tmp.getContext("2d")!.drawImage(refImg, 0, 0, 256, 256);
                const refData = tmp
                  .getContext("2d", { willReadFrequently: true })!
                  .getImageData(0, 0, 256, 256);
                const active = useActiveLayerCanvas();
                if (!active) throw new Error("Tidak ada layer");
                const snap = layerManager.snapshot(active.id);
                if (snap)
                  useEditorStore.getState().pushHistory({
                    label: "AI color transfer",
                    layerId: active.id,
                    snapshot: snap,
                  });
                const id = active.canvas
                  .getContext("2d", { willReadFrequently: true })!
                  .getImageData(0, 0, active.canvas.width, active.canvas.height);
                colorTransfer(id, refData);
                active.canvas.getContext("2d")!.putImageData(id, 0, 0);
                updateJob(job.id, { progress: 100 });
                useEditorStore.getState().markDirty();
                return "Tone referensi ditiru ke layer aktif.";
              })
            }
            className="rounded bg-[#2c2c31] px-2 py-2 hover:bg-[#3a3a41] disabled:opacity-50"
          >
            Tiru tone referensi
          </button>
        </div>

        <label className="rounded border border-dashed border-[#2c2c31] p-2 text-center text-[11px] text-[#a7a7b0]">
          Upload foto referensi grading
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full text-[11px]"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const url = URL.createObjectURL(f);
              useAiStore.getState().setColorRef(url);
            }}
          />
        </label>
      </div>

      {jobs.length > 0 && (
        <div className="space-y-1">
          {jobs.map((j) => (
            <div key={j.id} className="rounded bg-[#232327] p-2">
              <div className="flex justify-between text-[11px]">
                <span>{j.label}</span>
                <span className="font-mono">{j.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#161618]">
                <div className="h-full bg-[#2f7cf6]" style={{ width: `${j.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {lastResult && (
        <div className="rounded bg-[#1c1c1f] p-2 text-[11px] text-[#a7a7b0]">{lastResult}</div>
      )}

      <div className="space-y-1">
        <h4 className="font-semibold text-white">Model manager</h4>
        {models.map((m) => (
          <div key={m.id} className="rounded border border-[#2c2c31] bg-[#232327] p-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-white">{m.label}</span>
              <span className="font-mono text-[#a7a7b0]">heuristic 100%</span>
            </div>
            <div className="text-[#a7a7b0]">{m.note}</div>
            <div className="font-mono text-[10px] text-[#a7a7b0]">
              {m.file} • {m.sizeMB}MB opsional
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
