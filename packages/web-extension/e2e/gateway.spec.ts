import type { Page } from "@playwright/test";
import type { WxtBrowser } from "wxt/browser";
import {
  TRANSPARENT_PNG_BUFFER,
  comments,
} from "../../react-grab/e2e/mocks/fixtures.js";
import { PAGE_REQUEST_NAMESPACE } from "../src/constants.js";
import type { OverlayRequestProtocol } from "../src/messaging/overlay-request-protocol.js";
import { DISABLED_SITE_ORIGIN, SYNC_SERVER_URL } from "./e2e-origins.js";
import {
  DISABLED_PAGE_URL,
  HOST_INIT_DELAY_MS,
  LOCALHOST_PAGE_URL,
  TEST_API_TOKEN,
  TEST_PAGE_URL,
  TEST_WORKSPACE,
  expect,
  openExtensionPage,
  test,
  waitForOverlay,
} from "./fixtures.js";
import { loadPageMessaging } from "./page-messaging.js";

type PageMessagingModule = typeof import("@webext-core/messaging/page");

const OTHER_WORKSPACE = "someone-elses-workspace";
const EXPECTED_AUTHORIZATION = `Bearer ${TEST_API_TOKEN}`;

const pageRequestMessenger = (page: Page) => ({
  uploadScreenshot: (blobText: string) =>
    page.evaluate(
      async ({ namespace, text }) => {
        const messaging: PageMessagingModule = Reflect.get(
          window,
          "webExtCorePageMessaging",
        );
        const messenger =
          messaging.defineCustomEventMessaging<OverlayRequestProtocol>({
            namespace,
          });
        return messenger.sendMessage("storage.uploadScreenshot", [
          "sel-e2e",
          "element",
          new Blob([text], { type: "image/png" }),
        ]);
      },
      { namespace: PAGE_REQUEST_NAMESPACE, text: blobText },
    ),
  loadScreenshot: () =>
    page.evaluate(async (namespace) => {
      const messaging: PageMessagingModule = Reflect.get(
        window,
        "webExtCorePageMessaging",
      );
      const messenger =
        messaging.defineCustomEventMessaging<OverlayRequestProtocol>({
          namespace,
        });
      const blob = await messenger.sendMessage("storage.loadScreenshot", [
        "sel-e2e",
        "element",
      ]);
      return { isBlob: blob instanceof Blob, type: blob.type, size: blob.size };
    }, PAGE_REQUEST_NAMESPACE),
  upsertComment: (args: unknown[]) =>
    page.evaluate(
      async ({ namespace, requestArgs }) => {
        const messaging: PageMessagingModule = Reflect.get(
          window,
          "webExtCorePageMessaging",
        );
        const messenger = messaging.defineCustomEventMessaging<
          Record<string, (args: unknown[]) => unknown>
        >({ namespace });
        return messenger
          .sendMessage("storage.upsertComment", requestArgs)
          .then(() => "accepted")
          .catch((error: unknown) => String(error));
      },
      { namespace: PAGE_REQUEST_NAMESPACE, requestArgs: args },
    ),
});

