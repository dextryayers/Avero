// GPU aware canvas path. WebGPU is queried when available, otherwise the
// editor stays on the fast tiled CPU path (C++ separable filters + Rust
// rayon). This keeps large documents light while leaving room for a real
// GPU upload path later.

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
}

export async function gpuCaps(power: "high-performance" | "low-power" = "high-performance"): Promise<GpuCaps> {
  if (cached && cachedPower === power) return cached;
  let webgpu = false;
  let adapter = "CPU tiled fallback";
  try {
    const nav: unknown =
      typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>).gpu : undefined;
    if (nav) {
      const gpu = nav as { requestAdapter?: (o?: Record<string, unknown>) => Promise<unknown> };
      if (typeof gpu.requestAdapter === "function") {
        const a = await gpu.requestAdapter({ powerPreference: power });
        if (a) {
          webgpu = true;
          adapter = power === "high-performance" ? "WebGPU high performance adapter" : "WebGPU low power adapter";
        }
      }
    }
  } catch {
    webgpu = false;
  }
  cached = { webgpu, adapter, tiled: true, tileSize: 512 };
  cachedPower = power;
  return cached;
}

export function shouldUseTiled(width: number, height: number): boolean {
  return width * height > 2048 * 2048;
}
