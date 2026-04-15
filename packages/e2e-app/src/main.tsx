import "solid-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { init, initSync } from "react-grab";
import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    initReactGrab: typeof init;
  }
}

window.initReactGrab = init;

const serverUrl = import.meta.env.VITE_REACT_GRAB_SYNC_URL as string | undefined;
const workspace = import.meta.env.VITE_REACT_GRAB_SYNC_WORKSPACE as string | undefined;
const jiraProjectKey = import.meta.env.VITE_REACT_GRAB_JIRA_PROJECT_KEY as string | undefined;

if (serverUrl && workspace && jiraProjectKey) {
  initSync({
    enabled: true,
    serverUrl,
    workspace,
    jiraProjectKey,
    syncRevealedState: true,
    onSyncError: (err) => console.warn("[react-grab e2e] sync error:", err.message),
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
