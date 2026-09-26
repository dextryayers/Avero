import { useEffect, useState } from "react";

interface Toast {
  id: number;
  msg: string;
  kind: "info" | "success" | "error";
}

let seq = 0;

export default function Notifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onNotify(e: Event) {
      const detail = (e as CustomEvent).detail as { msg: string; kind: Toast["kind"] };
      const id = ++seq;
      setToasts((t) => [...t.slice(-3), { id, msg: detail.msg, kind: detail.kind ?? "info" }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
    }
    window.addEventListener("avero:notify", onNotify);
    return () => window.removeEventListener("avero:notify", onNotify);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-[100] flex w-[320px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl border px-3 py-2 text-[12px] shadow-2xl backdrop-blur-xl ${
            t.kind === "error"
              ? "border-red-500/40 bg-[#2a1414]/95 text-red-100"
              : t.kind === "success"
                ? "border-emerald-500/30 bg-[#10241a]/95 text-emerald-50"
                : "border-white/10 bg-[#1c1c1f]/95 text-[#ececee]"
          }`}
        >
          <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-[#6e6e78]">
            AVERO STUDIO
          </div>
          <div className="leading-snug">{t.msg}</div>
        </div>
      ))}
    </div>
  );
}
