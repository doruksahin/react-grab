import type { BrowserContext, Page, Worker } from "@playwright/test";
import type { WxtBrowser } from "wxt/browser";
import {
  DISABLED_PAGE_URL,
  TEST_PAGE_URL,
  expect,
  extensionPageUrl,
  openExtensionPage,
  test,
  waitForOverlay,
} from "./fixtures.js";

const DISABLED_SITE_HOST = new URL(DISABLED_PAGE_URL).host;

const expectAddSiteFormFor = async (
  optionsPage: Page,
  siteUrl: string,
): Promise<void> => {
  const addSiteForm = optionsPage.locator("details#add-site");
  await expect(addSiteForm).toHaveAttribute("open", "");
  await expect(addSiteForm.getByLabel("Site address")).toHaveValue(
    new URL(siteUrl).origin,
  );
};

// A popup opened as a tab is its own active tab, so the test names the tab it pops up over.
const openPopupOver = async (
  context: BrowserContext,
  serviceWorker: Worker,
  activeTabUrl: string,
): Promise<Page> => {
  const popupPage = await context.newPage();
  await popupPage.addInitScript((url) => {
    const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
    const queryTabs = extensionApi.tabs.query.bind(extensionApi.tabs);
    extensionApi.tabs.query = async (queryInfo) =>
      (await queryTabs(queryInfo)).map((tab) => ({ ...tab, url }));
  }, activeTabUrl);
  await popupPage.goto(extensionPageUrl(serviceWorker, "popup.html"));
  return popupPage;
};

test.describe("action popup", { tag: ["@ADR-0023"] }, () => {
  test("its switch turns the overlay off in open tabs and badges the action", async ({
    context,
    page,
    serviceWorker,
  }) => {
    await page.goto(TEST_PAGE_URL);
    await waitForOverlay(page);
    const popupPage = await openExtensionPage(
      context,
      serviceWorker,
      "popup.html",
    );
    const overlaySwitch = popupPage.getByRole("switch", { name: "Overlay on" });
    await expect(overlaySwitch).toBeChecked();

    await overlaySwitch.uncheck();

    await expect
      .poll(() => page.evaluate(() => Boolean(window.__REACT_GRAB__)))
      .toBe(false);
    await expect
      .poll(() =>
        serviceWorker.evaluate(() => {
          const extensionApi: WxtBrowser = Reflect.get(globalThis, "chrome");
          return extensionApi.action.getBadgeText({});
        }),
      )
      .toBe("OFF");

    await overlaySwitch.check();

    await waitForOverlay(page);
  });

  test("its Settings button opens the options page", async ({
    context,
    serviceWorker,
  }) => {
    const popupPage = await openExtensionPage(
      context,
      serviceWorker,
      "popup.html",
    );

    const optionsPageOpened = context.waitForEvent("page", (openedPage) =>
      openedPage.url().endsWith("/options.html"),
    );
    await popupPage.getByRole("button", { name: "Settings" }).click();

    await expect((await optionsPageOpened).locator("body")).not.toBeEmpty();
  });

  test("warns that the site in the active tab is not added and opens the form with its address filled in", async ({
    context,
    serviceWorker,
  }) => {
    const popupPage = await openPopupOver(
      context,
      serviceWorker,
      DISABLED_PAGE_URL,
    );
    const warning = popupPage.getByRole("alert");
    await expect(warning).toContainText(`${DISABLED_SITE_HOST} is not added`);

    const optionsPageOpened = context.waitForEvent("page", (openedPage) =>
      openedPage.url().includes("/options.html?origin="),
    );
    await warning.getByRole("button", { name: "Add this site" }).click();

    await expectAddSiteFormFor(await optionsPageOpened, DISABLED_PAGE_URL);
  });

  test("Add this site reuses a settings tab that is already open", async ({
    context,
    serviceWorker,
  }) => {
    const optionsPage = await openExtensionPage(
      context,
      serviceWorker,
      "options.html",
    );
    const popupPage = await openPopupOver(
      context,
      serviceWorker,
      DISABLED_PAGE_URL,
    );
    const openPageCount = context.pages().length;

    await popupPage
      .getByRole("alert")
      .getByRole("button", { name: "Add this site" })
      .click();

    await expectAddSiteFormFor(optionsPage, DISABLED_PAGE_URL);
    expect(context.pages()).toHaveLength(openPageCount - 1);
  });

  test("shows no warning over a site that is added", async ({
    context,
    serviceWorker,
  }) => {
    const popupPage = await openPopupOver(
      context,
      serviceWorker,
      TEST_PAGE_URL,
    );
    await expect(popupPage.getByRole("switch")).toBeVisible();

    await expect(popupPage.getByRole("alert")).toHaveCount(0);
  });
});
