import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  FolderOpen,
  ImagePlus,
  Layers,
  Wand2,
  Keyboard,
  Palette,
  Check,
} from "lucide-react";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { clearSelectionMask } from "../engine/selection";
import { renderTextToLayer } from "../engine/textShape";
import clsx from "clsx";

const STEPS = [
  { id: "welcome", title: "Selamat Datang", desc: "Pengantar singkat" },
  { id: "create", title: "Buka dan Buat", desc: "Mulai berkarya" },
  { id: "retouch", title: "Retouch", desc: "Peralatan lengkap" },
  { id: "color", title: "Warna dan Filter", desc: "Non-destruktif" },
  { id: "workspace", title: "Workspace", desc: "Siap kerja" },
];

function sampleProject(kind: "retouch" | "design") {
  const st = useEditorStore.getState();
  layerManager.clear();
  const W = 1600;
  const H = 1000;
  st.newDocument(kind === "design" ? "Sample Design" : "Sample Retouch", W, H);
  const id = useEditorStore.getState().activeLayerId!;
  const c = layerManager.ensure(id, W, H);
  const ctx = c.getContext("2d")!;
  if (kind === "design") {
    ctx.fillStyle = "#1a2b45";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2f7cf6";
    ctx.fillRect(180, 640, 520, 180);
    ctx.fillStyle = "#d8d8de";
    ctx.fillRect(740, 640, 680, 180);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#3a4a63");
    g.addColorStop(0.55, "#6a6a80");
    g.addColorStop(1, "#9a7a5a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e8e2d6";
    ctx.beginPath();
    ctx.ellipse(800, 520, 260, 320, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#232327";
    ctx.beginPath();
    ctx.ellipse(730, 470, 26, 34, 0, 0, Math.PI * 2);
    ctx.ellipse(870, 470, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const l2 = makeLayer("Teks Judul");
  layerManager.ensure(l2.id, W, H);
  st.addLayer({ ...l2, kind: "text" });
  const spec = {
    text: kind === "design" ? "AVERO STUDIO" : "Coba hapus background",
    fontFamily: "Inter",
    fontSize: 72,
    color: "#ffffff",
    bold: true,
    italic: false,
    tracking: 1,
    leading: 1.2,
  };
  useProStore.getState().setTextSpec(l2.id, spec);
  const cc = layerManager.get(l2.id);
  if (cc) renderTextToLayer(cc, spec, 180, 120);
  useProStore.getState().bumpHistogram();
  clearSelectionMask();
  useWorkspaceStore.getState().setOnboarding(true);
  useHomeStore.getState().setHome(false);
}

export default function Onboarding() {
  const done = useWorkspaceStore((s) => s.onboardingDone);
  const setOnboarding = useWorkspaceStore((s) => s.setOnboarding);
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  if (done) return null;

  function finishEmpty() {
    if (dontShow) {
      setOnboarding(true);
    } else {
      useWorkspaceStore.setState({ onboardingDone: true });
      try {
        localStorage.removeItem("avero-onboarding");
      } catch {}
      queueMicrotask(() => {
        try {
          localStorage.removeItem("avero-onboarding");
        } catch {}
      });
    }
    useHomeStore.getState().setHome(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const st = useEditorStore.getState();
      st.openDocument(f.name, img.naturalWidth, img.naturalHeight, null, f.size);
      layerManager.clear();
      const id = useEditorStore.getState().activeLayerId!;
      const c = layerManager.ensure(id, img.naturalWidth, img.naturalHeight);
      c.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      useProStore.getState().bumpHistogram();
      setOnboarding(true);
      useHomeStore.getState().setHome(false);
    };
    img.src = url;
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-[840px] max-w-full overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]">
        <div className="hidden w-[220px] shrink-0 flex-col border-r border-[#2c2c31] bg-[#161618] p-4 sm:flex">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="AVERO" className="h-9 w-9 rounded-md object-cover" />
            <div>
              <div className="text-[12px] font-bold tracking-wide text-white">AVERO STUDIO</div>
              <div className="font-mono text-[10px] text-[#6e6e78]">v2.0.0</div>
            </div>
          </div>
          <div className="mt-5 space-y-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left",
                  i === step ? "bg-[#232327]" : "hover:bg-[#1c1c1f]",
                )}
              >
                <span
                  className={clsx(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                    i < step
                      ? "bg-[#2f7cf6] text-white"
                      : i === step
                        ? "bg-[#2f7cf6] text-white"
                        : "bg-[#2c2c31] text-[#a7a7b0]",
                  )}
                >
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                <span>
                  <span className={clsx("block text-[12px] font-semibold", i === step ? "text-white" : "text-[#c9c9d1]")}>
                    {s.title}
                  </span>
                  <span className="block text-[10px] text-[#6e6e78]">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-md border border-[#2c2c31] p-2.5 text-[10px] leading-relaxed text-[#6e6e78]">
            Offline. Non-destruktif. Tanpa akun.
          </div>
        </div>

        <div className="flex min-h-[460px] min-w-0 flex-1 flex-col p-5">
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-[#6e6e78]">
            <span>
              {step + 1} / {STEPS.length}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded bg-[#2c2c31]">
              <div
                className="h-full bg-[#2f7cf6] transition-all"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {step === 0 && (
              <div>
                <div className="avero-micro">Pengantar</div>
                <h2 className="mt-1 text-[20px] font-bold leading-snug text-white">
                  Editor foto profesional untuk pekerjaan sehari-hari.
                </h2>
                <p className="mt-2 max-w-[520px] text-[12.5px] leading-relaxed text-[#a7a7b0]">
                  AVERO STUDIO memiliki layer dan mask, adjustment non-destruktif, RAW develop,
                  filter stack, dan automation dalam satu aplikasi desktop.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { icon: Layers, t: "Layer dan Mask", d: "Blend, clip, feather, density" },
                    { icon: Brush, t: "Retouch lengkap", d: "Heal, clone, dodge dan burn" },
                    { icon: Palette, t: "Warna akurat", d: "Levels, curves, selective" },
                    { icon: Wand2, t: "Filter non-destruktif", d: "Blur, sharpen, grain, vignette" },
                  ].map((f) => (
                    <div key={f.t} className="avero-card flex gap-2.5 p-3">
                      <f.icon size={17} className="mt-0.5 shrink-0 text-[#8fb6f5]" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">{f.t}</div>
                        <div className="text-[11px] text-[#6e6e78]">{f.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="avero-micro">Mulai</div>
                <h2 className="mt-1 text-[18px] font-bold text-white">Buka foto atau kanvas kosong</h2>
                <p className="mt-1 text-[12px] text-[#6e6e78]">Pilih salah satu untuk langsung masuk editor.</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => fileRef.current?.click()} className="avero-card group p-4 text-left hover:border-[#3a3a41]">
                    <FolderOpen size={20} className="text-[#8fb6f5]" />
                    <div className="mt-2 text-[12px] font-semibold text-white">Buka Foto</div>
                    <div className="text-[11px] text-[#6e6e78]">PNG, JPG, WEBP, PSD</div>
                  </button>
                  <button onClick={() => sampleProject("retouch")} className="avero-card group p-4 text-left hover:border-[#3a3a41]">
                    <ImagePlus size={20} className="text-[#8fb6f5]" />
                    <div className="mt-2 text-[12px] font-semibold text-white">Sample Retouch</div>
                    <div className="text-[11px] text-[#6e6e78]">Foto dan teks siap edit</div>
                  </button>
                  <button onClick={() => sampleProject("design")} className="avero-card group p-4 text-left hover:border-[#3a3a41]">
                    <Wand2 size={20} className="text-[#8fb6f5]" />
                    <div className="mt-2 text-[12px] font-semibold text-white">Sample Design</div>
                    <div className="text-[11px] text-[#6e6e78]">Komposisi bentuk dasar</div>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <div className="mt-3 rounded-md border border-[#2c2c31] bg-[#161618] p-3 text-[11.5px] text-[#a7a7b0]">
                  Seret file dari Explorer ke kanvas untuk membuat dokumen baru. File tercatat di
                  riwayat Home.
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="avero-micro">Peralatan</div>
                <h2 className="mt-1 text-[18px] font-bold text-white">Shortcut utama retouch</h2>
                <p className="mt-1 text-[12px] text-[#6e6e78]">Hafalkan yang sering dipakai agar kerja lebih cepat.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                  {[
                    ["B", "Brush dan Eraser", "Hardness, opacity, paint mask"],
                    ["J / S", "Spot Heal dan Clone", "Alt+klik menentukan sumber"],
                    ["O", "Dodge, Burn, Sponge", "Terang, gelap, saturasi lokal"],
                    ["R", "Blur, Sharpen, Smudge", "Haluskan dan seret piksel"],
                    ["M / L / W", "Select", "Rect, lasso, wand, feather"],
                    ["V / H / Z", "Navigasi", "Move, pan, zoom, guides"],
                  ].map(([k, t, d]) => (
                    <div key={t} className="flex items-center gap-2.5 rounded-md border border-[#2c2c31] bg-[#161618] p-2.5">
                      <span className="rounded bg-[#232327] px-1.5 py-1 font-mono text-[10px] text-[#8fb6f5]">{k}</span>
                      <span>
                        <span className="block font-semibold text-white">{t}</span>
                        <span className="block text-[#6e6e78]">{d}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="avero-micro">Warna</div>
                <h2 className="mt-1 text-[18px] font-bold text-white">Edit aman dan akurat</h2>
                <div className="mt-3 space-y-2 text-[12px]">
                  {[
                    ["Levels, Curves, Exposure, HSL, Vibrance", "Stack adjustment bisa dimatikan, diatur opacity, dan disusun ulang."],
                    ["Gaussian dan Motion Blur, Sharpen, Vignette, Grain", "Stack filter dengan pratinjau langsung."],
                    ["RAW develop, sRGB dan AdobeRGB, soft-proof CMYK", "Manajemen warna untuk kebutuhan cetak."],
                    ["Export PNG, JPG, WEBP, BMP, SVG, TIFF", "Simpan proyek utuh sebagai .avx, buka lagi kapan saja."],
                  ].map(([t, d]) => (
                    <div key={t} className="rounded-md border border-[#2c2c31] bg-[#161618] p-2.5">
                      <div className="font-semibold text-white">{t}</div>
                      <div className="text-[#6e6e78]">{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="avero-micro">Workspace</div>
                <h2 className="mt-1 text-[18px] font-bold text-white">Pilih workspace dan mulai</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["retouching", "photography", "design", "minimal"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => useWorkspaceStore.getState().setWorkspace(w)}
                      className="rounded-md border border-[#2c2c31] bg-[#161618] p-3 text-left capitalize hover:border-[#3a3a41]"
                    >
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
                        <Keyboard size={14} className="text-[#8fb6f5]" /> {w}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#6e6e78]">
                        {w === "retouching" ? "Brush, layer, mask" : w === "photography" ? "RAW, histogram, color" : w === "design" ? "Text, shape, node" : "Kanvas bersih minimal"}
                      </div>
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11.5px] text-[#6e6e78]">
                  <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-3.5 w-3.5 accent-[#2f7cf6]" />
                  Jangan tampilkan lagi saat startup
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-[#2c2c31] pt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-md bg-[#232327] px-3 py-2 text-[12px] text-white disabled:opacity-40"
            >
              <ArrowLeft size={14} /> Kembali
            </button>
            <button
              onClick={finishEmpty}
              className="rounded-md px-3 py-2 text-[12px] text-[#6e6e78] hover:text-white"
            >
              Lewati
            </button>
            <div className="ml-auto flex gap-2">
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="avero-btn-primary flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-semibold text-white"
                >
                  Lanjut <ArrowRight size={14} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => sampleProject("retouch")}
                    className="avero-btn-primary rounded-md px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    Buat sample dan mulai
                  </button>
                  <button
                    onClick={finishEmpty}
                    className="rounded-md bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]"
                  >
                    Mulai kosong
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
