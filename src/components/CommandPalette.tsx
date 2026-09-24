import { useEffect, useMemo, useState } from "react";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { useHomeStore } from "../stores/useHomeStore";
import { layerManager } from "../engine/layerManager";
import { getCompositeCanvas } from "./CanvasArea";
import {
  pickImageToOpen,
  pickSavePath,
  rustDecodeToDataUrl,
  rustImageInfo,
  rustSaveDataUrl,
} from "../io/tauriIo";

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const actions = useMemo(() => {
    const s = useEditorStore.getState();
    return [
      {
        id: "new",
        title: "New document 1920x1080",
        run: () => {
          layerManager.clear();
          s.newDocument("Untitled", 1920, 1080);
          useHomeStore.getState().setHome(false);
        },
      },
      {
        id: "home",
        title: "Go to Home screen",
        run: () => useHomeStore.getState().setHome(true),
      },
      {
        id: "save-avx",
        title: "Simpan proyek .avx (Ctrl+S)",
        run: () => window.dispatchEvent(new Event("avero:save-avx")),
      },
      {
        id: "open-avx",
        title: "Buka proyek .avx",
        run: () => window.dispatchEvent(new Event("avero:open-avx")),
      },
      {
        id: "export",
        title: "Export gambar PNG JPG WEBP BMP SVG TIFF (Ctrl+E)",
        run: () => window.dispatchEvent(new Event("avero:open-export")),
      },
      {
        id: "open",
        title: "Open image PNG JPG WEBP PSD",
        run: async () => {
          const path = await pickImageToOpen();
          if (!path) return;
          const info = await rustImageInfo(path);
          const dataUrl = await rustDecodeToDataUrl(path, 2048);
          const name = path.split(/[/\\]/).pop() ?? "Image";
          s.openDocument(name, info.width, info.height, path, info.file_size);
          useHomeStore.getState().pushRecent({
            name,
            path,
            thumb: dataUrl,
            full: dataUrl.length < 2_500_000 ? dataUrl : null,
            w: info.width,
            h: info.height,
            size: info.file_size,
          });
          useHomeStore.getState().setHome(false);
          layerManager.clear();
          // tunggu layer dibuat oleh store
          setTimeout(() => {
            const id =
              useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
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
        id: "save-legacy",
        title: "Export cepat PNG komposit (dengan adjust+filter)",
        run: async () => {
          const st = useEditorStore.getState();
          const comp = getCompositeCanvas();
          const dataUrl = comp
            ? comp.toDataURL("image/png")
            : (() => {
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
                return out.toDataURL("image/png");
              })();
          const path = await pickSavePath(`${st.doc.name || "avero-studio"}.png`);
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
      {
        id: "zoom-fit",
        title: "Zoom fit ke layar",
        run: () => window.dispatchEvent(new Event("avero:fit-zoom")),
      },
      { id: "rulers", title: "Toggle rulers", run: () => s.toggleRulers() },
      {
        id: "guides-toggle",
        title: "Toggle guides",
        run: () => useProStore.getState().toggleGuides(),
      },
      {
        id: "guides-h",
        title: "Tambah guide horizontal tengah",
        run: () =>
          useProStore.getState().addGuide("h", Math.round(useEditorStore.getState().doc.height / 2)),
      },
      {
        id: "guides-v",
        title: "Tambah guide vertikal tengah",
        run: () =>
          useProStore.getState().addGuide("v", Math.round(useEditorStore.getState().doc.width / 2)),
      },
      { id: "guides-clear", title: "Hapus semua guides", run: () => useProStore.getState().clearGuides() },
      { id: "brush", title: "Tool brush (B)", run: () => s.setTool("brush") },
      { id: "heal", title: "Tool spot heal (J)", run: () => s.setTool("spot-heal") },
      { id: "eraser", title: "Tool eraser (E)", run: () => s.setTool("eraser") },
      { id: "clone", title: "Tool clone stamp (S)", run: () => s.setTool("clone") },
      { id: "blur", title: "Tool blur (R)", run: () => s.setTool("blur") },
      { id: "sharpen-t", title: "Tool sharpen (R)", run: () => s.setTool("sharpen") },
      { id: "smudge", title: "Tool smudge (R)", run: () => s.setTool("smudge") },
      { id: "dodge", title: "Tool dodge (O)", run: () => s.setTool("dodge") },
      { id: "burn", title: "Tool burn (O)", run: () => s.setTool("burn") },
      { id: "sponge", title: "Tool sponge (O)", run: () => s.setTool("sponge") },
      { id: "fill", title: "Tool paint bucket fill (G)", run: () => s.setTool("fill") },
      { id: "pen", title: "Tool pen (P)", run: () => s.setTool("pen") },
      { id: "line", title: "Tool line (P)", run: () => s.setTool("line") },
      { id: "crop", title: "Tool crop (C)", run: () => s.setTool("crop") },
      { id: "gradient", title: "Tool gradient (G)", run: () => s.setTool("gradient") },
      { id: "move", title: "Tool move / transform (V)", run: () => s.setTool("move") },
      { id: "grid", title: "Toggle grid Photoshop", run: () => useProStore.getState().toggleGrid() },
      { id: "snap", title: "Toggle snap guides/grid", run: () => useProStore.getState().toggleSnap() },
      {
        id: "layer-duplicate",
        title: "Duplikat layer aktif",
        run: () => {
          const st = useEditorStore.getState();
          const pro = useProStore.getState();
          const id = st.activeLayerId;
          const src = st.layers.find((l) => l.id === id);
          if (!id || !src) return;
          const l = makeLayer(`${src.name} copy`);
          const nl = { ...l, opacity: src.opacity, blendMode: src.blendMode, kind: src.kind };
          const sc = layerManager.get(id);
          const dc = layerManager.ensure(nl.id, st.doc.width, st.doc.height);
          if (sc) dc.getContext("2d")!.drawImage(sc, 0, 0);
          st.addLayer(nl);
          void pro;
        },
      },
      {
        id: "transform-flipv",
        title: "Flip vertikal layer aktif",
        run: () => {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (!id) return;
          const pro = useProStore.getState();
          pro.ensureTransform(id);
          const t = pro.transforms[id] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
          pro.updateTransform(id, { scaleY: t.scaleY * -1 });
        },
      },
      {
        id: "transform-rot90",
        title: "Putar layer aktif +90 derajat",
        run: () => {
          const st = useEditorStore.getState();
          const id = st.activeLayerId;
          if (!id) return;
          const pro = useProStore.getState();
          pro.ensureTransform(id);
          const t = pro.transforms[id] ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
          pro.updateTransform(id, { rotation: (t.rotation + 90) % 360 });
        },
      },
      {
        id: "sel-rect",
        title: "Tool rect select",
        run: () => {
          s.setTool("select-rect");
          useProStore.getState().setSelKind("rect");
        },
      },
      {
        id: "sel-lasso",
        title: "Tool lasso select",
        run: () => {
          s.setTool("select-lasso");
          useProStore.getState().setSelKind("lasso");
        },
      },
      {
        id: "wand",
        title: "Tool magic wand",
        run: () => {
          s.setTool("wand");
          useProStore.getState().setSelKind("wand");
        },
      },
      { id: "text", title: "Tool text", run: () => s.setTool("text") },
      {
        id: "add-adjust-bc",
        title: "Add adjustment brightness/contrast",
        run: () => useProStore.getState().addAdjustment("brightnessContrast"),
      },
      {
        id: "add-adjust-levels",
        title: "Add adjustment levels",
        run: () => useProStore.getState().addAdjustment("levels"),
      },
      {
        id: "add-adjust-exposure",
        title: "Add adjustment exposure",
        run: () => useProStore.getState().addAdjustment("exposure"),
      },
      {
        id: "add-filter-gauss",
        title: "Add filter gaussian blur",
        run: () => useProStore.getState().addFilter("gaussianBlur"),
      },
      {
        id: "add-filter-sharpen",
        title: "Add filter sharpen",
        run: () => useProStore.getState().addFilter("sharpen"),
      },
      {
        id: "add-filter-vignette",
        title: "Add filter vignette",
        run: () => useProStore.getState().addFilter("vignette"),
      },
      {
        id: "add-filter-grain",
        title: "Add filter film grain",
        run: () => useProStore.getState().addFilter("filmGrain"),
      },
      {
        id: "add-filter-tilt",
        title: "Add filter tilt shift",
        run: () => useProStore.getState().addFilter("tiltShift"),
      },
      {
        id: "add-filter-unsharp",
        title: "Add filter unsharp mask",
        run: () => useProStore.getState().addFilter("unsharpMask"),
      },
      {
        id: "add-adj-vibrance",
        title: "Add adjustment vibrance",
        run: () => useProStore.getState().addAdjustment("vibrance"),
      },
      {
        id: "add-adj-shhi",
        title: "Add adjustment shadows/highlights",
        run: () => useProStore.getState().addAdjustment("shadowsHighlights"),
      },
      {
        id: "add-adj-photo",
        title: "Add adjustment photo filter",
        run: () => useProStore.getState().addAdjustment("photoFilter"),
      },
      {
        id: "proof",
        title: "Toggle soft proofing CMYK",
        run: () => {
          const c = useProStore.getState().color;
          useProStore.getState().setColor({ proofEnabled: !c.proofEnabled });
        },
      },
    ];
  }, []);

  const filtered = actions.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 p-10"
      onClick={onClose}
    >
      <div
        className="w-[520px] overflow-hidden rounded-md border border-[#2c2c31] bg-[#1c1c1f]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik perintah: avx, export, blur, layer..."
          className="w-full border-b border-[#2c2c31] bg-transparent px-4 py-3 text-[13px] text-white outline-none"
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
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[12px] text-[#c9c9d1] hover:bg-[#2f7cf6] hover:text-white"
            >
              {a.title}
              <span className="font-mono text-[10px] opacity-60">Enter</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-center text-[12px] text-[#a7a7b0]">Tidak ada aksi cocok</div>
          )}
        </div>
      </div>
    </div>
  );
}
