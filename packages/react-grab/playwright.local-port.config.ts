import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

// HACK: temporary local config — another worktree's dev server holds :5175.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:5195" },
  webServer: {
    ...base.webServer,
    command:
      "pnpm --filter react-grab build && pnpm dev --port 5195 --strictPort",
    url: "http://localhost:5195",
    reuseExistingServer: false,
  },
});
