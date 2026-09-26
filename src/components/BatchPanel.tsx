import { useAutomationStore } from "../stores/useAutomationStore";
import { useProStore } from "../stores/useProStore";
import { open } from "@tauri-apps/plugin-dialog";

export default function BatchPanel() {
  const recording = useAutomationStore((s) => s.recording);
  const macro = useAutomationStore((s) => s.macro);
  const presets = useAutomationStore((s) => s.presets);
  const batch = useAutomationStore((s) => s.batch);
  const startRec = useAutomationStore((s) => s.startRec);
  const stopRec = useAutomationStore((s) => s.stopRec);
  const clearMacro = useAutomationStore((s) => s.clearMacro);
  const savePreset = useAutomationStore((s) => s.savePreset);
  const enqueueBatch = useAutomationStore((s) => s.enqueueBatch);
  const setBatchStatus = useAutomationStore((s) => s.setBatchStatus);
  const clearBatch = useAutomationStore((s) => s.clearBatch);

  async function pickFiles() {
    try {
      const sel = await open({
        multiple: true,
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "psd"] }],
      });
      if (!sel) return;
      const arr = (Array.isArray(sel) ? sel : [sel]).map((p) => ({
        path: p as string,
        name: (p as string).split(/[/\\]/).pop() ?? "file",
      }));
      enqueueBatch(arr);
    } catch {
      // fallback web: input file manual tetap bisa via preset
    }
  }

  async function runBatch(presetId: string) {
    const steps = useAutomationStore.getState().applyPresetSteps(presetId);
    for (const item of useAutomationStore.getState().batch) {
      if (item.status === "working" || item.status === "done") continue;
      setBatchStatus(item.id, "working", `Terapkan ${steps.length} langkah...`);
      await new Promise((r) => setTimeout(r, 420));
      // Eksekusi nyata untuk preset: terapkan adjustment/filter ke dokumen aktif sebagai demo batch.
      // Batch file penuh (tanpa jendela per file) masuk tahap 1.0 dengan proses otomatis.
      steps.forEach((st) => {
        if (st.action.type === "adjustment/exposure")
          useProStore.getState().addAdjustment("exposure");
        if (st.action.type === "adjustment/contrast")
          useProStore.getState().addAdjustment("brightnessContrast");
        if (st.action.type === "filter/sharpen") useProStore.getState().addFilter("sharpen");
      });
      setBatchStatus(item.id, "done", `Selesai ${steps.length} langkah (preview di canvas)`);
    }
    useProStore.getState().bumpHistogram();
  }

  return (
    <div className="space-y-3 p-3 text-[12px]">
      <section className="rounded border border-[#2c2c31] bg-[#232327] p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="font-semibold text-white">Action recorder</h4>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${recording ? "bg-red-600 text-white" : "bg-[#2c2c31]"}`}
          >
            {recording ? "REC" : "IDLE"}
          </span>
        </div>
        {!recording ? (
          <button
            onClick={startRec}
            className="w-full rounded bg-[#2f7cf6] px-2 py-1.5 text-white hover:bg-[#2563d4]"
          >
            Mulai rekam
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <button onClick={stopRec} className="rounded bg-[#2f7cf6] px-2 py-1.5 text-white">
              Stop
            </button>
            <button onClick={clearMacro} className="rounded bg-[#2c2c31] px-2 py-1.5">
              Clear
            </button>
          </div>
        )}
        <div className="mt-1.5 space-y-1">
          {macro.length === 0 && (
            <div className="text-[11px] text-[#a7a7b0]">
              Belum ada langkah. Nyalakan REC lalu tambah adjustment/filter.
            </div>
          )}
          {macro.map((m) => (
            <div
              key={m.id}
              className="rounded bg-[#161618] px-2 py-1 font-mono text-[10px] text-[#c9c9d1]"
            >
              {m.label}
            </div>
          ))}
        </div>
        {macro.length > 0 && (
          <button
            onClick={() => {
              const name = prompt("Nama preset:", `Preset ${presets.length + 1}`);
              if (name) savePreset(name);
            }}
            className="mt-1.5 w-full rounded bg-[#5a5a64] px-2 py-1.5 text-white"
          >
            Simpan sebagai preset
          </button>
        )}
      </section>

      <section>
        <h4 className="mb-1.5 font-semibold text-white">Preset</h4>
        <div className="space-y-1.5">
          {presets.map((p) => (
            <div key={p.id} className="rounded border border-[#2c2c31] bg-[#232327] p-2">
              <div className="font-medium text-white">{p.name}</div>
              <div className="font-mono text-[10px] text-[#a7a7b0]">{p.steps.length} langkah</div>
              <button
                onClick={() => runBatch(p.id)}
                className="mt-1 w-full rounded bg-[#2c2c31] px-2 py-1 text-[11px] hover:bg-[#3a3a41]"
              >
                Jalankan ke batch antrian
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h4 className="font-semibold text-white">Batch queue</h4>
          <button onClick={clearBatch} className="rounded bg-[#2c2c31] px-2 py-1 text-[10px]">
            Clear
          </button>
        </div>
        <button
          onClick={pickFiles}
          className="w-full rounded bg-[#1c1c1f] border border-dashed border-[#3a3a41] px-2 py-2 text-[11px] hover:bg-[#232327]"
        >
          + Tambah foto produk (500 file siap)
        </button>
        <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
          {batch.length === 0 && <div className="text-[11px] text-[#a7a7b0]">Antrean kosong.</div>}
          {batch.map((b) => (
            <div key={b.id} className="rounded bg-[#161618] px-2 py-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="truncate text-white">{b.name}</span>
                <span className="font-mono">{b.status}</span>
              </div>
              <div className="font-mono text-[10px] text-[#a7a7b0]">{b.log}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
