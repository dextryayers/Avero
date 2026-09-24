import { create } from "zustand";

export interface MacroStep {
  id: string;
  label: string;
  time: number;
  action: { type: string; payload: any };
}

export interface BatchItem {
  id: string;
  path: string;
  name: string;
  status: "queued" | "working" | "done" | "error";
  log: string;
}

interface AutomationState {
  recording: boolean;
  macro: MacroStep[];
  presets: { id: string; name: string; steps: MacroStep[] }[];
  batch: BatchItem[];
  startRec: () => void;
  stopRec: () => void;
  pushStep: (label: string, action: MacroStep["action"]) => void;
  clearMacro: () => void;
  savePreset: (name: string) => void;
  applyPresetSteps: (id: string) => MacroStep[];
  enqueueBatch: (files: { path: string; name: string }[]) => void;
  setBatchStatus: (id: string, status: BatchItem["status"], log?: string) => void;
  clearBatch: () => void;
}

let seq = 0;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  recording: false,
  macro: [],
  presets: [
    {
      id: "preset-produk",
      name: "Produk marketplace cerah",
      steps: [
        { id: "s1", label: "Exposure +0.4", time: Date.now(), action: { type: "adjustment/exposure", payload: { exposure: 0.4 } } },
        { id: "s2", label: "Contrast +14", time: Date.now(), action: { type: "adjustment/contrast", payload: { contrast: 14 } } },
        { id: "s3", label: "Sharpen 40", time: Date.now(), action: { type: "filter/sharpen", payload: { amount: 40 } } },
      ],
    },
    {
      id: "preset-portrait",
      name: "Portrait lembut",
      steps: [
        { id: "s1", label: "Brightness +6 contrast -8", time: Date.now(), action: { type: "adjustment/bc", payload: { brightness: 6, contrast: -8 } } },
        { id: "s2", label: "Saturation -6", time: Date.now(), action: { type: "adjustment/hsl", payload: { saturation: -6 } } },
      ],
    },
  ],
  batch: [],
  startRec: () => set({ recording: true, macro: [] }),
  stopRec: () => set({ recording: false }),
  pushStep: (label, action) => {
    if (!get().recording) return;
    set((s) => ({ macro: [...s.macro, { id: uid("step"), label, time: Date.now(), action }] }));
  },
  clearMacro: () => set({ macro: [] }),
  savePreset: (name) =>
    set((s) => ({ presets: [...s.presets, { id: uid("preset"), name, steps: [...s.macro] }], macro: [], recording: false })),
  applyPresetSteps: (id) => get().presets.find((p) => p.id === id)?.steps ?? [],
  enqueueBatch: (files) =>
    set((s) => ({ batch: [...s.batch, ...files.map((f) => ({ id: uid("job"), path: f.path, name: f.name, status: "queued" as const, log: "Antre" }))] })),
  setBatchStatus: (id, status, log) =>
    set((s) => ({ batch: s.batch.map((b) => (b.id === id ? { ...b, status, log: log ?? b.log } : b)) })),
  clearBatch: () => set({ batch: [] }),
}));
