import { useEffect, useRef, useState } from "react";
import { checkBackend, pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";
import { openAvxProject, saveAvxProject } from "../io/projectIo";
import { layerManager } from "../engine/layerManager";
import { useEditorStore } from "../stores/useEditorStore";
import { useHomeStore } from "../stores/useHomeStore";
import { useProStore } from "../stores/useProStore";
import { House, Search } from "lucide-react";
import clsx from "clsx";
import { MENUS } from "../app/menus";


export default function TitleBar({
  onOpenCommand,
  onOpenExport,
  onHome,
}: {
  onOpenCommand: () => void;
  onOpenExport: () => void;
  onHome: () => void;
}) {
  const doc = useEditorStore((s) => s.doc);
  const setBackend = useEditorStore((s) => s.setBackend);
  const openDocument = useEditorStore((s) => s.openDocument);
  const [busy, setBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    checkBackend().then((r) => {
      setBackend(r.ok ? "online" : "web-only", r.info);
    });
  }, [setBackend]);

  useEffect(() => {
    function close() {
      setOpenMenu(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function openPath(path: string) {
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const name = path.split(/[/\\]/).pop() ?? "Opened image";
    openDocument(name, info.width, info.height, path, info.file_size);
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
    window.dispatchEvent(
      new CustomEvent("avero:opened-image", { detail: { dataUrl, w: info.width, h: info.height } }),
    );
  }

  useEffect(() => {
    function onOpenPath(e: Event) {
      const path = (e as CustomEvent).detail as string;
      if (!path || busy) return;
      setBusy(true);
      openPath(path)
        .catch((err) => {
          console.error(err);
          alert(`Gagal membuka gambar: ${String(err)}`);
        })
        .finally(() => setBusy(false));
    }
    window.addEventListener("avero:open-path", onOpenPath);
    return () => window.removeEventListener("avero:open-path", onOpenPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // Shortcut global memanggil aksi menu lewat event ini
  const runActionRef = useRef(runAction);
  runActionRef.current = runAction;
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) runActionRef.current(detail);
    };
    window.addEventListener("avero:action", h);
    return () => window.removeEventListener("avero:action", h);
  }, []);

  async function handleOpen() {
    if (busy) return;
    setBusy(true);
    try {
      const path = await pickImageToOpen();
      if (!path) return;
      await openPath(path);
    } catch (e) {
      console.error(e);
      alert(`Gagal membuka gambar: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function runAction(a: string) {
    setOpenMenu(null);
    const ed = useEditorStore.getState();
    const pro = useProStore.getState();
    const pick = async () => {
      const { pickSavePath, rustSaveDataUrl } = await import("../io/tauriIo");
      const { getCompositeCanvas } = await import("./CanvasArea");
      const comp = getCompositeCanvas();
      const dataUrl = comp?.toDataURL("image/png") ?? "";
      const path = await pickSavePath(`${ed.doc.name || "avero-studio"}.png`);
      if (path && dataUrl) await rustSaveDataUrl(dataUrl, path);
    };
    switch (a) {
      case "home":
        onHome();
        break;
      case "open":
        handleOpen();
        break;
      case "open-avx":
        openAvxProject().catch((e) => alert(`Gagal membuka proyek: ${String(e)}`));
        break;
      case "save-avx":
        saveAvxProject(false).catch((e) => alert(`Gagal menyimpan proyek: ${String(e)}`));
        break;
      case "save-avx-as":
        saveAvxProject(true).catch((e) => alert(`Gagal menyimpan proyek: ${String(e)}`));
        break;
      case "export":
        onOpenExport();
        break;
      case "export-png":
        pick().catch((e) => alert(String(e)));
        break;
      case "new-doc":
        layerManager.clear();
        ed.newDocument("Untitled", 1920, 1080);
        useHomeStore.getState().setHome(true);
        break;
      case "close-doc":
        useHomeStore.getState().setHome(true);
        break;
      case "palette":
        onOpenCommand();
        break;
      case "undo": {
        const e = ed.undoMeta();
        if (e) {
          layerManager.restore(e.layerId, e.snapshot);
          if (e.maskSnapshot) layerManager.restoreMask(e.layerId, e.maskSnapshot);
          ed.markDirty();
          pro.bumpHistogram();
        }
        break;
      }
      case "redo":
        ed.redoMeta();
        break;
      case "fit":
        window.dispatchEvent(new Event("avero:fit-zoom"));
        break;
      case "zoom100":
        ed.setZoom(100);
        break;
      case "zoom200":
        ed.setZoom(200);
        break;
      case "zoom50":
        ed.setZoom(50);
        break;
      case "zoom-in":
        ed.setZoom(Math.min(3200, ed.zoom + 25));
        break;
      case "zoom-out":
        ed.setZoom(Math.max(1, ed.zoom - 25));
        break;
      case "rulers":
        ed.toggleRulers();
        break;
      case "grid":
        pro.toggleGrid();
        break;
      case "snap":
        pro.toggleSnap();
        break;
      case "guides":
        pro.toggleGuides();
        break;
      case "nodegraph":
        import("../stores/useNodeStore").then(({ useNodeStore }) => {
          useNodeStore.getState().toggle();
          if (useNodeStore.getState().enabled) useNodeStore.getState().autoFromStack();
        });
        break;
      case "add-layer": {
        import("../stores/useEditorStore").then(({ makeLayer }) => {
          const l = makeLayer(`Layer ${ed.layers.length + 1}`);
          layerManager.ensure(l.id, ed.doc.width, ed.doc.height);
          ed.addLayer(l);
        });
        break;
      }
      case "dup-layer":
      case "layer-copy": {
        const id = ed.activeLayerId;
        const src = ed.layers.find((l) => l.id === id);
        if (src) {
          import("../stores/useEditorStore").then(({ makeLayer }) => {
            const l = makeLayer(`${src.name} copy`);
            const nl = { ...l, opacity: src.opacity, blendMode: src.blendMode, kind: src.kind };
            const sc = layerManager.get(src.id);
            const dc = layerManager.ensure(nl.id, ed.doc.width, ed.doc.height);
            if (sc) dc.getContext("2d")!.drawImage(sc, 0, 0);
            ed.addLayer(nl);
          });
        }
        break;
      }
      case "layer-cut":
        onOpenCommand();
        break;
      case "del-layer":
        if (ed.activeLayerId && ed.layers.length > 1) ed.removeLayer(ed.activeLayerId);
        break;
      case "layer-up":
        if (ed.activeLayerId) ed.moveLayer(ed.activeLayerId, 1);
        break;
      case "layer-down":
        if (ed.activeLayerId) ed.moveLayer(ed.activeLayerId, -1);
        break;
      case "layer-top":
        if (ed.activeLayerId) {
          for (let i = 0; i < 99; i++) ed.moveLayer(ed.activeLayerId, 1);
        }
        break;
      case "layer-bottom":
        if (ed.activeLayerId) {
          for (let i = 0; i < 99; i++) ed.moveLayer(ed.activeLayerId, -1);
        }
        break;
      case "merge-down":
      case "merge-all":
      case "flatten":
      case "group":
      case "add-mask":
      case "clip-mask":
      case "lock-layer":
      case "layer-opacity":
      case "blend-mode":
      case "select-mask":
      case "color-range":
      case "select-subject":
      case "content-aware":
      case "clear-fill":
      case "fill-fg":
      case "fill-bg":
      case "trim":
      case "prefs":
      case "histogram":
      case "tips":
      case "filter-gallery":
      case "img-size":
      case "canvas-size":
        onOpenCommand();
        break;
      case "mode-8":
        pro.setColor({ bitDepth: 8 });
        break;
      case "mode-16":
        pro.setColor({ bitDepth: 16 });
        break;
      case "proof": {
        const c = pro.color;
        pro.setColor({ proofEnabled: !c.proofEnabled });
        break;
      }
      case "cut":
        window.dispatchEvent(new CustomEvent("avero:clip", { detail: "cut" }));
        break;
      case "copy":
        window.dispatchEvent(new CustomEvent("avero:clip", { detail: "copy" }));
        break;
      case "paste":
        window.dispatchEvent(new CustomEvent("avero:clip", { detail: "paste" }));
        break;
      case "auto-tone":
      case "auto-contrast":
      case "auto-color":
        pro.addAdjustment("autoContrast");
        break;
      case "invert":
      case "a-invert":
        pro.addAdjustment("invert");
        break;
      case "desaturate":
        pro.addAdjustment("blackWhite");
        break;
      case "threshold":
      case "a-threshold":
        pro.addAdjustment("threshold");
        break;
      case "posterize":
      case "a-posterize":
        pro.addAdjustment("posterize");
        break;
      case "sel-all":
      case "sel-none":
      case "sel-reselect":
      case "sel-inverse":
      case "sel-feather":
        window.dispatchEvent(new CustomEvent("avero:select", { detail: a }));
        break;
      case "sel-rect":
        ed.setTool("select-rect");
        pro.setSelKind("rect");
        break;
      case "sel-lasso":
        ed.setTool("select-lasso");
        pro.setSelKind("lasso");
        break;
      case "wand":
        ed.setTool("wand");
        pro.setSelKind("wand");
        break;
      case "crop":
        ed.setTool("crop");
        break;
      case "free-transform":
        ed.setTool("move");
        break;
      case "rotate-cw":
      case "canvas-cw": {
        const id = ed.activeLayerId;
        if (id) {
          pro.ensureTransform(id);
          const t = pro.transforms[id] ?? { rotation: 0 };
          pro.updateTransform(id, { rotation: (t.rotation + 90) % 360 });
        }
        break;
      }
      case "rotate-ccw":
      case "canvas-ccw": {
        const id = ed.activeLayerId;
        if (id) {
          pro.ensureTransform(id);
          const t = pro.transforms[id] ?? { rotation: 0 };
          pro.updateTransform(id, { rotation: (t.rotation - 90) % 360 });
        }
        break;
      }
      case "flip-h": {
        const id = ed.activeLayerId;
        if (id) {
          pro.ensureTransform(id);
          const t = pro.transforms[id] ?? { scaleX: 1 };
          pro.updateTransform(id, { scaleX: t.scaleX * -1 });
        }
        break;
      }
      case "flip-v": {
        const id = ed.activeLayerId;
        if (id) {
          pro.ensureTransform(id);
          const t = pro.transforms[id] ?? { scaleY: 1 };
          pro.updateTransform(id, { scaleY: t.scaleY * -1 });
        }
        break;
      }
      case "reset-color":
        pro.setColor({ workingSpace: "sRGB", bitDepth: 8, proofEnabled: false });
        break;
      case "f-blur":
        pro.addFilter("gaussianBlur");
        break;
      case "f-motion":
        pro.addFilter("motionBlur");
        break;
      case "f-box":
        pro.addFilter("boxBlur");
        break;
      case "f-sharpen":
        pro.addFilter("sharpen");
        break;
      case "f-unsharp":
        pro.addFilter("unsharpMask");
        break;
      case "f-highpass":
        pro.addFilter("highPass");
        break;
      case "f-denoise":
        pro.addFilter("reduceNoise");
        break;
      case "f-noise":
        pro.addFilter("noise");
        break;
      case "f-grain":
        pro.addFilter("filmGrain");
        break;
      case "f-pixelate":
        pro.addFilter("pixelate");
        break;
      case "f-halftone":
        pro.addFilter("halftone");
        break;
      case "f-emboss":
        pro.addFilter("emboss");
        break;
      case "f-edges":
        pro.addFilter("findEdges");
        break;
      case "f-oil":
        pro.addFilter("oilPaintLite");
        break;
      case "f-tilt":
        pro.addFilter("tiltShift");
        break;
      case "f-vignette":
        pro.addFilter("vignette");
        break;
      case "f-chroma":
        pro.addFilter("chromaticAberration");
        break;
      case "f-native-box":
      case "f-native-sharpen":
      case "f-native-unsharp":
      case "f-native-emboss":
        void (async () => {
          try {
            const { isTauri, nativeProcessCanvas } = await import("../io/nativeEngine");
            const id = ed.activeLayerId;
            if (!isTauri() || !id) return;
            const c = layerManager.get(id) ?? layerManager.ensure(id, ed.doc.width, ed.doc.height);
            const filter =
              a === "f-native-box"
                ? { op: "boxBlur" as const, radius: 4 }
                : a === "f-native-sharpen"
                  ? { op: "sharpen" as const, amount: 1.2 }
                  : a === "f-native-unsharp"
                    ? { op: "unsharp" as const, amount: 1.5, radius: 2 }
                    : { op: "emboss" as const };
            await nativeProcessCanvas(c, "filter", filter);
            ed.markDirty();
            pro.bumpHistogram();
          } catch (e) {
            alert(`Filter gagal: ${String(e)}`);
          }
        })();
        break;
      case "a-native-gray":
      case "a-native-invert":
      case "a-native-contrast":
        void (async () => {
          try {
            const { isTauri, nativeProcessCanvas } = await import("../io/nativeEngine");
            const id = ed.activeLayerId;
            if (!isTauri() || !id) return;
            const c = layerManager.get(id) ?? layerManager.ensure(id, ed.doc.width, ed.doc.height);
            const op =
              a === "a-native-gray"
                ? { op: "gray" as const }
                : a === "a-native-invert"
                  ? { op: "invert" as const }
                  : { op: "contrast" as const, amount: 25 };
            await nativeProcessCanvas(c, "op", op);
            ed.markDirty();
            pro.bumpHistogram();
          } catch (e) {
            alert(`Penyesuaian gagal: ${String(e)}`);
          }
        })();
        break;
      case "a-bc":
        pro.addAdjustment("brightnessContrast");
        break;
      case "a-levels":
        pro.addAdjustment("levels");
        break;
      case "a-curves":
        pro.addAdjustment("curves");
        break;
      case "a-exposure":
        pro.addAdjustment("exposure");
        break;
      case "a-hsl":
        pro.addAdjustment("hueSaturation");
        break;
      case "a-vibrance":
        pro.addAdjustment("vibrance");
        break;
      case "a-balance":
        pro.addAdjustment("colorBalance");
        break;
      case "a-bw":
        pro.addAdjustment("blackWhite");
        break;
      case "a-photo":
        pro.addAdjustment("photoFilter");
        break;
      case "a-mixer":
        pro.addAdjustment("channelMixer");
        break;
      case "a-gradmap":
        pro.addAdjustment("gradientMap");
        break;
      case "a-lut":
        pro.addAdjustment("colorLookup");
        break;
      case "a-selective":
        pro.addAdjustment("selectiveColor");
        break;
      case "a-shhi":
        pro.addAdjustment("shadowsHighlights");
        break;
      case "ws-retouch":
        import("../stores/useWorkspaceStore").then(({ useWorkspaceStore }) =>
          useWorkspaceStore.getState().setWorkspace("retouching"),
        );
        break;
      case "ws-photo":
        import("../stores/useWorkspaceStore").then(({ useWorkspaceStore }) =>
          useWorkspaceStore.getState().setWorkspace("photography"),
        );
        break;
      case "ws-design":
        import("../stores/useWorkspaceStore").then(({ useWorkspaceStore }) =>
          useWorkspaceStore.getState().setWorkspace("design"),
        );
        break;
      case "ws-minimal":
        import("../stores/useWorkspaceStore").then(({ useWorkspaceStore }) =>
          useWorkspaceStore.getState().setWorkspace("minimal"),
        );
        break;
      case "onboarding":
        try {
          localStorage.removeItem("avero-onboarding");
        } catch {}
        window.location.reload();
        break;
      case "about":
        alert("AVERO STUDIO v2.0.0. Professional photo studio. Offline, non-destruktif, open source.");
        break;
    }
  }

  return (
    <div className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b border-[#2c2c31] bg-[#1c1c1f]/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-[#1c1c1f]/80">
      <div className="flex items-center gap-2">
        <button onClick={onHome} title="Home" className="group">
          <img src="/logo.png" alt="AVERO" className="h-7 w-7 rounded-md object-cover ring-1 ring-white/10 group-hover:ring-[#2f7cf6]/50 transition" />
        </button>
        <button onClick={onHome} title="Home" className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[12.5px] font-bold tracking-wide text-white">AVERO STUDIO</span>
          <House size={13} className="text-[#6e6e78] group-hover:text-white" />
        </button>
        <span className="hidden items-center gap-1 rounded-full border border-[#2c2c31] bg-[#161618] px-2 py-0.5 font-mono text-[9.5px] text-[#a7a7b0] sm:flex">
          v2.0.0 <span className="h-1 w-1 rounded-full bg-[#7ad69e]" />
        </span>
      </div>

      <nav className="ml-2 hidden items-center gap-0.5 text-[12px] lg:flex">
        {Object.keys(MENUS).map((m) => (
          <div key={m} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpenMenu(openMenu === m ? null : m)}
              onMouseEnter={() => {
                if (openMenu) setOpenMenu(m);
              }}
              className={clsx(
                "rounded-full px-2.5 py-1.5 transition-colors",
                openMenu === m ? "bg-[#232327] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              {m}
            </button>
            {openMenu === m && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-[240px] overflow-y-auto rounded-xl border border-[#2c2c31] bg-[#1c1c1f] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
                {MENUS[m].map((it) => (
                  <button
                    key={it.label}
                    onClick={() => runAction(it.action)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] text-[#c9c9d1] hover:bg-[#2f7cf6] hover:text-white"
                  >
                    <span>{it.label}</span>
                    {it.hint && <span className="font-mono text-[10px] opacity-60">{it.hint}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <button
        onClick={onOpenCommand}
        className="ml-2 hidden items-center gap-1.5 rounded-full border border-[#2c2c31] bg-[#161618] px-3 py-1.5 text-[11.5px] text-[#6e6e78] hover:border-[#3a3a41] hover:text-white md:flex transition-colors"
      >
        <Search size={13} /> Ctrl+K semua aksi
      </button>

      <div className="ml-auto flex items-center gap-2 text-[11px]">
        <span className="hidden max-w-[280px] truncate rounded-full border border-[#2c2c31] bg-[#161618] px-2.5 py-1 font-mono text-[#a7a7b0] xl:flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${doc.dirty ? "bg-[#d9a441] animate-pulse" : "bg-[#7ad69e]"}`} />
          {doc.name}
          {doc.dirty ? " *" : ""} • {doc.width}x{doc.height}
        </span>
        <span className={clsx("hidden items-center gap-1 rounded-full px-2 py-1 font-mono text-[10px] sm:flex", doc.dirty ? "bg-[#3a2f14] text-amber-200" : "bg-[#1a2b1f] text-[#7ad69e]")}>
          <span className={`h-1 w-1 rounded-full ${doc.dirty ? "bg-amber-300" : "bg-[#7ad69e]"}`} />
          {doc.dirty ? "Belum disimpan" : "Tersimpan"}
        </span>
      </div>
      <span className="hidden" data-open-handler={busy ? "busy" : "idle"} onClick={handleOpen} />
    </div>
  );
}

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
      new CustomEvent("avero:opened-image", { detail: { dataUrl, w: info.width, h: info.height } }),
    );
  };
}
