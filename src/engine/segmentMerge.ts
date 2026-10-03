// Plan5 Fase 4: pure merge policy for auto segmentation (unit-tested).
// Rust owns tensors and pixels; TypeScript owns boxes, labels and merge
// policy: dedupe near-duplicates, drop specks, order for layering.

export type SegmentSource = "yolo" | "stuff" | "text";

export interface MergeBox {
  label: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
  source: SegmentSource;
}

export function boxArea(b: { w: number; h: number }): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

export function iouBoxes(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const ix0 = Math.max(a.x, b.x);
  const iy0 = Math.max(a.y, b.y);
  const ix1 = Math.min(a.x + a.w, b.x + b.w);
  const iy1 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, ix1 - ix0);
  const ih = Math.max(0, iy1 - iy0);
  const inter = iw * ih;
  const ua = boxArea(a) + boxArea(b) - inter;
  return ua <= 0 ? 0 : inter / ua;
}

/** Drop near-duplicate boxes of the same label, keeping the best score. */
export function dedupeSameLabel<T extends MergeBox>(items: T[], iouThr = 0.85): T[] {
  const sorted = [...items].sort((p, q) => q.score - p.score);
  const kept: T[] = [];
  for (const it of sorted) {
    let clash = false;
    for (const k of kept) {
      if (k.label === it.label && iouBoxes(k, it) > iouThr) {
        clash = true;
        break;
      }
    }
    if (!clash) kept.push(it);
  }
  return kept;
}

/** Drop boxes under a fraction of the frame area (speck filter). */
export function filterMinArea<T extends { w: number; h: number }>(
  items: T[],
  frameArea: number,
  frac = 0.003,
): T[] {
  if (frameArea <= 0) return [];
  return items.filter((it) => boxArea(it) >= frameArea * frac);
}

export function sortAreaDesc<T extends { w: number; h: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => boxArea(b) - boxArea(a));
}

/** Reading order: bands of ~8% frame height, then left to right. */
export function readingOrder<T extends { x: number; y: number; w: number; h: number }>(
  items: T[],
  frameH: number,
): T[] {
  const band = Math.max(1, frameH * 0.08);
  return [...items].sort((a, b) => {
    const ra = Math.floor((a.y + a.h / 2) / band);
    const rb = Math.floor((b.y + b.h / 2) / band);
    if (ra !== rb) return ra - rb;
    return a.x - b.x;
  });
}

/** Round a box and clamp it inside the frame (min 2px side). */
export function clampBox(
  b: { x: number; y: number; w: number; h: number },
  W: number,
  H: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, Math.min(W - 1, Math.round(b.x)));
  const y = Math.max(0, Math.min(H - 1, Math.round(b.y)));
  const w = Math.max(2, Math.min(W - x, Math.round(b.w)));
  const h = Math.max(2, Math.min(H - y, Math.round(b.h)));
  return { x, y, w, h };
}

// Plan5 Fase 5.1: label language toggle. English is the default (matches the
// UI); Indonesian labels are used when the user enables the Settings toggle.
// The map covers the COCO things, curated ADE20K stuff and text labels the
// Rust engine can emit. Unknown labels pass through unchanged.
const SEGMENT_LABEL_ID: Record<string, string> = {
  person: "Orang",
  bicycle: "Sepeda",
  car: "Mobil",
  motorcycle: "Sepeda Motor",
  airplane: "Pesawat",
  bus: "Bus",
  train: "Kereta",
  truck: "Truk",
  boat: "Perahu",
  "traffic light": "Lampu Lalu Lintas",
  "fire hydrant": "Hydrant",
  "stop sign": "Rambu Berhenti",
  "parking meter": "Parkir Meter",
  bench: "Bangku",
  bird: "Burung",
  cat: "Kucing",
  dog: "Anjing",
  horse: "Kuda",
  sheep: "Domba",
  cow: "Sapi",
  elephant: "Gajah",
  bear: "Beruang",
  zebra: "Zebra",
  giraffe: "Jerapah",
  backpack: "Ransel",
  umbrella: "Payung",
  handbag: "Tas Tangan",
  tie: "Dasi",
  suitcase: "Koper",
  frisbee: "Frisbee",
  skis: "Sepatu Salju",
  snowboard: "Papan Salju",
  "sports ball": "Bola",
  kite: "Layangan",
  "baseball bat": "Tongkat Bisbol",
  "baseball glove": "Sarung Tangan Bisbol",
  skateboard: "Skateboard",
  surfboard: "Papan Selancar",
  "tennis racket": "Raket Tenis",
  bottle: "Botol",
  "wine glass": "Gelas Anggur",
  cup: "Cangkir",
  fork: "Garpu",
  knife: "Pisau",
  spoon: "Sendok",
  bowl: "Mangkuk",
  banana: "Pisang",
  apple: "Apel",
  sandwich: "Sandwich",
  orange: "Jeruk",
  broccoli: "Brokoli",
  carrot: "Wortel",
  "hot dog": "Hot Dog",
  pizza: "Pizza",
  donut: "Donat",
  cake: "Kue",
  chair: "Kursi",
  couch: "Sofa",
  "potted plant": "Tanaman Pot",
  bed: "Tempat Tidur",
  "dining table": "Meja Makan",
  toilet: "Toilet",
  tv: "Televisi",
  laptop: "Laptop",
  mouse: "Mouse",
  remote: "Remote",
  keyboard: "Keyboard",
  "cell phone": "Ponsel",
  microwave: "Microwave",
  oven: "Oven",
  toaster: "Pemanggang Roti",
  sink: "Wastafel",
  refrigerator: "Kulkas",
  book: "Buku",
  clock: "Jam",
  vase: "Vas",
  scissors: "Gunting",
  "teddy bear": "Boneka Beruang",
  "hair dryer": "Pengering Rambut",
  toothbrush: "Sikat Gigi",
  // ADE20K curated stuff classes
  house: "Rumah",
  building: "Gedung",
  sky: "Langit",
  road: "Jalan",
  grass: "Rumput",
  tree: "Pohon",
  water: "Air",
  mountain: "Gunung",
  sea: "Laut",
  field: "Lapangan",
  sidewalk: "Trotoar",
  earth: "Tanah",
  sand: "Pasir",
  river: "Sungai",
  hill: "Bukit",
  palm: "Pohon Palem",
  path: "Jalur",
  fence: "Pagar",
  bridge: "Jembatan",
  tower: "Menara",
  skyscraper: "Gedung Pencakar Langit",
  lake: "Danau",
  land: "Daratan",
  // Text detection
  text: "Tulisan",
};

/** Translate an English segment label to Indonesian (identity when unknown). */
export function segmentLabelId(label: string): string {
  const key = label.toLowerCase();
  return SEGMENT_LABEL_ID[key] ?? label;
}

/** Build the layer name for a detected object, honoring the language toggle. */
export function segmentLayerName(label: string, n: number, idMode: boolean): string {
  const base = idMode ? segmentLabelId(label) : label;
  return `${base} ${n}`;
}
