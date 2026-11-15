import type { WxtBrowser } from "wxt/browser";
import { TEST_PAGE_URL, expect, test } from "./fixtures.js";

test.describe(
  "web extension on a non-localhost page",
  { tag: ["@ADR-0023"] },
  () => {
    test.beforeEach(async ({ page, serviceWorker }) => {
      expect(serviceWorker.url()).toContain("background.js");
      await page.goto(TEST_PAGE_URL);
      await expect
        .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)))
        .toBe(true);
    });

    test("mounts the overlay in the page", async ({ page }) => {
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
          serviceWorker.evaluate(async (pageUrl) => {
            const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
            const [tab] = await extensionApi.tabs.query({ url: pageUrl });
            return extensionApi.action.getBadgeText({ tabId: tab?.id });
          }, TEST_PAGE_URL),
        )
        .toBe("OFF");
    });

    test("saves toolbar changes made in the page to extension storage", async ({
      page,
      serviceWorker,
    }) => {
      await page.evaluate(() => {
        window.__REACT_GRAB__?.setToolbarState({ collapsed: true });
      });

      await expect
        .poll(() =>
          serviceWorker.evaluate(async () => {
            const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
            const stored = await extensionApi.storage.local.get(
              "react_grab_toolbar_state",
            );
            return stored;
          }),
        )
        .toMatchObject({ react_grab_toolbar_state: { collapsed: true } });
    });
  },
);
