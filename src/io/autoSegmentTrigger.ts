import { isTauri, segmentModelsStatus } from "./nativeEngine";
import { useSettingsStore } from "../stores/useSettingsStore";
import { runAutoSegment } from "./autoSegment";

// Plan5 Fase 6.1: auto-segment trigger for image entry paths.
// Fires after a new image enters via dialog, drop, or double-click.
// Does NOT fire for .avx projects or pasted images.
// Respects the autoSegment setting (default ON). Non-blocking: the
// trigger only schedules the work; the caller never awaits inference.

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function cancelPendingAutoSegment(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

export async function triggerAutoSegment(): Promise<void> {
  if (!isTauri()) return;
  const s = useSettingsStore.getState();
  if (!s.autoSegment) return;
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void fire();
  }, 350);
}

async function fire(): Promise<void> {
  if (running) return;
  let models;
  try {
    models = await segmentModelsStatus();
  } catch {
    return;
  }
  const anyFound = models.yolo.found || models.stuff.found || models.text.found;
  if (!anyFound) return;
  running = true;
  try {
    await runAutoSegment();
  } finally {
    running = false;
  }
}
