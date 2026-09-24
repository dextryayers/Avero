import { create } from "zustand";
import type { AiJob, AiModelInfo } from "../engine/ai/runtime";
import { listAiModels } from "../engine/ai/runtime";

interface AiState {
  models: AiModelInfo[];
  jobs: AiJob[];
  lastResult: string | null;
  autoColorRef: string | null;
  refreshModels: () => void;
  pushJob: (j: AiJob) => void;
  updateJob: (id: string, p: Partial<AiJob>) => void;
  removeJob: (id: string) => void;
  setResult: (s: string | null) => void;
  setColorRef: (s: string | null) => void;
}

export const useAiStore = create<AiState>((set) => ({
  models: listAiModels(),
  jobs: [],
  lastResult: null,
  autoColorRef: null,
  refreshModels: () => set({ models: listAiModels() }),
  pushJob: (j) => set((s) => ({ jobs: [...s.jobs, j] })),
  updateJob: (id, p) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  setResult: (lastResult) => set({ lastResult }),
  setColorRef: (autoColorRef) => set({ autoColorRef }),
}));
