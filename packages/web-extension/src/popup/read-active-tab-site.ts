import { browser } from "wxt/browser";
import { findSite } from "../settings/find-site.js";
import { siteOriginSchema } from "../settings/settings-schema.js";
import { sitesItem } from "../settings/settings-items.js";

export interface ActiveTabSite {
  origin: string;
  isAdded: boolean;
}

/** The web site in the active tab and whether it is added in the settings; null on a non-web page. */
export const readActiveTabSite = async (): Promise<ActiveTabSite | null> => {
  const [[activeTab], sites] = await Promise.all([
    browser.tabs.query({ active: true, currentWindow: true }),
    sitesItem.getValue(),
  ]);
  const origin = siteOriginSchema.safeParse(activeTab?.url ?? "");
  if (!origin.success) return null;
  return {
    origin: origin.data,
    isAdded: findSite(sites, origin.data) !== null,
  };
};
