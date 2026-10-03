import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Clock,
  FileBox,
  Film,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Keyboard,
  Layers,
  LayoutGrid,
  Monitor,
  Plus,
  Printer,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useHomeStore, resolveRecent, type RecentFile } from "../stores/useHomeStore";
import { useEditorStore } from "../stores/useEditorStore";
import { useProStore } from "../stores/useProStore";
import { layerManager } from "../engine/layerManager";
import { openAvxProject, pickProjectFolder, createNewProjectWithFolder, joinPath, sanitizeProjectName, prepareFreshDocument } from "../io/projectIo";
import { useConvertStore } from "../stores/useConvertStore";
import ConverterPage from "./ConverterPage";
import { pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";
import { showError, showMessage, askConfirm } from "../ui/notify";
import { triggerAutoSegment } from "../io/autoSegmentTrigger";
import { useObjectStore } from "../stores/useObjectStore";
import clsx from "clsx";

type PresetCat = "Photo" | "Print" | "Art" | "Web" | "Mobile" | "Film";

const PRESETS: Record<PresetCat, { name: string; w: number; h: number; desc: string }[]> = {
  Photo: [
    { name: "HD Photo", w: 1920, h: 1080, desc: "General 16:9 editing" },
    { name: "4K Photo", w: 3840, h: 2160, desc: "High resolution" },
    { name: "8K UHD Photo", w: 7680, h: 4320, desc: "UHD tiled path" },
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
    { name: "4K UHD Frame", w: 3840, h: 2160, desc: "UHD frame" },
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

const RATIO_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "16:9", w: 1920, h: 1080 },
  { label: "4:3", w: 2400, h: 1800 },
  { label: "1:1", w: 1080, h: 1080 },
  { label: "3:2", w: 3000, h: 2000 },
  { label: "9:16", w: 1080, h: 1920 },
  { label: "A4", w: 2480, h: 3508 },
];

const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "Ctrl+K", what: "All actions" },
  { keys: "Ctrl+,", what: "Settings page" },
  { keys: "Space+drag", what: "Pan canvas" },
  { keys: "[ / ]", what: "Brush size" },
  { keys: "Ctrl+S", what: "Save .avx" },
  { keys: "Ctrl+E", what: "Export" },
];

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
    useObjectStore.getState().clearObjects();
    void triggerAutoSegment();
    return true;
  } catch (e) {
    console.error(e);
    await showError(`Failed to open image: ${String(e)}`);
    return false;
  }
}

