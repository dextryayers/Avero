import { create } from "zustand";

export type WorkspaceId = "photography" | "retouching" | "design" | "minimal";

interface WorkspaceState {
  active: WorkspaceId;
  rightTab: string | null; // override tab kanan per workspace
  showNode: boolean;
  onboardingDone: boolean;
  setWorkspace: (w: WorkspaceId) => void;
  setRightTab: (t: string | null) => void;
  setShowNode: (v: boolean) => void;
  setOnboarding: (v: boolean) => void;
}

const saved = (() => {
  try {
    return localStorage.getItem("avero-workspace") as WorkspaceId | null;
  } catch {
    return null;
  }
})();

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  active: saved ?? "retouching",
  rightTab: null,
  showNode: false,
  onboardingDone: (() => {
    try {
      return localStorage.getItem("avero-onboarding") === "done";
    } catch {
      return false;
    }
  })(),
  setWorkspace: (active) => {
    try {
      localStorage.setItem("avero-workspace", active);
    } catch {
      /* abaikan */
    }
    // preset per workspace
    const map: Record<WorkspaceId, { tab: string; node: boolean }> = {
      photography: { tab: "raw", node: false },
      retouching: { tab: "layers", node: false },
      design: { tab: "text", node: true },
      minimal: { tab: "layers", node: false },
    };
    const m = map[active];
    set({ active, rightTab: m.tab, showNode: m.node });
  },
  setRightTab: (rightTab) => set({ rightTab }),
  setShowNode: (showNode) => set({ showNode }),
  setOnboarding: (onboardingDone) => {
    try {
      localStorage.setItem("avero-onboarding", onboardingDone ? "done" : "");
    } catch {
      /* abaikan */
    }
    set({ onboardingDone });
  },
}));

// Shortcut map yang bisa diedit user
export type ShortcutMap = Record<string, string>;

const DEFAULT_SHORTCUTS: ShortcutMap = {
  move: "V",
  "select-rect": "M",
  "select-lasso": "L",
  wand: "W",
  brush: "B",
  "spot-heal": "J",
  clone: "S",
  blur: "R",
  dodge: "O",
  eraser: "E",
  gradient: "G",
  fill: "Shift+G",
  eyedropper: "I",
  text: "T",
  "shape-rect": "U",
  pen: "P",
  crop: "C",
  pan: "H",
  zoom: "Z",
};

export function loadShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem("avero-shortcuts");
    if (raw) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) };
  } catch {
    /* abaikan */
  }
  return { ...DEFAULT_SHORTCUTS };
}

export function saveShortcuts(m: ShortcutMap) {
  try {
    localStorage.setItem("avero-shortcuts", JSON.stringify(m));
  } catch {
    /* abaikan */
  }
}
