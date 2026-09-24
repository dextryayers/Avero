import { create } from "zustand";
import { useEditorStore } from "./useEditorStore";
import { useProStore } from "./useProStore";

export type NodeKind = "input" | "adjust" | "filter" | "blend" | "output";

export interface PNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  refId?: string; // adjustment/filter id atau layer id
  params?: Record<string, number>;
}

export interface PEdge {
  id: string;
  from: string;
  to: string;
}

interface NodeState {
  enabled: boolean;
  nodes: PNode[];
  edges: PEdge[];
  selected: string | null;
  toggle: () => void;
  autoFromStack: () => void;
  addNode: (kind: NodeKind, label: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  connect: (from: string, to: string) => void;
  setSelected: (id: string | null) => void;
}

let seq = 0;
function uid(p: string) {
  seq += 1;
  return `${p}-${Date.now().toString(36)}-${seq}`;
}

export const useNodeStore = create<NodeState>((set, get) => ({
  enabled: false,
  nodes: [],
  edges: [],
  selected: null,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  autoFromStack: () => {
    const layers = useEditorStore.getState().layers;
    const adj = useProStore.getState().adjustments;
    const flt = useProStore.getState().filters;
    const nodes: PNode[] = [];
    const edges: PEdge[] = [];
    layers.forEach((l: any, i: number) => {
      nodes.push({ id: `n-input-${l.id}`, kind: "input", label: l.name.slice(0, 14), x: 40, y: 40 + i * 86, refId: l.id });
    });
    let y = 40;
    let prev = nodes.length > 0 ? nodes[nodes.length - 1].id : null;
    adj
      .filter((a: any) => a.enabled)
      .forEach((a: any) => {
        const id = `n-adj-${a.id}`;
        nodes.push({ id, kind: "adjust", label: a.name.slice(0, 14), x: 280, y, refId: a.id });
        if (prev) edges.push({ id: uid("e"), from: prev, to: id });
        prev = id;
        y += 86;
      });
    flt
      .filter((f: any) => f.enabled)
      .forEach((f: any) => {
        const id = `n-flt-${f.id}`;
        nodes.push({ id, kind: "filter", label: f.name.slice(0, 14), x: 520, y: y - 40, refId: f.id });
        if (prev) edges.push({ id: uid("e"), from: prev, to: id });
        prev = id;
      });
    const outId = "n-output";
    nodes.push({ id: outId, kind: "output", label: "Output", x: 760, y: 120 });
    if (prev) edges.push({ id: uid("e"), from: prev, to: outId });
    set({ nodes, edges });
  },
  addNode: (kind, label) =>
    set((s) => ({ nodes: [...s.nodes, { id: uid("n"), kind, label, x: 120 + s.nodes.length * 24, y: 120 + s.nodes.length * 24 }] })),
  moveNode: (id, x, y) => set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),
  removeNode: (id) => set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id), edges: s.edges.filter((e) => e.from !== id && e.to !== id) })),
  connect: (from, to) => {
    if (from === to) return;
    const exists = get().edges.some((e) => e.from === from && e.to === to);
    if (exists) return;
    set((s) => ({ edges: [...s.edges, { id: uid("e"), from, to }] }));
  },
  setSelected: (selected) => set({ selected }),
}));
