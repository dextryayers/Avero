import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileBox } from "lucide-react";
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

// Dedicated Export page: one Export button opens this full page.
// Universal formats, pro print formats (native Rust encoders), vector
// wrapper, and the special AVX project format live side by side with a
// live preview, honest size estimate, and quality/matte/scale controls.
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

  const meta = formatMeta(format);
  const effMatte = needsMatteFor(format) && matte === "none" ? "white" : matte;
  const outW = Math.max(1, Math.round(doc.width * (scale / 100)));
  const outH = Math.max(1, Math.round(doc.height * (scale / 100)));
  const showQuality = usesQualityFor(format);
  const approx = useMemo(
    () => formatBytes(estimateBytes(format, outW, outH, quality)),
    [format, outW, outH, quality],
  );

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
      const sc = Math.min(1, 480 / Math.max(comp.width, comp.height));
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
  }, [effMatte]);

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
    setBusy(true);
    setStage("Preparing export");
    try {
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#101012]">
      <div className="flex shrink-0 items-center gap-3 border-b border-[#2c2c31] bg-gradient-to-r from-[#16161a] via-[#1c1c1f] to-[#16161a] px-4 py-2.5">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#2f7cf6] to-[#19c2e0] text-white shadow-[0_0_16px_rgba(47,124,246,0.45)]">
          <Download size={15} />
        </div>
        <div>
          <div className="text-[13px] font-bold text-white">Export</div>
          <div className="font-mono text-[10.5px] text-[#6e6e78]">
            {outW} x {outH} px · about {approx}
            {tiled ? " · tiled UHD path" : " · direct path"}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={onBack} className="rounded-md bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]">
            Cancel
          </button>
          <button onClick={doExport} disabled={busy} className="avero-btn-primary rounded-md px-5 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            {busy ? stage || "Exporting..." : `Export .${format.toUpperCase()}`}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 lg:grid-cols-[300px_1fr_300px]">
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="avero-micro mb-1.5">{g === "Project" ? "Project" : g}</div>
              <div className="space-y-1">
                {EXPORT_FORMATS.filter((f) => f.group === g).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={clsx(
                      "avero-lift flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-all",
                      format === f.id
                        ? "border-[#2f7cf6] bg-[#2f7cf6]/10 shadow-[0_0_12px_rgba(47,124,246,0.25)]"
                        : "border-[#2c2c31] bg-[#161618] hover:-translate-y-px hover:border-[#3a3a41] hover:bg-[#1a1a1e]",
                    )}
                  >
                    {f.id === "avx" ? (
                      <FileBox size={14} className={format === f.id ? "text-white" : "text-[#8fb6f5]"} />
                    ) : (
                      <span className={clsx("font-mono text-[11px] font-bold", format === f.id ? "text-white" : "text-[#8fb6f5]")}>
                        {f.label}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-[#c9c9d1]">{f.id === "avx" ? "AVX Project" : f.desc}</span>
                      <span className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-[#6e6e78]">
                        {f.id === "avx" ? (
                          <span className="rounded bg-[#2f7cf6]/20 px-1 py-px text-[9px] font-bold text-[#8fb6f5]">PROJECT</span>
                        ) : (
                          <>
                            {f.rust && <span className="rounded bg-[#7ad69e]/15 px-1 py-px text-[9px] font-bold text-[#7ad69e]">NATIVE</span>}
                            {!f.rust && <span className="rounded bg-[#232327] px-1 py-px text-[9px] font-bold text-[#a7a7b0]">FAST</span>}
                            <span>{f.alpha ? "alpha" : "no alpha"}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-[#2c2c31] bg-[#161618] p-4">
          {preview ? (
            <div
              className="rounded border border-[#2c2c31]"
              style={{
                backgroundImage:
                  "conic-gradient(#232327 0 25%, #161618 0 50%, #232327 0 75%, #161618 0)",
                backgroundSize: "16px 16px",
              }}
            >
              <img src={preview} alt="Export preview" className="block max-h-[46vh] max-w-full rounded object-contain" />
            </div>
          ) : (
            <div className="text-[12px] text-[#6e6e78]">No preview available. Open an image first.</div>
          )}
          <div className="mt-3 font-mono text-[11px] text-[#6e6e78]">
            {outW} x {outH} · {meta.label} · about {approx}
          </div>
          {format === "ico" && (
            <div className="mt-2 max-w-[420px] rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 py-1.5 text-center text-[10.5px] leading-snug text-[#a7a7b0]">
              Icons are capped at 256px by the format spec. Larger canvases are fitted down automatically.
            </div>
          )}
          {meta.rust && (
            <div className="mt-2 max-w-[420px] rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 py-1.5 text-center text-[10.5px] leading-snug text-[#a7a7b0]">
              Encoded by the native engine into a real {meta.label} file. Requires the desktop app.
            </div>
          )}
          {format === "avx" && (
            <div className="mt-2 max-w-[420px] rounded-md border border-[#2f7cf6]/40 bg-[#2f7cf6]/10 px-2.5 py-1.5 text-center text-[10.5px] leading-snug text-[#c9d8f5]">
              The special AVX format keeps every layer, mask, effect and detected object. Reopen it anytime with zero loss.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="avero-micro mb-1 block">File name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[#2c2c31] bg-[#161618] px-3 py-2 text-[12.5px] text-white outline-none focus:border-[#2f7cf6]"
            />
          </label>
          {showQuality && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                Quality <span className="font-mono text-white">{quality}%</span>
              </div>
              <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
            </div>
          )}
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
              Scale <span className="font-mono text-white">{scale}%</span>
            </div>
            <input type="range" min={10} max={400} step={5} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[25, 50, 100, 200, 400].map((s) => (
                <button key={s} onClick={() => setScale(s)} className={clsx("rounded px-2 py-0.5 font-mono text-[10px]", scale === s ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white")}>
                  {s}%
                </button>
              ))}
            </div>
            {tiled && (
              <div className="mt-1.5 rounded-md border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[10.5px] leading-snug text-[#a7a7b0]">
                UHD output renders through the tiled path in 512px blocks to keep RAM flat.
              </div>
            )}
          </div>
          <div>
            <div className="avero-micro mb-1.5">Transparent background</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(["none", "white", "black"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMatte(m)}
                  disabled={!meta.alpha && m === "none"}
                  className={clsx(
                    "rounded-md border px-2 py-1.5 text-[11px] disabled:opacity-40",
                    matte === m ? "border-[#2f7cf6] bg-[#2f7cf6]/10 text-white" : "border-[#2c2c31] text-[#a7a7b0] hover:text-white",
                  )}
                >
                  {m === "none" ? "Alpha" : m === "white" ? "White" : "Black"}
                </button>
              ))}
            </div>
            {needsMatteFor(format) && (
              <div className="mt-1.5 text-[10.5px] text-[#6e6e78]">{meta.label} does not store alpha. White is used automatically.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-4 py-2.5">
        <span className="font-mono text-[11px] text-[#6e6e78]">
          {name.trim() || "Untitled"}.{format} · {outW} x {outH}
        </span>
        <span className="hidden font-mono text-[10px] text-[#4a4a52] md:block">
          file manager opens at your file after export
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={onBack} className="rounded-md bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]">
            Cancel
          </button>
          <button onClick={doExport} disabled={busy} className="avero-btn-primary relative overflow-hidden rounded-md px-5 py-2 text-[12px] font-semibold text-white disabled:opacity-50">
            {busy && <span className="avero-shimmer absolute inset-0" />}
            <span className="relative">{busy ? stage || "Exporting..." : "Export"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
