import "solid-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { init, initSync, populateSync } from "react-grab";
import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    initReactGrab: typeof init;
  }
}

window.initReactGrab = init;

// Expose sync controls for E2E tests — tests call populate() or initSync() manually.
// No auto-initSync on boot. See SPEC-014 (ADR-0011).
if (import.meta.env.DEV) {
  (window as any).__reactGrabSync = {
    populate: populateSync,
    initSync,
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
