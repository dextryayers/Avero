import { useEffect, useMemo, useState } from "react";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { pickImageToOpen, pickSavePath, rustDecodeToDataUrl, rustImageInfo, rustSaveDataUrl } from "../io/tauriIo";

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open ]);

  const actions = useMemo(() => {
    const s = useEditorStore.getState();
    return [
      {
        id: "new",
        title: "New document 1920x1080",
        run: () => {
          layerManager.clear();
          s.newDocument("Untitled", 1920, 1080);
        },
      },
      {
        id: "open",
        title: "Open image PNG JPG WEBP PSD",
        run: async () => {
          const path = await pickImageToOpen();
          if (!path) return;
          const info = await rustImageInfo(path);
          const dataUrl = await rustDecodeToDataUrl(path, 2048);
          s.openDocument(path.split(/[/\\]/).pop() ?? "Image", info.width, info.height, path, info.file_size);
          layerManager.clear();
          // tunggu layer dibuat oleh store
          setTimeout(() => {
            const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
            if (!id) return;
            const img = new Image();
            img.onload = () => {
              layerManager.ensure(id, info.width, info.height);
              layerManager.drawImageToLayer(id, img, info.width, info.height);
              useEditorStore.getState().markDirty();
              useEditorStore.getState().setZoom(useEditorStore.getState().zoom);
            };
            img.src = dataUrl;
          }, 50);
        },
      },
      {
        id: "save",
        title: "Export composite PNG JPG WEBP",
        run: async () => {
          const st = useEditorStore.getState();
          const out = document.createElement("canvas");
          out.width = st.doc.width;
          out.height = st.doc.height;
          const ctx = out.getContext("2d")!;
          st.layers.forEach((l) => {
            if (!l.visible) return;
            const lc = layerManager.get(l.id);
            if (!lc) return;
            ctx.save();
            ctx.globalAlpha = l.opacity / 100;
            ctx.drawImage(lc, 0, 0);
            ctx.restore();
          });
          const dataUrl = out.toDataURL("image/png");
          const path = await pickSavePath(`${st.doc.name || "psd-studio"}.png`);
          if (!path) return;
          await rustSaveDataUrl(dataUrl, path);
          st.markClean();
        },
      },
      {
        id: "add-layer",
        title: "Add new raster layer",
        run: () => {
          const st = useEditorStore.getState();
          const l = makeLayer(`Layer ${st.layers.length + 1}`);
          layerManager.ensure(l.id, st.doc.width, st.doc.height);
          st.addLayer(l);
        },
      },
      { id: "zoom-in", title: "Zoom in", run: () => s.setZoom(s.zoom + 25) },
      { id: "zoom-out", title: "Zoom out", run: () => s.setZoom(s.zoom - 25) },
      { id: "zoom-100", title: "Zoom 100 percent", run: () => s.setZoom(100) },
      { id: "rulers", title: "Toggle rulers", run: () => s.toggleRulers() },
      { id: "brush", title: "Tool brush", run: () => s.setTool("brush") },
      { id: "eraser", title: "Tool eraser", run: () => s.setTool("eraser") },
      { id: "move", title: "Tool move", run: () => s.setTool("move") },
    ];
  }, []);

  const filtered = actions.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 p-10" onClick={onClose}>
      <div className="w-[520px] overflow-hidden rounded-lg border border-[#3e3e42] bg-[#252526] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik perintah: blur, export, open, layer..."
          className="w-full border-b border-[#3e3e42] bg-transparent px-4 py-3 text-[13px] text-white outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              filtered[0].run();
              onClose();
            }
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="max-h-[320px] overflow-y-auto p-1">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                a.run();
                onClose();
              }}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[12px] text-[#e0e0e0] hover:bg-[#0a84ff] hover:text-white"
            >
              {a.title}
              <span className="font-mono text-[10px] opacity-60">Enter</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="p-4 text-center text-[12px] text-[#a0a0a0]">Tidak ada aksi cocok</div>}
        </div>
      </div>
    </div>
  );
}
