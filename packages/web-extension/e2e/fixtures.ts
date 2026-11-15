import path from "node:path";
import {
  type BrowserContext,
  type Worker,
  chromium,
  test as base,
} from "@playwright/test";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../dist/chrome-mv3");

export const TEST_PAGE_URL = "https://react-grab-extension.test/";
export const TEST_PAGE_WITH_IFRAME_URL =
  "https://react-grab-extension.test/with-iframe";
const THIRD_PARTY_IFRAME_URL = "https://third-party-ads.test/frame";

export const FORGED_TOOLBAR_EDGE = "left";

const TEST_PAGE_HTML =
  "<!doctype html><html><head><title>Extension test page</title></head><body><h1>Extension test page</h1></body></html>";

const TEST_PAGE_WITH_IFRAME_HTML = `<!doctype html><html><head><title>Extension test page with iframe</title></head><body>
<script>window.addEventListener("message", (event) => { if (event.data === "forgery-attempted") window.forgeryAttempted = true; });</script>
<iframe src="${THIRD_PARTY_IFRAME_URL}"></iframe>
</body></html>`;

const THIRD_PARTY_IFRAME_HTML = `<!doctype html><html><body><script>
const forgedToolbarState = { edge: "${FORGED_TOOLBAR_EDGE}", ratio: 0.5, collapsed: false, enabled: true, devMode: false, selectionsRevealed: false };
const forgedMessage = { id: 1, type: "saveToolbarState", data: forgedToolbarState, timestamp: Date.now() };
for (const namespace of ["react-grab-extension", "react-grab-extension:request"]) {
  parent.postMessage({ type: "@webext-core/messaging/window", message: forgedMessage, senderOrigin: location.origin, namespace, instanceId: "third-party" }, "*");
  try {
    parent.dispatchEvent(new CustomEvent("@webext-core/messaging/custom-events", { detail: { message: forgedMessage, namespace, instanceId: "third-party" } }));
  } catch {}
}
parent.postMessage("forgery-attempted", "*");
</script></body></html>`;

const HTML_PAGES = new Map([
  [TEST_PAGE_URL, TEST_PAGE_HTML],
  [TEST_PAGE_WITH_IFRAME_URL, TEST_PAGE_WITH_IFRAME_HTML],
  [THIRD_PARTY_IFRAME_URL, THIRD_PARTY_IFRAME_HTML],
]);

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
    for (const [url, body] of HTML_PAGES) {
      await context.route(url, (route) =>
        route.fulfill({ contentType: "text/html", body }),
      );
    }
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const [existingWorker] = context.serviceWorkers();
    await use(existingWorker ?? (await context.waitForEvent("serviceworker")));
  },
});

export { expect } from "@playwright/test";
