import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { makeLayer, useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { getContentBounds } from "../engine/layerBounds";
import { notify, notifyError, notifySuccess } from "../ui/notify";

interface RmbgModelStatus {
  id: string;
  label: string;
  file: string;
  found: boolean;
  path: string;
  size_mb: number;
  input_size: number;
  tagline: string;
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
  flat_bg: boolean;
  model_id?: string;
  model_label?: string;
}

type BgMode = "mask" | "new";

/// Expert feather picked once: soft enough to hide jaggies, tight enough
/// to keep logo edges crisp. No slider, one less decision per click.
const FEATHER_AUTO = 2;
const MODEL_STORAGE_KEY = "avero:rmbg-model-id";

const MODEL_FALLBACK: RmbgModelStatus[] = [
  {
    id: "avero-1",
    label: "Avero Remove BG I",
    file: "model-rmbg-1.4.onnx",
    found: false,
    path: "",
    size_mb: 0,
    input_size: 1024,
    tagline: "Fast balanced cutout for everyday photos",
  },
  {
    id: "avero-2",
    label: "Avero Remove BG II",
    file: "RMBG2-0.onnx",
    found: false,
    path: "",
    size_mb: 0,
    input_size: 1024,
    tagline: "High detail backbone for portraits and products",
  },
  {
    id: "avero-3",
    label: "Avero Remove BG III",
    file: "BiReFNet.onnx",
    found: false,
    path: "",
    size_mb: 0,
    input_size: 1024,
    tagline: "Ultra precise backbone for hair and fine edges",
  },
];

// Remove Background studio with three selectable engines.
// Each dropdown entry maps to exactly one ONNX file in the models folder:
//   Avero Remove BG I   -> model-rmbg-1.4.onnx (fast balanced)
//   Avero Remove BG II  -> RMBG2-0.onnx (high detail)
//   Avero Remove BG III -> BiReFNet.onnx (ultra precise)
// Inference runs in Rust through Tauri with a shared maximum performance
// pipeline: parallel 1024px preprocess, smart cutoff selection, gap bridging,
// orientation fix, page rescue, speck cleanup, hole fill, and guided edge
// refinement. Output is a live layer mask or a cutout on a fresh layer.
export default function BgRemovePanel() {
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const doc = useEditorStore((s) => s.doc);
  const [models, setModels] = useState<RmbgModelStatus[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => {
    try {
      return localStorage.getItem(MODEL_STORAGE_KEY) || "avero-1";
    } catch {
      return "avero-1";
    }
  });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<BgMode>("mask");
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<string | null>(null);
  // One-click panel: every smart default is hardcoded below and the engine
  // decides orientation, page rescue, trim, and cutoff automatically.
  const softCache = useRef<{ layerId: string; bytes: number[]; w: number; h: number; inv: boolean; thr: number } | null>(null);

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
    invoke<RmbgModelStatus[]>("cmd_rmbg_models_status")
      .then((list) => {
        if (!alive) return;
        if (Array.isArray(list) && list.length > 0) {
          setModels(list);
          setSelectedId((prev) => {
            const kept = list.some((m) => m.id === prev) ? prev : "avero-1";
            const target = list.find((m) => m.id === kept);
            if (target && !target.found) {
              const firstReady = list.find((m) => m.found);
              return firstReady ? firstReady.id : kept;
            }
            return kept;
          });
        } else {
          setModels(MODEL_FALLBACK);
        }
      })
      .catch(() => {
        if (alive) setModels(MODEL_FALLBACK);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedId);
    } catch {
      /* ignore */
    }
  }, [selectedId]);

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

  const selected = useMemo(() => {
    const list = models ?? MODEL_FALLBACK;
    return list.find((m) => m.id === selectedId) ?? list[0];
  }, [models, selectedId]);

  const readyCount = useMemo(() => (models ?? []).filter((m) => m.found).length, [models]);

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

  async function onRemove() {
    const st = useEditorStore.getState();
    const id = st.activeLayerId;
    const meta = id ? st.layers.find((l) => l.id === id) : undefined;
    if (!meta || !id) {
      notify("Remove BG: select a photo layer first.", "error");
      return;
    }
    const engine = selected;
    if (!engine?.found) {
      notifyError(
        `${engine?.label ?? "Remove BG"}: model file missing. Place ${engine?.file ?? "the ONNX file"} in the models folder shown below.`
      );
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
        model_path: engine.path,
        model_id: engine.id,
        rgba: Array.from(data),
        width: src.width,
        height: src.height,
        cleanup: true,
        smooth: true,
        invert: null,
        trim_borders: false,
        keep_largest: 0,
        smart_trim: true,
      });
      if (!res.mask || res.mask.length !== res.width * res.height || res.width < 4) {
        notifyError("Remove BG: model returned an empty matte. Try another photo.");
        return;
      }
      softCache.current = { layerId: id, bytes: res.mask, w: res.width, h: res.height, inv: res.inverted, thr: res.suggested };
      const engineLabel = res.model_label || engine.label;
      const oriented = res.inverted ? " plus auto orientation" : "";
      const flat = res.flat_bg ? " plus page mode" : "";
      setStats(
        `${engineLabel}: subject ${res.kept_pct.toFixed(1)}% of frame, threshold ${res.suggested}, cleaned ${res.removed} speck${res.removed === 1 ? "" : "s"}${oriented}${flat} in ${(res.millis / 1000).toFixed(1)}s`
      );
      if (mode === "mask") {
        const snap = layerManager.snapshot(id);
        const maskSnap = layerManager.snapshotMask(id);
        if (snap) st.pushHistory({ label: `Remove background (${engineLabel})`, layerId: id, snapshot: snap, maskSnapshot: maskSnap });
        applySoftMask(id, res.mask, res.width, res.height, res.suggested, FEATHER_AUTO, res.inverted);
        st.markDirty();
        useProStore.getState().bumpHistogram();
        notifySuccess(`${engineLabel} finished in ${(res.millis / 1000).toFixed(1)}s. Undo restores the photo.`);
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
        notifySuccess(`${engineLabel} cut to a new layer in ${(res.millis / 1000).toFixed(1)}s.`);
      }
    } catch (e) {
      notifyError(`Remove BG failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const list = models ?? MODEL_FALLBACK;
  const readyReason = !models
    ? "Checking models..."
    : !selected?.found
      ? `${selected?.label ?? "Model"} file missing`
      : !active
        ? "Select a visible photo layer"
        : busy
          ? "Working..."
          : "Ready";
  const canRun = !!selected?.found && !!active && !busy;
  const cache = softCache.current;
  const preview = cache && cache.layerId === activeLayerId ? cache : null;

  return (
    <div className="space-y-2.5 p-3 text-[11px]">
      <div className="flex items-center gap-2 rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1.5">
        <span
          className={clsx("h-2 w-2 shrink-0 rounded-full", readyCount > 0 ? "bg-[#7ad69e]" : "bg-[#d9a441]")}
          title={readyCount > 0 ? "Background removal engine ready" : "Model missing"}
        />
        <span className="min-w-0 flex-1 truncate text-[#c9c9d1]" title="Installed background removal engines">
          {models ? (readyCount > 0 ? `${readyCount} of ${list.length} engines ready` : "No BG engine installed") : "Checking engines..."}
        </span>
        <span className="avero-micro shrink-0">Smart</span>
      </div>

      <div>
        <div className="avero-micro mb-1 px-1">Engine</div>
        <select
          value={selected?.id ?? "avero-1"}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label="Background removal engine"
          title="Pick one engine. Each entry runs a different ONNX model."
          className="w-full rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1.5 text-[11px] font-semibold text-white outline-none focus:border-[#2f7cf6]"
        >
          {list.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}{m.found ? ` (${m.size_mb.toFixed(0)} MB ready)` : " (missing)"}
            </option>
          ))}
        </select>
        {selected && (
          <div className="mt-1 rounded-lg border border-[#2c2c31] bg-[#101012] px-2 py-1.5 leading-relaxed">
            <div className="font-semibold text-white">{selected.label}</div>
            <div className="text-[10px] text-[#8e8e98]">{selected.tagline}</div>
            <div className="mt-0.5 font-mono text-[9px] text-[#6e6e78]">
              {selected.file} plus 1024px precision pipeline
            </div>
          </div>
        )}
      </div>

      {!selected?.found && selected && (
        <div className="rounded-lg border border-dashed border-[#2c2c31] px-2 py-1.5 text-[10px] leading-relaxed text-[#6e6e78]">
          Place <span className="font-mono text-[#a7a7b0]">{selected.file}</span> in:
          <div className="mt-1 break-all font-mono text-[9px] text-[#8e8e98]">{selected.path || "models folder next to the app"}</div>
          <div className="mt-1">
            Missing engines stay selectable so you can see what each one needs. Install the file, restart the status check, and the engine activates.
          </div>
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
      <button
        onClick={() => void onRemove()}
        disabled={!canRun}
        title={canRun ? `Run ${selected?.label ?? "Remove BG"} on the active photo` : readyReason}
        className="avero-press w-full rounded-lg bg-[#2f7cf6] py-2 text-[12px] font-bold text-white shadow-[0_2px_10px_rgba(47,124,246,0.45)] hover:bg-[#3b8bff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? `Working with ${selected?.label ?? "engine"}... ${elapsed.toFixed(0)}s` : `Remove Background with ${selected?.label ?? "engine"}`}
      </button>
      <p className="px-1 text-[10px] leading-relaxed text-[#6e6e78]">
        {stats ?? `${readyReason}. One click: orientation, page rescue, trim, and cutoff are fully automatic.`}
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
