import { create } from "zustand";

// Plan5 Fase 7: object metadata for the Objects panel. Each entry tracks
// the layer created by auto-segment, its label, confidence, and mask
// thumbnail. The panel reads this store to render the list.

export interface ObjectEntry {
  id: string;
  layerId: string;
  label: string;
  confidence: number;
  thumb: string | null;
  source: string;
}

interface ObjectState {
  objects: ObjectEntry[];
  selectedId: string | null;
  setObjects: (objects: ObjectEntry[]) => void;
  addObject: (obj: ObjectEntry) => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  clearObjects: () => void;
}

export const useObjectStore = create<ObjectState>((set) => ({
  objects: [],
  selectedId: null,
  setObjects: (objects) => set({ objects }),
  addObject: (obj) => set((s) => ({ objects: [...s.objects, obj] })),
  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  selectObject: (id) => set({ selectedId: id }),
  clearObjects: () => set({ objects: [], selectedId: null }),
}));
