import { useEffect, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { rustPsdLayers, rustRawInfo, type PsdLayerInfo } from "../io/tauriIo";
import { useProStore } from "../stores/useProStore";

export default function PsdInfo() {
  const filePath = useEditorStore((s) => s.doc.filePath);
  const [layers, setLayers] = useState<PsdLayerInfo[] | null>(null);
  const [note, setNote] = useState<string>("");
  const setRaw = useProStore((s) => s.setRaw);

  useEffect(() => {
    if (!filePath) {
      setLayers(null);
      setNote("");
      return;
    }
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".psd")) {
      rustPsdLayers(filePath)
        .then((l) => {
          setLayers(l);
          setNote(
            `${l.length} layer terbaca dari PSD. Import multi-layer penuh masuk Fase 5, saat ini flatten composite + metadata.`,
          );
        })
        .catch((e) => setNote(`PSD info gagal: ${String(e)}`));
    } else {
      setLayers(null);
      rustRawInfo(filePath)
        .then((r) => {
          if (r.is_raw) {
            setNote(r.note);
            setRaw({ isRaw: true, fileName: filePath.split(/[/\\]/).pop() ?? filePath });
          } else {
            setNote("");
            setRaw({ isRaw: false, fileName: null });
          }
        })
        .catch(() => {});
    }
  }, [filePath, setRaw]);

  if (!note && (!layers || layers.length === 0)) return null;
  return (
    <div className="border-b border-[#2c2c31] bg-[#1c1c1f] p-2 text-[11px] text-[#c9c9d1]">
      {note && <div className="mb-1">{note}</div>}
      {layers && layers.length > 0 && (
        <div className="max-h-28 overflow-y-auto font-mono text-[10px]">
          {layers.slice(0, 24).map((l) => (
            <div key={l.index} className="flex justify-between gap-2">
              <span className="truncate">
                {l.index}: {l.name}
              </span>
              <span>
                {l.width}x{l.height} {l.visible ? "" : "(hidden)"}
              </span>
            </div>
          ))}
          {layers.length > 24 && <div>... +{layers.length - 24} lagi</div>}
        </div>
      )}
    </div>
  );
}
