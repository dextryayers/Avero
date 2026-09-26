// Shortcut global editor: huruf tool (Shift untuk ganti keluarga), aksi menu, dan navigasi cepat.
import { TOOLS } from "../components/ToolBar";
import { MENUS } from "./menus";
import { useEditorStore, type ToolId } from "../stores/useEditorStore";

type Family = string[];

let families: Map<string, Family> | null = null;

function buildFamilies(): Map<string, Family> {
  const map = new Map<string, Family>();
  for (const t of TOOLS) {
    const key = t.shortcut.toUpperCase();
    const arr = map.get(key) ?? [];
    arr.push(t.id);
    map.set(key, arr);
  }
  const preferred: Record<string, string> = {
    V: "move",
    M: "select-rect",
    L: "select-lasso",
    W: "wand",
    B: "brush",
    J: "spot-heal",
    S: "clone",
    R: "blur",
    O: "dodge",
    E: "eraser",
    G: "gradient",
    I: "eyedropper",
    T: "text",
    U: "shape-rect",
    P: "pen",
    C: "crop",
    H: "hand",
    Z: "zoom",
  };
  for (const [letter, id] of Object.entries(preferred)) {
    const arr = map.get(letter);
    if (!arr) continue;
    const i = arr.indexOf(id);
    if (i > 0) {
      arr.splice(i, 1);
      arr.unshift(id);
    }
  }
  return map;
}

function getFamilies() {
  if (!families) families = buildFamilies();
  return families;
}

export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let k = e.key;
  if (k === "=" || k === "+") k = "+";
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

let actionIndex: Map<string, string> | null = null;

export function findMenuAction(combo: string): string | null {
  if (!actionIndex) {
    actionIndex = new Map();
    for (const items of Object.values(MENUS)) {
      for (const it of items) {
        if (it.hint && !actionIndex.has(it.hint)) actionIndex.set(it.hint, it.action);
      }
    }
  }
  return actionIndex.get(combo) ?? null;
}

export function dispatchAction(action: string) {
  window.dispatchEvent(new CustomEvent("avero:action", { detail: action }));
}

// Shift+huruf: cycling berurutan dalam keluarga tool yang sama (perilaku editor profesional)
export function cycleFamily(letter: string): boolean {
  const fam = getFamilies().get(letter.toUpperCase());
  if (!fam || fam.length === 0) return false;
  const ed = useEditorStore.getState();
  const cur = fam.indexOf(ed.tool);
  const next = cur < 0 ? 0 : (cur + 1) % fam.length;
  ed.setTool(fam[next] as ToolId);
  return true;
}

// Pilih tool pertama dari keluarga bila huruf belum tertangani handler lain
export function selectFamilyFirst(letter: string): boolean {
  const fam = getFamilies().get(letter.toUpperCase());
  if (!fam || fam.length === 0) return false;
  useEditorStore.getState().setTool(fam[0] as ToolId);
  return true;
}

export function adjustBrushSize(delta: number): boolean {
  const ed = useEditorStore.getState();
  const next = Math.max(1, Math.min(300, ed.brushSize + delta));
  ed.setBrush({ size: next });
  return true;
}

// Spasi: tahan untuk memakai Hand sementara, lepas untuk kembali ke tool sebelumnya
let spaceTool: string | null = null;

export function spaceDown(): boolean {
  const ed = useEditorStore.getState();
  if (ed.tool === "hand") return true;
  spaceTool = ed.tool;
  ed.setTool("hand");
  return true;
}

export function spaceUp(): boolean {
  if (!spaceTool) return false;
  const ed = useEditorStore.getState();
  if (ed.tool === "hand") ed.setTool(spaceTool as never);
  spaceTool = null;
  return true;
}
