import type { Browser } from "wxt/browser";
import { originMatchPattern } from "../settings/origin-match-pattern.js";
import { settingsWriteQueue } from "../background/queues.js";
import { removeSites, sitesItem } from "../settings/settings-items.js";

export const removeRevokedSites = async (
  revoked: Browser.permissions.Permissions,
): Promise<void> => {
  const revokedPatterns = new Set(revoked.origins ?? []);
  await settingsWriteQueue.run(async () => {
    const sites = await sitesItem.getValue();
    const revokedOrigins = Object.keys(sites).filter((origin) =>
      revokedPatterns.has(originMatchPattern(origin)),
    );
    if (revokedOrigins.length > 0) await removeSites(revokedOrigins);
  });
};
