import { create } from "zustand";

export type WorkspaceId = "photography" | "retouching" | "design" | "minimal";

interface WorkspaceState {
  active: WorkspaceId;
  rightTab: string | null; // override tab kanan per workspace
  showPrompt: boolean;
  showNode: boolean;
  onboardingDone: boolean;
  setWorkspace: (w: WorkspaceId) => void;
  setRightTab: (t: string | null) => void;
  setShowPrompt: (v: boolean) => void;
  setShowNode: (v: boolean) => void;
  setOnboarding: (v: boolean) => void;
}

const saved = (() => {
  try {
    return localStorage.getItem("psd-workspace") as WorkspaceId | null;
  } catch {
    return null;
  }
})();

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  active: saved ?? "retouching",
  rightTab: null,
  showPrompt: true,
  showNode: false,
  onboardingDone: (() => {
    try {
      return localStorage.getItem("psd-onboarding") === "done";
    } catch {
      return false;
    }
  })(),
  setWorkspace: (active) => {
    try {
      localStorage.setItem("psd-workspace", active);
    } catch {
      /* abaikan */
    }
    // preset per workspace
    const map: Record<WorkspaceId, { tab: string; prompt: boolean; node: boolean }> = {
      photography: { tab: "raw", prompt: false, node: false },
      retouching: { tab: "layers", prompt: true, node: false },
      design: { tab: "text", prompt: true, node: true },
      minimal: { tab: "layers", prompt: false, node: false },
    };
    const m = map[active];
    set({ active, rightTab: m.tab, showPrompt: m.prompt, showNode: m.node });
  },
  setRightTab: (rightTab) => set({ rightTab }),
  setShowPrompt: (showPrompt) => set({ showPrompt }),
  setShowNode: (showNode) => set({ showNode }),
  setOnboarding: (onboardingDone) => {
    try {
      localStorage.setItem("psd-onboarding", onboardingDone ? "done" : "");
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
  eraser: "E",
  eyedropper: "I",
  text: "T",
  "shape-rect": "U",
  pan: "H",
  zoom: "Z",
};

export function loadShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem("psd-shortcuts");
    if (raw) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) };
  } catch {
    /* abaikan */
  }
  return { ...DEFAULT_SHORTCUTS };
}

export function saveShortcuts(m: ShortcutMap) {
  try {
    localStorage.setItem("psd-shortcuts", JSON.stringify(m));
  } catch {
    /* abaikan */
  }
}
