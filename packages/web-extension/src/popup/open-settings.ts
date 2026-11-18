import { browser } from "wxt/browser";

const findOpenSettingsTab = async (settingsUrl: string) => {
  const tabContexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.TAB],
  });
  return tabContexts.find((context) =>
    context.documentUrl?.startsWith(settingsUrl),
  );
};

/**
 * Opens the settings page, at `path` (a query and anchor) when given, and
 * closes the popup. An open settings tab is reused rather than a new one.
 */
export const openSettings = async (path?: string): Promise<void> => {
  if (path) {
    const settingsUrl = browser.runtime.getURL("/options.html");
    const url = `${settingsUrl}${path}`;
    const openTab = await findOpenSettingsTab(settingsUrl);
    if (openTab) {
      await browser.tabs.update(openTab.tabId, { url, active: true });
      await browser.windows.update(openTab.windowId, { focused: true });
    } else {
      await browser.tabs.create({ url });
    }
  } else {
    await browser.runtime.openOptionsPage();
  }
  window.close();
};
