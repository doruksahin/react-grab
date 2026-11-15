import path from "node:path";
import {
  type BrowserContext,
  type Worker,
  chromium,
  test as base,
} from "@playwright/test";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../dist/chrome-mv3");

export const TEST_PAGE_URL = "https://react-grab-extension.test/";

const TEST_PAGE_HTML =
  "<!doctype html><html><head><title>Extension test page</title></head><body><h1>Extension test page</h1></body></html>";

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await context.route(TEST_PAGE_URL, (route) =>
      route.fulfill({ contentType: "text/html", body: TEST_PAGE_HTML }),
    );
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const [existingWorker] = context.serviceWorkers();
    await use(existingWorker ?? (await context.waitForEvent("serviceworker")));
  },
});

export { expect } from "@playwright/test";
