import { invoke } from "@tauri-apps/api/core";

export type NativeOp =
  | { op: "gray" }
  | { op: "invert" }
  | { op: "brightness"; amount: number }
  | { op: "contrast"; amount: number }
  | { op: "threshold"; level: number }
  | { op: "desaturate"; amount: number };

export type NativeFilterOp =
  | { op: "boxBlur"; radius: number }
  | { op: "sharpen"; amount: number }
  | { op: "unsharp"; amount: number; radius: number }
  | { op: "emboss" }
  | { op: "motionBlur"; radius: number; angle: number };

export interface NativeInfo {
  c_engine: string;
  cpp_engine: string;
  languages: string[];
  ready: boolean;
}

export function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

export async function nativeInfo(): Promise<NativeInfo> {
  return invoke<NativeInfo>("cmd_native_info");
}

function clampSize(len: number): boolean {
  return len > 0 && len % 4 === 0;
}

/** Operasi C in-place. Return buffer RGBA8 baru dari backend. */
export async function nativeApplyOp(
  rgba: Uint8ClampedArray | Uint8Array,
  op: NativeOp,
): Promise<Uint8ClampedArray> {
  if (!isTauri() || !clampSize(rgba.length)) {
    throw new Error("Native C engine tidak tersedia atau buffer tidak valid");
  }
  const out = await invoke<number[] | Uint8Array>("cmd_native_apply_op", {
    rgba: Array.from(rgba),
    op,
  });
  const arr = out instanceof Uint8Array ? out : Uint8Array.from(out as number[]);
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.length);
}

/** Filter C++ dua-pass. width*height harus cocok dengan buffer. */
export async function nativeApplyFilter(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  op: NativeFilterOp,
): Promise<Uint8ClampedArray> {
  const need = width * height * 4;
  if (!isTauri() || rgba.length !== need) {
    throw new Error("Native C++ engine tidak tersedia atau dimensi tidak cocok");
  }
  const out = await invoke<number[] | Uint8Array>("cmd_native_apply_filter", {
    rgba: Array.from(rgba),
    width,
    height,
    op,
  });
  const arr = out instanceof Uint8Array ? out : Uint8Array.from(out as number[]);
  return new Uint8ClampedArray(arr.buffer, arr.byteOffset, arr.length);
}

/** Baca ImageData dari canvas, proses native, tulis balik. */
export async function nativeProcessCanvas(
  canvas: HTMLCanvasElement,
  kind: "op",
  op: NativeOp,
): Promise<void>;
export async function nativeProcessCanvas(
  canvas: HTMLCanvasElement,
  kind: "filter",
  op: NativeFilterOp,
): Promise<void>;
export async function nativeProcessCanvas(
  canvas: HTMLCanvasElement,
  kind: "op" | "filter",
  op: NativeOp | NativeFilterOp,
): Promise<void> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2d context gagal");
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let out: Uint8ClampedArray;
  if (kind === "op") {
    out = await nativeApplyOp(id.data, op as NativeOp);
  } else {
    out = await nativeApplyFilter(id.data, canvas.width, canvas.height, op as NativeFilterOp);
  }
  const next = new ImageData(out, canvas.width, canvas.height);
  ctx.putImageData(next, 0, 0);
}

/** Ubah data URL gambar lewat native (encode PNG by browser setelah proses). */
export async function nativeApplyOpToDataUrl(
  dataUrl: string,
  op: NativeOp,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  await nativeProcessCanvas(c, "op", op);
  return c.toDataURL("image/png");
}

export async function nativeApplyFilterToDataUrl(
  dataUrl: string,
  op: NativeFilterOp,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  await nativeProcessCanvas(c, "filter", op);
  return c.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar gagal dimuat"));
    img.src = src;
  });
}
