// Unified GPU backend abstraction.
// Maps OS graphics APIs to what the WebView + browser can actually use:
// - Windows (WebView2/Chromium): DirectX 11/12 -> WebGPU (D3D12) + WebGL2 (ANGLE/D3D)
// - Linux (WebKitGTK): Vulkan / OpenGL -> WebGPU (Vulkan) + WebGL2 (OpenGL)
// - macOS (WKWebView, future): Metal -> WebGPU (Metal) + WebGL2
// Falls back to CPU tiled path when no GPU is present. All detection is lazy,
// cached, and never blocks the UI thread.

export type GpuApi =
  | "webgpu-d3d12"
  | "webgpu-vulkan"
  | "webgpu-metal"
  | "webgpu-unknown"
  | "webgl2-angle"
  | "webgl2-opengl"
  | "cpu";

export interface GpuBackend {
  api: GpuApi;
  label: string;
  osApi: string;
  accelerated: boolean;
  maxTexture: number;
  tile: 256 | 512 | 1024;
  dprCap: number;
}

let cached: GpuBackend | null = null;

function osApiFor(api: GpuApi): string {
  const os = typeof navigator !== "undefined" ? (navigator as Navigator).platform ?? "" : "";
  const isWin = /win/i.test(os) || /win/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
  const isMac = /mac/i.test(os);
  switch (api) {
    case "webgpu-d3d12":
      return "DirectX 12 (via WebGPU/D3D12)";
    case "webgpu-vulkan":
      return isWin ? "Vulkan on Windows (via WebGPU)" : "Vulkan (via WebGPU)";
    case "webgpu-metal":
      return "Metal (via WebGPU)";
    case "webgpu-unknown":
      return isWin ? "DirectX 11/12 (via WebGPU)" : isMac ? "Metal (via WebGPU)" : "Vulkan/OpenGL (via WebGPU)";
    case "webgl2-angle":
      return isWin ? "DirectX 11 (via ANGLE/OpenGL ES)" : "OpenGL ES (via ANGLE)";
    case "webgl2-opengl":
      return "OpenGL (via WebGL2)";
    default:
      return isWin ? "DirectX software (WARP/CPU)" : isMac ? "Metal software (CPU)" : "Mesa software (CPU)";
  }
}

async function probeWebGpu(): Promise<{ ok: boolean; adapterLabel: string }> {
  try {
    const nav = navigator as unknown as { gpu?: { requestAdapter?: (o?: object) => Promise<unknown> } };
    if (!nav.gpu?.requestAdapter) return { ok: false, adapterLabel: "" };
    const adapter = (await nav.gpu.requestAdapter({ powerPreference: "high-performance" })) as null | {
      info?: Record<string, string>;
      requestAdapterInfo?: () => Promise<Record<string, string>>;
    };
    if (!adapter) return { ok: false, adapterLabel: "" };
    let info: Record<string, string> = {};
    try {
      if (typeof adapter.requestAdapterInfo === "function") info = await adapter.requestAdapterInfo();
      else if (adapter.info) info = adapter.info;
    } catch {
      /* ignore */
    }
    const raw = `${info.vendor ?? ""} ${info.device ?? ""} ${info.description ?? info.architecture ?? info.backend ?? ""}`.toLowerCase();
    return { ok: true, adapterLabel: raw };
  } catch {
    return { ok: false, adapterLabel: "" };
  }
}

function probeWebGL2(): { ok: boolean; renderer: string; maxTexture: number } {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, renderer: "", maxTexture: 0 };
    const maxTexture = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 0;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "WebGL adapter";
    // Free the context ASAP (no RAM held).
    const lose = gl.getExtension("WEBGL_lose_context");
    try {
      lose?.loseContext();
    } catch {
      /* ignore */
    }
    return { ok: true, renderer, maxTexture };
  } catch {
    return { ok: false, renderer: "", maxTexture: 0 };
  }
}

function classifyWebGpuAdapter(raw: string): GpuApi {
  if (/d3d|directx|angle.*d3d/i.test(raw)) return "webgpu-d3d12";
  if (/metal/i.test(raw)) return "webgpu-metal";
  if (/vulkan|amd|nvidia|intel.*uhd|iris|radeon|geforce|rtx|gtx/i.test(raw)) return "webgpu-vulkan";
  return "webgpu-unknown";
}

/** Detect once, cache forever (reset via resetGpuBackend on device change). */
export async function gpuBackend(): Promise<GpuBackend> {
  if (cached) return cached;
  const gpu = await probeWebGpu();
  if (gpu.ok) {
    const api = classifyWebGpuAdapter(gpu.adapterLabel);
    cached = {
      api,
      label: "WebGPU",
      osApi: osApiFor(api),
      accelerated: true,
      maxTexture: 8192,
      tile: 1024,
      dprCap: 2,
    };
    return cached;
  }
  const gl = probeWebGL2();
  if (gl.ok) {
    const r = gl.renderer.toLowerCase();
    const angle = /angle|directx|d3d/i.test(r);
    const api: GpuApi = angle ? "webgl2-angle" : "webgl2-opengl";
    const bigTex = gl.maxTexture >= 8192;
    cached = {
      api,
      label: "WebGL2",
      osApi: osApiFor(api),
      accelerated: true,
      maxTexture: gl.maxTexture || 4096,
      tile: bigTex ? 1024 : 512,
      dprCap: 1.75,
    };
    return cached;
  }
  cached = {
    api: "cpu",
    label: "CPU",
    osApi: osApiFor("cpu"),
    accelerated: false,
    maxTexture: 4096,
    tile: 256,
    dprCap: 1.5,
  };
  return cached;
}

export function resetGpuBackend() {
  cached = null;
}

export function gpuBackendSyncFallback(): GpuBackend {
  return (
    cached ?? {
      api: "cpu",
      label: "CPU",
      osApi: osApiFor("cpu"),
      accelerated: false,
      maxTexture: 4096,
      tile: 512,
      dprCap: 1.5,
    }
  );
}
