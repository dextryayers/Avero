import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export interface RustImageInfo {
  width: number;
  height: number;
  format: string;
  file_size: number;
  color_type: string;
}

export async function pickImageToOpen(): Promise<string | null> {
  try {
    const file = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif", "psd"] }],
    });
    if (typeof file === "string") return file;
    return null;
  } catch {
    return null;
  }
}

export async function pickSavePath(defaultName: string): Promise<string | null> {
  try {
    const ext = defaultName.split(".").pop() ?? "png";
    const file = await save({
      defaultPath: defaultName,
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg", "jpeg"] },
        { name: "WEBP", extensions: ["webp"] },
        { name: "TIFF", extensions: ["tiff"] },
        { name: "BMP", extensions: ["bmp"] },
      ],
    });
    if (!file) return null;
    if (file.includes(".")) return file;
    return `${file}.${ext}`;
  } catch {
    return null;
  }
}

export async function rustImageInfo(path: string): Promise<RustImageInfo> {
  return invoke<RustImageInfo>("cmd_open_image_info", { path });
}

export async function rustDecodeToDataUrl(path: string, maxSide = 2048): Promise<string> {
  return invoke<string>("cmd_decode_image_to_dataurl", { path, maxSide });
}

export async function rustSaveDataUrl(dataUrl: string, path: string): Promise<void> {
  await invoke("cmd_save_dataurl_to_file", { dataUrl: dataUrl, path });
}

export async function checkBackend(): Promise<{ ok: boolean; info: string }> {
  try {
    const info = await invoke<{ name: string; version: string; os: string; arch: string }>("app_ping");
    return { ok: true, info: `${info.name} ${info.version} Rust (${info.os}/${info.arch})` };
  } catch (e) {
    return { ok: false, info: `Web preview only: ${String(e)}` };
  }
}
