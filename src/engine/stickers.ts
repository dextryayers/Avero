// Sticker engine: 72 ready to place stickers in 6 categories.
// A sticker renders as a photo style decal: the glyph painted on a
// transparent tile with a thick white halo and a soft drop shadow, so it
// reads clearly on any background. Placed stickers become normal raster
// layers, which means the blue transform box can move, resize and rotate
// them exactly like imported photos.

export type StickerCategory = "faces" | "gestures" | "symbols" | "animals" | "food" | "nature";

export interface StickerMeta {
  id: string;
  label: string;
  glyph: string;
  category: StickerCategory;
  description: string;
}

export const STICKER_CATEGORIES: { id: StickerCategory; label: string }[] = [
  { id: "faces", label: "Faces" },
  { id: "gestures", label: "Gestures" },
  { id: "symbols", label: "Symbols" },
  { id: "animals", label: "Animals" },
  { id: "food", label: "Food" },
  { id: "nature", label: "Nature" },
];

function meta(id: string, label: string, glyph: string, category: StickerCategory): StickerMeta {
  return {
    id,
    label,
    glyph,
    category,
    description: `${label} sticker. Click the canvas to place it.`,
  };
}

export const STICKER_META: StickerMeta[] = [
  // Faces (12)
  meta("sticker-smile", "Smile", "\u{1F600}", "faces"),
  meta("sticker-laugh", "Laugh", "\u{1F602}", "faces"),
  meta("sticker-wink", "Wink", "\u{1F609}", "faces"),
  meta("sticker-cool", "Cool", "\u{1F60E}", "faces"),
  meta("sticker-party-face", "Party Face", "\u{1F973}", "faces"),
  meta("sticker-heart-eyes", "Heart Eyes", "\u{1F60D}", "faces"),
  meta("sticker-star-struck", "Star Struck", "\u{1F929}", "faces"),
  meta("sticker-sleepy", "Sleepy", "\u{1F634}", "faces"),
  meta("sticker-clown", "Clown", "\u{1F921}", "faces"),
  meta("sticker-robot", "Robot", "\u{1F916}", "faces"),
  meta("sticker-alien", "Alien", "\u{1F47D}", "faces"),
  meta("sticker-ghost", "Ghost", "\u{1F47B}", "faces"),
  // Gestures (8)
  meta("sticker-thumbs-up", "Thumbs Up", "\u{1F44D}", "gestures"),
  meta("sticker-ok-hand", "OK Hand", "\u{1F44C}", "gestures"),
  meta("sticker-peace", "Peace", "\u270C\uFE0F", "gestures"),
  meta("sticker-pray", "Pray", "\u{1F64F}", "gestures"),
  meta("sticker-clap", "Clap", "\u{1F44F}", "gestures"),
  meta("sticker-wave", "Wave", "\u{1F44B}", "gestures"),
  meta("sticker-rock-on", "Rock On", "\u{1F918}", "gestures"),
  meta("sticker-love-you", "Love You", "\u{1F91F}", "gestures"),
  // Symbols (14)
  meta("sticker-red-heart", "Red Heart", "\u2764\uFE0F", "symbols"),
  meta("sticker-sparkles", "Sparkles", "\u2728", "symbols"),
  meta("sticker-star", "Star", "\u2B50", "symbols"),
  meta("sticker-fire", "Fire", "\u{1F525}", "symbols"),
  meta("sticker-lightning", "Lightning", "\u26A1", "symbols"),
  meta("sticker-hundred", "Hundred", "\u{1F4AF}", "symbols"),
  meta("sticker-party-popper", "Party Popper", "\u{1F389}", "symbols"),
  meta("sticker-balloon", "Balloon", "\u{1F388}", "symbols"),
  meta("sticker-crown", "Crown", "\u{1F451}", "symbols"),
  meta("sticker-gem", "Gem", "\u{1F48E}", "symbols"),
  meta("sticker-trophy", "Trophy", "\u{1F3C6}", "symbols"),
  meta("sticker-medal", "Medal", "\u{1F3C5}", "symbols"),
  meta("sticker-rocket", "Rocket", "\u{1F680}", "symbols"),
  meta("sticker-gift", "Gift", "\u{1F381}", "symbols"),
  // Animals (14)
  meta("sticker-cat", "Cat", "\u{1F431}", "animals"),
  meta("sticker-dog", "Dog", "\u{1F436}", "animals"),
  meta("sticker-fox", "Fox", "\u{1F98A}", "animals"),
  meta("sticker-panda", "Panda", "\u{1F43C}", "animals"),
  meta("sticker-frog", "Frog", "\u{1F438}", "animals"),
  meta("sticker-monkey", "Monkey", "\u{1F435}", "animals"),
  meta("sticker-lion", "Lion", "\u{1F981}", "animals"),
  meta("sticker-tiger", "Tiger", "\u{1F42F}", "animals"),
  meta("sticker-unicorn", "Unicorn", "\u{1F984}", "animals"),
  meta("sticker-chick", "Chick", "\u{1F424}", "animals"),
  meta("sticker-penguin", "Penguin", "\u{1F427}", "animals"),
  meta("sticker-butterfly", "Butterfly", "\u{1F98B}", "animals"),
  meta("sticker-ladybug", "Ladybug", "\u{1F41E}", "animals"),
  meta("sticker-bee", "Bee", "\u{1F41D}", "animals"),
  // Food (14)
  meta("sticker-pizza", "Pizza", "\u{1F355}", "food"),
  meta("sticker-burger", "Burger", "\u{1F354}", "food"),
  meta("sticker-fries", "Fries", "\u{1F35F}", "food"),
  meta("sticker-taco", "Taco", "\u{1F32E}", "food"),
  meta("sticker-sushi", "Sushi", "\u{1F363}", "food"),
  meta("sticker-donut", "Donut", "\u{1F369}", "food"),
  meta("sticker-cupcake", "Cupcake", "\u{1F9C1}", "food"),
  meta("sticker-ice-cream", "Ice Cream", "\u{1F366}", "food"),
  meta("sticker-candy", "Candy", "\u{1F36C}", "food"),
  meta("sticker-lollipop", "Lollipop", "\u{1F36D}", "food"),
  meta("sticker-coffee", "Coffee", "\u2615", "food"),
  meta("sticker-bubble-tea", "Bubble Tea", "\u{1F9CB}", "food"),
  meta("sticker-strawberry", "Strawberry", "\u{1F353}", "food"),
  meta("sticker-watermelon", "Watermelon", "\u{1F349}", "food"),
  // Nature (10)
  meta("sticker-sunflower", "Sunflower", "\u{1F33B}", "nature"),
  meta("sticker-rose", "Rose", "\u{1F339}", "nature"),
  meta("sticker-cactus", "Cactus", "\u{1F335}", "nature"),
  meta("sticker-mushroom", "Mushroom", "\u{1F344}", "nature"),
  meta("sticker-sun", "Sun", "\u2600\uFE0F", "nature"),
  meta("sticker-rainbow", "Rainbow", "\u{1F308}", "nature"),
  meta("sticker-cloud", "Cloud", "\u2601\uFE0F", "nature"),
  meta("sticker-snowflake", "Snowflake", "\u2744\uFE0F", "nature"),
  meta("sticker-ocean-wave", "Ocean Wave", "\u{1F30A}", "nature"),
  meta("sticker-clover", "Lucky Clover", "\u{1F340}", "nature"),
];

