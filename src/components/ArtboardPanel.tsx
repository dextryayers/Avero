import { useState } from "react";
import { ART_PRESETS, useArtboardStore } from "../stores/useArtboardStore";
import { getCompositeCanvas } from "./CanvasArea";
import { rustSaveDataUrl } from "../io/tauriIo";
import { save } from "@tauri-apps/plugin-dialog";

export default function ArtboardPanel() {
  const boards = useArtboardStore((s) => s.boards);
  const add = useArtboardStore((s) => s.add);
  const update = useArtboardStore((s) => s.update);
  const remove = useArtboardStore((s) => s.remove);
  const [preset, setPreset] = useState(ART_PRESETS[0]);
  const [log, setLog] = useState<string | null>(null);

  async function exportBoard(id: string) {
    const b = boards.find((x) => x.id === id);
    const comp = getCompositeCanvas();
    if (!b || !comp) {
      setLog("Composite belum siap");
      return;
    }
    // petakan artboard doc-space ke composite pixel
    const sx = Math.max(0, Math.min(comp.width, Math.round(b.x)));
    const sy = Math.max(0, Math.min(comp.height, Math.round(b.y)));
    const sw = Math.max(1, Math.min(comp.width - sx, Math.round(b.w)));
    const sh = Math.max(1, Math.min(comp.height - sy, Math.round(b.h)));
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")!.drawImage(comp, sx, sy, sw, sh, 0, 0, sw, sh);
    const url = out.toDataURL("image/png");
    try {
      const path = await save({
        defaultPath: `${b.name}.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (!path) return;
      await rustSaveDataUrl(url, path);
      setLog(`${b.name} diekspor ${sw}x${sh}`);
    } catch (e) {
      // fallback download browser
      const a = document.createElement("a");
      a.href = url;
      a.download = `${b.name}.png`;
      a.click();
      setLog(`${b.name} diunduh via browser`);
    }
  }

  return (
    <div className="space-y-2 p-3 text-[12px]">
      <div className="flex gap-1.5">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="flex-1 rounded bg-[#1e1e1e] px-2 py-1.5 text-white"
        >
          {ART_PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button onClick={() => add(preset)} className="rounded bg-[#0a84ff] px-2 py-1.5 text-white">
          +Artboard
        </button>
      </div>
      {boards.map((b) => (
        <div key={b.id} className="rounded border border-[#3e3e42] bg-[#2a2a2a] p-2">
          <div className="flex items-center gap-1.5">
            <input
              value={b.name}
              onChange={(e) => update(b.id, { name: e.target.value })}
              className="w-full rounded bg-[#1e1e1e] px-2 py-1 text-white"
            />
            <button
              onClick={() => remove(b.id)}
              className="rounded bg-[#5a1f1f] px-2 py-1 text-white"
            >
              x
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <label key={k} className="text-[10px] text-[#a0a0a0]">
                {k.toUpperCase()}
                <input
                  type="number"
                  value={Math.round(b[k])}
                  onChange={(e) => update(b.id, { [k]: Number(e.target.value) } as any)}
                  className="mt-0.5 w-full rounded bg-[#1e1e1e] px-1 py-1 font-mono text-white"
                />
              </label>
            ))}
          </div>
          <button
            onClick={() => exportBoard(b.id)}
            className="mt-1.5 w-full rounded bg-[#2d7a3a] px-2 py-1 text-white"
          >
            Export {b.name}
          </button>
        </div>
      ))}
      {log && <div className="rounded bg-[#1f3a24] p-2 text-[11px] text-[#bfe6c6]">{log}</div>}
      <p className="text-[10px] text-[#a0a0a0]">
        Infinite canvas + artboard ala Figma. Koordinat dalam pixel dokumen.
      </p>
    </div>
  );
}
