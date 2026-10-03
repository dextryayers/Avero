import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Cpu,
  Download,
  FileImage,
  FolderOpen,
  Layers,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEditorStore } from "../stores/useEditorStore";
import { getCompositeCanvas } from "../engine/compositeRef";
import { exportPlan } from "../io/memoryManager";
import { runImageExport } from "../io/exportRunner";
import {
  EXPORT_FORMATS,
  estimateBytes,
  formatBytes,
  formatMeta,
  needsMatteFor,
  usesQualityFor,
  type ExportFormatGroup,
} from "../io/exportFormats";
import { showError } from "../ui/notify";
import clsx from "clsx";

const GROUPS: ExportFormatGroup[] = ["Universal", "Pro & Print", "Vector", "Project"];

const GROUP_HINT: Record<ExportFormatGroup, string> = {
  Universal: "Everyday share",
  "Pro & Print": "Native engine",
  Vector: "Scalable",
  Project: "Editable source",
};

// Dedicated Export page - rombak total: modern, elegan, cepat.
// Kiri: katalog format dengan search + badge jujur.
// Tengah: live preview besar dengan checkerboard + info output.
// Kanan: pengaturan file yang ramping + ringkasan.
// Kontrak UX: klik Export SELALU membuka file manager (native save dialog)
// agar user menaruh file persis sesuai keinginan, lalu file di-reveal.
export default function ExportPage({ onBack }: { onBack: () => void }) {
  const doc = useEditorStore((s) => s.doc);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(100);
  const [matte, setMatte] = useState<"none" | "white" | "black">("none");
  const [name, setName] = useState(doc.name.replace(/\.[a-z0-9]+$/i, "") || "Untitled");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [tiled, setTiled] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fq, setFq] = useState("");

  const meta = formatMeta(format);
  const effMatte = needsMatteFor(format) && matte === "none" ? "white" : matte;
  const outW = Math.max(1, Math.round(doc.width * (scale / 100)));
  const outH = Math.max(1, Math.round(doc.height * (scale / 100)));
  const showQuality = usesQualityFor(format);
  const approx = useMemo(
    () => formatBytes(estimateBytes(format, outW, outH, quality)),
    [format, outW, outH, quality],
  );
  const isAvx = format === "avx";
  const outFile = `${(name.trim() || "Untitled").replace(/[\\/:*?"<>|]+/g, "_")}.${format === "jpeg" ? "jpeg" : format}`;

  const visibleFormats = useMemo(() => {
    const q = fq.trim().toLowerCase();
    if (!q) return EXPORT_FORMATS;
    return EXPORT_FORMATS.filter(
      (f) =>
        f.id.includes(q) ||
        f.label.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q) ||
        f.group.toLowerCase().includes(q),
    );
  }, [fq]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await exportPlan(doc.width, doc.height, scale);
        if (alive) setTiled(p.tiled);
      } catch {
        if (alive) setTiled(outW * outH > 2048 * 2048);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.width, doc.height, scale]);

  useEffect(() => {
    try {
      const comp = getCompositeCanvas();
      if (!comp) {
        setPreview(null);
        return;
      }
      // Matte-aware preview: mirrors exactly what the file will contain.
      const sc = Math.min(1, 560 / Math.max(comp.width, comp.height));
      const t = document.createElement("canvas");
      t.width = Math.max(1, Math.round(comp.width * sc));
      t.height = Math.max(1, Math.round(comp.height * sc));
      const g = t.getContext("2d")!;
      if (effMatte !== "none") {
        g.fillStyle = effMatte === "white" ? "#ffffff" : "#000000";
        g.fillRect(0, 0, t.width, t.height);
      }
      g.drawImage(comp, 0, 0, t.width, t.height);
      setPreview(t.toDataURL("image/png"));
    } catch {
      setPreview(null);
    }
  }, [effMatte, doc.width, doc.height, doc.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  async function doExport() {
    if (busy) return;
    if (!name.trim()) {
      await showError("Give the file a name first.");
      return;
    }
    setBusy(true);
    setStage("Opening file manager");
    try {
      // runImageExport membuka native save dialog DULU (file manager),
      // jadi user selalu menaruh export sesuai keinginan sendiri.
      const out = await runImageExport({
        format,
        quality,
        scale,
        matte: effMatte,
        fileName: name,
        onStage: (s) => setStage(s),
      });
      if (out) onBack();
    } catch (e) {
      await showError(`Export failed: ${String(e)}`);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0e0e10]">
      {/* ===== Header modern ===== */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#141416]/95 px-4 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] text-[#a7a7b0] transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#2f7cf6] via-[#2f7cf6] to-[#19c2e0] text-white shadow-[0_8px_24px_rgba(47,124,246,0.35)]">
          {isAvx ? <Layers size={17} /> : <Download size={17} />}
          {busy && <span className="avero-shimmer absolute inset-0" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-[14px] font-bold tracking-tight text-white">Export</div>
            <span
              className={clsx(
                "hidden rounded-full border px-2 py-px font-mono text-[10px] sm:block",
                isAvx
                  ? "border-[#2f7cf6]/40 bg-[#2f7cf6]/15 text-[#9ec1ff]"
                  : "border-white/10 bg-white/[0.05] text-[#a7a7b0]",
              )}
            >
              {isAvx ? "Avero Project Design" : meta.label}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-[#6e6e78]">
            {outW} × {outH} px · ±{approx}
            {tiled ? " · tiled UHD" : " · direct"} · {doc.width}×{doc.height} source
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            onClick={onBack}
            className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] text-[#c9c9d1] transition hover:bg-white/[0.08] hover:text-white sm:block"
          >
            Cancel
          </button>
          <button
            onClick={doExport}
            disabled={busy}
            className="avero-btn-primary avero-lift relative flex items-center gap-2 overflow-hidden rounded-lg px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_rgba(47,124,246,0.35)] disabled:opacity-60"
          >
            {busy && <span className="avero-shimmer absolute inset-0" />}
            <FolderOpen size={14} className="relative" />
            <span className="relative">{busy ? stage || "Exporting…" : isAvx ? "Choose folder & Save .AVX" : `Export .${format.toUpperCase()}`}</span>
          </button>
        </div>
      </div>

      {/* ===== Body 3 kolom ===== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[288px_minmax(0,1fr)_324px] lg:p-4">
        {/* ---- Kiri: format ---- */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-[#151517] p-3">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e78]" />
            <input
              value={fq}
              onChange={(e) => setFq(e.target.value)}
              placeholder="Search format… png, print, vector"
              className="h-9 w-full rounded-xl border border-white/[0.07] bg-[#0e0e10] pl-8 pr-3 text-[12px] text-white outline-none placeholder:text-[#4a4a52] focus:border-[#2f7cf6]"
            />
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
            {GROUPS.map((g) => {
              const list = visibleFormats.filter((f) => f.group === g);
              if (list.length === 0) return null;
              return (
                <div key={g}>
                  <div className="mb-1.5 flex items-baseline justify-between px-1">
                    <div className="avero-micro">{g === "Project" ? "Project - Avero" : g}</div>
                    <div className="font-mono text-[10px] text-[#4a4a52]">{GROUP_HINT[g]}</div>
                  </div>
                  <div className="space-y-1.5">
                    {list.map((f) => {
                      const active = format === f.id;
                      const avxCard = f.id === "avx";
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFormat(f.id)}
                          className={clsx(
                            "group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-150",
                            active
                              ? avxCard
                                ? "border-[#2f7cf6] bg-gradient-to-r from-[#2f7cf6]/25 to-[#19c2e0]/15 shadow-[0_0_20px_rgba(47,124,246,0.3)]"
                                : "border-[#2f7cf6]/70 bg-[#2f7cf6]/[0.12] shadow-[0_0_16px_rgba(47,124,246,0.22)]"
                              : "border-white/[0.06] bg-[#0e0e10] hover:-translate-y-px hover:border-white/[0.14] hover:bg-[#1a1a1e]",
                          )}
                        >
                          {avxCard ? (
                            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-black">
                              <img src="/logo.png" alt="Avero" className="h-full w-full object-cover" />
                            </span>
                          ) : (
                            <span
                              className={clsx(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-mono text-[10px] font-bold",
                                active
                                  ? "border-[#2f7cf6]/50 bg-[#2f7cf6]/20 text-white"
                                  : "border-white/[0.07] bg-white/[0.04] text-[#8fb6f5] group-hover:text-white",
                              )}
                            >
                              {f.label.slice(0, 4)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[12px] font-semibold text-white">
                                {avxCard ? "AVX - Avero Project Design" : `${f.label} · .${f.id}`}
                              </span>
                              {active && <BadgeCheck size={13} className="shrink-0 text-[#8fb6f5]" />}
                            </span>
                            <span className="block truncate text-[11px] text-[#8f8f98]">{avxCard ? "Full project · layers kept · icon Avero asli" : f.desc}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[9.5px]">
                              {avxCard ? (
                                <>
                                  <span className="rounded-md bg-[#2f7cf6] px-1.5 py-px font-bold text-white">PROJECT</span>
                                  <span className="rounded-md bg-white/[0.07] px-1.5 py-px text-[#c9d8f5]">Type: Avero Project Design</span>
                                </>
                              ) : (
                                <>
                                  {f.rust ? (
                                    <span className="flex items-center gap-1 rounded-md bg-[#7ad69e]/15 px-1.5 py-px font-bold text-[#7ad69e]">
                                      <Cpu size={10} /> NATIVE
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-1.5 py-px font-bold text-[#a7a7b0]">
                                      <Zap size={10} /> FAST
                                    </span>
                                  )}
                                  <span className="text-[#6e6e78]">{f.alpha ? "alpha ✓" : "no alpha"}</span>
                                </>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {visibleFormats.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[12px] text-[#6e6e78]">
                No format matches “{fq.trim()}”.
              </div>
            )}
          </div>
        </div>

        {/* ---- Tengah: preview ---- */}
        <div className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#151517]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
            <FileImage size={14} className="text-[#8fb6f5]" />
            <span className="text-[12px] font-semibold text-white">Preview</span>
            <span className="font-mono text-[10.5px] text-[#6e6e78]">
              {outW} × {outH} · {meta.label} · ±{approx}
            </span>
            <span
              className={clsx(
                "ml-auto rounded-full border px-2 py-px font-mono text-[10px]",
                tiled ? "border-[#2f7cf6]/40 bg-[#2f7cf6]/10 text-[#8fb6f5]" : "border-white/10 bg-white/[0.04] text-[#a7a7b0]",
              )}
            >
              {tiled ? "tiled UHD path" : "direct path"}
            </span>
          </div>
          <div className="grid flex-1 place-items-center overflow-auto bg-[radial-gradient(ellipse_at_top,#1c1e24_0%,#101012_60%)] p-5">
            {preview ? (
              <div className="avero-fade-in">
                <div
                  className="overflow-hidden rounded-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                  style={{
                    backgroundImage: effMatte === "none" ? "conic-gradient(#232327 0 25%, #141416 0 50%, #232327 0 75%, #141416 0)" : undefined,
                    backgroundSize: "18px 18px",
                    backgroundColor: effMatte === "white" ? "#fff" : effMatte === "black" ? "#000" : undefined,
                  }}
                >
                  <img src={preview} alt="Export preview" className="block max-h-[52vh] max-w-[min(100%,720px)] object-contain" />
                </div>
                <div className="mt-3 text-center font-mono text-[11px] text-[#6e6e78]">
                  {outFile} · {outW} × {outH}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <FileImage size={22} className="text-[#4a4a52]" />
                </div>
                <div className="mt-3 text-[13px] font-semibold text-white">No preview available</div>
                <div className="mt-1 text-[12px] text-[#6e6e78]">Open an image or create a project first.</div>
              </div>
            )}
          </div>
          <div className="space-y-2 border-t border-white/[0.06] bg-[#101012] px-4 py-3">
            {isAvx ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#2f7cf6]/30 bg-gradient-to-r from-[#2f7cf6]/15 to-[#19c2e0]/10 px-3 py-2.5">
                <img src="/logo.png" alt="Avero" className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover" />
                <div className="text-[11.5px] leading-relaxed text-[#c9d8f5]">
                  <span className="font-semibold text-white">Avero Project Design (.avx)</span> - keeps every layer, mask, effect &amp;
                  detected object. Type column in Explorer shows{" "}
                  <span className="rounded bg-white/10 px-1 font-mono text-[10.5px] text-white">Avero Project Design</span> with the authentic
                  Avero icon.
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-[#8f8f98]">
                <Sparkles size={13} className="shrink-0 text-[#8fb6f5]" />
                <span className="truncate">
                  {format === "ico"
                    ? "Icons are capped at 256px by the spec - larger canvases are fitted down automatically."
                    : meta.rust
                      ? `Encoded by the native engine into a real ${meta.label} file. Requires the desktop app.`
                      : `${meta.desc}. Fast browser encode, alpha ${meta.alpha ? "kept" : "flattened"}.`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ---- Kanan: settings ---- */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-white/[0.07] bg-[#151517] p-4">
            <div className="avero-micro mb-1.5">File name</div>
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled"
                maxLength={80}
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#0e0e10] px-3 text-[13px] text-white outline-none placeholder:text-[#4a4a52] focus:border-[#2f7cf6]"
              />
              <span className="shrink-0 rounded-lg border border-[#2f7cf6]/30 bg-[#2f7cf6]/10 px-2 py-2 font-mono text-[11px] font-bold text-[#8fb6f5]">
                .{format}
              </span>
            </div>
            <div className="mt-2 truncate rounded-lg border border-white/[0.06] bg-[#0e0e10] px-2.5 py-2 font-mono text-[10.5px] text-[#8f8f98]">
              → {outFile} · {outW}×{outH} · ±{approx}
            </div>

            {showQuality && !isAvx && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-[#a7a7b0]">Quality</span>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-white">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="avero-slider w-full"
                  style={{ ["--avero-fill" as string]: `${((quality - 10) / 90) * 100}%` }}
                />
              </div>
            )}

            {!isAvx && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-[#a7a7b0]">Scale</span>
                  <span className="rounded-md bg-white/[0.06] px-1.5 py-px font-mono text-[11px] text-white">{scale}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={400}
                  step={5}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="avero-slider w-full"
                  style={{ ["--avero-fill" as string]: `${((scale - 10) / 390) * 100}%` }}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[25, 50, 100, 200, 400].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScale(s)}
                      className={clsx(
                        "rounded-lg px-2.5 py-1 font-mono text-[10.5px] transition",
                        scale === s ? "bg-[#2f7cf6] font-bold text-white" : "bg-white/[0.06] text-[#a7a7b0] hover:bg-white/[0.1] hover:text-white",
                      )}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
                {tiled && (
                  <div className="mt-2 rounded-lg border border-white/[0.07] bg-[#0e0e10] px-2.5 py-2 text-[10.5px] leading-snug text-[#8f8f98]">
                    UHD output renders tiled in 512px blocks - RAM stays flat.
                  </div>
                )}
              </div>
            )}

            {isAvx && (
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0e0e10] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                  <Layers size={13} className="text-[#8fb6f5]" /> What .avx stores
                </div>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[#8f8f98]">
                  <li>· Layers + masks + blend &amp; opacity intact</li>
                  <li>· Adjustments, filters, transforms, guides</li>
                  <li>· Detected objects &amp; selection mask</li>
                  <li>· Checksum-verified, zero-loss reopen</li>
                </ul>
              </div>
            )}

            {!isAvx && (
              <div className="mt-4">
                <div className="avero-micro mb-1.5">Background</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["none", "white", "black"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMatte(m)}
                      disabled={!meta.alpha && m === "none"}
                      className={clsx(
                        "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11.5px] transition disabled:opacity-40",
                        matte === m
                          ? "border-[#2f7cf6] bg-[#2f7cf6]/15 text-white"
                          : "border-white/[0.07] bg-[#0e0e10] text-[#a7a7b0] hover:border-white/20 hover:text-white",
                      )}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{
                          background: m === "none" ? "conic-gradient(#555 0 25%, #222 0 50%, #555 0 75%, #222 0)" : m === "white" ? "#fff" : "#000",
                        }}
                      />
                      {m === "none" ? "Alpha" : m === "white" ? "White" : "Black"}
                    </button>
                  ))}
                </div>
                {needsMatteFor(format) && (
                  <div className="mt-1.5 text-[10.5px] leading-snug text-[#6e6e78]">
                    {meta.label} has no alpha channel - white matte is applied automatically.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#151517] p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
              <FolderOpen size={14} className="text-[#8fb6f5]" /> Where it goes
            </div>
            <div className="mt-1.5 text-[11.5px] leading-relaxed text-[#8f8f98]">
              Pressing <span className="font-semibold text-white">Export</span> opens your file manager - pick any folder, rename on the
              spot, press Save. The file is then revealed in Explorer automatically.
            </div>
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0e0e10] px-3 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#2f7cf6]/15 text-[#8fb6f5]">
                <Download size={13} />
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#c9c9d1]">{outFile}</span>
              <span className="shrink-0 font-mono text-[10px] text-[#6e6e78]">±{approx}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Footer ===== */}
      <div className="flex shrink-0 items-center gap-3 border-t border-white/[0.07] bg-[#141416] px-4 py-3">
        <span className="hidden truncate font-mono text-[11px] text-[#6e6e78] md:block">
          {outFile} · {outW} × {outH}
        </span>
        <span className="hidden items-center gap-1.5 font-mono text-[10.5px] text-[#4a4a52] lg:flex">
          <FolderOpen size={12} /> file manager opens at your file after export
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[12px] text-[#c9c9d1] transition hover:bg-white/[0.08] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={doExport}
            disabled={busy}
            className="avero-btn-primary avero-lift relative flex items-center gap-2 overflow-hidden rounded-lg px-6 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_rgba(47,124,246,0.35)] disabled:opacity-60"
          >
            {busy && <span className="avero-shimmer absolute inset-0" />}
            <Download size={14} className="relative" />
            <span className="relative">{busy ? stage || "Exporting…" : isAvx ? "Save .AVX" : "Export"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
