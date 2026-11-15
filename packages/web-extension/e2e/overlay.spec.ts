import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { WxtBrowser } from "wxt/browser";
import {
  FORGED_TOOLBAR_EDGE,
  TEST_PAGE_URL,
  TEST_PAGE_WITH_IFRAME_URL,
  expect,
  test,
} from "./fixtures.js";

type PageMessagingModule = typeof import("@webext-core/messaging/page");

const BLOB_PROBE_NAMESPACE = "react-grab-extension:blob-probe";

const readPageMessagingBundle = (): Promise<string> => {
  const pageModulePath = createRequire(import.meta.url).resolve(
    "@webext-core/messaging/page",
  );
  return readFile(
    path.join(path.dirname(pageModulePath), "page.iife.js"),
    "utf8",
  );
};

const waitForOverlay = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)))
    .toBe(true);

test.describe(
  "web extension on a non-localhost page",
  { tag: ["@ADR-0023"] },
  () => {
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

    test("disabling the extension reaches the overlay API and badges the action", async ({
      page,
      serviceWorker,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await page.evaluate(() => {
        const api = window.__REACT_GRAB__;
        if (!api) return;
        const setEnabledCalls: boolean[] = [];
        const originalSetEnabled = api.setEnabled;
        api.setEnabled = (enabled) => {
          setEnabledCalls.push(enabled);
          originalSetEnabled(enabled);
        };
        Reflect.set(window, "setEnabledCalls", setEnabledCalls);
      });

      await serviceWorker.evaluate(async () => {
        const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
        await extensionApi.storage.local.set({ react_grab_enabled: false });
      });

      await expect
        .poll(() =>
          page.evaluate((): unknown => Reflect.get(window, "setEnabledCalls")),
        )
        .toEqual([false]);
      await expect
        .poll(() =>
          serviceWorker.evaluate(() => {
            const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
            return extensionApi.action.getBadgeText({});
          }),
        )
        .toBe("OFF");
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
