import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  AlertCircle,
  Check,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { jobDisplayName, useConvertStore, type ConvertJob } from "../stores/useConvertStore";
import {
  EDGE_PRESETS,
  OUTPUT_FORMATS,
  RESIZE_FILTERS,
  browseImages,
  buildOutputPath,
  cancelBatch,
  defaultSuffix,
  extOf,
  formatBytes,
  isInputSupported,
  needsMatte,
  pathExists,
  pickOutputFolder,
  probeImage,
  revealInFolder,
  runBatch,
  type BatchProgress,
  type OutputFormat,
} from "../io/convert";
import { WEB_FORMATS, webConvertImage } from "../io/convertWeb";
import { useEditorStore } from "../stores/useEditorStore";
import { useHomeStore } from "../stores/useHomeStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { showError, showMessage } from "../ui/notify";

const desktop = typeof window !== "undefined" && "__TAURI__" in window;
const FORMATS: readonly string[] = desktop ? OUTPUT_FORMATS : WEB_FORMATS;

function effTarget(t: string): string {
  return (FORMATS as readonly string[]).includes(t) ? t : "png";
}

async function uniquePath(p: string): Promise<string> {
  if (!(await pathExists(p))) return p;
  const dot = p.lastIndexOf(".");
  const base = dot > 0 ? p.slice(0, dot) : p;
  const ext = dot > 0 ? p.slice(dot) : "";
  for (let n = 2; n <= 99; n++) {
    const c = `${base} - ${n}${ext}`;
    if (!(await pathExists(c))) return c;
  }
  return `${base} - ${Date.now().toString(36)}${ext}`;
}

