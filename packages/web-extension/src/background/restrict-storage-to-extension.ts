import { browser } from "wxt/browser";

export const restrictStorageToExtension = async (): Promise<void> => {
  await browser.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
};