export const STICKER_BY_ID: Record<string, StickerMeta> = Object.fromEntries(
  STICKER_META.map((s) => [s.id, s]),
);

export const STICKER_IDS: string[] = STICKER_META.map((s) => s.id);

export const STICKER_USAGE =
  "Click the canvas to place. Then use Move to resize or rotate.";

export function isStickerTool(id: string): boolean {
  return id.startsWith("sticker-");
}

export function getSticker(id: string): StickerMeta | undefined {
  return STICKER_BY_ID[id];
}

/** Sensible default sticker size for a document: 22 percent of the short side. */
export function defaultStickerSize(docW: number, docH: number): number {
  const m = Math.min(Math.max(1, docW), Math.max(1, docH));
  return Math.max(96, Math.min(384, Math.round(m * 0.22)));
}

const EMOJI_FONT = `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;

/** Paint one glyph tile with a white sticker halo and a soft shadow. */
export function drawStickerGlyph(g: CanvasRenderingContext2D, glyph: string, sizePx: number): void {
  const s = Math.max(16, Math.round(sizePx));
  g.clearRect(0, 0, s, s);
  g.font = `${Math.round(s * 0.72)}px ${EMOJI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.miterLimit = 2;
  const cx = s / 2;
  const cy = s / 2 + s * 0.02;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = Math.max(2, s * 0.03);
  g.shadowOffsetY = Math.max(1, s * 0.012);
  g.lineWidth = Math.max(2, s * 0.075);
  g.strokeStyle = "#ffffff";
  g.strokeText(glyph, cx, cy);
  g.restore();
  g.lineWidth = Math.max(2, s * 0.06);
  g.strokeStyle = "#ffffff";
  g.strokeText(glyph, cx, cy);
  g.fillText(glyph, cx, cy);
}

/** Stamp a sticker onto a document size layer canvas. Returns false for unknown ids. */
export function renderStickerToLayer(
  canvas: HTMLCanvasElement,
  stickerId: string,
  dx: number,
  dy: number,
  sizePx: number,
): boolean {
  const meta = STICKER_BY_ID[stickerId];
  if (!meta) return false;
  const s = Math.max(16, Math.round(sizePx));
  try {
    const tile = document.createElement("canvas");
    tile.width = s;
    tile.height = s;
    const g = tile.getContext("2d");
    if (!g) return false;
    drawStickerGlyph(g, meta.glyph, s);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tile, Math.round(dx), Math.round(dy), s, s);
    return true;
  } catch {
    return false;
  }
}
