import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useEditorStore } from "../stores/useEditorStore";
import { exportDataUrl, writeTextFile, type ExportFormat } from "../io/projectIo";
import { rustSaveDataUrl } from "../io/tauriIo";
import clsx from "clsx";

const FORMATS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: "png", label: "PNG", desc: "Lossless, transparan" },
  { id: "jpg", label: "JPG", desc: "Foto kecil, tanpa alpha" },
  { id: "jpeg", label: "JPEG", desc: "Sama dengan JPG" },
  { id: "webp", label: "WEBP", desc: "Modern, kecil" },
  { id: "bmp", label: "BMP", desc: "Tanpa kompresi" },
  { id: "tiff", label: "TIFF", desc: "Cetak dan arsip" },
  { id: "svg", label: "SVG", desc: "Vektor pembungkus raster" },
];

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const doc = useEditorStore((s) => s.doc);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(100);
  const [matte, setMatte] = useState<"none" | "white" | "black">("none");
  const [name, setName] = useState(doc.name.replace(/\.[a-z0-9]+$/i, "") || "Untitled");
  const [busy, setBusy] = useState(false);

  const needsMatte = format === "jpg" || format === "jpeg";
  const effMatte = needsMatte && matte === "none" ? "white" : matte;
  const outW = Math.max(1, Math.round(doc.width * (scale / 100)));
  const outH = Math.max(1, Math.round(doc.height * (scale / 100)));
  const showQuality = format === "jpg" || format === "jpeg" || format === "webp";

  const approx = useMemo(() => {
    const px = outW * outH;
    let bytes = px * 4;
    if (format === "png") bytes = px * 1.1;
    else if (format === "bmp") bytes = px * 3 + 54;
    else if (format === "svg") bytes = px * 1.4;
    else if (format === "tiff") bytes = px * 2.2;
    else bytes = px * 0.28 * (quality / 90);
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }, [outW, outH, format, quality]);

  async function doExport() {
    if (busy) return;
    setBusy(true);
    try {
      const { dataUrl, ext } = exportDataUrl({
        format,
        quality,
        scale,
        matte: effMatte,
        fileName: name,
      });
      const fileName = `${name.trim() || "Untitled"}.${ext}`;
      if (isTauri()) {
        const path = await save({
          defaultPath: fileName,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (!path) return;
        if (format === "svg") {
          const b64 = dataUrl.split(",")[1] ?? "";
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const text = new TextDecoder().decode(bytes);
          await writeTextFile(path, text);
        } else {
          await rustSaveDataUrl(dataUrl, path);
        }
      } else {
        if (format === "svg" || format === "bmp" || format === "tiff") {
          if (format !== "svg") {
            alert("Format ini butuh aplikasi desktop. Di pratinjau web, PNG dipakai sebagai ganti.");
            const png = exportDataUrl({ format: "png", quality, scale, matte: effMatte, fileName: name });
            triggerDownload(png.dataUrl, `${name.trim() || "Untitled"}.png`);
            return;
          }
        }
        triggerDownload(dataUrl, fileName);
      }
      onClose();
    } catch (e) {
      alert(`Gagal export: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function triggerDownload(dataUrl: string, fileName: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-[560px] max-w-full overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[#2c2c31] px-5 py-3.5">
          <Download size={16} className="text-[#8fb6f5]" />
          <div>
            <div className="text-[13px] font-bold text-white">Export Gambar</div>
            <div className="font-mono text-[10.5px] text-[#6e6e78]">
              {outW} x {outH} px, perkiraan {approx}
            </div>
          </div>
          <button onClick={onClose} className="ml-auto rounded p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 p-5">
          <div>
            <div className="avero-micro mb-2">Format</div>
            <div className="space-y-1">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left",
                    format === f.id
                      ? "border-[#2f7cf6] bg-[#2f7cf6]/10"
                      : "border-[#2c2c31] bg-[#161618] hover:border-[#3a3a41]",
                  )}
                >
                  <span className={clsx("font-mono text-[11px] font-bold", format === f.id ? "text-white" : "text-[#8fb6f5]")}>
                    {f.label}
                  </span>
                  <span className="text-[11px] text-[#6e6e78]">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="avero-micro mb-1 block">Nama file</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-[#2c2c31] bg-[#161618] px-3 py-2 text-[12.5px] text-white outline-none focus:border-[#2f7cf6]"
              />
            </label>
            {showQuality && (
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                  Kualitas <span className="font-mono text-white">{quality}%</span>
                </div>
                <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
              </div>
            )}
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-[#a7a7b0]">
                Skala <span className="font-mono text-white">{scale}%</span>
              </div>
              <input type="range" min={10} max={400} step={5} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
              <div className="mt-1 flex gap-1.5">
                {[25, 50, 100, 200].map((s) => (
                  <button key={s} onClick={() => setScale(s)} className={clsx("rounded px-2 py-0.5 font-mono text-[10px]", scale === s ? "bg-[#2f7cf6] text-white" : "bg-[#232327] text-[#a7a7b0] hover:text-white")}>
                    {s}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="avero-micro mb-1.5">Latar transparan</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["none", "white", "black"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMatte(m)}
                    className={clsx(
                      "rounded-md border px-2 py-1.5 text-[11px]",
                      matte === m ? "border-[#2f7cf6] bg-[#2f7cf6]/10 text-white" : "border-[#2c2c31] text-[#a7a7b0] hover:text-white",
                    )}
                  >
                    {m === "none" ? "Alpha" : m === "white" ? "Putih" : "Hitam"}
                  </button>
                ))}
              </div>
              {needsMatte && (
                <div className="mt-1.5 text-[10.5px] text-[#6e6e78]">JPG tidak menyimpan alpha. Putih dipakai otomatis.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-5 py-3.5">
          <span className="font-mono text-[11px] text-[#6e6e78]">
            {outW} x {outH} .{format}
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-md bg-[#232327] px-4 py-2 text-[12px] text-white hover:bg-[#2c2c31]">
              Batal
            </button>
            <button
              onClick={doExport}
              disabled={busy}
              className="avero-btn-primary rounded-md px-5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Mengekspor..." : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
