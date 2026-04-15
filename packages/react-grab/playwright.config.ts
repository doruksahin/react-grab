import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5175",
    trace: "on-first-retry",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/touch-mode\.spec\.ts/, /mocked\//],
    },
    {
      name: "chromium-touch",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
      },
      testMatch: /touch-mode\.spec\.ts/,
    },
    {
      name: "chromium-mocked",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:5176",
        video: "on",
      },
      testMatch: /mocked\/.+\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "pnpm --filter react-grab build && pnpm dev",
      url: "http://localhost:5175",
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(__dirname, "../e2e-app"),
      timeout: 30000,
    },
    {
      command: "pnpm dev:mock",
      url: "http://localhost:5176",
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(__dirname, "../e2e-app"),
      timeout: 30000,
    },
  ],
});
