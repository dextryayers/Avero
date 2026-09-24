import { useEditorStore } from "../stores/useEditorStore";
import { checkBackend, pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";
import { layerManager } from "../engine/layerManager";
import { useEffect, useState } from "react";
import { Bell, CloudOff, Cpu } from "lucide-react";

export default function TitleBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const doc = useEditorStore((s) => s.doc);
  const backendStatus = useEditorStore((s) => s.backendStatus);
  const backendInfo = useEditorStore((s) => s.backendInfo);
  const setBackend = useEditorStore((s) => s.setBackend);
  const openDocument = useEditorStore((s) => s.openDocument);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkBackend().then((r) => {
      setBackend(r.ok ? "online" : "web-only", r.info);
    });
  }, [setBackend]);

  async function handleOpen() {
    if (busy) return;
    setBusy(true);
    try {
      const path = await pickImageToOpen();
      if (!path) return;
      const info = await rustImageInfo(path);
      const dataUrl = await rustDecodeToDataUrl(path, 2048);
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const name = path.split(/[/\\]/).pop() ?? "Opened image";
      openDocument(name, info.width, info.height, path, info.file_size);
      // gambar dibuka akan digambar oleh CanvasArea via event custom
      window.dispatchEvent(
        new CustomEvent("psd:opened-image", { detail: { dataUrl, w: info.width, h: info.height } }),
      );
    } catch (e) {
      console.error(e);
      alert(`Gagal membuka gambar: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-10 items-center gap-2 border-b border-[#3e3e42] bg-[#252526] px-3">
      <div className="flex items-center gap-2">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-[#0a84ff] text-[11px] font-bold text-white">
          PS
        </div>
        <span className="text-[13px] font-semibold text-[#e0e0e0]">PSD Studio</span>
        <span className="rounded bg-[#2d2d2d] px-1.5 py-0.5 text-[10px] text-[#a0a0a0]">
          Fase 1 MVP
        </span>
      </div>

      <nav className="ml-4 hidden items-center gap-1 text-[12px] text-[#c5c5c5] md:flex">
        {["File", "Edit", "Image", "Layer", "Filter", "View", "Help"].map((m) => (
          <button
            key={m}
            onClick={() => {
              if (m === "File") handleOpen();
              if (m === "View") onOpenCommand();
            }}
            className="rounded px-2 py-1 hover:bg-[#3e3e42] hover:text-white"
          >
            {m}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2 text-[11px]">
        <span className="max-w-[320px] truncate text-[#c5c5c5]">
          {doc.name} {doc.dirty ? "•" : ""} {doc.width}x{doc.height}
        </span>
        <span
          title={backendInfo}
          className={`flex items-center gap-1 rounded-full px-2 py-1 ${
            backendStatus === "online"
              ? "bg-[#1f3a24] text-[#7bd88a]"
              : "bg-[#3a2a1f] text-[#e0a35a]"
          }`}
        >
          {backendStatus === "online" ? <Cpu size={12} /> : <CloudOff size={12} />}
          {backendStatus === "online" ? "Rust engine" : "Web preview"}
        </span>
        <Bell size={14} className="text-[#a0a0a0]" />
      </div>
      {/* expose handler via prop drilling sederhana */}
      <span className="hidden" data-open-handler={busy ? "busy" : "idle"} onClick={handleOpen} />
    </div>
  );
}

// Helper agar App bisa trigger open tanpa prop drilling rumit
export function useTitleBarOpen() {
  const openDocument = useEditorStore((s) => s.openDocument);
  return async function openNow() {
    const path = await pickImageToOpen();
    if (!path) return;
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    const name = path.split(/[/\\]/).pop() ?? "Opened image";
    openDocument(name, info.width, info.height, path, info.file_size);
    layerManager.clear();
    window.dispatchEvent(
      new CustomEvent("psd:opened-image", { detail: { dataUrl, w: info.width, h: info.height } }),
    );
  };
}
