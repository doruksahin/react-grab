import { storage } from "wxt/utils/storage";
import {
  apiTokenSchema,
  serverUrlSchema,
  siteOriginSchema,
  siteSettingsSchema,
} from "./settings-schema.js";
import type {
  SiteSettings,
  SiteSettingsByOrigin,
  SyncSettings,
} from "./types.js";

export const serverUrlItem = storage.defineItem<string>(
  "local:sync_server_url",
);

export const apiTokenItem = storage.defineItem<string>("local:sync_api_token");

export const sitesItem = storage.defineItem<SiteSettingsByOrigin>(
  "local:sync_sites",
  { fallback: {} },
);

export const readSyncSettings = async (): Promise<SyncSettings> => {
  const [serverUrl, apiToken, sites] = await Promise.all([
    serverUrlItem.getValue(),
    apiTokenItem.getValue(),
    sitesItem.getValue(),
  ]);
  return { serverUrl, apiToken, sites };
};

export const saveServerUrl = async (serverUrl: string): Promise<void> => {
  await serverUrlItem.setValue(serverUrlSchema.parse(serverUrl));
};

export const saveApiToken = async (apiToken: string): Promise<void> => {
  await apiTokenItem.setValue(apiTokenSchema.parse(apiToken));
};

export const saveSite = async (
  origin: string,
  site: SiteSettings,
): Promise<void> => {
  const sites = await sitesItem.getValue();
  await sitesItem.setValue({
    ...sites,
    [siteOriginSchema.parse(origin)]: siteSettingsSchema.parse(site),
  });
};

export const removeSites = async (
  origins: ReadonlyArray<string>,
): Promise<void> => {
  const sites = await sitesItem.getValue();
  const remainingSites = Object.fromEntries(
    Object.entries(sites).filter(([origin]) => !origins.includes(origin)),
  );
  await sitesItem.setValue(remainingSites);
};
