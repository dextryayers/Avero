import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { useEditorStore } from "./stores/useEditorStore";
import { useProStore } from "./stores/useProStore";
import { useWorkspaceStore } from "./stores/useWorkspaceStore";
import "./index.css";

let __ec = 0;
let __pc = 0;
let __wc = 0;
useEditorStore.subscribe(() => {
  __ec++;
  if (__ec <= 6 || (__ec % 25 === 0 && __ec < 130))
    console.log(`[DIAG] editor publish #${__ec} ${__ec > 6 ? new Error().stack?.slice(0, 700) : ""}`);
});
useProStore.subscribe(() => {
  __pc++;
  if (__pc <= 4 || (__pc % 25 === 0 && __pc < 130))
    console.log(`[DIAG] pro publish #${__pc} ${__pc > 4 ? new Error().stack?.slice(0, 700) : ""}`);
});
useWorkspaceStore.subscribe(() => {
  __wc++;
  if (__wc < 12) console.log(`[DIAG] workspace publish #${__wc}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
