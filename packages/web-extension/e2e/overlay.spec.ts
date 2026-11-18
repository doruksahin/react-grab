import type { WxtBrowser } from "wxt/browser";
import {
  FORGED_TOOLBAR_EDGE,
  HOST_INIT_DELAY_MS,
  LOCALHOST_PAGE_URL,
  OVERLAY_SETTLE_MS,
  TEST_PAGE_URL,
  TEST_PAGE_WITH_IFRAME_URL,
  expect,
  setExtensionEnabled,
  test,
  waitForOverlay,
} from "./fixtures.js";
import { readPageMessagingBundle } from "./page-messaging.js";

type PageMessagingModule = typeof import("@webext-core/messaging/page");

const BLOB_PROBE_NAMESPACE = "react-grab-extension:blob-probe";

test.describe(
  "overlay on an enabled non-localhost site",
  { tag: ["@ADR-0023"] },
  () => {
    test("copies an element that has no text, such as an input", async ({
      page,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);

      const copied = await page.evaluate(async () => {
        const input = document.querySelector("input");
        if (!input || !window.__REACT_GRAB__) return false;
        return window.__REACT_GRAB__.copyElement(input);
      });
      expect(copied).toBe(true);
    });

    test("mounts the overlay in the page", async ({ page, serviceWorker }) => {
      expect(serviceWorker.url()).toContain("background.js");
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);

      await expect
        .poll(() =>
          page.evaluate(() =>
            Boolean(
              document.querySelector("[data-react-grab-product]")?.shadowRoot,
            ),
          ),
        )
        .toBe(true);
    });

    test("turning the extension off disposes the overlay and its sync, and badges the action", async ({
      page,
      serviceWorker,
      syncServer,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await expect
        .poll(() => syncServer.requests("listGroups").length)
        .toBeGreaterThan(0);
      await page.evaluate(() => {
        const api = window.__REACT_GRAB__;
        if (!api) return;
        const originalDispose = api.dispose;
        api.dispose = () => {
          Reflect.set(window, "overlayDisposed", true);
          originalDispose();
        };
      });

      await setExtensionEnabled(serviceWorker, false);

      await expect
        .poll(() =>
          page.evaluate(() => ({
            hasApi: Boolean(window.__REACT_GRAB__),
            disposed: Reflect.get(window, "overlayDisposed"),
          })),
        )
        .toEqual({ hasApi: false, disposed: true });
      await expect
        .poll(() =>
          serviceWorker.evaluate(() => {
            const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
            return extensionApi.action.getBadgeText({});
          }),
        )
        .toBe("OFF");
    });

    test("turning the extension back on starts the overlay and its sync again", async ({
      page,
      serviceWorker,
      syncServer,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await setExtensionEnabled(serviceWorker, false);
      await expect
        .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)))
        .toBe(false);
      syncServer.reset();

      await setExtensionEnabled(serviceWorker, true);

      await waitForOverlay(page);
      await expect
        .poll(() => syncServer.requests("listGroups").length)
        .toBeGreaterThan(0);
    });

    test("a page opened while the extension is off gets no overlay and no sync", async ({
      page,
      serviceWorker,
      syncServer,
    }) => {
      await setExtensionEnabled(serviceWorker, false);

      await page.goto(TEST_PAGE_URL);
      await page.waitForTimeout(OVERLAY_SETTLE_MS);

      expect(await page.evaluate(() => Boolean(window.__REACT_GRAB__))).toBe(
        false,
      );
      expect(syncServer.requests("listGroups")).toEqual([]);
      expect(syncServer.requests("listComments")).toEqual([]);
    });

    test("on localhost turning the extension off leaves the host app's own overlay running", async ({
      page,
      serviceWorker,
    }) => {
      await page.goto(LOCALHOST_PAGE_URL);
      await expect
        .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)), {
          timeout: HOST_INIT_DELAY_MS * 4,
        })
        .toBe(true);

      await setExtensionEnabled(serviceWorker, false);
      await expect
        .poll(() =>
          serviceWorker.evaluate(() => {
            const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
            return extensionApi.action.getBadgeText({});
          }),
        )
        .toBe("OFF");
      await page.waitForTimeout(OVERLAY_SETTLE_MS);

      expect(await page.evaluate(() => Boolean(window.__REACT_GRAB__))).toBe(
        true,
      );
    });

    test("saves toolbar changes made in the page to extension storage", async ({
      page,
      serviceWorker,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);

      await page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ collapsed: true });
      });

      await expect
        .poll(() =>
          serviceWorker.evaluate(async () => {
            const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
            return extensionApi.storage.local.get("react_grab_toolbar_state");
          }),
        )
        .toMatchObject({ react_grab_toolbar_state: { collapsed: true } });
    });

    test("a cross-origin iframe cannot reach the service worker", async ({
      page,
      serviceWorker,
    }) => {
      await serviceWorker.evaluate(() => {
        const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
        const storedToolbarStates: unknown[] = [];
        Reflect.set(globalThis, "storedToolbarStates", storedToolbarStates);
        extensionApi.storage.local.onChanged.addListener((changes) => {
          const toolbarStateChange = changes["react_grab_toolbar_state"];
          if (toolbarStateChange)
            storedToolbarStates.push(toolbarStateChange.newValue);
        });
      });

      await page.goto(TEST_PAGE_WITH_IFRAME_URL);
      await waitForOverlay(page);
      await expect
        .poll(() =>
          page.evaluate((): unknown => Reflect.get(window, "forgeryAttempted")),
        )
        .toBe(true);
      await page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ collapsed: true });
      });

      const readStoredToolbarStates = () =>
        serviceWorker.evaluate((): unknown =>
          Reflect.get(globalThis, "storedToolbarStates"),
        );
      await expect
        .poll(readStoredToolbarStates)
        .toContainEqual(expect.objectContaining({ collapsed: true }));
      expect(await readStoredToolbarStates()).not.toContainEqual(
        expect.objectContaining({ edge: FORGED_TOOLBAR_EDGE }),
      );
    });

    test("a Blob crosses from the MAIN world to an isolated world on the custom-event messenger", async ({
      context,
      page,
    }) => {
      await page.goto(TEST_PAGE_URL);
      const pageMessagingBundle = await readPageMessagingBundle();

      const devtoolsSession = await context.newCDPSession(page);
      const { frameTree } = await devtoolsSession.send("Page.getFrameTree");
      const { executionContextId } = await devtoolsSession.send(
        "Page.createIsolatedWorld",
        { frameId: frameTree.frame.id, worldName: "blob-probe" },
      );
      await devtoolsSession.send("Runtime.evaluate", {
        contextId: executionContextId,
        expression: `${pageMessagingBundle}
        webExtCorePageMessaging
          .defineCustomEventMessaging({ namespace: "${BLOB_PROBE_NAMESPACE}" })
          .onMessage("describeBlob", async ({ data }) => ({
            isBlob: data instanceof Blob,
            type: data.type,
            text: await data.text(),
          }));`,
      });

      await page.addScriptTag({ content: pageMessagingBundle });
      const blobDescription = await page.evaluate(async (namespace) => {
        const messaging: PageMessagingModule = Reflect.get(
          window,
          "webExtCorePageMessaging",
        );
        return messaging
          .defineCustomEventMessaging<{
            describeBlob(blob: Blob): {
              isBlob: boolean;
              type: string;
              text: string;
            };
          }>({ namespace })
          .sendMessage("describeBlob", new Blob(["x"], { type: "image/png" }));
      }, BLOB_PROBE_NAMESPACE);

      expect(blobDescription).toEqual({
        isBlob: true,
        type: "image/png",
        text: "x",
      });
    });
  },
);
