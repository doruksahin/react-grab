import { browser } from "wxt/browser";

export const forEachTab = async (
  visitTab: (tabId: number) => Promise<void>,
): Promise<void> => {
  const tabs = await browser.tabs.query({});
  const tabIds = tabs
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined);
  await Promise.allSettled(tabIds.map(visitTab));
};
