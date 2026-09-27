import { create } from "zustand";
import {
  baseOf,
  buildOutputPath,
  defaultSuffix,
  extOf,
  probeImage,
  thumbFor,
  type ConvertOptions,
  type OutputFormat,
} from "../io/convert";

export type JobStatus = "queued" | "converting" | "done" | "error" | "skipped";

export interface ConvertJob {
  id: string;
  input: string;
  name: string;
  target: OutputFormat;
  overridden: boolean; // true when the row format differs from global
  status: JobStatus;
  w: number | null;
  h: number | null;
  size: number | null;
  srcFormat: string;
  thumb: string | null;
  output: string | null;
  outSize: number | null;
  error: string | null;
}

export type ResizeMode = "original" | "long-edge" | "exact" | "percent" | "preset";
export type FitMode = "fit" | "stretch" | "fill";

interface ConvertSettings {
  target: OutputFormat;
  quality: number; // JPEG 1-100
  pngBest: boolean;
  matte: string; // hex
  resizeMode: ResizeMode;
  longEdge: number;
  exactW: string;
  exactH: string;
  fit: FitMode;
  percent: string;
  preset: number;
  filter: string;
  noEnlarge: boolean;
  outDir: string | null; // null = beside source in converted/
  prefix: string;
  suffix: string;
  overwrite: "overwrite" | "skip" | "rename";
}

interface ConvertState {
  jobs: ConvertJob[];
  settings: ConvertSettings;
  running: boolean;
  batchId: string | null;
  done: number;
  total: number;
  startedAt: number | null;
  finishedAt: number | null;

  addPaths: (paths: string[]) => Promise<void>;
  removeJob: (id: string) => void;
  clearJobs: () => void;
  clearFinished: () => void;
  setJobTarget: (id: string, t: OutputFormat) => void;
  setSettings: (p: Partial<ConvertSettings>) => void;
  markConverting: (input: string) => void;
  markProgress: (input: string, ok: boolean, error: string | null, output: string | null) => void;
  setJobOutput: (id: string, output: string) => void;
  setJobOutSize: (id: string, outSize: number) => void;
  beginBatch: (batchId: string, total: number) => void;
  endBatch: () => void;
  buildOptions: () => ConvertOptions;
  outputFor: (j: ConvertJob) => string;
}

let seq = 0;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export const useConvertStore = create<ConvertState>((set, get) => ({
  jobs: [],
  settings: {
    target: "jpg",
    quality: 92,
    pngBest: false,
    matte: "#ffffff",
    resizeMode: "original",
    longEdge: 1920,
    exactW: "1920",
    exactH: "1080",
    fit: "fit",
    percent: "100",
    preset: 1920,
    filter: "lanczos",
    noEnlarge: true,
    outDir: null,
    prefix: "",
    suffix: "",
    overwrite: "rename",
  },
  running: false,
  batchId: null,
  done: 0,
  total: 0,
  startedAt: null,
  finishedAt: null,

  addPaths: async (paths) => {
    const st = get();
    const fresh: ConvertJob[] = paths.map((p) => ({
      id: uid("job"),
      input: p,
      name: p.split(/[/\\]/).pop() ?? p,
      target: st.settings.target,
      overridden: false,
      status: "queued" as JobStatus,
      w: null,
      h: null,
      size: null,
      srcFormat: extOf(p),
      thumb: null,
      output: null,
      outSize: null,
      error: null,
    }));
    set((s) => ({ jobs: [...s.jobs, ...fresh] }));
    // Probe + thumbnail per file, failures mark the row (batch continues).
    await Promise.all(
      fresh.map(async (j) => {
        try {
          const info = await probeImage(j.input);
          const thumb = await thumbFor(j.input);
          set((s) => ({
            jobs: s.jobs.map((x) =>
              x.id === j.id
                ? { ...x, w: info.width, h: info.height, size: info.file_size, srcFormat: info.format, thumb }
                : x,
            ),
          }));
        } catch (e) {
          set((s) => ({
            jobs: s.jobs.map((x) =>
              x.id === j.id ? { ...x, status: "error" as JobStatus, error: String(e) } : x,
            ),
          }));
        }
      }),
    );
  },

  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  clearJobs: () => set({ jobs: [], done: 0, total: 0, startedAt: null, finishedAt: null }),
  clearFinished: () =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.status === "queued" || j.status === "converting") })),

  setJobTarget: (id, t) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, target: t, overridden: t !== s.settings.target } : j)),
    })),

  setSettings: (p) =>
    set((s) => {
      const settings = { ...s.settings, ...p };
      // Global target change flows into queued rows that were not overridden.
      const jobs =
        p.target !== undefined
          ? s.jobs.map((j) =>
              j.status === "queued" && !j.overridden ? { ...j, target: p.target! } : j,
            )
          : s.jobs;
      return { settings, jobs };
    }),

  markConverting: (input) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.input === input ? { ...j, status: "converting" as JobStatus } : j)) })),

  setJobOutput: (id, output) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, output } : j)) })),

  setJobOutSize: (id, outSize) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, outSize } : j)) })),

  markProgress: (input, ok, error, output) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.name === input || j.input === input
          ? { ...j, status: ok ? ("done" as JobStatus) : ("error" as JobStatus), error, output }
          : j,
      ),
      done: s.done + 1,
    })),

  beginBatch: (batchId, total) =>
    set({ running: true, batchId, done: 0, total, startedAt: Date.now(), finishedAt: null }),

  endBatch: () => set({ running: false, batchId: null, finishedAt: Date.now() }),

  outputFor: (j) => {
    const s = get().settings;
    const suffix = s.suffix || defaultSuffix(j.input, j.target);
    return buildOutputPath(j.input, s.outDir, j.target, {
      prefix: s.prefix || undefined,
      suffix: suffix || undefined,
      overwrite: s.overwrite,
    });
  },

  buildOptions: () => {
    const s = get().settings;
    const resizeMode = s.resizeMode;
    return {
      format: s.target,
      quality: Math.max(1, Math.min(100, Math.round(s.quality))),
      png_best: s.pngBest,
      matte: hexToRgb(s.matte),
      resize: {
        mode: resizeMode === "original" ? "original" : resizeMode,
        long_edge: Math.max(16, Math.min(16384, Math.round(s.longEdge) || 1920)),
        width: Math.max(1, Math.min(16384, parseInt(s.exactW) || 1920)),
        height: Math.max(1, Math.min(16384, parseInt(s.exactH) || 1080)),
        fit: s.fit,
        percent: Math.max(1, Math.min(800, parseFloat(s.percent) || 100)),
        preset: s.preset,
      },
      filter: s.filter,
      no_enlarge: s.noEnlarge,
    };
  },
}));

export function jobDisplayName(j: ConvertJob): string {
  return j.name || baseOf(j.input);
}