test.describe(
  "sync gateway in the service worker",
  { tag: ["@ADR-0023"] },
  () => {
    test("the overlay loads comments through the gateway with the token and the site's workspace", async ({
      page,
      syncServer,
    }) => {
      const consoleMessages: string[] = [];
      page.on("console", (message) => consoleMessages.push(message.text()));
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);

      await expect
        .poll(() => syncServer.requests("listComments").length)
        .toBeGreaterThan(0);
      const [listComments] = syncServer.requests("listComments");
      expect(listComments?.url).toBe(
        `${SYNC_SERVER_URL}/workspaces/${TEST_WORKSPACE}/comments`,
      );
      expect(listComments?.authorization).toBe(EXPECTED_AUTHORIZATION);
      await expect
        .poll(() => syncServer.requests("listGroups")[0]?.authorization)
        .toBe(EXPECTED_AUTHORIZATION);
      expect(
        consoleMessages.filter((message) => message.includes("sync error")),
      ).toEqual([]);
    });

    test("a comment write carries the token and goes to the site's workspace, whatever the page asks for", async ({
      page,
      syncServer,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await loadPageMessaging(page);

      const messenger = pageRequestMessenger(page);
      expect(
        await messenger.upsertComment([
          comments[0],
          { workspace: OTHER_WORKSPACE },
        ]),
      ).toContain("storage.upsertComment got invalid arguments");
      expect(
        await messenger.upsertComment([
          { ...comments[0], id: `../../${OTHER_WORKSPACE}/comments/x` },
        ]),
      ).toContain("storage.upsertComment got invalid arguments");
      expect(await messenger.upsertComment([comments[0]])).toBe("accepted");

      const upserts = syncServer.requests("upsertComment");
      expect(upserts).toHaveLength(1);
      expect(upserts[0]?.url).toBe(
        `${SYNC_SERVER_URL}/workspaces/${TEST_WORKSPACE}/comments/${comments[0]?.id}`,
      );
      expect(upserts[0]?.authorization).toBe(EXPECTED_AUTHORIZATION);
      expect(upserts[0]?.url).not.toContain(OTHER_WORKSPACE);
    });

    test("a comment's steps pass the gateway, and a typed value never does @ADR-0025", async ({
      page,
      syncServer,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await loadPageMessaging(page);

      const steps = [
        { type: "navigate", url: TEST_PAGE_URL },
        { type: "change", selectors: ["#coupon"], value: "" },
      ];
      const messenger = pageRequestMessenger(page);
      expect(
        await messenger.upsertComment([
          {
            ...comments[0],
            steps: [
              { type: "change", selectors: ["#coupon"], value: "SECRET" },
            ],
          },
        ]),
      ).toContain("storage.upsertComment got invalid arguments");
      expect(await messenger.upsertComment([{ ...comments[0], steps }])).toBe(
        "accepted",
      );

      const upserts = syncServer.requests("upsertComment");
      expect(upserts).toHaveLength(1);
      expect(upserts[0]?.body).toMatchObject({ steps });
    });

    test("a Blob screenshot is uploaded and loaded back through both message hops", async ({
      page,
      syncServer,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await loadPageMessaging(page);
      const messenger = pageRequestMessenger(page);

      await messenger.uploadScreenshot("png-bytes");
      const [upload] = syncServer.requests("uploadScreenshot");
      expect(upload?.url).toBe(
        `${SYNC_SERVER_URL}/workspaces/${TEST_WORKSPACE}/screenshots/sel-e2e/element`,
      );
      expect(upload?.body).toBe("png-bytes");

      expect(await messenger.loadScreenshot()).toEqual({
        isBlob: true,
        type: "image/png",
        size: TRANSPARENT_PNG_BUFFER.length,
      });
    });

    test("the page's JavaScript never sees the token", async ({
      page,
      syncServer,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      await expect
        .poll(() => syncServer.requests("listComments").length)
        .toBeGreaterThan(0);

      const pageCanSeeToken = await page.evaluate((token) => {
        const pageText = [
          document.documentElement.outerHTML,
          JSON.stringify({ ...localStorage }),
          JSON.stringify({ ...sessionStorage }),
          ...Object.getOwnPropertyNames(window).map((name) => {
            try {
              const value: unknown = Reflect.get(window, name);
              return typeof value === "string" ? value : "";
            } catch {
              return "";
            }
          }),
        ].join("\n");
        return pageText.includes(token);
      }, TEST_API_TOKEN);

      expect(pageCanSeeToken).toBe(false);
    });

    test("an origin that is not enabled gets no overlay and no relay", async ({
      page,
      serviceWorker,
    }) => {
      await page.goto(DISABLED_PAGE_URL);
      await page.waitForLoadState("load");

      expect(
        await page.evaluate(() => ({
          hasOverlayApi: Boolean(window.__REACT_GRAB__),
          hasOverlayHost: Boolean(
            document.querySelector("[data-react-grab-product]"),
          ),
        })),
      ).toEqual({ hasOverlayApi: false, hasOverlayHost: false });
      const registeredMatches = await serviceWorker.evaluate(async () => {
        const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
        const scripts =
          await extensionApi.scripting.getRegisteredContentScripts();
        return scripts.flatMap((script) => script.matches ?? []);
      });
      expect(registeredMatches).not.toContain(`${DISABLED_SITE_ORIGIN}/*`);
    });

    test("disabling a site in the options page removes its scripts and reloads its tabs", async ({
      context,
      page,
      serviceWorker,
    }) => {
      await page.goto(TEST_PAGE_URL);
      await waitForOverlay(page);
      const optionsPage = await openExtensionPage(
        context,
        serviceWorker,
        "options.html",
      );

      const pageReloaded = page.waitForEvent("load");
      await optionsPage
        .getByRole("button", {
          name: `Disable ${new URL(TEST_PAGE_URL).origin}`,
        })
        .click();
      await pageReloaded;

      await expect(
        optionsPage.getByRole("button", {
          name: `Disable ${new URL(TEST_PAGE_URL).origin}`,
        }),
      ).toHaveCount(0);
      expect(await page.evaluate(() => Boolean(window.__REACT_GRAB__))).toBe(
        false,
      );
      expect(
        await serviceWorker.evaluate(async () => {
          const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
          const scripts =
            await extensionApi.scripting.getRegisteredContentScripts();
          return scripts.flatMap((script) => script.matches ?? []);
        }),
      ).not.toContain(`${new URL(TEST_PAGE_URL).origin}/*`);
    });

    test("enabling a site in the options page registers the overlay for it", async ({
      context,
      serviceWorker,
    }) => {
      const optionsPage = await openExtensionPage(
        context,
        serviceWorker,
        "options.html",
      );

      // A site is already enabled, so the form starts closed.
      await optionsPage
        .locator("summary", { hasText: "Enable a site" })
        .click();
      await optionsPage.getByLabel("Site address").fill(DISABLED_SITE_ORIGIN);
      // Without the admin token the workspace is typed, with the known ones suggested.
      await optionsPage
        .getByLabel("Workspace", { exact: true })
        .fill(TEST_WORKSPACE);
      await optionsPage.getByRole("button", { name: "Enable site" }).click();
      await expect(
        optionsPage.getByText(
          `Enabled ${DISABLED_SITE_ORIGIN} for ${TEST_WORKSPACE}.`,
        ),
      ).toBeVisible();

      const disabledSitePage = await context.newPage();
      await disabledSitePage.goto(DISABLED_PAGE_URL);
      await waitForOverlay(disabledSitePage);
    });

    test("without the admin token the options page shows each site's workspace and where its tickets go @ADR-0027", async ({
      context,
      serviceWorker,
      syncServer,
    }) => {
      syncServer.override("listWorkspaces", [
        {
          id: TEST_WORKSPACE,
          jiraAccountId: "e2e-jira-account",
          jiraProjectKey: "SHOP",
          siteUrl: "https://acme.atlassian.net",
        },
      ]);
      const optionsPage = await openExtensionPage(
        context,
        serviceWorker,
        "options.html",
      );

      const siteRow = optionsPage.getByRole("row", {
        name: new URL(TEST_PAGE_URL).origin,
      });
      await expect(siteRow.getByText("→ SHOP")).toBeVisible();
      await expect(
        optionsPage.locator("[data-badge='sync-server']"),
      ).toHaveText("OK");

      await siteRow.getByRole("link", { name: TEST_WORKSPACE }).click();
      await expect(
        optionsPage.locator(`#workspace-${TEST_WORKSPACE}`),
      ).toBeVisible();
      await expect(
        optionsPage.getByRole("link", { name: "Workspaces" }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        syncServer
          .requests("listWorkspaces")
          .map((request) => request.authorization),
      ).toContain(EXPECTED_AUTHORIZATION);
    });

    test("on localhost the host app's own react-grab is the only overlay and the extension starts no sync", async ({
      page,
      syncServer,
    }) => {
      await page.goto(LOCALHOST_PAGE_URL);
      await expect
        .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)), {
          timeout: HOST_INIT_DELAY_MS * 4,
        })
        .toBe(true);

      expect(
        await page.evaluate(
          () => document.querySelectorAll("[data-react-grab-product]").length,
        ),
      ).toBe(1);
      expect(
        await page.evaluate(() =>
          Boolean(Reflect.get(window, "__REACT_GRAB_MODULE__")),
        ),
      ).toBe(true);
      expect(syncServer.requests("listComments")).toEqual([]);
      expect(syncServer.requests("listGroups")).toEqual([]);
    });
  },
);
