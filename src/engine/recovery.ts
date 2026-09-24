// Fase 6.1: Auto-save dan crash recovery ringan.
// Simpan thumbnail composite + metadata tiap 2 menit ke localStorage.
// Saat start, jika ada sesi kotor, tawarkan recovery banner.

const KEY = "psd-recovery-v1";

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
    // storage penuh: abaikan, jangan ganggu editing
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
    /* abaikan */
  }
}
