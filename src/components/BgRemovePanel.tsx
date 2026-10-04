import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { getContentBounds } from "../engine/layerBounds";
import { notify, notifyError, notifySuccess } from "../ui/notify";
import { DockSlider } from "../ui/atoms";

interface RmbgStatus {
  found: boolean;
  path: string;
  size_mb: number;
}

interface RmbgResult {
  mask: number[];
  width: number;
  height: number;
  millis: number;
  suggested: number;
  kept_pct: number;
  removed: number;
}

type BgMode = "mask" | "new";

// Remove Background studio: RMBG model inference through Tauri, placed in
// the Color column between Stroke and Brush. The panel is contextual: it
// arms itself when a visible unlocked photo or raster layer with pixels is
// active. Output is either a live layer mask (undoable, feathered) or a
// cutout on a fresh layer, both transformable like everything else.
export default function BgRemovePanel() {
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const doc = useEditorStore((s) => s.doc);
  const [status, setStatus] = useState<RmbgStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [threshold, setThreshold] = useState(128);
  const [feather, setFeather] = useState(2);
  const [mode, setMode] = useState<BgMode>("mask");
  const [cleanup, setCleanup] = useState(true);
  const [smooth, setSmooth] = useState(true);
  const [stats, setStats] = useState<string | null>(null);
  const softCache = useRef<{ layerId: string; bytes: number[]; w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    invoke<RmbgStatus>("cmd_rmbg_status")
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {
        if (alive) setStatus(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const active = useMemo(() => {
    const meta = layers.find((l) => l.id === activeLayerId);
    if (!meta || !meta.visible || meta.locked) return null;
    if (meta.kind !== "raster" && meta.kind !== "text" && meta.kind !== "shape") return null;
    try {
      const c = layerManager.get(meta.id);
      if (!c) return null;
      const bounds = getContentBounds(c);
      if (!bounds || bounds.w < 4 || bounds.h < 4) return null;
    } catch {
      return null;
    }
    return meta;
  }, [layers, activeLayerId]);

  function maskCanvasFromBytes(bytes: number[], w: number, h: number, thr: number): HTMLCanvasElement {
    const mc = document.createElement("canvas");
    mc.width = w;
    mc.height = h;
    const g = mc.getContext("2d")!;
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = bytes[i] >= thr ? 255 : 0;
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = v;
    }
    g.putImageData(img, 0, 0);
    return mc;
  }

  function applySoftMask(layerId: string, bytes: number[], w: number, h: number, thr: number, fth: number) {
    const mc = maskCanvasFromBytes(bytes, w, h, thr);
    const target = layerManager.ensureMask(layerId, doc.width, doc.height);
    const g = target.getContext("2d")!;
    g.clearRect(0, 0, target.width, target.height);
    g.drawImage(mc, 0, 0, target.width, target.height);
    const pro = useProStore.getState();
    pro.ensureMask(layerId);
    pro.updateMask(layerId, { enabled: true, hasMask: true, feather: fth });
  }

  function onThreshold(v: number) {
    setThreshold(v);
    // Live re-threshold from the cached matte, no re-inference needed.
    const st = useEditorStore.getState();
    const c = softCache.current;
    if (c && st.activeLayerId === c.layerId && mode === "mask") {
      try {
        applySoftMask(c.layerId, c.bytes, c.w, c.h, v, useProStore.getState().masks[c.layerId]?.feather ?? feather);
        st.markDirty();
        useProStore.getState().bumpHistogram();
      } catch {
        /* keep slider value on paint failure */
      }
    }
  }

  function onFeather(v: number) {
    setFeather(v);
    const id = useEditorStore.getState().activeLayerId;
    if (id && mode === "mask") {
      useProStore.getState().updateMask(id, { feather: v });
      useEditorStore.getState().markDirty();
    }
  }

  async function onRemove() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    const meta = id ? st.layers.find((l) => l.id === id) : undefined;
    if (!meta || !id) {
      notify("Remove BG: select a photo layer first.", "error");
      return;
    }
    if (!status?.found) {
      notifyError("Remove BG: model file missing. Place model-rmbg-1.4.onnx in the models folder shown below.");
      return;
    }
    const src = layerManager.get(id);
    if (!src || src.width < 8 || src.height < 8) {
      notify("Remove BG: active layer has no pixels.", "error");
      return;
    }
    setBusy(true);
    try {
      const sctx = src.getContext("2d", { willReadFrequently: true })!;
      const data = sctx.getImageData(0, 0, src.width, src.height).data;
      const res = await invoke<RmbgResult>("cmd_rmbg_remove", {
        model_path: null,
        rgba: Array.from(data),
        width: src.width,
        height: src.height,
        cleanup,
        smooth,
      });
      if (!res.mask || res.mask.length !== res.width * res.height || res.width < 4) {
        notifyError("Remove BG: model returned an empty matte. Try another photo.");
        return;
      }
      softCache.current = { layerId: id, bytes: res.mask, w: res.width, h: res.height };
      setThreshold(res.suggested);
      setStats(
        `Kept ${Math.round(res.kept_pct)}% · removed ${res.removed} speck${res.removed === 1 ? "" : "s"} · ${(res.millis / 1000).toFixed(1)}s`,
      );
      if (mode === "mask") {
        const snap = layerManager.snapshot(id);
        const maskSnap = layerManager.snapshotMask(id);
        if (snap) st.pushHistory({ label: "Remove background", layerId: id, snapshot: snap, maskSnapshot: maskSnap });
        applySoftMask(id, res.mask, res.width, res.height, res.suggested, feather);
        st.markDirty();
        useProStore.getState().bumpHistogram();
        notifySuccess(`Background removed in ${(res.millis / 1000).toFixed(1)}s. Adjust threshold live, undo restores.`);
      } else {
        const mc = maskCanvasFromBytes(res.mask, res.width, res.height, res.suggested);
        const cut = document.createElement("canvas");
        cut.width = doc.width;
        cut.height = doc.height;
        const g = cut.getContext("2d")!;
        g.drawImage(src, 0, 0);
        g.globalCompositeOperation = "destination-in";
        g.drawImage(mc, 0, 0, cut.width, cut.height);
        g.globalCompositeOperation = "source-over";
        const l = makeLayer(`${meta.name} cut`);
        const nc = layerManager.ensure(l.id, doc.width, doc.height);
        nc.getContext("2d")!.drawImage(cut, 0, 0);
        st.addLayer(l);
        st.setActiveLayer(l.id);
        useProStore.getState().ensureTransform(l.id);
        st.markDirty();
        useProStore.getState().bumpHistogram();
        notifySuccess(`Background cut to a new layer in ${(res.millis / 1000).toFixed(1)}s.`);
      }
    } catch (e) {
      notifyError(`Remove BG failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const readyReason = !status
    ? "Checking model..."
    : !status.found
      ? "Model file missing"
      : !active
        ? "Select a visible photo layer"
        : busy
          ? "Working..."
          : "Ready";
  const canRun = !!status?.found && !!active && !busy;

  return (
    <div className="space-y-2.5 p-3 text-[11px]">
      <div className="flex items-center gap-2 rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1.5">
        <span
          className={clsx("h-2 w-2 shrink-0 rounded-full", status?.found ? "bg-[#7ad69e]" : "bg-[#d9a441]")}
          title={status?.found ? "Model ready" : "Model missing"}
        />
        <span className="min-w-0 flex-1 truncate text-[#c9c9d1]" title={status ? status.path : "Checking model file"}>
          {status ? (status.found ? `RMBG ready (${status.size_mb.toFixed(0)} MB)` : "RMBG model missing") : "Checking model..."}
        </span>
      </div>
      {!status?.found && status !== null && (
        <div className="rounded-lg border border-dashed border-[#2c2c31] px-2 py-1.5 text-[10px] leading-relaxed text-[#6e6e78]">
          Place <span className="font-mono text-[#a7a7b0]">model-rmbg-1.4.onnx</span> in:
          <div className="mt-1 break-all font-mono text-[9px] text-[#8e8e98]">{status.path}</div>
        </div>
      )}
      <div className="rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[#c9c9d1]">
        {active ? (
          <span>
            Target: <span className="font-semibold text-white">{active.name}</span>{" "}
            <span className="font-mono text-[10px] text-[#6e6e78]">{active.kind}</span>
          </span>
        ) : (
          <span className="text-[#6e6e78]">Click an imported photo to arm Remove BG.</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#2c2c31] bg-[#101012] p-1" role="group" aria-label="Output target">
        {(["mask", "new"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            title={m === "mask" ? "Write a live mask on the photo (undoable)" : "Cut the subject onto a fresh layer"}
            aria-pressed={mode === m}
            className={clsx(
              "rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f7cf6]",
              mode === m ? "bg-[#2f7cf6] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
            )}
          >
            {m === "mask" ? "Mask" : "New layer"}
          </button>
        ))}
      </div>
      <DockSlider label="Threshold" value={threshold} min={1} max={254} title="Subject cutoff, live on mask mode" onChange={onThreshold} />
      <DockSlider label="Feather" value={feather} min={0} max={20} suffix="px" title="Soften mask edges" onChange={onFeather} />
      <div className="grid grid-cols-2 gap-1">
        {(
          [
            { id: "cleanup", label: "Clean specks", hint: "Drop isolated fragments smaller than the subject", value: cleanup, set: setCleanup },
            { id: "smooth", label: "Smooth edges", hint: "Snap matte edges to photo detail", value: smooth, set: setSmooth },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => t.set(!t.value)}
            title={`${t.hint} (applies on next run)`}
            aria-pressed={t.value}
            className={clsx(
              "flex items-center justify-between rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2f7cf6]",
              t.value ? "border-[#2f7cf6]/60 bg-[#2f7cf6]/15 text-white" : "border-[#2c2c31] text-[#6e6e78] hover:text-white",
            )}
          >
            {t.label}
            <span className={clsx("relative h-4 w-7 shrink-0 rounded-full transition-colors", t.value ? "bg-[#2f7cf6]" : "bg-[#3a3a41]")}>
              <span
                className={clsx(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                  t.value ? "left-3.5" : "left-0.5",
                )}
              />
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={() => void onRemove()}
        disabled={!canRun}
        title={canRun ? "Remove the background of the active photo" : readyReason}
        className="avero-press w-full rounded-lg bg-[#2f7cf6] py-2 text-[12px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Removing..." : "Remove Background"}
      </button>
      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        {stats ?? `${readyReason}. CPU inference on large photos can take a minute. Threshold re-applies instantly on mask mode.`}
      </p>
    </div>
  );
}
