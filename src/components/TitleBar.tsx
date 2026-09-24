import { useEffect, useState } from "react";
import { checkBackend, pickImageToOpen, rustDecodeToDataUrl, rustImageInfo } from "../io/tauriIo";
import { layerManager } from "../engine/layerManager";
import { useEditorStore } from "../stores/useEditorStore";
import { useHomeStore } from "../stores/useHomeStore";
import { useProStore } from "../stores/useProStore";
import { Bell, CloudOff, Cpu, House, Search } from "lucide-react";
import clsx from "clsx";

const MENUS: Record<string, { label: string; hint?: string; action: string }[]> = {
  File: [
    { label: "Baru…", hint: "Ctrl+N", action: "new" },
    { label: "Buka Gambar…", hint: "Ctrl+O", action: "open" },
    { label: "Home Screen", hint: "", action: "home" },
    { label: "Export PNG…", hint: "Ctrl+S", action: "export" },
  ],
  Edit: [
    { label: "Undo", hint: "Ctrl+Z", action: "undo" },
    { label: "Redo", hint: "Ctrl+Y", action: "redo" },
    { label: "Semua Aksi…", hint: "Ctrl+K", action: "palette" },
  ],
  Image: [
    { label: "Fit Zoom", hint: "", action: "fit" },
    { label: "Zoom 100%", hint: "", action: "zoom100" },
    { label: "Toggle Rulers", hint: "", action: "rulers" },
  ],
  Layer: [
    { label: "Layer Baru", hint: "", action: "add-layer" },
    { label: "Duplikat Layer", hint: "", action: "dup-layer" },
    { label: "Toggle Guides", hint: "", action: "guides" },
  ],
  Filter: [
    { label: "Gaussian Blur", hint: "", action: "f-blur" },
    { label: "Sharpen", hint: "", action: "f-sharpen" },
    { label: "Vignette", hint: "", action: "f-vignette" },
  ],
  View: [
    { label: "Workspace Retouch", hint: "", action: "ws-retouch" },
    { label: "Workspace Photo", hint: "", action: "ws-photo" },
    { label: "Onboarding Lagi", hint: "", action: "onboarding" },
  ],
  Help: [
    { label: "Shortcut & Tips", hint: "Ctrl+K", action: "palette" },
    { label: "Tentang AVERO", hint: "v2.0.0", action: "about" },
  ],
};

