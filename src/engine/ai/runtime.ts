// Fase 4.1: AI runtime lokal offline.
// Jujur secara produk: engine heuristik lokal berjalan 100% offline tanpa download.
// Slot model ONNX (SAM, U2Net, Lama, RealESRGAN) disiapkan via Model Manager,
// jika file .onnx ada di folder model maka dipakai, jika tidak fallback heuristik.

export type AiModelId = "u2net" | "sam-mobile" | "lama" | "esrgan-x4" | "color-grade";

export interface AiModelInfo {
  id: AiModelId;
  label: string;
  file: string;
  sizeMB: number;
  loaded: "heuristic" | "onnx" | "downloading" | "missing";
  progress: number;
  note: string;
}

const MODELS: AiModelInfo[] = [
  { id: "u2net", label: "Background Remover", file: "u2net.onnx", sizeMB: 176, loaded: "heuristic", progress: 100, note: "Heuristik saliency+edge aktif. Taruh u2net.onnx di folder model untuk akurasi penuh." },
  { id: "sam-mobile", label: "Select Subject", file: "sam-mobile.onnx", sizeMB: 98, loaded: "heuristic", progress: 100, note: "Heuristik kontras+tengah aktif. SAM ONNX opsional." },
  { id: "lama", label: "Inpaint Erase", file: "lama.onnx", sizeMB: 210, loaded: "heuristic", progress: 100, note: "Inpaint difusi tetangga aktif. Lama ONNX opsional." },
  { id: "esrgan-x4", label: "Upscale 4x", file: "esrgan-x4.onnx", sizeMB: 64, loaded: "heuristic", progress: 100, note: "Upscale bicubic+sharpen aktif. RealESRGAN ONNX opsional." },
  { id: "color-grade", label: "Color Transfer", file: "color-grade.onnx", sizeMB: 12, loaded: "heuristic", progress: 100, note: "Transfer Reinhard lokal aktif, tanpa model." },
];

export function listAiModels(): AiModelInfo[] {
  return MODELS.map((m) => ({ ...m }));
}

export interface AiJob {
  id: string;
  label: string;
  progress: number;
  cancelled: boolean;
}

let seq = 0;
export function createJob(label: string): AiJob {
  seq += 1;
  return { id: `ai-${Date.now().toString(36)}-${seq}`, label, progress: 0, cancelled: false };
}

// Helper progres kooperatif agar UI tidak freeze di gambar besar.
export async function yieldToUI(step = 0) {
  if (step % 24 === 0) await new Promise((r) => setTimeout(r, 0));
}
