import path from "node:path";
import {
  type BrowserContext,
  type Page,
  type Worker,
  chromium,
  test as base,
  expect,
} from "@playwright/test";
import type { WxtBrowser } from "wxt/browser";
import {
  type MockServerHandle,
  mockSyncServer,
} from "../../react-grab/e2e/mocks/routes.js";
import { TEST_API_TOKEN } from "../../react-grab/e2e/mocks/fixtures.js";
import type { SiteSettingsByOrigin } from "../src/settings/types.js";
import {
  DISABLED_SITE_ORIGIN,
  ENABLED_SITE_ORIGIN,
  LOCALHOST_SITE_ORIGIN,
  SYNC_SERVER_URL,
} from "./e2e-origins.js";

const EXTENSION_PATH = path.resolve(
  import.meta.dirname,
  "../dist/chrome-mv3-e2e",
);

export const TEST_PAGE_URL = `${ENABLED_SITE_ORIGIN}/`;
export const TEST_PAGE_WITH_IFRAME_URL = `${ENABLED_SITE_ORIGIN}/with-iframe`;
export const DISABLED_PAGE_URL = `${DISABLED_SITE_ORIGIN}/`;
export const LOCALHOST_PAGE_URL = `${LOCALHOST_SITE_ORIGIN}/`;
const HOST_REACT_GRAB_URL = `${LOCALHOST_SITE_ORIGIN}/react-grab.js`;
const HOST_REACT_GRAB_PATH = path.resolve(
  import.meta.dirname,
  "../../react-grab/dist/index.global.js",
);
export const HOST_INIT_DELAY_MS = 1500;
export const OVERLAY_SETTLE_MS = 1000;
const THIRD_PARTY_IFRAME_URL = "https://third-party-ads.test/frame";

export const TEST_WORKSPACE = "extension-e2e-workspace";
export const FORGED_TOOLBAR_EDGE = "left";
export { TEST_API_TOKEN };

const TEST_PAGE_HTML =
  "<!doctype html><html><head><title>Extension test page</title></head><body><h1>Extension test page</h1><label>Board name <input name='board' placeholder='Name'></label></body></html>";

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

const LOCALHOST_PAGE_WITH_LATE_HOST_HTML = `<!doctype html><html><head><title>Host app with its own react-grab</title></head><body>
<script>setTimeout(() => { const script = document.createElement("script"); script.src = "/react-grab.js"; document.head.appendChild(script); }, ${HOST_INIT_DELAY_MS});</script>
</body></html>`;

const HTML_PAGES = new Map([
  [LOCALHOST_PAGE_URL, LOCALHOST_PAGE_WITH_LATE_HOST_HTML],
  [TEST_PAGE_URL, TEST_PAGE_HTML],
  [TEST_PAGE_WITH_IFRAME_URL, TEST_PAGE_WITH_IFRAME_HTML],
  [DISABLED_PAGE_URL, TEST_PAGE_HTML],
  [THIRD_PARTY_IFRAME_URL, THIRD_PARTY_IFRAME_HTML],
]);

export const ENABLED_SITES: SiteSettingsByOrigin = {
  [ENABLED_SITE_ORIGIN]: {
    workspace: TEST_WORKSPACE,
    recordSteps: false,
    recordSession: false,
  },
  [LOCALHOST_SITE_ORIGIN]: {
    workspace: TEST_WORKSPACE,
    recordSteps: false,
    recordSession: false,
  },
};

const configureSync = async (serviceWorker: Worker): Promise<void> => {
  await serviceWorker.evaluate(
    async ({ serverUrl, apiToken, sites }) => {
      const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
      await extensionApi.storage.local.set({
        sync_server_url: serverUrl,
        sync_api_token: apiToken,
        sync_sites: sites,
        // WXT storage version of sync_sites (settings-items.ts), so the
        // seeded value is not migrated again.
        sync_sites$: { v: 2 },
      });
    },
    {
      serverUrl: SYNC_SERVER_URL,
      apiToken: TEST_API_TOKEN,
      sites: ENABLED_SITES,
    },
  );
  await expect
    .poll(() =>
      serviceWorker.evaluate(async () => {
        const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
        const scripts =
          await extensionApi.scripting.getRegisteredContentScripts();
        return scripts.flatMap((script) => script.matches ?? []).sort();
      }),
    )
    .toEqual(
      ["relay", "overlay"]
        .flatMap(() =>
          Object.keys(ENABLED_SITES).map((origin) => `${origin}/*`),
        )
        .sort(),
    );
};

export const extensionPageUrl = (
  serviceWorker: Worker,
  pagePath: string,
): string =>
  `chrome-extension://${new URL(serviceWorker.url()).host}/${pagePath}`;

export const openExtensionPage = async (
  context: BrowserContext,
  serviceWorker: Worker,
  pagePath: string,
): Promise<Page> => {
  const extensionPage = await context.newPage();
  await extensionPage.goto(extensionPageUrl(serviceWorker, pagePath));
  return extensionPage;
};

export const setExtensionEnabled = (
  serviceWorker: Worker,
  enabled: boolean,
): Promise<void> =>
  serviceWorker.evaluate(async (nextEnabled) => {
    const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
    await extensionApi.storage.local.set({ react_grab_enabled: nextEnabled });
  }, enabled);

export const waitForOverlay = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)))
    .toBe(true);

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  syncServer: MockServerHandle;
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
    await context.route(HOST_REACT_GRAB_URL, (route) =>
      route.fulfill({
        contentType: "text/javascript",
        path: HOST_REACT_GRAB_PATH,
      }),
    );
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const [existingWorker] = context.serviceWorkers();
    const serviceWorker =
      existingWorker ?? (await context.waitForEvent("serviceworker"));
    await use(serviceWorker);
  },
  syncServer: [
    async ({ context, serviceWorker }, use) => {
      const syncServer = await mockSyncServer(context);
      await configureSync(serviceWorker);
      await use(syncServer);
    },
    { auto: true },
  ],
});

export { expect };
