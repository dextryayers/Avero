import { useEffect, useRef, useState } from "react";
import { checkBackend, pickImageToOpen, pickSavePath, rustDecodeToDataUrl, rustImageInfo, rustSaveDataUrl } from "../io/tauriIo";
import { getCompositeCanvas } from "../engine/compositeRef";
import { openAvxProject, registerAvxAssociation, saveAvxProject } from "../io/projectIo";
import { layerManager } from "../engine/layerManager";
import { useEditorStore, makeLayer } from "../stores/useEditorStore";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import { useNodeStore } from "../stores/useNodeStore";
import { isTauri, nativeProcessCanvas } from "../io/nativeEngine";
import { useHomeStore } from "../stores/useHomeStore";
import { useProStore } from "../stores/useProStore";
import { House, Search, Settings2 } from "lucide-react";
import clsx from "clsx";
import { MENUS } from "../app/menus";
import { showError, showMessage } from "../ui/notify";
import { Kbd } from "../ui/atoms";
import { doUndo, doRedo } from "../engine/historyOps";
import { copyActiveLayerShim } from "../app/shortcuts-shim";


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
    void registerAvxAssociation();  }, [setBackend]);

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
          void showError(`Failed to open image: ${String(err)}`);
        })
        .finally(() => setBusy(false));
    }
    window.addEventListener("avero:open-path", onOpenPath);
    return () => window.removeEventListener("avero:open-path", onOpenPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  // Global shortcuts trigger menu actions through this event
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
      await showError(`Failed to open image: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function runAction(a: string) {
    setOpenMenu(null);
    const ed = useEditorStore.getState();
    const pro = useProStore.getState();
    const pick = async () => {
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
        void openAvxProject().catch((e) => showError(`Failed to open project: ${String(e)}`));
        break;
      case "save-avx":
        void saveAvxProject(false)
          .then((p) => {
            if (p) void showMessage(`Saved: ${p}`);
          })
          .catch((e) => showError(`Failed to save project: ${String(e)}`));
        break;
      case "save-avx-as":
        void saveAvxProject(true)
          .then((p) => {
            if (p) void showMessage(`Saved as: ${p}`);
          })
          .catch((e) => showError(`Failed to save project: ${String(e)}`));
        break;
      case "export":
        onOpenExport();
        break;
      case "export-png":
        void pick().catch((e) => showError(String(e)));
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
      case "undo":
        void (async () => {
          const { doUndo } = await import("../engine/historyOps");
          doUndo();
        })();
        break;
      case "redo":
        void (async () => {
          const { doRedo } = await import("../engine/historyOps");
          doRedo();
        })();
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
        useNodeStore.getState().toggle();
        if (useNodeStore.getState().enabled) useNodeStore.getState().autoFromStack();
        break;
      case "add-layer": {
        const l = makeLayer(`Layer ${ed.layers.length + 1}`);
        layerManager.ensure(l.id, ed.doc.width, ed.doc.height);
        ed.addLayer(l);
        break;
      }
      case "dup-layer":
      case "layer-copy": {
        void (async () => {
          const s = await import("../app/shortcuts");
          if (!(await import("../engine/selection")).hasSelection()) {
            s.duplicateActiveLayer();
            return;
          }
          // Layer via Copy: copy the selection to a new layer, keep the original.
          try {
            const st = useEditorStore.getState();
            const id = st.activeLayerId;
            if (!id) return;
            const src = layerManager.get(id);
            const sel = (await import("../engine/selection")).selectionMaskCanvas();
            if (!src || !sel) {
              s.duplicateActiveLayer();
              return;
            }
            const moved = document.createElement("canvas");
            moved.width = src.width;
            moved.height = src.height;
            const mg = moved.getContext("2d")!;
            mg.drawImage(src, 0, 0);
            mg.globalCompositeOperation = "destination-in";
            mg.drawImage(sel, 0, 0);
            const meta = st.layers.find((l) => l.id === id);
            const l = makeLayer(`${meta?.name ?? "Layer"} copy`);
            const nc = layerManager.ensure(l.id, st.doc.width, st.doc.height);
            nc.getContext("2d")!.drawImage(moved, 0, 0);
            st.addLayer(l);
            st.setActiveLayer(l.id);
            st.markDirty();
          } catch {
            /* ignore */
          }
        })();
        break;
      }
      case "layer-cut":
        void (async () => {
          const s = await import("../app/shortcuts");
          if (!s.layerViaCut()) s.duplicateActiveLayer();
        })();
        break;
      case "del-layer":
        if (ed.activeLayerId && ed.layers.length > 1) ed.removeLayer(ed.activeLayerId);
        else void showMessage("Cannot delete the last layer. Delete pixels instead (Del).");
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
      case "merge-down": {
        // Gabung layer aktif ke layer di bawahnya (hormati opacity sederhana).
        try {
          const st = useEditorStore.getState();
          const idx = st.layers.findIndex((l) => l.id === st.activeLayerId);
          if (idx <= 0) {
            void showMessage("Merge Down: no layer below.");
            break;
          }
          const top = st.layers[idx];
          const below = st.layers[idx - 1];
          const tc = layerManager.get(top.id);
          const bc = layerManager.get(below.id) ?? layerManager.ensure(below.id, st.doc.width, st.doc.height);
          if (!tc) break;
          const snap = layerManager.snapshot(below.id);
          const g = bc.getContext("2d")!;
          g.save();
          g.globalAlpha = Math.max(0, Math.min(1, top.opacity / 100));
          g.drawImage(tc, 0, 0);
          g.restore();
          if (snap) st.pushHistory({ label: "Merge down", layerId: below.id, snapshot: snap });
          st.removeLayer(top.id);
          st.setActiveLayer(below.id);
          st.markDirty();
          pro.bumpHistogram();
        } catch (e) {
          void showError(`Merge failed: ${String(e)}`);
        }
        break;
      }
      case "merge-all":
      case "flatten": {
        // Ratakan semua layer tampak ke layer bawah (non-destruktif: snapshot per layer).
        try {
          const st = useEditorStore.getState();
          const vis = st.layers.filter((l) => l.visible);
          if (vis.length < 2) {
            void showMessage("Nothing to merge.");
            break;
          }
          const bottom = vis[0];
          const snap = layerManager.snapshot(bottom.id);
          const bc = layerManager.get(bottom.id) ?? layerManager.ensure(bottom.id, st.doc.width, st.doc.height);
          const g = bc.getContext("2d")!;
          for (let i = 1; i < vis.length; i++) {
            const c = layerManager.get(vis[i].id);
            if (!c) continue;
            g.save();
            g.globalAlpha = Math.max(0, Math.min(1, vis[i].opacity / 100));
            g.drawImage(c, 0, 0);
            g.restore();
          }
          if (snap) st.pushHistory({ label: a === "flatten" ? "Flatten" : "Merge all", layerId: bottom.id, snapshot: snap });
          // Hapus layer atas (bawah dipertahankan sebagai hasil).
          for (let i = vis.length - 1; i >= 1; i--) {
            if (st.layers.length > 1) st.removeLayer(vis[i].id);
          }
          st.setActiveLayer(bottom.id);
          st.markDirty();
          pro.bumpHistogram();
        } catch (e) {
          void showError(`Merge failed: ${String(e)}`);
        }
        break;
      }
      case "clear-fill":
        void (async () => {
          const s = await import("../app/shortcuts");
          s.deleteActivePixels();
        })();
        break;
      case "fill-fg":
      case "fill-bg": {
        void (async () => {
          try {
            const st = useEditorStore.getState();
            const id = st.activeLayerId;
            if (!id) return;
            const meta = st.layers.find((l) => l.id === id);
            if (!meta || meta.locked || !meta.visible) {
              void showMessage("Active layer is locked or hidden.");
              return;
            }
            const c = layerManager.get(id) ?? layerManager.ensure(id, st.doc.width, st.doc.height);
            const snap = layerManager.snapshot(id);
            const color = a === "fill-fg" ? st.brushColor : st.bgColor;
            const g = c.getContext("2d")!;
            const sel = (await import("../engine/selection")).hasSelection()
              ? (await import("../engine/selection")).selectionMaskCanvas()
              : null;
            g.save();
            if (sel) {
              // Fill inside the selection only: clip via a temporary mask.
              const tmp = document.createElement("canvas");
              tmp.width = c.width;
              tmp.height = c.height;
              const tg = tmp.getContext("2d")!;
              tg.fillStyle = color;
              tg.fillRect(0, 0, tmp.width, tmp.height);
              tg.globalCompositeOperation = "destination-in";
              tg.drawImage(sel, 0, 0);
              g.drawImage(tmp, 0, 0);
            } else {
              g.fillStyle = color;
              g.fillRect(0, 0, c.width, c.height);
            }
            g.restore();
            if (snap) st.pushHistory({ label: a === "fill-fg" ? "Fill FG" : "Fill BG", layerId: id, snapshot: snap });
            st.markDirty();
            pro.bumpHistogram();
          } catch (e) {
            void showError(`Fill failed: ${String(e)}`);
          }
        })();
        break;
      }
      case "content-aware":
        // Point at the Content Fill tool so the next click fills the selection.
        ed.setTool("content-fill");
        void (async () => {
          const { hasSelection } = await import("../engine/selection");
          if (!hasSelection()) void showMessage("Content-Aware: make a selection first, then click the canvas.");
        })();
        break;
      case "group":
      case "add-mask":
      case "clip-mask":
      case "lock-layer":
      case "layer-opacity":
      case "blend-mode":
      case "select-mask":
      case "color-range":
      case "select-subject":
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
      case "paste-place":
        window.dispatchEvent(new CustomEvent("avero:clip", { detail: "paste-place" }));
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
        ed.setTool("transform-free");
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
            await showError(`Filter failed: ${String(e)}`);
          }
        })();
        break;
      case "a-native-gray":
      case "a-native-invert":
      case "a-native-contrast":
        void (async () => {
          try {
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
            await showError(`Adjustment failed: ${String(e)}`);
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
        useWorkspaceStore.getState().setWorkspace("retouching");
        break;
      case "ws-photo":
        useWorkspaceStore.getState().setWorkspace("photography");
        break;
      case "ws-design":
        useWorkspaceStore.getState().setWorkspace("design");
        break;
      case "ws-minimal":
        useWorkspaceStore.getState().setWorkspace("minimal");
        break;
      case "onboarding":
        try {
          localStorage.removeItem("avero-onboarding");
        } catch {}
        window.location.reload();
        break;
      case "about":
        void showMessage("AVERO STUDIO v2.0.0. Professional photo studio. Offline, non-destructive, open source.");
        break;
    }
  }

  return (
    <div className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b border-[#2c2c31] bg-[#1c1c1f] px-3">
      <div className="flex items-center gap-2">
        <button onClick={onHome} title="Home" className="group">
          <img src="/logo.png" alt="AVERO" className="h-7 w-7 rounded-md border border-[#2c2c31] object-cover" />
        </button>
        <button onClick={onHome} title="Home" className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[12px] font-bold tracking-wide text-white">AVERO STUDIO</span>
          <House size={13} className="text-[#6e6e78]" />
        </button>
        <span className="hidden items-center gap-1.5 rounded border border-[#2c2c31] bg-[#101012] px-2 py-0.5 font-mono text-[9px] text-[#a7a7b0] sm:flex">
          v2.0.0 <span className="h-1.5 w-1.5 rounded-full bg-[#7ad69e]" />
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
                "rounded-md px-2 py-1",
                openMenu === m ? "bg-[#232327] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              {m}
            </button>
            {openMenu === m && (
              <div className="avero-pop absolute left-0 top-full z-50 mt-1.5 max-h-[70vh] w-[248px] overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1f]/95 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                {MENUS[m].map((it) => (
                  <button
                    key={it.label}
                    onClick={() => runAction(it.action)}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-[12px] text-[#c9c9d1] transition-colors hover:bg-[#2f7cf6] hover:text-white"
                  >
                    <span className="truncate">{it.label}</span>
                    {it.hint && (
                      <Kbd className="group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white/90">
                        {it.hint}
                      </Kbd>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <button
        onClick={onOpenCommand}
        className="ml-2 hidden h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#101012] px-3 text-[11px] text-[#6e6e78] hover:border-[#3a3a41] hover:text-white md:flex"
      >
        <Search size={13} /> Ctrl+K all actions
      </button>

      <div className="ml-auto flex items-center gap-1.5 text-[11px]">
        <button
          onClick={() => window.dispatchEvent(new Event("avero:open-settings"))}
          title="Control Center settings (Ctrl+,)"
          className="avero-press grid h-8 w-8 place-items-center rounded-md border border-[#2c2c31] bg-[#101012] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
        >
          <Settings2 size={14} />
        </button>
        <span className="hidden max-w-[280px] truncate rounded border border-[#2c2c31] bg-[#101012] px-2 py-1 font-mono text-[10px] text-[#a7a7b0] xl:flex items-center gap-1.5" title={doc.projectPath ?? doc.projectFolder ?? doc.name}>
          <span className={`h-1.5 w-1.5 rounded-full ${doc.dirty ? "bg-[#d9a441]" : "bg-[#7ad69e]"}`} />
          {doc.name}
          {doc.dirty ? " *" : ""} {doc.width}x{doc.height}
        </span>
        <span className={clsx("hidden items-center gap-1.5 rounded border border-[#2c2c31] px-2 py-1 font-mono text-[10px] sm:flex", doc.dirty ? "bg-[#161618] text-[#d9a441]" : "bg-[#161618] text-[#7ad69e]")}>
          <span className={`h-1.5 w-1.5 rounded-full ${doc.dirty ? "bg-[#d9a441]" : "bg-[#7ad69e]"}`} />
          {doc.dirty ? "Unsaved" : "Saved"}
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
