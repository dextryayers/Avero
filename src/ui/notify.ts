import { message, ask } from "@tauri-apps/plugin-dialog";

function isTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

export type NotifyKind = "info" | "success" | "error";

export function notify(msg: string, kind: NotifyKind = "info") {
  window.dispatchEvent(new CustomEvent("avero:notify", { detail: { msg, kind } }));
}

export function notifyError(msg: string) {
  notify(msg, "error");
}

export function notifySuccess(msg: string) {
  notify(msg, "success");
}

// Native OS message box (app-titled, no "localhost says") when on desktop,
// fallback to in-app toast on web preview.
export async function showMessage(msg: string, title = "AVERO STUDIO"): Promise<void> {
  if (isTauri()) {
    try {
      await message(msg, { title, kind: "info" });
      return;
    } catch {
      /* fall through to toast */
    }
  }
  notify(msg, "info");
}

export async function showError(msg: string, title = "AVERO STUDIO"): Promise<void> {
  if (isTauri()) {
    try {
      await message(msg, { title, kind: "error" });
      return;
    } catch {
      /* fall through */
    }
  }
  notify(msg, "error");
}

// Native OS Yes/No confirm. Returns true for OK/Yes.
export async function askConfirm(msg: string, title = "AVERO STUDIO"): Promise<boolean> {
  if (isTauri()) {
    try {
      return await ask(msg, { title, kind: "warning" });
    } catch {
      /* fall through to in-app dialog */
    }
  }
  return await inAppConfirm(title, msg);
}

function inAppConfirm(title: string, msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; ok: boolean };
      if (detail.id !== id) return;
      window.removeEventListener("avero:dialog-result", handler as EventListener);
      resolve(detail.ok);
    };
    const id = `confirm-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
    window.addEventListener("avero:dialog-result", handler as EventListener);
    window.dispatchEvent(
      new CustomEvent("avero:dialog-request", {
        detail: { id, kind: "confirm", title, message: msg, initial: "" },
      }),
    );
  });
}

// Branded in-app text input (never uses window.prompt, so no localhost branding).
export async function askText(
  title: string,
  label: string,
  initial = "",
  placeholder = "",
): Promise<string | null> {
  return new Promise((resolve) => {
    const id = `input-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; ok: boolean; value?: string };
      if (detail.id !== id) return;
      window.removeEventListener("avero:dialog-result", handler as EventListener);
      resolve(detail.ok ? (detail.value ?? "") : null);
    };
    window.addEventListener("avero:dialog-result", handler as EventListener);
    window.dispatchEvent(
      new CustomEvent("avero:dialog-request", {
        detail: { id, kind: "input", title, message: label, initial, placeholder },
      }),
    );
  });
}
