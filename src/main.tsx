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
  if (__ec < 15) console.log(`[DIAG] editor publish #${__ec}`);
});
useProStore.subscribe(() => {
  __pc++;
  if (__pc < 15) console.log(`[DIAG] pro publish #${__pc}`);
});
useWorkspaceStore.subscribe(() => {
  __wc++;
  if (__wc < 15) console.log(`[DIAG] workspace publish #${__wc}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