function formatBytes(size: number | null): string {
  if (size === null) return "new";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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
  const [view, setView] = useState<"home" | "recent" | "learn" | "convert">("home");
  const convertCount = useConvertStore((s) => s.jobs.length);

  const [dn, setDn] = useState("Untitled-1");
  const [dw, setDw] = useState("1920");
  const [dh, setDh] = useState("1080");
  const [bg, setBg] = useState<"white" | "black" | "transparent">("white");
  const [pfolder, setPfolder] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createStage, setCreateStage] = useState("");
  const [folderBusy, setFolderBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const isDesktop = typeof window !== "undefined" && "__TAURI__" in window;

  // Folder picker — the "klik folder" path. Guarded against double-click,
  // reports cancel vs error distinctly, never freezes the modal.
  async function chooseProjectFolder() {
    if (folderBusy || creating) return;
    if (!isDesktop) {
      setFormError(null);
      setFormInfo("Folder picker needs the desktop app. On web, the project runs in memory and Save downloads Name.avx.");
      return;
    }
    setFolderBusy(true);
    try {
      const dir = await pickProjectFolder();
      if (dir) {
        setPfolder(dir);
        setFormError(null);
        setFormInfo(null);
      } else {
        // Cancel is normal — hint, don't scold.
        setFormError(null);
        setFormInfo("No folder picked yet. You can still press Create — Save (Ctrl+S) will ask where to put the .avx.");
      }
    } catch (e) {
      setFormError(`Could not open the folder picker: ${String(e)}`);
    } finally {
      setFolderBusy(false);
    }
  }

  function submitNew() {
    if (creating || folderBusy) return;
    void createNew(dn.trim() || "Untitled", Math.max(1, parseInt(dw) || 1920), Math.max(1, parseInt(dh) || 1080));
  }

  useEffect(() => {
    if (!showNew) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Enter inside the name field still creates (no native form to submit).
      if (e.key === "Escape" && !creating) setShowNew(false);
      if (e.key === "Enter" && !creating && !folderBusy) {
        // Don't hijack Enter while the user picks from an autocomplete popup.
        if (t && t.tagName === "INPUT" && (t as HTMLInputElement).list) {
          // fall through — still create, inputs here have no datalist
        }
        submitNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNew, dn, dw, dh, bg, creating, folderBusy, pfolder]);

  async function createNew(name: string, w: number, h: number) {
    if (creating) return;
    const cw = Math.max(1, Math.min(16384, Math.round(w)));
    const ch = Math.max(1, Math.min(16384, Math.round(h)));
    if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw < 1 || ch < 1) {
      setFormError("Width and height must be between 1 and 16384 px.");
      return;
    }
    // Huge canvases allocate ~4 bytes per pixel per layer: confirm before
    // committing to a document that needs hundreds of MB per stroke.
    if (cw * ch > 64 * 1024 * 1024) {
      const mp = ((cw * ch) / 1_000_000).toFixed(0);
      if (!(await askConfirm(`This canvas is ${mp} MP (about ${((cw * ch * 4) / 1024 / 1024).toFixed(0)} MB per layer). Continue?`))) return;
    }
    setFormError(null);
    setCreating(true);
    setCreateStage("Preparing");
    try {
      const clean = sanitizeProjectName(name.trim() || "Untitled");
      // Folder policy (fast + predictable):
      // - Modal flow (showNew open): use the picked folder when present; if
      //   none is picked yet, DON'T force a second file-manager popup — create
      //   now and let Ctrl+S ask where the .avx goes (defaults into the
      //   project folder when one exists). One picker per click, no loops.
      // - Preset quick-click (modal closed): never pop a picker; instant
      //   in-memory document for maximum perceived performance.
      const folder = showNew ? pfolder : null;
      let projectFolder: string | null = null;
      if (folder) {
        try {
          setCreateStage("Creating folder");
          projectFolder = await createNewProjectWithFolder(clean, folder);
        } catch (e) {
          setFormError(String(e));
          return;
        }
      }
      // Yield so the stage label paints before the heavy canvas allocation.
      setCreateStage("Preparing canvas");
      await new Promise((r) => setTimeout(r, 30));
      prepareFreshDocument();
      newDocument(clean, cw, ch, projectFolder);
      const id = useEditorStore.getState().activeLayerId;
      if (id) {
        const c = layerManager.ensure(id, cw, ch);
        if (bg !== "transparent") {
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = bg === "white" ? "#ffffff" : "#000000";
          ctx.fillRect(0, 0, cw, ch);
        }
        useProStore.getState().ensureTransform(id);
      }
      pushRecent({ name: clean, path: null, thumb: null, full: null, w: cw, h: ch, size: null });
      setShowNew(false);
      setHome(false);
      if (projectFolder) {
        await showMessage(`Project folder ready: ${projectFolder} (images in images/). Press Ctrl+S to save ${clean}.avx.`);
      }
    } finally {
      setCreating(false);
      setCreateStage("");
    }
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

  const searching = query.trim() !== "";
  const nw = Math.max(1, parseInt(dw) || 0);
  const nh = Math.max(1, parseInt(dh) || 0);
  const newMp = ((nw * nh) / 1_000_000).toFixed(1);
  const newMb = ((nw * nh * 4) / 1024 / 1024).toFixed(1);

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
              <span className="hidden items-center gap-1 sm:flex">
                <span className="h-1 w-1 rounded-full bg-[#7ad69e]" /> Offline
              </span>
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
          <button
            onClick={() => window.dispatchEvent(new Event("avero:open-settings"))}
            title="Settings page (Ctrl+,)"
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#161618] px-3 text-[12px] font-medium text-[#c9c9d1] hover:border-[#3a3a41] hover:text-white"
          >
            <Settings2 size={14} /> <span className="hidden lg:block">Settings</span>
          </button>
          <button
            onClick={() => void openAvxProject().catch((e) => showError(`Failed to open project: ${String(e)}`))}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#161618] px-3 text-[12px] font-medium text-[#c9c9d1] hover:border-[#3a3a41] hover:text-white"
          >
            <FileBox size={14} /> .avx
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="avero-btn-primary avero-lift flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white"
          >
            <Plus size={14} /> New
          </button>
          <button
            onClick={() => openImageViaDialog()}
            className="avero-lift flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#ececee] px-3 text-[12px] font-semibold text-[#161618] hover:bg-white"
          >
            <FolderOpen size={14} /> Open
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[212px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#2c2c31] bg-[#1c1c1f] p-3">
          <div className="avero-micro px-2 pb-1 pt-1">Studio</div>
          {[
            { id: "home", label: "Home", icon: LayoutGrid },
            { id: "recent", label: "Recent", icon: Clock, count: recents.length },
            { id: "convert", label: "Convert", icon: ArrowLeftRight, count: convertCount },
            { id: "learn", label: "Learn", icon: BookOpen },
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id as any)}
              className={clsx(
                "avero-lift flex items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-medium",
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
                    "avero-lift flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px]",
                    cat === c && view === "home" ? "bg-[#232327] text-white" : "text-[#a7a7b0] hover:bg-[#232327] hover:text-white",
                  )}
                >
                  <Icon size={13} /> {c}
                  <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">{PRESETS[c].length}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t border-[#2c2c31] pt-3">
            <button
              onClick={() => window.dispatchEvent(new Event("avero:open-settings"))}
              className="avero-lift flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-[#a7a7b0] hover:bg-[#232327] hover:text-white"
            >
              <Settings2 size={13} /> Settings
              <span className="ml-auto font-mono text-[10px] text-[#6e6e78]">Ctrl+,</span>
            </button>
          </div>
          <div className="mt-auto space-y-2 pt-3">
            <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Keyboard size={13} className="text-[#8fb6f5]" /> Shortcuts
              </div>
              <div className="mt-2 space-y-1">
                {SHORTCUTS.slice(0, 4).map((k) => (
                  <div key={k.keys} className="flex items-center justify-between text-[10.5px]">
                    <span className="text-[#6e6e78]">{k.what}</span>
                    <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-px font-mono text-[10px] text-[#a7a7b0]">{k.keys}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Layers size={13} className="text-[#8fb6f5]" /> .avx Project
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#a7a7b0]">
                Layers, masks, adjustments and filters stored intact. Press Ctrl+S to save.
              </div>
            </div>
            <div className="rounded-lg border border-[#2c2c31] bg-[#161618] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <Zap size={12} className="text-[#8fb6f5]" /> Light on RAM
              </div>
              <div className="mt-1 text-[11px] text-[#6e6e78]">Tiled processing keeps large files smooth.</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1240px] p-5">
            {view === "home" && !searching && (
              <div className="avero-fade-in overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f]">
                <div className="flex flex-wrap items-start gap-4 p-5">
                  <div className="min-w-[240px] flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[16px] font-bold text-white">Create something new</div>
                      <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-px font-mono text-[10px] text-[#8fb6f5]">174 tools ready</span>
                    </div>
                    <div className="mt-1 max-w-[600px] text-[12px] leading-relaxed text-[#a7a7b0]">
                      Open a photo, an .avx project, or start from a preset. Everything runs offline and non-destructively, and large files render through the tiled path.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowNew(true)}
                        className="avero-btn-primary avero-lift inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white"
                      >
                        <ImagePlus size={14} /> Create document <ArrowRight size={12} />
                      </button>
                      <button
                        onClick={() => openImageViaDialog()}
                        className="avero-lift inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] font-medium text-white hover:border-[#3a3a41]"
                      >
                        <FolderOpen size={14} /> Open image
                      </button>
                      <button
                        onClick={() => void openAvxProject().catch((e) => showError(String(e)))}
                        className="avero-lift inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2c2c31] bg-transparent px-3 text-[12px] text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
                      >
                        <FileBox size={14} /> Open .avx
                      </button>
                    </div>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2">
                    {[
                      { v: "174", l: "Tools" },
                      { v: "100%", l: "Offline" },
                      { v: "512px", l: "Tiled" },
                      { v: "27", l: "Blends" },
                    ].map((st) => (
                      <div key={st.l} className="w-[104px] rounded-md border border-[#2c2c31] bg-[#101012] px-2.5 py-2 text-center">
                        <div className="font-mono text-[15px] font-bold text-white">{st.v}</div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-[#6e6e78]">{st.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-[#2c2c31] bg-[#161618] px-5 py-2.5">
                  {SHORTCUTS.map((k) => (
                    <span key={k.keys} className="flex items-center gap-1.5 font-mono text-[10px] text-[#6e6e78]">
                      <span className="rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-px text-[#a7a7b0]">{k.keys}</span>
                      {k.what}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {view === "convert" ? (
              <ConverterPage />
            ) : (
              <>
            {searching && (
              <div className="avero-fade-in mb-2 text-[12px] text-[#a7a7b0]">
                Results for <span className="font-semibold text-white">“{query.trim()}”</span>
                <span className="font-mono text-[10px] text-[#6e6e78]"> · {filteredRecents.length} files, {filteredPresets.length} presets</span>
              </div>
            )}

            {view !== "learn" && (
              <>
                <div className="mb-3 mt-6 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[13px] font-bold text-white">
                    <Clock size={14} className="text-[#8fb6f5]" /> {searching ? "Matching files" : view === "recent" ? "All recent files" : "Recent"}
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
                    <div className="mt-3 text-[13px] font-semibold text-white">
                      {searching ? `No files match “${query.trim()}”` : "Start your first project"}
                    </div>
                    <div className="mx-auto mt-1 max-w-[420px] text-[11px] leading-relaxed text-[#6e6e78]">
                      {searching
                        ? "Try a different name, or open the file from disk to add it here."
                        : "Open a photo or .avx project, or create a new document. Files appear here automatically."}
                    </div>
                    {!searching && (
                      <div className="mt-4 flex justify-center gap-2">
                        <button
                          onClick={() => setShowNew(true)}
                          className="avero-btn-primary avero-lift h-8 rounded-md px-3 text-[12px] font-semibold text-white"
                        >
                          Create New
                        </button>
                        <button
                          onClick={() => openImageViaDialog()}
                          className="avero-lift h-8 rounded-md border border-[#2c2c31] bg-[#232327] px-3 text-[12px] text-white hover:border-[#3a3a41]"
                        >
                          Open Image
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredRecents.map((r) => (
                      <div
                        key={r.id}
                        className="avero-lift group relative overflow-hidden rounded-lg border border-[#2c2c31] bg-[#1c1c1f] hover:border-[#3a3a41]"
                      >
                        <button onClick={() => openRecent(r)} className="block w-full text-left" title={r.path ?? r.name}>
                          <div className="relative grid h-[132px] place-items-center overflow-hidden bg-[#0a0a0c]">
                            {r.thumb ? (
                              <img src={r.thumb} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="grid place-items-center">
                                <LayoutGrid size={22} className="text-[#3a3a41]" />
                                <span className="mt-1 font-mono text-[10px] text-[#6e6e78]">
                                  {r.w}x{r.h}
                                </span>
                              </div>
                            )}
                            {r.path?.toLowerCase().endsWith(".avx") && (
                              <span className="absolute left-2 top-2 rounded border border-[#2c2c31] bg-[#101012] px-1.5 py-px font-mono text-[9px] text-[#8fb6f5]">
                                .avx
                              </span>
                            )}
                          </div>
                          <div className="border-t border-[#2c2c31] p-3">
                            <div className="truncate text-[12px] font-semibold text-white">{r.name}</div>
                            <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[#6e6e78]">
                              <span>{new Date(r.time).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</span>
                              <span>
                                {r.w}x{r.h}
                              </span>
                              <span>{formatBytes(r.size)}</span>
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

            {(view === "home" || searching) && (
              <>
                <h3 className="mb-3 mt-8 flex items-center gap-2 text-[13px] font-bold text-white">
                  <ImagePlus size={14} className="text-[#8fb6f5]" /> {searching ? "Matching presets" : `${cat} Presets`}
                  <span className="rounded border border-[#2c2c31] bg-[#1c1c1f] px-1.5 py-px font-mono text-[10px] font-normal text-[#a7a7b0]">
                    {filteredPresets.length}
                  </span>
                  {!searching && (
                    <button
                      onClick={() => setShowNew(true)}
                      className="ml-auto flex h-7 items-center gap-1 rounded-md border border-[#2c2c31] bg-[#1c1c1f] px-2.5 text-[11px] font-normal text-[#a7a7b0] hover:border-[#3a3a41] hover:text-white"
                    >
                      <Plus size={12} /> Custom size
                    </button>
                  )}
                </h3>
                {filteredPresets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#2c2c31] bg-[#1c1c1f] p-6 text-center text-[12px] text-[#6e6e78]">
                    No presets match. <button onClick={() => setShowNew(true)} className="text-[#8fb6f5] hover:text-white">Create a custom size instead.</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredPresets.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => createNew(p.name, p.w, p.h)}
                        title={`Create ${p.w} by ${p.h}`}
                        className="avero-lift rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-3 text-left hover:border-[#3a3a41] hover:bg-[#1e1e22]"
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
                )}
              </>
            )}

            {view !== "recent" && (
              <>
                <h3 className="mb-1 mt-8 flex items-center gap-2 text-[13px] font-bold text-white">
                  <BookOpen size={14} className="text-[#8fb6f5]" /> Learn in 1 minute
                </h3>
                <div className="mb-3 text-[11px] text-[#6e6e78]">Core workflows. Open the editor and try each one on a test photo.</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { t: "Precise masking", d: "Select, feather, refine edge, paint mask. Hold Shift to add to selection.", tag: "Select", icon: Wand2 },
                    { t: "Natural retouch", d: "Spot Heal (J), Healing Brush, Clone Stamp (S), Patch. Alt+click sets the source.", tag: "Retouch", icon: Sparkles },
                    { t: "Cinematic grading", d: "Exposure, HSL, Vibrance, Warmth, Vignette, Grain. Tiled processing keeps it smooth.", tag: "Color", icon: Star },
                    { t: "History that restores pixels", d: "Undo steps back through real snapshots. Click any step in the Hist panel to jump.", tag: "History", icon: Clock },
                    { t: "Save .avx projects", d: "Ctrl+S saves layers and edits intact. Reopen identical every time.", tag: "Project", icon: FileBox },
                    { t: "Export to many formats", d: "PNG, JPG, WEBP, BMP, SVG, TIFF with flexible matte and scaling.", tag: "Export", icon: Globe },
                  ].map((c) => (
                    <div key={c.t} className="avero-lift rounded-lg border border-[#2c2c31] bg-[#1c1c1f] p-4">
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
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 pb-2 font-mono text-[10px] text-[#4a4a52]">
              <span>AVERO STUDIO v2.0.0</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <span>Offline</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <span>Non destructive</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <span>Ctrl+K all actions</span>
              <span className="h-1 w-1 rounded-full bg-[#2c2c31]" />
              <button onClick={() => window.dispatchEvent(new Event("avero:open-settings"))} className="hover:text-white">
                Settings
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <div
          className="avero-fade-in fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]"
          onClick={() => !creating && !folderBusy && setShowNew(false)}
        >
          <div
            className="avero-pop w-[640px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#151517] shadow-[0_32px_96px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="New Project"
          >
            {/* Header elegan */}
            <div className="flex items-center gap-3 border-b border-white/[0.07] bg-gradient-to-r from-[#161618] via-[#191922] to-[#161618] px-5 py-4">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#2f7cf6] to-[#19c2e0] text-white shadow-[0_8px_24px_rgba(47,124,246,0.4)]">
                <ImagePlus size={19} />
                {creating && <span className="avero-shimmer absolute inset-0" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-bold tracking-tight text-white">New Project</div>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-px font-mono text-[10px] text-[#8fb6f5]">
                    .avx ready
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-[#8f8f98]">
                  Canvas first, folder optional — max 16384px per side
                </div>
              </div>
              <div className="ml-auto hidden items-center gap-1 font-mono text-[10px] text-[#6e6e78] sm:flex">
                <span className="rounded-lg border border-[#2f7cf6]/40 bg-[#2f7cf6]/15 px-2 py-1 text-[#8fb6f5]">1 Canvas</span>
                <span>→</span>
                <span
                  className={clsx(
                    "rounded-lg border px-2 py-1",
                    pfolder ? "border-[#2f7cf6]/40 bg-[#2f7cf6]/15 text-[#8fb6f5]" : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  2 Folder
                </span>
                <span>→</span>
                <span
                  className={clsx(
                    "rounded-lg border px-2 py-1",
                    creating ? "border-[#2f7cf6]/40 bg-[#2f7cf6]/15 text-[#8fb6f5]" : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  3 Create
                </span>
              </div>
              <button
                onClick={() => !creating && !folderBusy && setShowNew(false)}
                disabled={creating || folderBusy}
                className="rounded-lg p-2 text-[#a7a7b0] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-5">
              {/* 01 Canvas */}
              <div className="flex items-center justify-between">
                <div className="avero-micro">01 — Canvas</div>
                <div className="font-mono text-[10px] text-[#4a4a52]">instant preview · no freeze</div>
              </div>
              <div className="avero-micro mb-1.5 mt-3">Aspect ratio shortcuts</div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {RATIO_PRESETS.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => {
                      setDw(String(r.w));
                      setDh(String(r.h));
                      setFormError(null);
                    }}
                    title={`${r.w} × ${r.h}`}
                    className={clsx(
                      "rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition",
                      dw === String(r.w) && dh === String(r.h)
                        ? "border-[#2f7cf6] bg-[#2f7cf6] font-bold text-white shadow-[0_4px_16px_rgba(47,124,246,0.35)]"
                        : "border-white/[0.08] bg-[#0e0e10] text-[#a7a7b0] hover:border-white/20 hover:text-white",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="avero-micro mb-1.5 block">Project name</span>
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={dn}
                  onChange={(e) => {
                    setDn(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Untitled-1"
                  maxLength={80}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0e0e10] px-3 text-[13px] text-white outline-none placeholder:text-[#4a4a52] focus:border-[#2f7cf6]"
                />
              </label>

              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label>
                  <span className="avero-micro mb-1.5 block">Width (px)</span>
                  <input
                    value={dw}
                    onChange={(e) => {
                      setDw(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
                      setFormError(null);
                    }}
                    inputMode="numeric"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0e0e10] px-3 font-mono text-[13px] text-white outline-none focus:border-[#2f7cf6]"
                  />
                </label>
                <button
                  onClick={() => {
                    setDw(dh);
                    setDh(dw);
                  }}
                  title="Swap orientation"
                  className="avero-lift mb-0.5 grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-[#0e0e10] text-[#a7a7b0] hover:border-white/20 hover:text-white"
                >
                  <ArrowLeftRight size={15} />
                </button>
                <label>
                  <span className="avero-micro mb-1.5 block">Height (px)</span>
                  <input
                    value={dh}
                    onChange={(e) => {
                      setDh(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
                      setFormError(null);
                    }}
                    inputMode="numeric"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0e0e10] px-3 font-mono text-[13px] text-white outline-none focus:border-[#2f7cf6]"
                  />
                </label>
              </div>

              <div className="mt-3">
                <span className="avero-micro mb-1.5 block">Background</span>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-[#0e0e10] p-1">
                  {(["white", "black", "transparent"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBg(b)}
                      className={clsx(
                        "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-medium capitalize transition",
                        bg === b ? "bg-[#2f7cf6] text-white shadow-[0_4px_16px_rgba(47,124,246,0.35)]" : "text-[#a7a7b0] hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/25"
                        style={{
                          background:
                            b === "transparent"
                              ? "conic-gradient(#555 0 25%, #222 0 50%, #555 0 75%, #222 0)"
                              : b === "white"
                                ? "#ececee"
                                : "#000",
                        }}
                      />
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live summary */}
              <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#0e0e10] px-3 py-2.5 font-mono text-[10.5px] text-[#8f8f98]">
                <span
                  className="inline-block shrink-0 rounded-[4px] border border-white/15"
                  style={{
                    width: `${Math.max(10, Math.min(48, (48 * nw) / Math.max(nw, nh)))}px`,
                    height: `${Math.max(7, Math.min(32, (32 * nh) / Math.max(nw, nh)))}px`,
                    background: bg === "transparent" ? "conic-gradient(#3a3a41 0 25%, #101012 0 50%, #3a3a41 0 75%, #101012 0)" : bg === "white" ? "#ececee" : "#000000",
                  }}
                  title="Live aspect preview"
                />
                <span className="text-white">{nw > 0 && nh > 0 ? `${nw}×${nh}` : "0×0"}</span>
                <span className="h-1 w-1 rounded-full bg-white/15" />
                <span>{newMp} MP</span>
                <span className="h-1 w-1 rounded-full bg-white/15" />
                <span>±{newMb} MB/layer</span>
                <span className="h-1 w-1 rounded-full bg-white/15" />
                <span className="capitalize">{bg}</span>
                {nw * nh > 2048 * 2048 && <span className="ml-auto rounded-md bg-[#2f7cf6]/15 px-1.5 py-px text-[#8fb6f5]">tiled path</span>}
              </div>

              {/* 02 Folder — klik folder dijamin berfungsi */}
              <div className="avero-micro mb-1.5 mt-5">02 — Project folder (optional)</div>
              <div
                className={clsx(
                  "rounded-xl border p-3 transition",
                  pfolder ? "border-[#2f7cf6]/30 bg-[#2f7cf6]/[0.06]" : "border-white/[0.08] bg-[#0e0e10]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#161618] text-[#8fb6f5]">
                    <FolderOpen size={16} />
                  </span>
                  <div
                    className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.07] bg-[#161618] px-2.5 py-2 font-mono text-[10.5px] text-[#c9c9d1]"
                    title={pfolder ?? "No parent folder selected yet"}
                  >
                    {pfolder ?? (isDesktop ? "No folder yet — optional, Create works anyway" : "Web preview: files download on save")}
                  </div>
                  {pfolder && (
                    <button
                      onClick={() => setPfolder(null)}
                      disabled={creating || folderBusy}
                      title="Use in-memory project instead"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#161618] text-[#a7a7b0] transition hover:border-[#e5534b]/50 hover:text-white disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => void chooseProjectFolder()}
                    disabled={creating || folderBusy}
                    className="avero-lift flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#2f7cf6] px-3.5 text-[12px] font-semibold text-white shadow-[0_4px_16px_rgba(47,124,246,0.35)] disabled:opacity-50"
                  >
                    {folderBusy ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Opening…
                      </>
                    ) : (
                      <>
                        <FolderOpen size={14} /> {pfolder ? "Change" : "Choose"}
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 rounded-lg border border-white/[0.06] bg-[#161618] px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-[#6e6e78]">
                  <div className="text-[#a7a7b0]">Will be created:</div>
                  <div className="truncate" title={pfolder ? joinPath(pfolder, sanitizeProjectName(dn.trim() || "Untitled")) : "In-memory project — Ctrl+S asks where to save"}>
                    {pfolder ? `${joinPath(pfolder, sanitizeProjectName(dn.trim() || "Untitled"))}/` : "In-memory — Ctrl+S opens file manager for Name.avx"}
                  </div>
                  {pfolder && (
                    <div className="truncate text-[#4a4a52]">
                      {`├─ ${sanitizeProjectName(dn.trim() || "Untitled")}.avx (on first Ctrl+S) └─ images/`}
                    </div>
                  )}
                </div>
                {!isDesktop && (
                  <div className="mt-2 text-[11px] leading-snug text-[#6e6e78]">
                    Web mode has no folder picker — everything stays in memory until you Save.
                  </div>
                )}
              </div>

              {formError && (
                <div className="mt-3 rounded-xl border border-[#e5534b]/40 bg-[#e5534b]/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-[#f0883e]">
                  {formError}
                </div>
              )}
              {formInfo && (
                <div className="mt-3 rounded-xl border border-[#2f7cf6]/40 bg-[#2f7cf6]/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-[#8fb6f5]">
                  {formInfo}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-white/[0.07] bg-[#101012] px-5 py-3.5">
              <span className="hidden font-mono text-[10.5px] text-[#4a4a52] sm:block">Enter creates · Esc closes</span>
              <span className="font-mono text-[10.5px] text-[#4a4a52] sm:hidden">Esc closes</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowNew(false)}
                  disabled={creating || folderBusy}
                  className="h-9 rounded-lg border border-white/10 bg-white/[0.05] px-4 text-[12px] text-white transition hover:bg-white/[0.09] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={submitNew}
                  disabled={creating || folderBusy}
                  className="avero-btn-primary avero-lift relative flex h-9 items-center gap-2 overflow-hidden rounded-lg px-5 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(47,124,246,0.35)] disabled:opacity-60"
                >
                  {creating && <span className="avero-shimmer absolute inset-0" />}
                  {creating ? (
                    <span className="relative flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {createStage || "Creating…"}
                    </span>
                  ) : (
                    <span className="relative">Create project →</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
