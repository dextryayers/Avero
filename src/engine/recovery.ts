// Phase 6.1: lightweight auto-save and crash recovery.
// Persist the composite thumbnail + metadata to localStorage every 2 minutes.
// On startup, if a dirty session exists, offer the recovery banner.

const KEY = "avero-recovery-v1";

export interface RecoveryData {
  time: number;
  docName: string;
  width: number;
  height: number;
  thumb: string;
}

export function saveRecovery(thumb: string, docName: string, w: number, h: number) {
  try {
    const data: RecoveryData = { time: Date.now(), docName, width: w, height: h, thumb };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full: ignore, never interrupt editing
  }
}

export function loadRecovery(): RecoveryData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as RecoveryData;
    if (Date.now() - d.time > 7 * 24 * 3600 * 1000) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearRecovery() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
