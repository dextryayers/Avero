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

export async function gpuCaps(): Promise<GpuCaps> {
  if (cached) return cached;
  let webgpu = false;
  let adapter = "CPU tiled fallback";
  try {
    const nav: unknown =
      typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>).gpu : undefined;
    if (nav) {
      const gpu = nav as { requestAdapter?: () => Promise<unknown> };
      if (typeof gpu.requestAdapter === "function") {
        const a = await gpu.requestAdapter();
        if (a) {
          webgpu = true;
          adapter = "WebGPU adapter available";
        }
      }
    }
  } catch {
    webgpu = false;
  }
  cached = { webgpu, adapter, tiled: true, tileSize: 512 };
  return cached;
}

export function shouldUseTiled(width: number, height: number): boolean {
  return width * height > 2048 * 2048;
}
