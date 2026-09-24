import { create } from "zustand";

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  preset: string;
}

const PRESETS: Record<string, { w: number; h: number }> = {
  "IG Post 1080": { w: 1080, h: 1080 },
  "IG Story 1080x1920": { w: 1080, h: 1920 },
  "Carousel 1080x1350": { w: 1080, h: 1350 },
  "FB Cover 1640x924": { w: 1640, h: 924 },
  "A4 2480x3508": { w: 2480, h: 3508 },
  Custom: { w: 800, h: 600 },
};

interface ArtState {
  boards: Artboard[];
  add: (preset?: string) => void;
  update: (id: string, p: Partial<Artboard>) => void;
  remove: (id: string) => void;
}

let seq = 0;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

export const useArtboardStore = create<ArtState>((set) => ({
  boards: [
    { id: uid("art"), name: "Artboard 1", x: 0, y: 0, w: 1080, h: 1080, preset: "IG Post 1080" },
  ],
  add: (preset = "IG Post 1080") =>
    set((s) => {
      const size = PRESETS[preset] ?? PRESETS.Custom;
      return {
        boards: [
          ...s.boards,
          {
            id: uid("art"),
            name: `Artboard ${s.boards.length + 1}`,
            x: s.boards.length * 60,
            y: 0,
            w: size.w,
            h: size.h,
            preset,
          },
        ],
      };
    }),
  update: (id, p) =>
    set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, ...p } : b)) })),
  remove: (id) => set((s) => ({ boards: s.boards.filter((b) => b.id !== id) })),
}));

export const ART_PRESETS = Object.keys(PRESETS);
