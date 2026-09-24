import { useState } from "react";
import { usePluginStore } from "../stores/usePluginStore";
import { runPlugin, type PluginDef } from "../plugins/sdk";
import { useEditorStore } from "../stores/useEditorStore";
import { layerManager } from "../engine/layerManager";
import { useProStore } from "../stores/useProStore";

export default function PluginPanel() {
  const plugins = usePluginStore((s) => s.plugins);
  const params = usePluginStore((s) => s.params);
  const toggle = usePluginStore((s) => s.toggle);
  const remove = usePluginStore((s) => s.remove);
  const setParam = usePluginStore((s) => s.setParam);
  const install = usePluginStore((s) => s.install);
  const [code, setCode] = useState(`// Contoh plugin custom 50 baris max\n// d = Uint8ClampedArray RGBA, params, W, H\nconst s = (params.strength ?? 50) / 100;\nfor (let i = 0; i < d.length; i += 4) {\n  d[i] = d[i]*(1-s) + (255-d[i])*s;\n}`);
  const [log, setLog] = useState<string | null>(null);

  function applyPlugin(def: PluginDef) {
    const id = useEditorStore.getState().activeLayerId;
    if (!id) {
      setLog("Pilih layer dulu");
      return;
    }
    const p = params[def.id] ?? {};
    try {
      const snap = layerManager.snapshot(id);
      if (snap) useEditorStore.getState().pushHistory({ label: `Plugin ${def.name}`, layerId: id, snapshot: snap });
      const c = layerManager.get(id);
      if (!c) return;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const out = runPlugin(def, img, p);
      ctx.putImageData(out, 0, 0);
      useEditorStore.getState().markDirty();
      useProStore.getState().bumpHistogram();
      setLog(`${def.name} diterapkan`);
    } catch (e) {
      setLog(`Plugin error: ${String(e)}`);
    }
  }

  function installCustom() {
    try {
      const def: PluginDef = {
        id: `custom-${Date.now().toString(36)}`,
        name: `Custom ${plugins.length + 1}`,
        version: "0.1.0",
        author: "Saya",
        description: "Plugin custom dari editor",
        params: [{ key: "strength", label: "Strength", min: 0, max: 100, def: 50 }],
        code,
      };
      // validasi sintaks
      new Function("d", "params", "W", "H", code);
      install(def);
      setLog("Plugin custom terinstall");
    } catch (e) {
      setLog(`Kode tidak valid: ${String(e)}`);
    }
  }

  return (
    <div className="space-y-2 p-3 text-[12px]">
      {plugins.map((p) => (
        <div key={p.id} className="rounded border border-[#3e3e42] bg-[#2a2a2a] p-2">
          <div className="flex items-center gap-1.5">
            <input type="checkbox" checked={p.enabled} onChange={() => toggle(p.id)} />
            <span className="flex-1 font-medium text-white">{p.name} <span className="font-mono text-[10px] text-[#a0a0a0]">v{p.version}</span></span>
            <button onClick={() => remove(p.id)} className="rounded bg-[#5a1f1f] px-1.5 py-0.5 text-[10px] text-white">Hapus</button>
          </div>
          <div className="text-[11px] text-[#a0a0a0]">{p.description} • {p.author}</div>
          {(params[p.id] ? Object.entries(params[p.id]) : []).map(([k, v]) => (
            <label key={k} className="mt-1 flex justify-between text-[11px] text-[#a0a0a0]">
              {k} <span className="font-mono text-white">{v}</span>
              <input type="range" min={0} max={100} value={v} onChange={(e) => setParam(p.id, k, Number(e.target.value))} className="w-full" />
            </label>
          ))}
          <button disabled={!p.enabled} onClick={() => applyPlugin(p)} className="mt-1.5 w-full rounded bg-[#0a84ff] px-2 py-1.5 text-white disabled:opacity-40">
            Terapkan ke layer aktif
          </button>
        </div>
      ))}

      <div className="rounded border border-dashed border-[#505050] p-2">
        <h4 className="mb-1 font-semibold text-white">Buat plugin (JS 50 baris)</h4>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={7} spellCheck={false} className="w-full rounded bg-[#141414] p-2 font-mono text-[10px] text-emerald-200" />
        <button onClick={installCustom} className="mt-1.5 w-full rounded bg-[#2d7a3a] px-2 py-1.5 text-white">Install plugin custom</button>
      </div>
      {log && <div className="rounded bg-[#1e2a33] p-2 text-[11px] text-[#bcd2e2]">{log}</div>}
      <p className="text-[10px] text-[#a0a0a0]">SDK Python via PyO3 dan WASM sandbox masuk trek 1.0. API JS stabil: d, params, W, H.</p>
    </div>
  );
}
