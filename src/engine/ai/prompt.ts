// Fase 4.4: Prompt-to-edit deterministik lokal.
// Parser kata kunci Indonesia + Inggris menjadi aksi adjustment/filter/AI.
// Tanpa LLM agar offline dan dapat diuji. Struktur siap diganti LLM lokal.

export interface PromptAction {
  kind: "adjustment" | "filter" | "ai" | "tool" | "color" | "raw";
  id: string;
  label: string;
  params?: Record<string, number | string>;
}

export function parsePromptToActions(prompt: string): PromptAction[] {
  const q = prompt.toLowerCase();
  const out: PromptAction[] = [];
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  if (has("sunset", "senja", "hangat", "warm", "golden")) {
    out.push({
      kind: "adjustment",
      id: "hueSaturation",
      label: "Hangatkan tone",
      params: { hue: 8, saturation: 24, lightness: 0 },
    });
    out.push({
      kind: "adjustment",
      id: "exposure",
      label: "Golden exposure",
      params: { exposure: 0.25 },
    });
  }
  if (has("dramatis", "dramatic", "kontras", "contrast", "punch")) {
    out.push({
      kind: "adjustment",
      id: "brightnessContrast",
      label: "Dramatic contrast",
      params: { brightness: 0, contrast: 28 },
    });
  }
  if (has("hitam putih", "black and white", "bw", "monokrom", "grayscale")) {
    out.push({ kind: "adjustment", id: "blackWhite", label: "Black and White", params: {} });
  }
  if (has("cerah", "bright", "terang", "exposure naik")) {
    out.push({ kind: "adjustment", id: "exposure", label: "Cerahkan", params: { exposure: 0.6 } });
  }
  if (has("gelap", "dark", "moody")) {
    out.push({
      kind: "adjustment",
      id: "exposure",
      label: "Moody gelap",
      params: { exposure: -0.5 },
    });
  }
  if (has("tajam", "sharp", "detail", "jelas")) {
    out.push({ kind: "filter", id: "sharpen", label: "Sharpen detail", params: { amount: 80 } });
  }
  if (has("blur", "bokeh", "lembut", "soft", "background blur")) {
    out.push({ kind: "filter", id: "gaussianBlur", label: "Soft blur", params: { radius: 3 } });
  }
  if (has("hapus background", "remove background", "background putih", "transparan")) {
    out.push({ kind: "ai", id: "background-remove", label: "AI background remover" });
  }
  if (has("pilih subjek", "select subject", "selektif objek", "object")) {
    out.push({ kind: "ai", id: "auto-select", label: "AI select subject" });
  }
  if (has("hapus objek", "hilangkan", "erase", "inpaint", "bersihkan")) {
    out.push({ kind: "ai", id: "inpaint", label: "AI erase seleksi" });
  }
  if (has("upscale", "hd", "4x", "tajamkan resolusi", "besar")) {
    out.push({ kind: "ai", id: "upscale-2x", label: "Upscale 2x" });
  }
  if (has("langit", "sky", "biru")) {
    out.push({
      kind: "adjustment",
      id: "hueSaturation",
      label: "Langit biru",
      params: { hue: -8, saturation: 26, lightness: 4 },
    });
  }
  if (has("kulit", "skin", "wajah", "portrait", "potret")) {
    out.push({
      kind: "adjustment",
      id: "brightnessContrast",
      label: "Kulit lembut",
      params: { brightness: 6, contrast: -8 },
    });
  }
  if (has("vintage", "retro", "film", "jadul")) {
    out.push({
      kind: "adjustment",
      id: "curves",
      label: "Film lift",
      params: { lift: 14, gain: -6 },
    });
    out.push({
      kind: "adjustment",
      id: "hueSaturation",
      label: "Film tone",
      params: { hue: 0, saturation: -18, lightness: 0 },
    });
  }
  if (has("cmyk", "proof", "cetak", "print")) {
    out.push({ kind: "color", id: "proof-on", label: "Aktifkan soft proof" });
  }
  if (out.length === 0) {
    out.push({
      kind: "adjustment",
      id: "brightnessContrast",
      label: "Auto enhance ringan",
      params: { brightness: 4, contrast: 12 },
    });
    out.push({ kind: "filter", id: "sharpen", label: "Sharpen ringan", params: { amount: 35 } });
  }
  return out;
}
