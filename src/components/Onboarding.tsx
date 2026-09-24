import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  FolderOpen,
  ImagePlus,
  Layers,
  Sparkles,
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
  { id: "welcome", title: "Selamat Datang", desc: "Kenalan dengan AVERO" },
  { id: "create", title: "Buka & Buat", desc: "Mulai berkarya" },
  { id: "retouch", title: "Retouch Pro", desc: "Tools lengkap" },
  { id: "color", title: "Warna & AI", desc: "Non-destruktif" },
  { id: "workspace", title: "Workspace", desc: "Siap kerja" },
];

function sampleProject(kind: "retouch" | "design" | "photo") {
  const st = useEditorStore.getState();
  layerManager.clear();
  const W = 1600;
  const H = 1000;
  st.newDocument(kind === "design" ? "Sample Design" : "Sample Retouch", W, H);
  const id = useEditorStore.getState().activeLayerId!;
  const c = layerManager.ensure(id, W, H);
  const ctx = c.getContext("2d")!;
  if (kind === "design") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0b1020");
    g.addColorStop(0.5, "#123a6d");
    g.addColorStop(1, "#0a84ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(56,225,255,0.18)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(200 + i * 300, 750 - i * 90, 120 - i * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#2b4a6f");
    g.addColorStop(0.55, "#7a6a9a");
    g.addColorStop(1, "#e0905a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f2ede4";
    ctx.beginPath();
    ctx.ellipse(800, 520, 260, 320, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e1e1e";
    ctx.beginPath();
    ctx.ellipse(730, 470, 26, 34, 0, 0, Math.PI * 2);
    ctx.ellipse(870, 470, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const l2 = makeLayer("Teks Judul");
  layerManager.ensure(l2.id, W, H);
  st.addLayer({ ...l2, kind: "text" });
  const spec = {
    text: kind === "design" ? "AVERO STUDIO" : "Coba AI hapus background",
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
      // Tutup untuk sesi ini saja, tanpa persist "done"
      useWorkspaceStore.setState({ onboardingDone: true });
      try {
        localStorage.removeItem("avero-onboarding");
      } catch {}
      // Kembalikan flag persist ke false agar startup berikutnya tampil lagi,
      // tapi overlay sesi ini tetap tertutup via session flag
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="animate-fade-up flex w-[860px] max-w-full overflow-hidden rounded-2xl border border-[#232b3d] bg-[#10141d] shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
        {/* Sidebar steps ala Photoshop */}
        <div className="hidden w-[240px] shrink-0 flex-col bg-gradient-to-b from-[#161c2a] to-[#0d1119] p-5 sm:flex">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="AVERO" className="h-10 w-10 rounded-xl object-cover" />
            <div>
              <div className="text-[13px] font-extrabold tracking-[0.16em] text-white">AVERO</div>
              <div className="text-[9px] tracking-[0.34em] text-[#38a0ff]">STUDIO</div>
            </div>
          </div>
          <div className="mt-6 space-y-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                  i === step ? "bg-[#0a84ff]/15 ring-1 ring-[#0a84ff]/50" : "hover:bg-white/5",
                )}
              >
                <span
                  className={clsx(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                    i < step
                      ? "bg-emerald-500 text-white"
                      : i === step
                        ? "bg-[#0a84ff] text-white"
                        : "bg-[#232b3d] text-[#8a94a6]",
                  )}
                >
                  {i < step ? <Check size={13} /> : i + 1}
                </span>
                <span>
                  <span className={clsx("block text-[12px] font-semibold", i === step ? "text-white" : "text-[#c5cddc]")}>
                    {s.title}
                  </span>
                  <span className="block text-[10px] text-[#5b6577]">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-lg border border-[#232b3d] bg-black/30 p-3 text-[10px] leading-relaxed text-[#8a94a6]">
            Offline-first • Non-destruktif • Tanpa akun • v2.0.0
          </div>
        </div>

        {/* Main */}
        <div className="flex min-h-[480px] min-w-0 flex-1 flex-col p-6">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-[#5b6577]">
            <span className="font-mono">
              {step + 1} / {STEPS.length}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded bg-[#1b2130]">
              <div
                className="h-full bg-gradient-to-r from-[#0a84ff] to-[#38e1ff] transition-all"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {step === 0 && (
              <div>
                <h2 className="text-[22px] font-extrabold leading-tight text-white">
                  Studio foto profesional,
                  <br />
                  <span className="bg-gradient-to-r from-[#0a84ff] to-[#38e1ff] bg-clip-text text-transparent">
                    sekelas Photoshop.
                  </span>
                </h2>
                <p className="mt-2 max-w-[520px] text-[12.5px] leading-relaxed text-[#aeb7c9]">
                  AVERO STUDIO adalah editor foto open-source dengan layer, mask, adjustment
                  non-destruktif, RAW develop, AI offline, dan automation — dalam 30 detik kamu
                  langsung bisa retouch.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Layers, t: "Layer + Mask", d: "Blend, clip, feather, density" },
                    { icon: Brush, t: "Retouch lengkap", d: "Heal, clone, dodge & burn" },
                    { icon: Palette, t: "Warna pro", d: "Levels, curves, selective" },
                    { icon: Sparkles, t: "AI offline", d: "BG remover, upscale 2x" },
                  ].map((f) => (
                    <div key={f.t} className="avero-card flex gap-2.5 p-3">
                      <f.icon size={18} className="mt-0.5 shrink-0 text-[#38a0ff]" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">{f.t}</div>
                        <div className="text-[11px] text-[#8a94a6]">{f.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-[19px] font-bold text-white">Mulai dari foto atau kanvas kosong</h2>
                <p className="mt-1 text-[12px] text-[#8a94a6]">Tiga cara tercepat — pilih salah satu, langsung masuk editor.</p>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <button onClick={() => fileRef.current?.click()} className="avero-card group p-4 text-left hover:ring-1 hover:ring-[#0a84ff]">
                    <FolderOpen size={22} className="text-[#38a0ff]" />
                    <div className="mt-2 text-[12.5px] font-semibold text-white">Buka Foto</div>
                    <div className="text-[11px] text-[#8a94a6]">PNG • JPG • WEBP • PSD</div>
                  </button>
                  <button onClick={() => sampleProject("retouch")} className="avero-card group p-4 text-left hover:ring-1 hover:ring-[#0a84ff]">
                    <ImagePlus size={22} className="text-[#38a0ff]" />
                    <div className="mt-2 text-[12.5px] font-semibold text-white">Sample Retouch</div>
                    <div className="text-[11px] text-[#8a94a6]">Wajah + teks siap edit</div>
                  </button>
                  <button onClick={() => sampleProject("design")} className="avero-card group p-4 text-left hover:ring-1 hover:ring-[#0a84ff]">
                    <Wand2 size={22} className="text-[#38a0ff]" />
                    <div className="mt-2 text-[12.5px] font-semibold text-white">Sample Design</div>
                    <div className="text-[11px] text-[#8a94a6]">Gradien + shape modern</div>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <div className="mt-3 rounded-lg bg-[#0a84ff]/10 p-3 text-[11.5px] text-[#aeb7c9] ring-1 ring-[#0a84ff]/30">
                  Atau seret file dari Explorer langsung ke kanvas — otomatis jadi dokumen baru + masuk
                  Riwayat Home.
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-[19px] font-bold text-white">Tools retouch selengkap Photoshop</h2>
                <p className="mt-1 text-[12px] text-[#8a94a6]">Semua ada shortcut — hafalkan 5 detik, kerja 10x lebih cepat.</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                  {[
                    ["B", "Brush & Eraser", "Hardness, opacity, paint mask"],
                    ["J / S", "Spot Heal & Clone", "Alt+klik tentukan sumber"],
                    ["O", "Dodge / Burn / Sponge", "Terang-gelap & saturasi lokal"],
                    ["Blur / Smudge", "U / Shift+U", "Haluskan & seret piksel"],
                    ["M / L / W", "Select pro", "Rect, lasso, magic wand + feather"],
                    ["V / H / Z", "Move / Pan / Zoom", "Transform + guides + snap"],
                  ].map(([k, t, d]) => (
                    <div key={t} className="flex items-center gap-2.5 rounded-lg border border-[#232b3d] bg-black/20 p-2.5">
                      <span className="rounded bg-[#1b2130] px-1.5 py-1 font-mono text-[10px] text-[#38e1ff]">{k}</span>
                      <span>
                        <span className="block font-semibold text-white">{t}</span>
                        <span className="block text-[#8a94a6]">{d}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-[19px] font-bold text-white">Warna akurat, edit aman</h2>
                <div className="mt-3 space-y-2 text-[12px]">
                  {[
                    ["Levels • Curves • Exposure • HSL • Vibrance", "Adjustment stack bisa di-toggle, opacity, reorder."],
                    ["Gaussian / Motion Blur • Sharpen • Vignette • Grain", "Filter stack dengan preview langsung."],
                    ["RAW develop • sRGB / AdobeRGB • Soft-proof CMYK", "Color management untuk cetak."],
                    ["Background remover • Upscale 2x • Restore — 100% offline", "AI lokal tanpa upload."],
                  ].map(([t, d]) => (
                    <div key={t} className="rounded-lg border border-[#232b3d] bg-black/20 p-2.5">
                      <div className="font-semibold text-white">{t}</div>
                      <div className="text-[#8a94a6]">{d}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-[19px] font-bold text-white">Pilih workspace, mulai kerja</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["retouching", "photography", "design", "minimal"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => useWorkspaceStore.getState().setWorkspace(w)}
                      className="rounded-lg border border-[#232b3d] bg-black/20 p-3 text-left capitalize hover:border-[#0a84ff]"
                    >
                      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
                        <Keyboard size={14} className="text-[#38a0ff]" /> {w}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#8a94a6]">
                        {w === "retouching" ? "Brush + layer + AI prompt" : w === "photography" ? "RAW + histogram + color" : w === "design" ? "Text + shape + node" : "Kanvas bersih minimal"}
                      </div>
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11.5px] text-[#8a94a6]">
                  <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-3.5 w-3.5 accent-[#0a84ff]" />
                  Jangan tampilkan lagi saat startup
                </label>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-2 border-t border-[#1c2333] pt-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#1b2130] px-3 py-2 text-[12px] text-white disabled:opacity-40"
            >
              <ArrowLeft size={14} /> Kembali
            </button>
            <button
              onClick={finishEmpty}
              className="rounded-lg px-3 py-2 text-[12px] text-[#8a94a6] hover:text-white"
            >
              Lewati
            </button>
            <div className="ml-auto flex gap-2">
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="avero-btn-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white"
                >
                  Lanjut <ArrowRight size={14} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => sampleProject("retouch")}
                    className="avero-btn-primary rounded-lg px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    Buat sample & mulai
                  </button>
                  <button
                    onClick={finishEmpty}
                    className="rounded-lg bg-[#1b2130] px-4 py-2 text-[12px] text-white hover:bg-[#232b3d]"
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
