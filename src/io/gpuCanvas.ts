// GPU aware canvas path. WebGPU (Vulkan / Metal / DirectX 12 via wgpu-style
// adapter) is preferred, WebGL2 (OpenGL / ANGLE) is the fallback, otherwise the
// editor stays on the fast tiled CPU path (C separable filters + Rust rayon).
// All compositing stays on drawImage (GPU-composited by the WebView) so the
// Rust/C++ side only handles pixel math in tiles — RAM stays flat.

import { gpuBackend, resetGpuBackend } from "./gpuBackend";

export interface GpuCaps {
  webgpu: boolean;
  adapter: string;
  tiled: boolean;
  tileSize: number;
}

let cached: GpuCaps | null = null;
let cachedPower = "";

export function resetGpuCache() {
  cached = null;
  cachedPower = "";
  resetGpuBackend();
}

export async function gpuCaps(power: "high-performance" | "low-power" = "high-performance"): Promise<GpuCaps> {
  if (cached && cachedPower === power) return cached;
  const b = await gpuBackend();
  const webgpu = b.label === "WebGPU";
  cached = {
    webgpu,
    adapter: `${b.label} — ${b.osApi}`,
    tiled: true,
    tileSize: b.tile,
  };
  cachedPower = power;
  return cached;
}

export function shouldUseTiled(width: number, height: number): boolean {
  return width * height > 2048 * 2048;
}
