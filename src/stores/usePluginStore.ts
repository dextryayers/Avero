import { create } from "zustand";
import type { PluginDef } from "../plugins/sdk";
import { EXAMPLE_PLUGINS } from "../plugins/sdk";

interface PluginState {
  plugins: (PluginDef & { enabled: boolean })[];
  params: Record<string, Record<string, number>>;
  install: (def: PluginDef) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  setParam: (id: string, key: string, v: number) => void;
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: EXAMPLE_PLUGINS.map((p) => ({ ...p, enabled: true })),
  params: Object.fromEntries(
    EXAMPLE_PLUGINS.map((p) => [p.id, Object.fromEntries(p.params.map((x) => [x.key, x.def]))]),
  ),
  install: (def) =>
    set((s) => {
      if (s.plugins.some((p) => p.id === def.id)) return s;
      return {
        plugins: [...s.plugins, { ...def, enabled: true }],
        params: {
          ...s.params,
          [def.id]: Object.fromEntries(def.params.map((x) => [x.key, x.def])),
        },
      };
    }),
  toggle: (id) =>
    set((s) => ({
      plugins: s.plugins.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    })),
  remove: (id) => set((s) => ({ plugins: s.plugins.filter((p) => p.id !== id) })),
  setParam: (id, key, v) =>
    set((s) => ({ params: { ...s.params, [id]: { ...s.params[id], [key]: v } } })),
}));
