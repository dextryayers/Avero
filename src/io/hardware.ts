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

export interface WebVitals {
  cores: number;
  deviceMemoryGb: number | null;
  screenW: number;
  screenH: number;
  dpr: number;
  webglVendor: string;
  webglRenderer: string;
  maxTexture: number;
  heapMb: number | null;
  touch: boolean;
  platform: string;
  ua: string;
}

export interface HardwareReport {
  profile: SystemProfile | null;
  recommend: EngineRecommendation | null;
  gpu: GpuInfo;
  renderTile: number;
  fastPath: boolean;
  rayonThreads: number;
  webOnly: boolean;
  web: WebVitals | null;
}

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

async function gpuInfo(power: "high-performance" | "low-power"): Promise<GpuInfo> {
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as unknown as Record<string, unknown>).gpu : undefined;
    if (!nav) return webglFallback();
    const gpu = nav as {
      requestAdapter?: (o?: Record<string, unknown>) => Promise<unknown>;
    };
    if (typeof gpu.requestAdapter !== "function") return webglFallback();
    const adapter = (await gpu.requestAdapter({ powerPreference: power })) as null | {
      requestAdapterInfo?: () => Promise<Record<string, string>>;
      info?: Record<string, string>;
    };
    if (!adapter) return webglFallback();
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
    if (!vendor && !device && !description) return webglFallback();
    return {
      available: true,
      vendor,
      device,
      description: description || "WebGPU adapter available",
      backend: info.backend ?? "webgpu",
    };
  } catch {
    return webglFallback();
  }
}

function webglFallback(): GpuInfo {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { available: false, vendor: "", device: "", description: "No WebGL either", backend: "cpu" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "WebGL adapter";
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : "";
    return { available: true, vendor, device: renderer, description: renderer, backend: "webgl" };
  } catch {
    return { available: false, vendor: "", device: "", description: "No WebGPU adapter", backend: "cpu" };
  }
}

function webVitals(): WebVitals | null {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    let webglVendor = "";
    let webglRenderer = "";
    let maxTexture = 0;
    try {
      const c = document.createElement("canvas");
      const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
      if (gl) {
        maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        if (dbg) {
          webglVendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL));
          webglRenderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
        }
      }
    } catch {
      /* ignore */
    }
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    return {
      cores: nav.hardwareConcurrency ?? 4,
      deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
      screenW: window.screen?.width ?? window.innerWidth,
      screenH: window.screen?.height ?? window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      webglVendor,
      webglRenderer,
      maxTexture,
      heapMb: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null,
      touch: "ontouchstart" in window || (nav.maxTouchPoints ?? 0) > 0,
      platform: nav.platform ?? "",
      ua: nav.userAgent ?? "",
    };
  } catch {
    return null;
  }
}

function webProfile(web: WebVitals | null, gpu: GpuInfo): SystemProfile {
  const cores = web?.cores ?? 4;
  const totalGb = web?.deviceMemoryGb ?? 8;
  const totalMb = Math.round(totalGb * 1024);
  const heap = web?.heapMb ?? 180;
  return {
    os: web?.platform || "Web",
    arch: "wasm32",
    cpu_brand: `${cores}-core web CPU`,
    cpu_cores: cores,
    cpu_threads: cores,
    total_ram_mb: totalMb,
    free_ram_mb: Math.max(256, totalMb - heap - 512),
    used_ram_mb: Math.min(totalMb, heap + 512),
    app_rss_mb: heap,
    render_tile: gpu.available ? 512 : 256,
    fast_path: gpu.available,
  };
}

function webRecommend(web: WebVitals | null, gpu: GpuInfo): EngineRecommendation {
  const cores = web?.cores ?? 4;
  const mem = web?.deviceMemoryGb ?? 8;
  const score = Math.max(5, Math.min(98, Math.round(cores * 7 + mem * 6 + (gpu.available ? 22 : 0))));
  if (score >= 72) {
    return { mode: "max", device: gpu.available ? "gpu" : "auto", tile: 1024, history_cap: 15, score, reason: `Strong web device: ${cores} cores, ${mem}GB RAM${gpu.available ? ", GPU on" : ""}. Max preset unlocked.` };
  }
  if (score >= 42) {
    return { mode: "balanced", device: "auto", tile: 512, history_cap: 8, score, reason: `Mid web device: ${cores} cores, ${mem}GB RAM. Balanced preset fits.` };
  }
  return { mode: "eco", device: "cpu", tile: 256, history_cap: 4, score, reason: `Light web device: ${cores} cores, ${mem}GB RAM. Eco keeps 4K smooth.` };
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
  const web = webVitals();
  // Web fallback: never leave Control Center empty — synthesize a real profile
  // from navigator + WebGL + heap so sliders and recommendations always work.
  if (webOnly || !profile) {
    const wp = webProfile(web, gpu);
    if (!profile) profile = wp;
    else {
      profile = { ...profile, app_rss_mb: wp.app_rss_mb };
    }
  }
  if (!recommend) recommend = webRecommend(web, gpu);
  if (webOnly) {
    renderTile = gpu.available ? 512 : 256;
    fastPath = gpu.available;
    rayonThreads = web?.cores ?? 4;
  }
  return { profile, recommend, gpu, renderTile, fastPath, rayonThreads, webOnly, web };
}

/** Short GPU label for status chips, e.g. "RTX 4070" or "Apple M2". */
export function gpuLabel(g: GpuInfo): string {
  const raw = `${g.vendor} ${g.device} ${g.description}`.trim();
  if (!g.available) return "CPU render";
  const m = raw.match(/(RTX\s?\d+\w*|GTX\s?\d+\w*|RX\s?\d+\w*|Radeon[^,]*(?:\d{3,4}\w*)?|Arc\s[A-Za-z0-9]+|M\d+(?:\s?(Pro|Max|Ultra))?|UHD\s?Graphics\s?\d*|Iris\s?\w*|Vega\s?\d*|Adreno\s?\w*|Mali\s?\w*|GeForce[^,]*|Quadro[^,]*)/i);
  if (m) return m[1].replace(/\s+/g, " ").trim().slice(0, 30);
  return raw.slice(0, 30) || "GPU detected";
}
