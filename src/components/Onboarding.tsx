import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { clearSelectionMask } from "../engine/selection";

export default function Onboarding() {
  const done = useWorkspaceStore((s) => s.onboardingDone);
  const setOnboarding = useWorkspaceStore((s) => s.setOnboarding);
  if (done) return null;

  function sampleProject() {
    const st = useEditorStore.getState();
    layerManager.clear();
    st.newDocument("Sample Retouch", 1600, 1000);
    const id = useEditorStore.getState().activeLayerId!;
    const c = layerManager.ensure(id, 1600, 1000);
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 1600, 1000);
    g.addColorStop(0, "#2b4a6f");
    g.addColorStop(0.55, "#7a6a9a");
    g.addColorStop(1, "#e0905a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 1000);
    // subjek lingkaran agar AI/select langsung terasa
    ctx.fillStyle = "#f2ede4";
    ctx.beginPath();
    ctx.ellipse(800, 520, 260, 320, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1e1e";
    ctx.beginPath();
    ctx.ellipse(730, 470, 26, 34, 0, 0, Math.PI * 2);
    ctx.ellipse(870, 470, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    const l2 = makeLayer("Teks Judul");
    layerManager.ensure(l2.id, 1600, 1000);
    st.addLayer({ ...l2, kind: "text" });
    import("../stores/useProStore").then((m) => {
      m.useProStore.getState().setTextSpec(l2.id, { text: "Coba AI hapus background", fontFamily: "Inter", fontSize: 72, color: "#ffffff", bold: true, italic: false, tracking: 1, leading: 1.2 });
      import("../engine/textShape").then((t) => {
        const cc = layerManager.get(l2.id);
        if (cc) t.renderTextToLayer(cc, { text: "Coba AI hapus background", fontFamily: "Inter", fontSize: 72, color: "#ffffff", bold: true, italic: false, tracking: 1, leading: 1.2 }, 180, 120);
        m.useProStore.getState().bumpHistogram();
      });
    });
    clearSelectionMask();
    setOnboarding(true);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-6">
      <div className="w-[560px] max-w-full rounded-xl border border-[#3e3e42] bg-[#252526] p-5">
        <h2 className="text-[18px] font-bold text-white">Selamat datang di PSD Studio</h2>
        <p className="mt-1 text-[12px] text-[#c5c5c5]">
          Editor foto open source, installer native Linux dan Windows, offline-first. 30 detik untuk mulai:
          buka foto, retouch dengan brush dan adjustment, coba AI lokal, export.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12px] text-[#e0e0e0]">
          <li>Ctrl+K lalu Open image PNG JPG PSD RAW.</li>
          <li>Tab AI untuk hapus background dan upscale 2x.</li>
          <li>Tab Adjust dan Filter non-destructive.</li>
          <li>Snapshot di tab Git untuk 3 varian edit.</li>
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={sampleProject} className="rounded bg-[#0a84ff] px-3 py-2 text-white hover:bg-[#0070e0]">
            Buat sample project
          </button>
          <button onClick={() => setOnboarding(true)} className="rounded bg-[#3e3e42] px-3 py-2 hover:bg-[#505050]">
            Lewati, mulai kosong
          </button>
        </div>
      </div>
    </div>
  );
}
