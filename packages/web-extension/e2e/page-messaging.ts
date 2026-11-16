import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Page } from "@playwright/test";

export const readPageMessagingBundle = (): Promise<string> => {
  const pageModulePath = createRequire(import.meta.url).resolve(
    "@webext-core/messaging/page",
  );
  return readFile(
    path.join(path.dirname(pageModulePath), "page.iife.js"),
    "utf8",
  );
};

export const loadPageMessaging = async (page: Page): Promise<void> => {
  await page.addScriptTag({ content: await readPageMessagingBundle() });
};
