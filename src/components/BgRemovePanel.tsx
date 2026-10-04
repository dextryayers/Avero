import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  inverted: boolean;
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
  const [trim, setTrim] = useState(false);
  const [keepMain, setKeepMain] = useState(false);
  const [smartTrim, setSmartTrim] = useState(true);
  const [invert, setInvert] = useState(false);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<string | null>(null);
  const softCache = useRef<{ layerId: string; bytes: number[]; w: number; h: number; inv: boolean } | null>(null);
  // Invert flips are instant; everything else applies on the next run.
  const invertTouched = useRef(false);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - t0) / 1000), 500);
    return () => clearInterval(t);
  }, [busy]);

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

  function maskCanvasFromBytes(bytes: number[], w: number, h: number, thr: number, inv: boolean): HTMLCanvasElement {
    const mc = document.createElement("canvas");
    mc.width = w;
    mc.height = h;
    const g = mc.getContext("2d")!;
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const fg = bytes[i] >= thr;
      const v = (fg !== inv ? 255 : 0);
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = v;
    }
    g.putImageData(img, 0, 0);
    return mc;
  }

  function applySoftMask(layerId: string, bytes: number[], w: number, h: number, thr: number, fth: number, inv: boolean) {
    const mc = maskCanvasFromBytes(bytes, w, h, thr, inv);
    const target = layerManager.ensureMask(layerId, doc.width, doc.height);
    const g = target.getContext("2d")!;
    g.clearRect(0, 0, target.width, target.height);
    g.drawImage(mc, 0, 0, target.width, target.height);
    const pro = useProStore.getState();
    pro.ensureMask(layerId);
    pro.updateMask(layerId, { enabled: true, hasMask: true, feather: fth });
  }

  function reapplyLive(thr: number, inv: boolean) {
    // Live re-apply from the cached matte, no re-inference needed.
    const st = useEditorStore.getState();
    const c = softCache.current;
    if (c && st.activeLayerId === c.layerId && mode === "mask") {
      try {
        applySoftMask(c.layerId, c.bytes, c.w, c.h, thr, useProStore.getState().masks[c.layerId]?.feather ?? feather, inv);
        st.markDirty();
        useProStore.getState().bumpHistogram();
      } catch {
        /* keep slider value on paint failure */
      }
    }
  }

  function onThreshold(v: number) {
    setThreshold(v);
    reapplyLive(v, invert);
  }

  function onInvert(v: boolean) {
    setInvert(v);
    invertTouched.current = true;
    const c = softCache.current;
    if (c) c.inv = v;
    reapplyLive(threshold, v);
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
        invert: invertTouched.current ? invert : null,
        trim_borders: trim,
        keep_largest: keepMain ? 1 : 0,
        smart_trim: smartTrim,
      });
      if (!res.mask || res.mask.length !== res.width * res.height || res.width < 4) {
        notifyError("Remove BG: model returned an empty matte. Try another photo.");
        return;
      }
      softCache.current = { layerId: id, bytes: res.mask, w: res.width, h: res.height, inv: res.inverted };
      setThreshold(res.suggested);
      setSuggested(res.suggested);
      setInvert(res.inverted);
      const manual = invertTouched.current;
      invertTouched.current = false;
      const oriented = res.inverted && !manual ? " · auto-oriented" : "";
      setStats(
        `Subject ${res.kept_pct.toFixed(1)}% of frame · removed ${res.removed} speck${res.removed === 1 ? "" : "s"}${oriented} · ${(res.millis / 1000).toFixed(1)}s`,
      );
      if (mode === "mask") {
        const snap = layerManager.snapshot(id);
        const maskSnap = layerManager.snapshotMask(id);
        if (snap) st.pushHistory({ label: "Remove background", layerId: id, snapshot: snap, maskSnapshot: maskSnap });
        applySoftMask(id, res.mask, res.width, res.height, res.suggested, feather, res.inverted);
        st.markDirty();
        useProStore.getState().bumpHistogram();
        notifySuccess(`Background removed in ${(res.millis / 1000).toFixed(1)}s. Adjust threshold live, undo restores.`);
      } else {
        const mc = maskCanvasFromBytes(res.mask, res.width, res.height, res.suggested, res.inverted);
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
  const cache = softCache.current;
  const preview =
    cache && cache.layerId === activeLayerId ? { ...cache, thr: threshold } : null;

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
        <span className="avero-micro shrink-0">Smart</span>
      </div>
      {!status?.found && status !== null && (
        <div className="rounded-lg border border-dashed border-[#2c2c31] px-2 py-1.5 text-[10px] leading-relaxed text-[#6e6e78]">
          Place <span className="font-mono text-[#a7a7b0]">model-rmbg-1.4.onnx</span> in:
          <div className="mt-1 break-all font-mono text-[9px] text-[#8e8e98]">{status.path}</div>
        </div>
      )}
      <div>
        <div className="avero-micro mb-1 px-1">Target</div>
        <div className="flex items-center gap-2 rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[#c9c9d1]">
          {active ? (
            <>
              <TargetThumb layerId={active.id} />
              <span className="min-w-0 flex-1 truncate">
                <span className="block truncate font-semibold text-white" title={active.name}>{active.name}</span>
                <span className="font-mono text-[10px] text-[#6e6e78]">{active.kind}</span>
              </span>
            </>
          ) : (
            <span className="text-[#6e6e78]">Click an imported photo to arm Remove BG.</span>
          )}
        </div>
      </div>
      <div>
        <div className="avero-micro mb-1 px-1">Output</div>
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
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="avero-micro">Refine</span>
          {suggested !== null && threshold === suggested && (
            <span className="rounded bg-[#2f7cf6]/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#7db3ff]" title="Threshold follows the automatic suggestion">
              Auto
            </span>
          )}
        </div>
        <div className="space-y-2">
          <DockSlider label="Threshold" value={threshold} min={1} max={254} title="Subject cutoff, live on mask mode" onChange={onThreshold} />
          <DockSlider label="Feather" value={feather} min={0} max={20} suffix="px" title="Soften mask edges" onChange={onFeather} />
        </div>
      </div>
      <details className="rounded-lg border border-[#2c2c31] bg-[#101012]">
        <summary className="cursor-pointer list-none px-2 py-1.5 text-[11px] font-medium text-[#a7a7b0] hover:text-white" title="Rarely needed: the smart pipeline already orients, trims backdrop, and cleans specks">
          Advanced
        </summary>
        <div className="grid grid-cols-2 gap-1 p-1 pt-0">
          {(
            [
              { id: "cleanup", label: "Clean specks", hint: "Drop isolated fragments smaller than the subject", value: cleanup, set: setCleanup, live: false },
              { id: "smooth", label: "Smooth edges", hint: "Snap matte edges to photo detail", value: smooth, set: setSmooth, live: false },
              { id: "smart", label: "Smart edge trim", hint: "Auto-drop edge pieces painted in backdrop color", value: smartTrim, set: setSmartTrim, live: false },
              { id: "trim", label: "Trim all edges", hint: "Drop every piece touching the frame", value: trim, set: setTrim, live: false },
              { id: "main", label: "Main subject", hint: "Keep only the largest piece", value: keepMain, set: setKeepMain, live: false },
              { id: "invert", label: "Invert mask", hint: "Flip subject and background instantly", value: invert, set: onInvert, live: true },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => t.set(!t.value)}
              title={t.live ? t.hint : `${t.hint} (applies on next run)`}
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
      </details>
      <button
        onClick={() => void onRemove()}
        disabled={!canRun}
        title={canRun ? "Remove the background of the active photo" : readyReason}
        className="avero-press w-full rounded-lg bg-[#2f7cf6] py-2 text-[12px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? `Working... ${elapsed.toFixed(0)}s` : "Remove Background"}
      </button>
      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        {stats ?? `${readyReason}. One click handles orientation, backdrop trim, and specks. Large photos can take a minute on CPU.`}
      </p>
      {preview && (
        <div>
          <div className="avero-micro mb-1 px-1">Preview</div>
          <div className="grid grid-cols-2 gap-1.5">
            <PreviewThumb kind="before" layerId={preview.layerId} bytes={preview.bytes} w={preview.w} h={preview.h} thr={preview.thr} inv={preview.inv} />
            <PreviewThumb kind="after" layerId={preview.layerId} bytes={preview.bytes} w={preview.w} h={preview.h} thr={preview.thr} inv={preview.inv} />
          </div>
        </div>
      )}
    </div>
  );
}

const CHECKER_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#2c2c31 25%,transparent 25%,transparent 75%,#2c2c31 75%),linear-gradient(45deg,#2c2c31 25%,#101012 25%,#101012 75%,#2c2c31 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 6px 6px",
};