function Pill({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={clsx(
        "rounded-md border px-2.5 py-1.5 font-mono text-[11px] disabled:opacity-40",
        active
          ? "border-[#2f7cf6] bg-[#2f7cf6] text-white"
          : "border-[#2c2c31] bg-[#101012] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function Row({
  job,
  running,
  webUrl,
  onDownload,
  onSendWeb,
}: {
  job: ConvertJob;
  running: boolean;
  webUrl?: string;
  onDownload?: () => void;
  onSendWeb?: () => void;
}) {
  const setJobTarget = useConvertStore((s) => s.setJobTarget);
  const removeJob = useConvertStore((s) => s.removeJob);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] px-3 py-2">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-[#2c2c31] bg-[#0a0a0c]">
        {job.thumb ? (
          <img src={job.thumb} alt={job.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <ImageIcon size={16} className="text-[#3a3a41]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-white" title={job.input}>
          {jobDisplayName(job)}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-[#6e6e78]">
          <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 py-px uppercase">{job.srcFormat || extOf(job.input)}</span>
          <span>{job.w && job.h ? `${job.w}x${job.h}` : "probing"}</span>
          <span>{formatBytes(job.size)}</span>
          {job.status === "done" && job.outSize !== null && (
            <span className="text-[#7ad69e]">to {formatBytes(job.outSize)}</span>
          )}
        </div>
        {job.status === "error" && job.error && (
          <div className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-[#f0883e]">
            <AlertCircle size={12} className="mt-0.5 shrink-0" /> <span className="break-words">{job.error}</span>
          </div>
        )}
        {job.status === "done" && job.output && (
          <div className="mt-1 truncate font-mono text-[10px] text-[#6e6e78]" title={job.output}>
            {job.output}
          </div>
        )}
      </div>
      <span className="hidden font-mono text-[11px] text-[#4a4a52] sm:block">to</span>
      <select
        value={effTarget(job.target)}
        disabled={running || job.status === "converting"}
        onChange={(e) => setJobTarget(job.id, e.target.value as OutputFormat)}
        title="Target format for this file"
        className="h-8 shrink-0 rounded-md border border-[#2c2c31] bg-[#101012] px-2 font-mono text-[11px] uppercase text-white outline-none disabled:opacity-40"
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <div className="flex w-[86px] shrink-0 items-center justify-end gap-1">
        {job.status === "queued" && <span className="font-mono text-[10px] text-[#6e6e78]">queued</span>}
        {job.status === "converting" && <Loader2 size={14} className="animate-spin text-[#8fb6f5]" />}
        {job.status === "done" && desktop && job.output && (
          <span className="flex items-center gap-1">
            <button
              onClick={() => void revealInFolder(job.output!).catch((e) => showError(String(e)))}
              title="Show in folder"
              className="rounded-md border border-[#2c2c31] bg-[#101012] p-1.5 text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
            >
              <FolderOpen size={13} />
            </button>
            <button
              onClick={() => void sendToEditor(job.output!)}
              title="Open result in editor"
              className="rounded-md bg-[#2f7cf6] p-1.5 text-white hover:bg-[#3b8bff]"
            >
              <Check size={13} />
            </button>
          </span>
        )}
        {job.status === "done" && !desktop && webUrl && (
          <span className="flex items-center gap-1">
            <button
              onClick={onDownload}
              title="Download result"
              className="rounded-md border border-[#2c2c31] bg-[#101012] p-1.5 text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
            >
              <Download size={13} />
            </button>
            <button
              onClick={onSendWeb}
              title="Open result in editor"
              className="rounded-md bg-[#2f7cf6] p-1.5 text-white hover:bg-[#3b8bff]"
            >
              <Check size={13} />
            </button>
          </span>
        )}
        {job.status === "skipped" && <span className="font-mono text-[10px] text-[#d9a441]">skipped</span>}
        {!running && job.status !== "converting" && (
          <button
            onClick={() => removeJob(job.id)}
            title="Remove"
            className="rounded-md border border-[#2c2c31] bg-[#101012] p-1.5 text-[#a7a7b0] hover:border-[#e5534b] hover:text-white"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export async function sendToEditor(path: string) {
  try {
    const { rustImageInfo, rustDecodeToDataUrl } = await import("../io/tauriIo");
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    await openDataUrlInEditor(dataUrl, path.split(/[/\\]/).pop() ?? "Converted", info.width, info.height, path, info.file_size);
  } catch (e) {
    await showError(`Failed to open in editor: ${String(e)}`);
  }
}

export async function openDataUrlInEditor(
  dataUrl: string,
  name: string,
  w: number,
  h: number,
  path: string | null,
  size: number | null,
) {
  const st = useEditorStore.getState();
  st.openDocument(name, w, h, path, size);
  layerManager.clear();
  useHomeStore.getState().pushRecent({ name, path, thumb: dataUrl, full: dataUrl.length < 2_500_000 ? dataUrl : null, w, h, size });
  const img = new Image();
  img.onload = () => {
    const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
    if (!id) return;
    layerManager.ensure(id, w, h);
    layerManager.drawImageToLayer(id, img, w, h);
    useEditorStore.getState().markDirty();
    useProStore.getState().bumpHistogram();
  };
  img.src = dataUrl;
  useHomeStore.getState().setHome(false);
}

export default function ConverterPage() {
  const jobs = useConvertStore((s) => s.jobs);
  const settings = useConvertStore((s) => s.settings);
  const running = useConvertStore((s) => s.running);
  const done = useConvertStore((s) => s.done);
  const total = useConvertStore((s) => s.total);
  const startedAt = useConvertStore((s) => s.startedAt);
  const finishedAt = useConvertStore((s) => s.finishedAt);
  const [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [webUrls, setWebUrls] = useState<Record<string, string>>({});
  const webBlobs = useRef(new Map<string, Blob>());
  const webCancel = useRef(false);

  const queued = useMemo(() => jobs.filter((j) => j.status === "queued"), [jobs]);
  const okCount = useMemo(() => jobs.filter((j) => j.status === "done").length, [jobs]);
  const errCount = useMemo(() => jobs.filter((j) => j.status === "error").length, [jobs]);
  const inBytes = useMemo(() => jobs.reduce((a, j) => a + (j.size ?? 0), 0), [jobs]);
  const outBytes = useMemo(() => jobs.reduce((a, j) => a + (j.outSize ?? 0), 0), [jobs]);
  const previewOut = useMemo(() => {
    const j = queued[0] ?? jobs[0];
    if (!j) return null;
    const t = effTarget(j.target);
    const suffix = settings.suffix || defaultSuffix(j.input, t);
    return buildOutputPath(j.input, settings.outDir, t, {
      prefix: settings.prefix || undefined,
      suffix: suffix || undefined,
    });
  }, [queued, jobs, settings]);
  const showQuality = settings.target === "jpg" || (!desktop && settings.target === "webp");
  const showMatte = needsMatte(effTarget(settings.target));

  // Revoke web object URLs when their rows disappear.
  useEffect(() => {
    const ids = new Set(jobs.map((j) => j.id));
    setWebUrls((prev) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const [id, url] of Object.entries(prev)) {
        if (ids.has(id)) {
          next[id] = url;
        } else {
          changed = true;
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
          webBlobs.current.delete(id);
        }
      }
      return changed ? next : prev;
    });
  }, [jobs]);

  // Native file drop (desktop webview event carries real paths).
  useEffect(() => {
    if (!desktop) return;
    let unlisten: (() => void) | null = null;
    void getCurrentWebview()
      .onDragDropEvent((e) => {
        if (e.payload.type === "enter" || e.payload.type === "over") setDropActive(true);
        else if (e.payload.type === "leave") setDropActive(false);
        else if (e.payload.type === "drop") {
          setDropActive(false);
          const paths = e.payload.paths.filter(isInputSupported);
          if (paths.length > 0) void useConvertStore.getState().addPaths(paths);
          const rejected = e.payload.paths.length - paths.length;
          if (rejected > 0) void showError(`${rejected} file(s) skipped: format not supported.`);
        }
      })
      .then((u) => {
        unlisten = u;
      });
    return () => {
      unlisten?.();
    };
  }, []);

  function onWebDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => isInputSupported(f.name));
    if (files.length > 0) void useConvertStore.getState().addFiles(files);
    const rejected = e.dataTransfer.files.length - files.length;
    if (rejected > 0) void showError(`${rejected} file(s) skipped: format not supported.`);
  }

  async function addViaDialog() {
    if (busy) return;
    setBusy(true);
    try {
      if (desktop) {
        const paths = await browseImages();
        if (paths.length > 0) await useConvertStore.getState().addPaths(paths);
      } else {
        const picked = await new Promise<File[] | null>((resolve) => {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.accept = ".png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,.gif,.tga,.ico,.pnm,.pbm,.pgm,.ppm,.qoi";
          inp.multiple = true;
          inp.onchange = () => resolve(inp.files ? Array.from(inp.files) : []);
          inp.click();
        });
        if (picked && picked.length > 0) {
          const files = picked.filter((f) => isInputSupported(f.name));
          if (files.length > 0) await useConvertStore.getState().addFiles(files);
          if (files.length < picked.length) await showError(`${picked.length - files.length} file(s) skipped: format not supported.`);
        }
      }
    } catch (e) {
      await showError(`Could not open files: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function chooseOutDir() {
    try {
      const dir = await pickOutputFolder();
      if (dir) useConvertStore.getState().setSettings({ outDir: dir });
    } catch (e) {
      await showError(`Could not open folder: ${String(e)}`);
    }
  }

  function fileNameFor(j: ConvertJob, target: string): string {
    const suffix = settings.suffix || defaultSuffix(j.input, target);
    const stem = `${settings.prefix || ""}${j.name.replace(/\.[^.]+$/, "")}${suffix}`;
    return `${stem}.${target.toLowerCase()}`;
  }

  async function startBatch() {
    const st = useConvertStore.getState();
    if (st.running) return;
    const list = st.jobs.filter((j) => j.status === "queued");
    if (list.length === 0) return;
    if (desktop) await startDesktopBatch(list);
    else await startWebBatch(list);
  }

  async function startDesktopBatch(list: ConvertJob[]) {
    const st = useConvertStore.getState();
    const options = st.buildOptions();
    const planned: { job: ConvertJob; output: string }[] = [];
    for (const j of list) {
      const t = effTarget(j.target);
      let out = buildOutputPath(j.input, st.settings.outDir, t, {
        prefix: st.settings.prefix || undefined,
        suffix: st.settings.suffix || defaultSuffix(j.input, t) || undefined,
      });
      if (st.settings.overwrite === "skip" && (await pathExists(out))) {
        useConvertStore.setState((s) => ({
          jobs: s.jobs.map((x) => (x.id === j.id ? { ...x, status: "skipped" as const, output: out } : x)),
        }));
        continue;
      }
      if (st.settings.overwrite === "rename") out = await uniquePath(out);
      planned.push({ job: j, output: out });
      st.setJobOutput(j.id, out);
    }
    if (planned.length === 0) {
      await showMessage("Nothing to convert: all queued files were skipped.");
      return;
    }
    const batchId = `batch-${Date.now().toString(36)}`;
    st.beginBatch(batchId, planned.length);
    useConvertStore.setState((s) => ({
      jobs: s.jobs.map((x) =>
        planned.some((p) => p.job.id === x.id) ? { ...x, status: "converting" as const } : x,
      ),
    }));
    const unlisten = await listen<BatchProgress>("avero:convert-progress", (e) => {
      const p = e.payload;
      if (p.batch_id !== batchId) return;
      useConvertStore.getState().markProgress(p.current, p.ok, p.error, null);
    });
    try {
      const summary = await runBatch(
        batchId,
        planned.map((p) => ({ input: p.job.input, output: p.output })),
        options,
      );
      await Promise.all(
        planned.map(async ({ job }) => {
          const cur = useConvertStore.getState().jobs.find((x) => x.id === job.id);
          if (cur && cur.status === "done" && cur.output) {
            try {
              const info = await probeImage(cur.output);
              useConvertStore.getState().setJobOutSize(job.id, info.file_size);
            } catch {
              /* size optional */
            }
          }
        }),
      );
      if (summary.failed > 0) {
        await showError(`Converted ${summary.ok}, failed ${summary.failed}. See rows for details.`);
      } else {
        await showMessage(`Converted ${summary.ok} file(s) successfully.`);
      }
    } catch (e) {
      await showError(`Batch failed: ${String(e)}`);
    } finally {
      unlisten();
      useConvertStore.getState().endBatch();
    }
  }

  async function startWebBatch(list: ConvertJob[]) {
    const st = useConvertStore.getState();
    const batchId = `batch-${Date.now().toString(36)}`;
    st.beginBatch(batchId, list.length);
    useConvertStore.setState((s) => ({
      jobs: s.jobs.map((x) => (list.some((l) => l.id === x.id) ? { ...x, status: "converting" as const } : x)),
    }));
    webCancel.current = false;
    let ok = 0;
    let failed = 0;
    for (const j of list) {
      if (webCancel.current) {
        useConvertStore.setState((s) => ({
          jobs: s.jobs.map((x) =>
            x.id === j.id ? { ...x, status: "error" as const, error: "Cancelled" } : x,
          ),
          done: s.done + 1,
        }));
        failed += 1;
        continue;
      }
      if (!j.file) {
        useConvertStore.setState((s) => ({
          jobs: s.jobs.map((x) =>
            x.id === j.id ? { ...x, status: "error" as const, error: "File handle lost. Re-add the file." } : x,
          ),
          done: s.done + 1,
        }));
        failed += 1;
        continue;
      }
      const t = effTarget(j.target) as "png" | "jpg" | "webp";
      const name = fileNameFor(j, t);
      try {
        const { blob } = await webConvertImage(j.file, {
          format: t,
          quality: Math.max(1, Math.min(100, Math.round(st.settings.quality))),
          matte: hexToRgb(st.settings.matte),
          resize: {
            mode: st.settings.resizeMode,
            long_edge: st.settings.longEdge,
            width: parseInt(st.settings.exactW) || 1920,
            height: parseInt(st.settings.exactH) || 1080,
            fit: st.settings.fit,
            percent: parseFloat(st.settings.percent) || 100,
            preset: st.settings.preset,
          },
          noEnlarge: st.settings.noEnlarge,
        });
        const url = URL.createObjectURL(blob);
        webBlobs.current.set(j.id, blob);
        setWebUrls((prev) => ({ ...prev, [j.id]: url }));
        useConvertStore.setState((s) => ({
          jobs: s.jobs.map((x) =>
            x.id === j.id
              ? { ...x, status: "done" as const, error: null, output: name, outSize: blob.size }
              : x,
          ),
          done: s.done + 1,
        }));
        ok += 1;
      } catch (e) {
        useConvertStore.setState((s) => ({
          jobs: s.jobs.map((x) =>
            x.id === j.id ? { ...x, status: "error" as const, error: String(e) } : x,
          ),
          done: s.done + 1,
        }));
        failed += 1;
      }
    }
    useConvertStore.getState().endBatch();
    if (failed > 0) await showError(`Converted ${ok}, failed ${failed}. See rows for details.`);
    else await showMessage(`Converted ${ok} file(s). Use Download per row or Download all.`);
  }

  async function cancel() {
    const st = useConvertStore.getState();
    if (desktop && st.batchId) await cancelBatch(st.batchId);
    else webCancel.current = true;
  }

  function downloadOne(id: string) {
    const url = webUrls[id];
    const j = useConvertStore.getState().jobs.find((x) => x.id === id);
    if (!url || !j || !j.output) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = j.output;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll() {
    const s = useConvertStore.getState();
    s.jobs.forEach((j) => {
      if (j.status === "done" && webUrls[j.id] && j.output) downloadOne(j.id);
    });
  }

  async function sendWebToEditor(id: string) {
    const blob = webBlobs.current.get(id);
    const j = useConvertStore.getState().jobs.find((x) => x.id === id);
    if (!blob || !j) return;
    try {
      const bmp = await createImageBitmap(blob);
      const w = bmp.width;
      const h = bmp.height;
      bmp.close();
      const reader = new FileReader();
      reader.onload = () => {
        void openDataUrlInEditor(
          String(reader.result ?? ""),
          (j.output ?? j.name).replace(/\.[^.]+$/, ""),
          w,
          h,
          null,
          blob.size,
        );
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      await showError(`Failed to open in editor: ${String(e)}`);
    }
  }

  const elapsed = startedAt !== null ? ((finishedAt ?? Date.now()) - startedAt) / 1000 : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1240px] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[16px] font-bold text-white">Convert</div>
            <span className="rounded border border-[#2c2c31] bg-[#1c1c1f] px-1.5 py-px font-mono text-[10px] text-[#8fb6f5]">
              {jobs.length} files
            </span>
            {!desktop && (
              <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-px font-mono text-[10px] text-[#d9a441]">
                web mode: PNG/JPG/WebP
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-[#a7a7b0]">
            {desktop
              ? "Batch convert between PNG, JPG, WebP, BMP, TIFF, TGA and QOI with adjustable resolution and quality."
              : "Convert between PNG, JPG and WebP right in the browser. The desktop app unlocks BMP, TIFF, TGA and QOI."}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={addViaDialog}
            disabled={busy || running}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] font-medium text-white hover:border-[#3a3a41] disabled:opacity-40"
          >
            <Plus size={14} /> Add files
          </button>
          <button
            onClick={() => useConvertStore.getState().clearJobs()}
            disabled={busy || running || jobs.length === 0}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-transparent px-3 text-[12px] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white disabled:opacity-40"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          if (desktop) return;
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => {
          if (!desktop) setDropActive(false);
        }}
        onDrop={onWebDrop}
        className={clsx(
          "mt-4 rounded-lg border border-dashed p-6 text-center transition-colors",
          dropActive ? "border-[#2f7cf6] bg-[#2f7cf6]/10" : "border-[#2c2c31] bg-[#1c1c1f]",
        )}
      >
        <div className="text-[13px] font-semibold text-white">Drop images anywhere on this page</div>
        <div className="mt-1 text-[11px] text-[#6e6e78]">
          {desktop
            ? "or use Add files. PNG, JPG, WebP, BMP, TIFF, GIF, TGA, ICO, PNM, QOI."
            : "or use Add files. PNG, JPG, WebP, BMP, TIFF, GIF, TGA, ICO, PNM, QOI accepted, converted to PNG, JPG or WebP."}
        </div>
      </div>

      {/* Batch bar */}
      {(running || total > 0) && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#2c2c31] bg-[#161618] px-4 py-2.5">
          <div className="h-1.5 w-[180px] overflow-hidden rounded-full bg-[#2c2c31]">
            <div className="h-full rounded-full bg-[#2f7cf6] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[11px] text-[#a7a7b0]">
            {running ? `Converting ${done}/${total}` : `Done ${okCount} ok, ${errCount} failed in ${elapsed.toFixed(1)}s`}
          </span>
          {!running && inBytes > 0 && (
            <span className="hidden font-mono text-[10px] text-[#6e6e78] sm:block">
              {formatBytes(inBytes)} in{outBytes > 0 ? `, ${formatBytes(outBytes)} out` : ""}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {running ? (
              <button
                onClick={cancel}
                className="flex h-8 items-center gap-1.5 rounded-md border border-[#e5534b]/50 bg-[#e5534b]/10 px-3 text-[12px] font-semibold text-[#f0883e] hover:bg-[#e5534b]/20"
              >
                <X size={14} /> Cancel
              </button>
            ) : (
              <>
                {errCount > 0 && (
                  <button
                    onClick={() => useConvertStore.getState().retryFailed()}
                    className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-transparent px-3 text-[12px] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
                  >
                    <RotateCcw size={13} /> Retry failed
                  </button>
                )}
                {!desktop && okCount > 0 && (
                  <button
                    onClick={downloadAll}
                    className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] text-white hover:border-[#3a3a41]"
                  >
                    <Download size={14} /> Download all
                  </button>
                )}
                <button
                  onClick={() => useConvertStore.getState().clearFinished()}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-transparent px-3 text-[12px] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
                >
                  Clear finished
                </button>
                <button
                  onClick={startBatch}
                  disabled={queued.length === 0}
                  className="avero-btn-primary flex h-8 items-center gap-1.5 rounded-md px-4 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  <Play size={14} /> Convert {queued.length > 0 ? `${queued.length}` : ""}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Queue */}
        <div className="min-w-0">
          <h3 className="mb-2 text-[13px] font-bold text-white">Queue</h3>
          {jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#2c2c31] bg-[#1c1c1f] p-8 text-center">
              <ImageIcon size={20} className="mx-auto text-[#3a3a41]" />
              <div className="mt-2 text-[12px] font-semibold text-white">No files yet</div>
              <div className="mt-1 text-[11px] text-[#6e6e78]">Drop images here or press Add files to build a batch.</div>
            </div>
          ) : (
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {jobs.map((j) => (
                <Row
                  key={j.id}
                  job={j}
                  running={running}
                  webUrl={webUrls[j.id]}
                  onDownload={() => downloadOne(j.id)}
                  onSendWeb={() => void sendWebToEditor(j.id)}
                />
              ))}
            </div>
          )}
          {jobs.length > 0 && !running && queued.length > 0 && (
            <button
              onClick={startBatch}
              className="avero-btn-primary mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold text-white"
            >
              <Play size={15} /> Convert {queued.length} file(s) to {effTarget(settings.target).toUpperCase()}
            </button>
          )}
        </div>

        {/* Settings */}
        <div className={clsx("min-w-0", running && "pointer-events-none opacity-60")}>
          <h3 className="mb-2 text-[13px] font-bold text-white">Settings</h3>
          <div className="space-y-4 rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
            <div>
              <div className="avero-micro mb-1.5">Target format</div>
              <div className="flex flex-wrap gap-1.5">
                {OUTPUT_FORMATS.map((f) => {
                  const available = (FORMATS as readonly string[]).includes(f);
                  return (
                    <Pill
                      key={f}
                      active={settings.target === f}
                      disabled={!available}
                      title={available ? `Convert to ${f.toUpperCase()}` : `${f.toUpperCase()} needs the desktop app`}
                      onClick={() => useConvertStore.getState().setSettings({ target: f })}
                    >
                      {f.toUpperCase()}
                    </Pill>
                  );
                })}
              </div>
              {settings.target === "webp" && (
                <div className="mt-1.5 text-[10.5px] text-[#6e6e78]">WebP output is lossless.</div>
              )}
            </div>

            {showQuality && (
              <div>
                <div className="avero-micro mb-1.5">
                  {settings.target.toUpperCase()} quality <span className="ml-1 font-mono text-white">{settings.quality}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={settings.quality}
                  onChange={(e) => useConvertStore.getState().setSettings({ quality: Number(e.target.value) })}
                  className="h-1 w-full accent-[#2f7cf6]"
                />
                <div className="mt-1 flex justify-between font-mono text-[9px] text-[#4a4a52]">
                  <span>1 small</span>
                  <span>100 best</span>
                </div>
              </div>
            )}

            {settings.target === "png" && desktop && (
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#c9c9d1]">
                <input
                  type="checkbox"
                  checked={settings.pngBest}
                  onChange={(e) => useConvertStore.getState().setSettings({ pngBest: e.target.checked })}
                  className="accent-[#2f7cf6]"
                />
                Best PNG compression <span className="text-[10px] text-[#6e6e78]">(slower, smaller)</span>
              </label>
            )}

            {showMatte && (
              <div>
                <div className="avero-micro mb-1.5">Matte for transparency</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.matte}
                    onChange={(e) => useConvertStore.getState().setSettings({ matte: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded border border-[#2c2c31] bg-transparent"
                  />
                  <span className="font-mono text-[11px] uppercase text-white">{settings.matte}</span>
                </div>
                <div className="mt-1 text-[10.5px] text-[#6e6e78]">Transparent pixels blend onto this color.</div>
              </div>
            )}

            <div>
              <div className="avero-micro mb-1.5">Resolution</div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["original", "Original"],
                    ["long-edge", "Long edge"],
                    ["exact", "Exact"],
                    ["percent", "Percent"],
                    ["preset", "Preset"],
                  ] as const
                ).map(([v, l]) => (
                  <Pill
                    key={v}
                    active={settings.resizeMode === v}
                    onClick={() => useConvertStore.getState().setSettings({ resizeMode: v })}
                  >
                    {l}
                  </Pill>
                ))}
              </div>

              {settings.resizeMode === "long-edge" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={String(settings.longEdge)}
                    onChange={(e) => useConvertStore.getState().setSettings({ longEdge: Number(e.target.value.replace(/[^0-9]/g, "")) || 1920 })}
                    inputMode="numeric"
                    className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 font-mono text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                  />
                  <span className="font-mono text-[10px] text-[#6e6e78]">px</span>
                </div>
              )}

              {settings.resizeMode === "exact" && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={settings.exactW}
                      onChange={(e) => useConvertStore.getState().setSettings({ exactW: e.target.value.replace(/[^0-9]/g, "") })}
                      inputMode="numeric"
                      placeholder="W"
                      className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 font-mono text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                    />
                    <input
                      value={settings.exactH}
                      onChange={(e) => useConvertStore.getState().setSettings({ exactH: e.target.value.replace(/[^0-9]/g, "") })}
                      inputMode="numeric"
                      placeholder="H"
                      className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 font-mono text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {(["fit", "stretch", "fill"] as const).map((f) => (
                      <Pill key={f} active={settings.fit === f} onClick={() => useConvertStore.getState().setSettings({ fit: f })}>
                        {f}
                      </Pill>
                    ))}
                  </div>
                  <div className="text-[10.5px] text-[#6e6e78]">Fit keeps ratio, stretch distorts, fill crops center.</div>
                </div>
              )}

              {settings.resizeMode === "percent" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={settings.percent}
                    onChange={(e) => useConvertStore.getState().setSettings({ percent: e.target.value.replace(/[^0-9]/g, "") })}
                    inputMode="numeric"
                    className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 font-mono text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                  />
                  <span className="font-mono text-[10px] text-[#6e6e78]">% (1-800)</span>
                </div>
              )}

              {settings.resizeMode === "preset" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EDGE_PRESETS.map((p) => (
                    <Pill key={p} active={settings.preset === p} onClick={() => useConvertStore.getState().setSettings({ preset: p })}>
                      {p >= 1000 ? `${(p / 1000).toFixed(p % 1000 === 0 ? 0 : 1)}K` : `${p}`}
                    </Pill>
                  ))}
                </div>
              )}

              {settings.resizeMode !== "original" && (
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="avero-micro mb-1">Resample filter</div>
                    <select
                      value={settings.filter}
                      onChange={(e) => useConvertStore.getState().setSettings({ filter: e.target.value })}
                      className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2 text-[12px] text-white outline-none"
                    >
                      {RESIZE_FILTERS.map((f) => (
                        <option key={f} value={f}>
                          {f === "lanczos" ? "Lanczos3 (best)" : f[0].toUpperCase() + f.slice(1)}
                        </option>
                      ))}
                    </select>
                    {!desktop && (
                      <div className="mt-1 text-[10.5px] text-[#6e6e78]">Web mode maps this to high-quality smoothing.</div>
                    )}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#c9c9d1]">
                    <input
                      type="checkbox"
                      checked={settings.noEnlarge}
                      onChange={(e) => useConvertStore.getState().setSettings({ noEnlarge: e.target.checked })}
                      className="accent-[#2f7cf6]"
                    />
                    Never enlarge small images
                  </label>
                </div>
              )}
            </div>

            <div>
              <div className="avero-micro mb-1.5">Output</div>
              {desktop ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1 truncate rounded border border-[#2c2c31] bg-[#101012] px-2.5 py-2 font-mono text-[10px] text-[#a7a7b0]" title={settings.outDir ?? "Same folder as source"}>
                      {settings.outDir ?? "Same folder as source"}
                    </div>
                    <button
                      onClick={chooseOutDir}
                      className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] text-white hover:border-[#3a3a41]"
                    >
                      <FolderOpen size={13} /> Choose
                    </button>
                  </div>
                  {settings.outDir && (
                    <button
                      onClick={() => useConvertStore.getState().setSettings({ outDir: null })}
                      className="mt-1 font-mono text-[10px] text-[#6e6e78] hover:text-white"
                    >
                      Reset to source folder
                    </button>
                  )}
                </>
              ) : (
                <div className="rounded border border-[#2c2c31] bg-[#101012] px-2.5 py-2 font-mono text-[10px] text-[#a7a7b0]">
                  Downloads folder (browser)
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label>
                  <span className="avero-micro mb-1 block">Prefix</span>
                  <input
                    value={settings.prefix}
                    onChange={(e) => useConvertStore.getState().setSettings({ prefix: e.target.value })}
                    placeholder="-"
                    className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 text-[12px] text-white outline-none placeholder:text-[#4a4a52] focus:border-[#2f7cf6]"
                  />
                </label>
                <label>
                  <span className="avero-micro mb-1 block">Suffix</span>
                  <input
                    value={settings.suffix}
                    onChange={(e) => useConvertStore.getState().setSettings({ suffix: e.target.value })}
                    placeholder="auto"
                    className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 text-[12px] text-white outline-none placeholder:text-[#4a4a52] focus:border-[#2f7cf6]"
                  />
                </label>
              </div>
              {desktop && (
                <div className="mt-2">
                  <div className="avero-micro mb-1">If file exists</div>
                  <div className="flex gap-1.5">
                    {(["rename", "overwrite", "skip"] as const).map((o) => (
                      <Pill key={o} active={settings.overwrite === o} onClick={() => useConvertStore.getState().setSettings({ overwrite: o })}>
                        {o}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {previewOut && (
                <div className="mt-2 truncate rounded border border-[#2c2c31] bg-[#101012] px-2.5 py-2 font-mono text-[10px] text-[#6e6e78]" title={previewOut}>
                  e.g. {previewOut}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
