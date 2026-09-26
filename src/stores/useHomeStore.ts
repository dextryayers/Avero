import { create } from "zustand";

export interface RecentFile {
  id: string;
  name: string;
  path: string | null;
  thumb: string | null;
  full: string | null; // dataURL penuh bila kecil, untuk buka ulang offline
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
    // storage penuh (thumb besar): simpan tanpa full/thumb
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(r.slice(0, 18).map((x) => ({ ...x, full: null, thumb: null }))),
      );
    } catch {
      /* abaikan */
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
    const next = [entry, ...dedup].slice(0, 18);
    set({ recents: next });
    saveRecents(next);
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

// Buka ulang dari recent: full dataURL dulu, lalu path via Rust, else null.
export async function resolveRecent(r: RecentFile): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (r.full) return { dataUrl: r.full, w: r.w, h: r.h };
  if (r.path) {
    if (r.path.toLowerCase().endsWith(".avx")) return null;
    const { rustDecodeToDataUrl, rustImageInfo } = await import("../io/tauriIo");
    const info = await rustImageInfo(r.path);
    const dataUrl = await rustDecodeToDataUrl(r.path, 2048);
    return { dataUrl, w: info.width, h: info.height };
  }
  return null;
}
