import "solid-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { init, initSync, populateSync } from "react-grab";
import {
  createFakeJiraPort,
  type FakeJiraData,
} from "react-grab/src/test-support/fake-ports.ts";
import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    initReactGrab: typeof init;
  }
}

window.initReactGrab = init;

type PopulateSeed = Parameters<typeof populateSync>[0] & {
  jira?: FakeJiraData;
};

// Seeds the overlay without HTTP: an in-memory Jira port goes in through the
// same initSync injection seam a host app or the extension uses (ADR-0023),
// with storage left local, and the seed fills the sync store.
const populate = async ({ jira, ...seed }: PopulateSeed) => {
  await initSync({
    enabled: false,
    workspace: seed.workspace,
    jira: createFakeJiraPort(jira),
    syncRevealedState: true,
    onSyncError: (error) => console.warn("[e2e] sync error:", error.message),
  });
  populateSync(seed);
};

// Expose sync controls for E2E tests — tests call populate() or initSync() manually,
// never both. No auto-initSync on boot. See SPEC-014 (ADR-0011).
if (import.meta.env.DEV) {
  (window as any).__reactGrabSync = {
    populate,
    initSync,
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
