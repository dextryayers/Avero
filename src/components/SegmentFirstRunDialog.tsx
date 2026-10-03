import { useEffect, useState } from "react";
import { modelManifest, modelStatus, downloadModel, type ModelInfo, type ModelStatus } from "../io/nativeEngine";
import { notify } from "../ui/notify";

// Plan5 Fase 6.3: first-run dialog. Asks the user to download AI models once.
// Honest about size and offline-after behavior. Three choices: Download, Skip,
// Never auto. The dialog only shows when models are missing and the user has
// not previously dismissed it.

const DISMISS_KEY = "avero-segment-dismissed";

export function wasSegmentDialogDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissSegmentDialog(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface Props {
  onDone: () => void;
}

export function SegmentFirstRunDialog({ onDone }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [status, setStatus] = useState<ModelStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, s] = await Promise.all([modelManifest(), modelStatus()]);
        if (cancelled) return;
        setModels(m);
        setStatus(s);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;
    function apply(file: string, pct: number) {
      if (!alive) return;
      setProgress((p) => ({ ...p, [file]: pct }));
    }
    function onWindow(e: Event) {
      const d = (e as CustomEvent).detail as { file: string; pct: number };
      if (typeof d?.pct === "number") apply(String(d.file ?? ""), d.pct);
    }
    window.addEventListener("avero:segment-progress", onWindow);
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!alive) return;
        unlisten = await listen("avero:segment-progress", (ev) => {
          const d = ev.payload as { file: string; pct: number };
          if (typeof d?.pct === "number") apply(String(d.file ?? ""), d.pct);
        });
      } catch {
        /* web preview has no Tauri events */
      }
    })();
    return () => {
      alive = false;
      window.removeEventListener("avero:segment-progress", onWindow);
      if (unlisten) unlisten();
    };
  }, []);

  const totalSize = models.reduce((a, m) => a + m.size, 0);
  const totalMb = (totalSize / 1024 / 1024).toFixed(0);
  const allFound = status.length > 0 && status.every((s) => s.found);

  async function handleDownload() {
    setBusy(true);
    for (const m of models) {
      try {
        await downloadModel(m.file, m.url, m.sha256);
      } catch (e) {
        notify(`Failed to download ${m.name}: ${String(e)}`);
      }
    }
    setBusy(false);
    onDone();
  }

  function handleSkip() {
    dismissSegmentDialog();
    onDone();
  }

  function handleNever() {
    dismissSegmentDialog();
    onDone();
  }

  if (allFound) {
    onDone();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-[#2c2c31] bg-[#1c1c1f] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Download AI Models</h2>
        <p className="mt-2 text-sm text-[#8e8e98]">
          Auto Segment uses local AI models to detect objects in your photos. Download them once
          (~{totalMb} MB) and everything works offline after that.
        </p>
        <div className="mt-4 space-y-2">
          {models.map((m) => {
            const pct = progress[m.file] ?? 0;
            const found = status.find((s) => s.name === m.name)?.found ?? false;
            return (
              <div key={m.file} className="flex items-center justify-between text-sm">
                <span className="text-[#c8c8d0]">{m.name}</span>
                <span className="text-[#8e8e98]">
                  {found ? "Ready" : pct > 0 ? `${pct}%` : `${(m.size / 1024 / 1024).toFixed(1)} MB`}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 rounded-lg bg-[#2f7cf6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a8bff] disabled:opacity-50"
          >
            {busy ? "Downloading..." : "Download"}
          </button>
          <button
            onClick={handleSkip}
            disabled={busy}
            className="rounded-lg border border-[#2c2c31] px-4 py-2 text-sm text-[#c8c8d0] hover:bg-white/5 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleNever}
            disabled={busy}
            className="rounded-lg border border-[#2c2c31] px-4 py-2 text-sm text-[#c8c8d0] hover:bg-white/5 disabled:opacity-50"
          >
            Never auto
          </button>
        </div>
      </div>
    </div>
  );
}
