import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  stack: string;
}

// Deep improve Fase 6: layar hitam tanpa pesan tidak boleh terjadi lagi.
// Boundary ini menangkap error render dan tampilkan diagnosis + tombol pulih.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, stack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log(`[DIAG] render crash: ${error.message}`);
    console.log(`[DIAG] component stack:${info.componentStack}`);
    this.setState({ stack: info.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full place-items-center bg-[#1e1e1e] p-8 text-[#e0e0e0]">
          <div className="w-[560px] max-w-full rounded-lg border border-red-800 bg-[#2a1f1f] p-5">
            <h2 className="text-[15px] font-bold text-red-200">PSD Studio menemui error render</h2>
            <p className="mt-1 font-mono text-[11px] text-red-100/80">{this.state.error.message}</p>
            <pre className="mt-2 max-h-44 overflow-auto rounded bg-black/50 p-2 font-mono text-[10px] text-[#c5c5c5]">
              {this.state.stack}
            </pre>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="rounded bg-[#0a84ff] px-3 py-1.5 text-[12px] text-white"
              >
                Muat ulang
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                  } catch {
                    /* abaikan */
                  }
                  window.location.reload();
                }}
                className="rounded bg-[#3e3e42] px-3 py-1.5 text-[12px]"
              >
                Reset setting lokal dan muat ulang
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