export default function TitleBar({
  onOpenCommand,
  onHome,
}: {
  onOpenCommand: () => void;
  onHome: () => void;
}) {
  const doc = useEditorStore((s) => s.doc);
  const backendStatus = useEditorStore((s) => s.backendStatus);
  const backendInfo = useEditorStore((s) => s.backendInfo);
  const setBackend = useEditorStore((s) => s.setBackend);
  const openDocument = useEditorStore((s) => s.openDocument);
  const [busy, setBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    checkBackend().then((r) => {
      setBackend(r.ok ? "online" : "web-only", r.info);
    });
  }, [setBackend]);

  useEffect(() => {
    function close() {
      setOpenMenu(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function openPath(path: string) {
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const name = path.split(/[/\\]/).pop() ?? "Opened image";
    openDocument(name, info.width, info.height, path, info.file_size);
    useHomeStore.getState().pushRecent({
      name,
      path,
      thumb: dataUrl,
      full: dataUrl.length < 2_500_000 ? dataUrl : null,
      w: info.width,
      h: info.height,
      size: info.file_size,
    });
    useHomeStore.getState().setHome(false);
    window.dispatchEvent(
      new CustomEvent("avero:opened-image", { detail: { dataUrl, w: info.width, h: info.height } }),
    );
  }

  useEffect(() => {
    function onOpenPath(e: Event) {
      const path = (e as CustomEvent).detail as string;
      if (!path || busy) return;
      setBusy(true);
      openPath(path)
        .catch((err) => {
          console.error(err);
          alert(`Gagal membuka gambar: ${String(err)}`);
        })
        .finally(() => setBusy(false));
    }
    window.addEventListener("avero:open-path", onOpenPath);
    return () => window.removeEventListener("avero:open-path", onOpenPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  async function handleOpen() {
    if (busy) return;
    setBusy(true);
    try {
      const path = await pickImageToOpen();
      if (!path) return;
      await openPath(path);
    } catch (e) {
      console.error(e);
      alert(`Gagal membuka gambar: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function runAction(a: string) {
    setOpenMenu(null);
    const ed = useEditorStore.getState();
    const pro = useProStore.getState();
    switch (a) {
      case "new":
        onHome();
        break;
      case "open":
        handleOpen();
        break;
      case "home":
        onHome();
        break;
      case "export":
      case "palette":
        onOpenCommand();
        break;
      case "undo": {
        const e = ed.undoMeta();
        if (e) {
          layerManager.restore(e.layerId, e.snapshot);
          if (e.maskSnapshot) layerManager.restoreMask(e.layerId, e.maskSnapshot);
          ed.markDirty();
          pro.bumpHistogram();
        }
        break;
      }
      case "redo":
        ed.redoMeta();
        break;
      case "fit":
        window.dispatchEvent(new Event("avero:fit-zoom"));
        break;
      case "zoom100":
        ed.setZoom(100);
        break;
      case "rulers":
        ed.toggleRulers();
        break;
      case "add-layer": {
        import("../stores/useEditorStore").then(({ makeLayer }) => {
          const l = makeLayer(`Layer ${ed.layers.length + 1}`);
          layerManager.ensure(l.id, ed.doc.width, ed.doc.height);
          ed.addLayer(l);
        });
        break;
      }
      case "dup-layer":
        onOpenCommand();
        break;
      case "guides":
        pro.toggleGuides();
        break;
      case "f-blur":
        pro.addFilter("gaussianBlur");
        break;
      case "f-sharpen":
        pro.addFilter("sharpen");
        break;
      case "f-vignette":
        pro.addFilter("vignette");
        break;
      case "ws-retouch":
        import("../stores/useWorkspaceStore").then(({ useWorkspaceStore }) =>
          useWorkspaceStore.getState().setWorkspace("retouching"),
        );
        break;
      case "ws-photo":
        import("../stores/useWorkspaceStore").then(({ useWorkspaceStore }) =>
          useWorkspaceStore.getState().setWorkspace("photography"),
        );
        break;
      case "onboarding":
        try {
          localStorage.removeItem("avero-onboarding");
        } catch {}
        window.location.reload();
        break;
      case "about":
        alert("AVERO STUDIO v2.0.0 — Professional Photo Studio.\nOffline-first • Non-destruktif • Open Source.");
        break;
    }
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#1c2333] bg-[#0e1219]/95 px-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <button onClick={onHome} title="Home (layar awal)">
          <img src="/logo.png" alt="AVERO" className="h-7 w-7 rounded-lg object-cover shadow-[0_0_16px_rgba(10,132,255,0.5)] hover:ring-2 hover:ring-[#0a84ff]" />
        </button>
        <button onClick={onHome} title="Home" className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[12.5px] font-extrabold tracking-[0.12em] text-white hover:text-[#38e1ff]">AVERO STUDIO</span>
          <House size={13} className="text-[#5b6577]" />
        </button>
        <span className="rounded-md border border-[#232b3d] bg-black/40 px-1.5 py-0.5 font-mono text-[9.5px] text-[#8a94a6]">
          v2.0.0
        </span>
      </div>

      <nav className="ml-2 hidden items-center gap-0.5 text-[12px] lg:flex">
        {Object.keys(MENUS).map((m) => (
          <div key={m} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                if (m === "File" && !openMenu) {
                  // klik pertama File tetap buka menu (tidak langsung dialog agar discoverable)
                }
                setOpenMenu(openMenu === m ? null : m);
              }}
              onMouseEnter={() => {
                if (openMenu) setOpenMenu(m);
              }}
              className={clsx(
                "rounded-lg px-2.5 py-1.5",
                openMenu === m ? "bg-[#1b2130] text-white" : "text-[#aeb7c9] hover:bg-white/5 hover:text-white",
              )}
            >
              {m}
            </button>
            {openMenu === m && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[220px] overflow-hidden rounded-xl border border-[#232b3d] bg-[#10141d] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                {MENUS[m].map((it) => (
                  <button
                    key={it.label}
                    onClick={() => runAction(it.action)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-[#c5cddc] hover:bg-[#0a84ff] hover:text-white"
                  >
                    <span>{it.label}</span>
                    {it.hint && <span className="font-mono text-[10px] opacity-60">{it.hint}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <button
        onClick={onOpenCommand}
        className="ml-2 hidden items-center gap-1.5 rounded-lg border border-[#232b3d] bg-black/40 px-2.5 py-1.5 text-[11.5px] text-[#8a94a6] hover:border-[#0a84ff] hover:text-white md:flex"
      >
        <Search size={13} /> Ctrl+K semua aksi…
      </button>

      <div className="ml-auto flex items-center gap-2 text-[11px]">
        <span className="hidden max-w-[260px] truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[#aeb7c9] xl:block">
          {doc.name} {doc.dirty ? "•" : ""} {doc.width}x{doc.height}
        </span>
        <span
          title={backendInfo}
          className={clsx(
            "flex items-center gap-1 rounded-full px-2.5 py-1 font-medium",
            backendStatus === "online" ? "bg-emerald-500/12 text-emerald-300" : "bg-amber-500/12 text-amber-300",
          )}
        >
          {backendStatus === "online" ? <Cpu size={12} /> : <CloudOff size={12} />}
          {backendStatus === "online" ? "Rust engine" : "Web preview"}
        </span>
        <Bell size={14} className="text-[#5b6577]" />
      </div>
      <span className="hidden" data-open-handler={busy ? "busy" : "idle"} onClick={handleOpen} />
    </div>
  );
}

// Helper agar App bisa trigger open tanpa prop drilling rumit
export function useTitleBarOpen() {
  const openDocument = useEditorStore((s) => s.openDocument);
  return async function openNow() {
    const path = await pickImageToOpen();
    if (!path) return;
    const info = await rustImageInfo(path);
    const dataUrl = await rustDecodeToDataUrl(path, 2048);
    const name = path.split(/[/\\]/).pop() ?? "Opened image";
    openDocument(name, info.width, info.height, path, info.file_size);
    layerManager.clear();
    window.dispatchEvent(
      new CustomEvent("avero:opened-image", { detail: { dataUrl, w: info.width, h: info.height } }),
    );
  };
}
