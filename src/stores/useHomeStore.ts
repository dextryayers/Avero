import { create } from "zustand";
import { rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";

export interface RecentFile {
  id: string;
  name: string;
  path: string | null;
  thumb: string | null;
  full: string | null; // full dataURL when small, for offline reopen
  w: number;
  h: number;
  size: number | null;
  time: number;
}

interface HomeState {
  homeOpen: boolean;
  recents: RecentFile[];
  setHome: (v: boolean) => void;
  pushRecent: (r: Omit<RecentFile, "id" | "time">) => void;
  removeRecent: (id: string) => void;
  clearRecents: () => void;
  stripHeavyRecents: () => number;
}

const KEY = "avero-recents-v1";

function loadRecents(): RecentFile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentFile[];
    return Array.isArray(arr) ? arr.slice(0, 18) : [];
  } catch {
    return [];
  }
}

function saveRecents(r: RecentFile[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r.slice(0, 18)));
  } catch {
    // storage full (large thumbs): persist without full/thumb
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(r.slice(0, 18).map((x) => ({ ...x, full: null, thumb: null }))),
      );
    } catch {
      /* ignore */
    }
  }
}

let seq = 0;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  homeOpen: true,
  recents: loadRecents(),
  setHome: (homeOpen) => set({ homeOpen }),
  pushRecent: (r) => {
    const entry: RecentFile = { ...r, id: uid("recent"), time: Date.now() };
    const dedup = get().recents.filter(
      (x) => !(x.path && r.path && x.path === r.path) && x.name !== r.name,
    );
    // Keep full image bytes only for the 3 newest entries. Older entries
    // reload from disk through Rust, which keeps the JS heap flat.
    const next = [entry, ...dedup]
      .slice(0, 18)
      .map((x, i) => (i > 2 && x.full ? { ...x, full: null } : x));
    set({ recents: next });
    saveRecents(next);
  },
  stripHeavyRecents: () => {
    const recents = get().recents;
    let freed = 0;
    const next = recents.map((x, i) => {
      if (i > 2 && x.full) {
        freed += x.full.length;
        return { ...x, full: null };
      }
      return x;
    });
    if (freed > 0) set({ recents: next });
    return freed;
  },
  removeRecent: (id) => {
    const next = get().recents.filter((x) => x.id !== id);
    set({ recents: next });
    saveRecents(next);
  },
  clearRecents: () => {
    set({ recents: [] });
    saveRecents([]);
  },
}));

// Reopen from recents: full dataURL first, then path via Rust, else null.
export async function resolveRecent(r: RecentFile): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (r.full) return { dataUrl: r.full, w: r.w, h: r.h };
  if (r.path) {
    if (r.path.toLowerCase().endsWith(".avx")) return null;
    const info = await rustImageInfo(r.path);
    const dataUrl = await rustDecodeToDataUrl(r.path, 2048);
    return { dataUrl, w: info.width, h: info.height };
  }
  return null;
}
