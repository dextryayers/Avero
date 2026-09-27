import { invoke } from "@tauri-apps/api/core";

export interface SystemProfile {
  os: string;
  arch: string;
  cpu_brand: string;
  cpu_cores: number;
  cpu_threads: number;
  total_ram_mb: number;
  free_ram_mb: number;
  used_ram_mb: number;
  app_rss_mb: number;
  render_tile: number;
  fast_path: boolean;
}

export interface EngineRecommendation {
  mode: string;
  device: string;
  tile: number;
  history_cap: number;
  score: number;
  reason: string;
}

export interface GpuInfo {
  available: boolean;
  vendor: string;
  device: string;
  description: string;
  backend: string;
}

export interface HardwareReport {
  profile: SystemProfile | null;
  recommend: EngineRecommendation | null;
  gpu: GpuInfo;
  renderTile: number;
  fastPath: boolean;
  rayonThreads: number;
  webOnly: boolean;
}

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

async function gpuInfo(power: "high-performance" | "low-power"): Promise<GpuInfo> {
  const none: GpuInfo = { available: false, vendor: "", device: "", description: "No WebGPU adapter", backend: "cpu" };
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>).gpu : undefined;
    if (!nav) return none;
    const gpu = nav as {
      requestAdapter?: (o?: Record<string, unknown>) => Promise<unknown>;
    };
    if (typeof gpu.requestAdapter !== "function") return none;
    const adapter = (await gpu.requestAdapter({ powerPreference: power })) as null | {
      requestAdapterInfo?: () => Promise<Record<string, string>>;
      info?: Record<string, string>;
    };
    if (!adapter) return none;
    let info: Record<string, string> = {};
    try {
      if (typeof adapter.requestAdapterInfo === "function") info = await adapter.requestAdapterInfo();
      else if (adapter.info) info = adapter.info;
    } catch {
      /* keep empty */
    }
    const vendor = info.vendor ?? "";
    const device = info.device ?? "";
    const description = info.description ?? info.architecture ?? "";
    return {
      available: true,
      vendor,
      device,
      description: description || "WebGPU adapter available",
      backend: info.backend ?? "webgpu",
    };
  } catch {
    return none;
  }
}

/** Full hardware scan: Rust system profile plus live WebGPU adapter data. */
export async function scanHardware(power: "high-performance" | "low-power" = "high-performance"): Promise<HardwareReport> {
  const webOnly = !isTauri();
  let profile: SystemProfile | null = null;
  let recommend: EngineRecommendation | null = null;
  let renderTile = 512;
  let fastPath = true;
  let rayonThreads = 0;
  if (!webOnly) {
    try {
      profile = await invoke<SystemProfile>("cmd_system_profile");
    } catch {
      profile = null;
    }
    try {
      recommend = await invoke<EngineRecommendation>("cmd_engine_recommend");
    } catch {
      recommend = null;
    }
    try {
      const caps = await invoke<{ tile: number; fast_path: boolean; rayon_threads: number }>("cmd_render_caps");
      renderTile = caps.tile;
      fastPath = caps.fast_path;
      rayonThreads = caps.rayon_threads;
    } catch {
      /* keep defaults */
    }
  }
  const gpu = await gpuInfo(power);
  return { profile, recommend, gpu, renderTile, fastPath, rayonThreads, webOnly };
}

/** Short GPU label for status chips, e.g. "RTX 4070" or "Apple M2". */
export function gpuLabel(g: GpuInfo): string {
  const raw = `${g.device} ${g.description}`.trim();
  if (!g.available) return "CPU render";
  const m = raw.match(/(RTX\s?\d+\w*|GTX\s?\d+\w*|RX\s?\d+\w*|Radeon[^,]*(?:\d{3,4}\w*)?|Arc\s[A-Za-z0-9]+|M\d+(?:\s?(Pro|Max|Ultra))?|UHD\s?Graphics\s?\d*|Iris\s?\w*|Vega\s?\d*)/i);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  return raw.slice(0, 28) || "GPU detected";
}
