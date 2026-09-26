import { useEffect, useState } from "react";

interface DialogRequest {
  id: string;
  kind: "input" | "confirm";
  title: string;
  message: string;
  initial: string;
  placeholder?: string;
}

// Branded AVERO modal. Replaces window.prompt / window.confirm so the
// WebView never shows the "tauri.localhost says" browser chrome.
export default function AppDialog() {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    function onRequest(e: Event) {
      const detail = (e as CustomEvent).detail as DialogRequest;
      setReq(detail);
      setValue(detail.initial ?? "");
    }
    window.addEventListener("avero:dialog-request", onRequest);
    return () => window.removeEventListener("avero:dialog-request", onRequest);
  }, []);

  useEffect(() => {
    if (!req) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") submit(true);
      if (e.key === "Escape") submit(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req, value]);

  if (!req) return null;

  function submit(ok: boolean) {
    window.dispatchEvent(
      new CustomEvent("avero:dialog-result", { detail: { id: req!.id, ok, value } }),
    );
    setReq(null);
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-[380px] rounded-2xl border border-white/10 bg-[#1c1c1f] p-4 shadow-2xl">
        <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-[#6e6e78]">
          AVERO STUDIO
        </div>
        <div className="mb-1 text-[14px] font-semibold text-white">{req.title}</div>
        <div className="mb-3 text-[12px] leading-snug text-[#a7a7b0]">{req.message}</div>
        {req.kind === "input" && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={req.placeholder ?? ""}
            className="mb-3 w-full rounded-lg border border-[#2c2c31] bg-[#101012] px-3 py-2 text-[13px] text-white outline-none focus:border-[#2f7cf6]"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => submit(false)}
            className="rounded-lg bg-[#232327] px-4 py-1.5 text-[12px] text-[#c9c9d1] hover:bg-[#2c2c31] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => submit(true)}
            className="rounded-lg bg-[#2f7cf6] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#3b8bff]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
