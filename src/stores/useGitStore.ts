import { create } from "zustand";

export interface GitSnapshot {
  id: string;
  branch: string;
  label: string;
  time: number;
  thumb: string; // dataURL kecil
  layersCount: number;
}

interface GitState {
  branches: string[];
  activeBranch: string;
  snaps: GitSnapshot[];
  compareA: string | null;
  compareB: string | null;
  snapshot: (label: string, thumb: string, layersCount: number) => void;
  createBranch: (name: string) => void;
  switchBranch: (name: string) => void;
  setCompare: (a: string | null, b: string | null) => void;
  clear: () => void;
}

let seq = 0;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

export const useGitStore = create<GitState>((set) => ({
  branches: ["main"],
  activeBranch: "main",
  snaps: [],
  compareA: null,
  compareB: null,
  snapshot: (label, thumb, layersCount) =>
    set((s) => ({
      snaps: [
        ...s.snaps.slice(-29),
        { id: uid("snap"), branch: s.activeBranch, label, time: Date.now(), thumb, layersCount },
      ],
    })),
  createBranch: (name) => {
    const n = name.trim() || `varian-${Date.now().toString(36)}`;
    set((s) => ({ branches: [...new Set([...s.branches, n])], activeBranch: n }));
  },
  switchBranch: (activeBranch) => set({ activeBranch }),
  setCompare: (compareA, compareB) => set({ compareA, compareB }),
  clear: () =>
    set({ snaps: [], branches: ["main"], activeBranch: "main", compareA: null, compareB: null }),
}));
