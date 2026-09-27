import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  ImagePlus,
  LayoutGrid,
  Trash2,
  X,
  Search,
  Clock,
  Star,
  BookOpen,
  Plus,
  Monitor,
  Printer,
  Smartphone,
  Globe,
  Film,
  FileBox,
  Layers,
  Wand2,
  Sparkles,
  Zap,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";
import { useHomeStore, resolveRecent, type RecentFile } from "../stores/useHomeStore";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { openAvxProject } from "../io/projectIo";
import { pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";
import { showError } from "../ui/notify";
import clsx from "clsx";

type PresetCat = "Photo" | "Print" | "Art" | "Web" | "Mobile" | "Film";

const PRESETS: Record<PresetCat, { name: string; w: number; h: number; desc: string }[]> = {
  Photo: [
    { name: "HD Photo", w: 1920, h: 1080, desc: "General 16:9 editing" },
    { name: "4K Photo", w: 3840, h: 2160, desc: "High resolution" },
    { name: "Portrait 4:5", w: 1080, h: 1350, desc: "IG carousel" },
    { name: "Square 1:1", w: 1080, h: 1080, desc: "IG post" },
    { name: "Story 9:16", w: 1080, h: 1920, desc: "Full vertical" },
    { name: "Landscape 3:2", w: 3000, h: 2000, desc: "Photo print" },
  ],
  Print: [
    { name: "A4 300dpi", w: 2480, h: 3508, desc: "Print document" },
    { name: "A3 300dpi", w: 3508, h: 4960, desc: "Small poster" },
    { name: "Letter", w: 2550, h: 3300, desc: "US Letter" },
    { name: "Business Card", w: 1050, h: 600, desc: "90 x 50mm" },
  ],
  Art: [
    { name: "HD Canvas", w: 1920, h: 1080, desc: "Digital painting" },
    { name: "4K Canvas", w: 3840, h: 2160, desc: "High detail" },
    { name: "Square Art", w: 2048, h: 2048, desc: "Illustration" },
  ],
  Web: [
    { name: "Web Hero", w: 1920, h: 1080, desc: "Landing page" },
    { name: "Banner 1200", w: 1200, h: 628, desc: "OG and ads" },
    { name: "YT Thumbnail", w: 1280, h: 720, desc: "16:9" },
  ],
  Mobile: [
    { name: "IG Story", w: 1080, h: 1920, desc: "9:16" },
    { name: "Phone Wallpaper", w: 1440, h: 3088, desc: "Full screen" },
    { name: "App Cover", w: 1024, h: 1024, desc: "Icon and cover" },
  ],
  Film: [
    { name: "FHD Video", w: 1920, h: 1080, desc: "Film frame" },
    { name: "2K DCI", w: 2048, h: 1080, desc: "Cinema" },
    { name: "Vertical Film", w: 1080, h: 1920, desc: "Shorts and Reels" },
  ],
};

const CAT_ICON: Record<PresetCat, any> = {
  Photo: Monitor,
  Print: Printer,
  Art: Star,
  Web: Globe,
  Mobile: Smartphone,
  Film: Film,
};

function drawDataUrlToActive(dataUrl: string, w: number, h: number) {
  const img = new Image();
  img.onload = () => {
    const id = useEditorStore.getState().activeLayerId ?? useEditorStore.getState().layers[0]?.id;
    if (!id) return;
    layerManager.ensure(id, w, h);
    layerManager.drawImageToLayer(id, img, w, h);
    useEditorStore.getState().markDirty();
    useProStore.getState().bumpHistogram();
  };
  img.src = dataUrl;
}

export async function openImageViaDialog(): Promise<boolean> {
  try {
    const path = await pickImageToOpen();
    if (!path) return false;
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    const st = useEditorStore.getState();
    st.openDocument(path.split(/[/\\]/).pop() ?? "Image", info.width, info.height, path, info.file_size);
    layerManager.clear();
    useHomeStore.getState().pushRecent({
      name: path.split(/[/\\]/).pop() ?? "Image",
      path,
      thumb: dataUrl,
      full: dataUrl.length < 2_500_000 ? dataUrl : null,
      w: info.width,
      h: info.height,
      size: info.file_size,
    });
    setTimeout(() => drawDataUrlToActive(dataUrl, info.width, info.height), 60);
    useHomeStore.getState().setHome(false);
    return true;
  } catch (e) {
    console.error(e);
    await showError(`Failed to open image: ${String(e)}`);
    return false;
  }
}

export default function HomeScreen() {
  const recents = useHomeStore((s) => s.recents);
  const setHome = useHomeStore((s) => s.setHome);
  const removeRecent = useHomeStore((s) => s.removeRecent);
  const clearRecents = useHomeStore((s) => s.clearRecents);
  const pushRecent = useHomeStore((s) => s.pushRecent);
  const newDocument = useEditorStore((s) => s.newDocument);
  const [cat, setCat] = useState<PresetCat>("Photo");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "recent" | "learn">("home");

  const [dn, setDn] = useState("Untitled-1");
  const [dw, setDw] = useState("1920");
  const [dh, setDh] = useState("1080");
  const [bg, setBg] = useState<"white" | "black" | "transparent">("white");

  useEffect(() => {
    if (!showNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNew(false);
      if (e.key === "Enter") createNew(dn.trim() || "Untitled", Math.max(1, parseInt(dw) || 1920), Math.max(1, parseInt(dh) || 1080));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNew, dn, dw, dh]);

  function createNew(name: string, w: number, h: number) {
    layerManager.clear();
    newDocument(name, w, h);
    const id = useEditorStore.getState().activeLayerId;
    if (id) {
      const c = layerManager.ensure(id, w, h);
      if (bg !== "transparent") {
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = bg === "white" ? "#ffffff" : "#000000";
        ctx.fillRect(0, 0, w, h);
      }
      useProStore.getState().ensureTransform(id);
    }
    pushRecent({ name, path: null, thumb: null, full: null, w, h, size: null });
    setShowNew(false);
    setHome(false);
  }

  async function openRecent(r: RecentFile) {
    if (busy) return;
    setBusy(r.id);
    try {
      if (r.path && r.path.toLowerCase().endsWith(".avx")) {
        const ok = await openAvxProject(r.path);
        if (!ok) await showError("Could not open project.");
        return;
      }
      const res = await resolveRecent(r);
      if (!res) {
        await showError("This session file is no longer available. Please reopen it from disk.");
        return;
      }
      const st = useEditorStore.getState();
      st.openDocument(r.name, res.w, res.h, r.path, r.size);
      layerManager.clear();
      setTimeout(() => drawDataUrlToActive(res.dataUrl, res.w, res.h), 60);
      setHome(false);
    } catch (e) {
      await showError(`Failed to open: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const filteredPresets = useMemo(() => {
    const list = PRESETS[cat];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    const all = Object.values(PRESETS).flat();
    return all.filter((p) => p.name.toLowerCase().includes(q) || `${p.w}x${p.h}`.includes(q));
  }, [cat, query]);

  const filteredRecents = useMemo(() => {
    if (!query.trim()) return recents;
    return recents.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
  }, [recents, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#101012]">
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#2c2c31] bg-[#1c1c1f] px-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="AVERO" className="h-8 w-8 rounded-md border border-[#2c2c31] object-cover" />
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-wide text-white">AVERO STUDIO</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-[#6e6e78]">
              <span className="rounded border border-[#2c2c31] bg-[#101012] px-1 py-px text-[#8fb6f5]">v2.0.0</span>
              <span>PROFESSIONAL</span>
            </div>
          </div>
        </div>
        <div className="relative ml-4 hidden w-[320px] md:block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e78]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, presets, tutorials"
            className="h-8 w-full rounded-md border border-[#2c2c31] bg-[#101012] pl-8 pr-3 text-[12px] text-white outline-none placeholder:text-[#6e6e78] focus:border-[#2f7cf6]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-[#6e6e78] lg:block">Ctrl+K actions</span>
          <button
            onClick={() => void openAvxProject().catch((e) => showError(`Failed to open project: ${String(e)}`))}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#161618] px-3 text-[12px] font-medium text-[#c9c9d1] hover:border-[#3a3a41] hover:text-white"
          >
            <FileBox size={14} /> .avx
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="avero-btn-primary flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white"
          >
            <Plus size={14} /> New
          </button>
          <button
            onClick={() => openImageViaDialog()}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#ececee] px-3 text-[12px] font-semibold text-[#161618] hover:bg-white"
          >
            <FolderOpen size={14} /> Open
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[212px] shrink-0 flex-col gap-1 border-r border-[#2c2c31] bg-[#1c1c1f] p-3">
          <div className="avero-micro px-2 pb-1 pt-1">Studio</div>
          {[
            { id: "home", label: "Home", icon: LayoutGrid },
            { id: "recent", label: "Recent", icon: Clock, count: recents.length },
            { id: "learn", label: "Learn", icon: BookOpen },
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id as any)}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-medium",
                view === n.id ? "bg-[#2f7cf6] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
              )}
            >
              <n.icon size={15} /> {n.label}
              {(n as any).count > 0 && (
                <span className="ml-auto rounded border border-white/20 px-1.5 py-px font-mono text-[10px]">
                  {(n as any).count}
                </span>
              )}
            </button>
          ))}
          <div className="mt-3 border-t border-[#2c2c31] pt-3">
            <div className="avero-micro mb-1 px-2">Presets</div>
            {(Object.keys(PRESETS) as PresetCat[]).map((c) => {
              const Icon = CAT_ICON[c];
              return (
                <button
                  key={c}
                  onClick={() => {
                    setCat(c);
                    setView("home");
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px]",
                    cat === c ? "bg-[#232327] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
                  )}
                >
                  <Icon size={13} /> {c}
                  <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">{PRESETS[c].length}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto space-y-2 pt-3">
            <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Layers size={13} className="text-[#8fb6f5]" /> .avx Project
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#a7a7b0]">
                Layers, masks, adjustments and filters stored intact.
              </div>
              <div className="mt-2 font-mono text-[10px] text-[#6e6e78]">Ctrl+S to save</div>
            </div>
            <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Zap size={12} className="text-[#8fb6f5]" /> Light on RAM
              </div>
              <div className="mt-1 text-[11px] text-[#6e6e78]">Tiled processing for large files</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1240px] p-5">
            {view === "home" && (
              <div className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-[240px] flex-1">
                    <div className="text-[15px] font-bold text-white">Start a new project</div>
                    <div className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-[#a7a7b0]">
                      Open a photo, an .avx project, or a preset. Files are listed under Recent. You can also drop images into the window.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowNew(true)}
                        className="avero-btn-primary inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white"
                      >
                        <ImagePlus size={14} /> Create document <ArrowRight size={12} />
                      </button>
                      <button
                        onClick={() => openImageViaDialog()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] font-medium text-white hover:border-[#3a3a41]"
                      >
                        <FolderOpen size={14} /> Open image
                      </button>
                      <button
                        onClick={() => void openAvxProject().catch((e) => showError(String(e)))}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-transparent px-3 text-[12px] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
                      >
                        <FileBox size={14} /> Open .avx
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 py-1.5 font-mono text-[10px] text-[#6e6e78]">
                      Ctrl+K palette
                    </div>
                    <div className="rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 py-1.5 font-mono text-[10px] text-[#6e6e78]">
                      Space+drag pan
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view !== "learn" && (
              <>
                <div className="mb-3 mt-6 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[13px] font-bold text-white">
                    <Clock size={14} className="text-[#8fb6f5]" /> Recent
                    <span className="rounded border border-[#2c2c31] bg-[#1c1c1f] px-1.5 py-px font-mono text-[10px] font-normal text-[#a7a7b0]">
                      {filteredRecents.length}
                    </span>
                  </h3>
                  {recents.length > 0 && (
                    <button
                      onClick={clearRecents}
                      className="flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] text-[#6e6e78] hover:bg-[#232327] hover:text-white"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>
                {filteredRecents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#2c2c31] bg-[#1c1c1f] p-8 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-[#2c2c31] bg-[#101012]">
                      <ImageIcon size={20} className="text-[#6e6e78]" />
                    </div>
                    <div className="mt-3 text-[13px] font-semibold text-white">Start your first project</div>
                    <div className="mx-auto mt-1 max-w-[420px] text-[11px] leading-relaxed text-[#6e6e78]">
                      Open a photo or .avx project, or create a new document. Files appear here automatically.
                    </div>
                    <div className="mt-4 flex justify-center gap-2">
                      <button
                        onClick={() => setShowNew(true)}
                        className="avero-btn-primary h-8 rounded-md px-3 text-[12px] font-semibold text-white"
                      >
                        Create New
                      </button>
                      <button
                        onClick={() => openImageViaDialog()}
                        className="h-8 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] text-white hover:border-[#3a3a41]"
                      >
                        Open Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredRecents.map((r) => (
                      <div
                        key={r.id}
                        className="group relative overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f] hover:border-[#3a3a41]"
                      >
                        <button onClick={() => openRecent(r)} className="block w-full text-left" title={r.path ?? r.name}>
                          <div className="relative grid h-[132px] place-items-center overflow-hidden bg-[#0a0a0c]">
                            {r.thumb ? (
                              <img src={r.thumb} alt={r.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid place-items-center">
                                <LayoutGrid size={22} className="text-[#3a3a41]" />
                                <span className="mt-1 font-mono text-[10px] text-[#6e6e78]">
                                  {r.w}x{r.h}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="border-t border-[#2c2c31] p-3">
                            <div className="truncate text-[12px] font-semibold text-white">{r.name}</div>
                            <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[#6e6e78]">
                              <span>{new Date(r.time).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</span>
                              <span>
                                {r.w}x{r.h}
                              </span>
                              {busy === r.id && <span className="text-[#8fb6f5]">opening</span>}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => removeRecent(r.id)}
                          title="Remove from list"
                          className="absolute right-2 top-2 rounded-md border border-[#2c2c31] bg-[#101012] p-1.5 text-[#a7a7b0] opacity-0 hover:border-[#e5534b] hover:text-white group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {view === "home" && (
              <>
                <h3 className="mb-3 mt-8 flex items-center gap-2 text-[13px] font-bold text-white">
                  <ImagePlus size={14} className="text-[#8fb6f5]" /> {cat} Presets
                  <span className="rounded border border-[#2c2c31] bg-[#1c1c1f] px-1.5 py-px font-mono text-[10px] font-normal text-[#a7a7b0]">
                    {filteredPresets.length}
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredPresets.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => createNew(p.name, p.w, p.h)}
                      className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-3 text-left hover:border-[#3a3a41] hover:bg-[#1e1e22]"
                    >
                      <div className="grid h-[72px] place-items-center rounded-md border border-[#2c2c31] bg-[#101012]">
                        <div
                          className="rounded-sm border border-[#3a3a41] bg-[#232327]"
                          style={{
                            width: Math.min(120, Math.max(28, (p.w / Math.max(p.w, p.h)) * 120)),
                            height: Math.min(56, Math.max(18, (p.h / Math.max(p.w, p.h)) * 56)),
                          }}
                        />
                      </div>
                      <div className="mt-2.5 text-[12px] font-semibold text-white">{p.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-[#6e6e78]">
                        {p.w}x{p.h} {p.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {view !== "recent" && (
              <>
                <h3 className="mb-3 mt-8 flex items-center gap-2 text-[13px] font-bold text-white">
                  <BookOpen size={14} className="text-[#8fb6f5]" /> Learn in 1 minute
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { t: "Precise masking", d: "Select, feather, refine edge, paint mask. Hold Shift to add to selection.", tag: "Select", icon: Wand2 },
                    { t: "Natural retouch", d: "Spot Heal (J), Healing Brush, Clone Stamp (S), Patch. Alt+click for source.", tag: "Retouch", icon: Sparkles },
                    { t: "Cinematic grading", d: "Exposure, HSL, Vibrance, Warmth, Vignette, Grain. Tiled processing.", tag: "Color", icon: Star },
                    { t: "Variants without duplicates", d: "Git tab: snapshots, branches, and a compare slider to explore variants.", tag: "Git", icon: Layers },
                    { t: "Save .avx projects", d: "Ctrl+S saves layers and edits intact. Reopen 100% identical.", tag: "Project", icon: FileBox },
                    { t: "Export to many formats", d: "PNG, JPG, WEBP, BMP, SVG, TIFF. Flexible matte and scaling.", tag: "Export", icon: Globe },
                  ].map((c) => (
                    <div key={c.t} className="rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-md border border-[#2c2c31] bg-[#101012] text-[#8fb6f5]">
                          <c.icon size={13} />
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#6e6e78]">{c.tag}</span>
                      </div>
                      <div className="mt-2.5 text-[12px] font-semibold text-white">{c.t}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-[#6e6e78]">{c.d}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-8 flex items-center justify-center gap-2 pb-2 font-mono text-[10px] text-[#4a4a52]">
              <span>AVERO STUDIO v2.0.0</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <span>Offline</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <span>Non destructive</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <span>Ctrl+K all actions</span>
            </div>
          </div>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" onClick={() => setShowNew(false)}>
          <div
            className="w-[520px] max-w-full overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[#2c2c31] px-5 py-4">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-[#2f7cf6] text-white">
                <ImagePlus size={16} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-white">New Document</div>
                <div className="text-[11px] text-[#6e6e78]">Presets and custom sizes</div>
              </div>
              <button
                onClick={() => setShowNew(false)}
                className="ml-auto rounded-md p-1.5 text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5">
              <label className="col-span-3">
                <span className="avero-micro mb-1.5 block">Document name</span>
                <input
                  value={dn}
                  onChange={(e) => setDn(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-3 text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                />
              </label>
              <label>
                <span className="avero-micro mb-1.5 block">Width</span>
                <input
                  value={dw}
                  onChange={(e) => setDw(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-3 font-mono text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                />
              </label>
              <label>
                <span className="avero-micro mb-1.5 block">Height</span>
                <input
                  value={dh}
                  onChange={(e) => setDh(e.target.value)}
                  className="h-9 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-3 font-mono text-[12px] text-white outline-none focus:border-[#2f7cf6]"
                />
              </label>
              <label>
                <span className="avero-micro mb-1.5 block">Background</span>
                <select
                  value={bg}
                  onChange={(e) => setBg(e.target.value as any)}
                  className="h-9 w-full rounded-md border border-[#2c2c31] bg-[#101012] px-2 text-[12px] text-white outline-none"
                >
                  <option value="white">White</option>
                  <option value="black">Black</option>
                  <option value="transparent">Transparent</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-5 py-3">
              <span className="font-mono text-[10px] text-[#6e6e78]">
                {dw}x{dh} {bg}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowNew(false)}
                  className="h-8 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] text-white hover:border-[#3a3a41]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createNew(dn.trim() || "Untitled", Math.max(1, parseInt(dw) || 1920), Math.max(1, parseInt(dh) || 1080))}
                  className="avero-btn-primary h-8 rounded-md px-4 text-[12px] font-semibold text-white"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