function TargetThumb({ layerId }: { layerId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const g = el.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, el.width, el.height);
    try {
      const src = layerManager.get(layerId);
      if (!src || src.width < 4 || src.height < 4) return;
      const s = Math.min(el.width / src.width, el.height / src.height);
      const dw = Math.max(1, Math.round(src.width * s));
      const dh = Math.max(1, Math.round(src.height * s));
      g.drawImage(src, (el.width - dw) / 2, (el.height - dh) / 2, dw, dh);
    } catch {
      /* layer gone mid-paint */
    }
  }, [layerId]);
  return (
    <canvas
      ref={ref}
      width={44}
      height={44}
      className="h-11 w-11 shrink-0 rounded-md border border-[#2c2c31] bg-[#0a0a0c]"
      title="Remove BG target"
    />
  );
}

function PreviewThumb({
  kind,
  layerId,
  bytes,
  w,
  h,
  thr,
  inv,
}: {
  kind: "before" | "after";
  layerId: string;
  bytes: number[];
  w: number;
  h: number;
  thr: number;
  inv: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const src = layerManager.get(layerId);
    if (!src || src.width < 4 || src.height < 4) return;
    const TW = 112;
    const scale = TW / src.width;
    const TH = Math.max(40, Math.min(132, Math.round(src.height * scale)));
    el.width = TW;
    el.height = TH;
    const g = el.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, TW, TH);
    g.drawImage(src, 0, 0, TW, TH);
    if (kind === "after" && bytes.length === w * h && w > 0) {
      const mc = document.createElement("canvas");
      mc.width = w;
      mc.height = h;
      const mg = mc.getContext("2d")!;
      const img = mg.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const fg = bytes[i] >= thr;
        const v = (fg !== inv ? 255 : 0);
        img.data[i * 4] = 255;
        img.data[i * 4 + 1] = 255;
        img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = v;
      }
      mg.putImageData(img, 0, 0);
      g.globalCompositeOperation = "destination-in";
      g.drawImage(mc, 0, 0, TW, TH);
      g.globalCompositeOperation = "source-over";
    }
  }, [kind, layerId, bytes, w, h, thr, inv]);
  return (
    <div>
      <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-[#6e6e78]">
        {kind === "before" ? "Before" : "After"}
      </div>
      <canvas
        ref={ref}
        className="block w-full rounded-lg border border-[#2c2c31]"
        style={kind === "after" ? CHECKER_STYLE : undefined}
        title={kind === "before" ? "Original photo" : "Subject kept by the matte"}
      />
    </div>
  );
}
