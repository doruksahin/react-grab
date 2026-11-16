import { storage } from "wxt/utils/storage";
import {
  adminTokenSchema,
  apiTokenSchema,
  serverUrlSchema,
  siteOriginSchema,
  siteSettingsSchema,
} from "./settings-schema.js";
import { addRecordingSettings, dropJiraProjectKey } from "./migrate-sites.js";
import type {
  SiteSettings,
  SiteSettingsByOrigin,
  SyncSettings,
} from "./types.js";

export const serverUrlItem = storage.defineItem<string>(
  "local:sync_server_url",
);

export const apiTokenItem = storage.defineItem<string>("local:sync_api_token");

/** The admin token (ADR-0027). storage.local is closed to content scripts. */
export const adminTokenItem = storage.defineItem<string>(
  "local:sync_admin_token",
);

export const sitesItem = storage.defineItem<SiteSettingsByOrigin>(
  "local:sync_sites",
  {
    fallback: {},
    version: 3,
    migrations: { 2: addRecordingSettings, 3: dropJiraProjectKey },
  },
);

export const readSyncSettings = async (): Promise<SyncSettings> => {
  const [serverUrl, apiToken, adminToken, sites] = await Promise.all([
    serverUrlItem.getValue(),
    apiTokenItem.getValue(),
    adminTokenItem.getValue(),
    sitesItem.getValue(),
  ]);
  return { serverUrl, apiToken, adminToken, sites };
};

export const saveServerUrl = async (serverUrl: string): Promise<void> => {
  await serverUrlItem.setValue(serverUrlSchema.parse(serverUrl));
};

export const saveApiToken = async (apiToken: string): Promise<void> => {
  await apiTokenItem.setValue(apiTokenSchema.parse(apiToken));
};

export const saveAdminToken = async (adminToken: string): Promise<void> => {
  await adminTokenItem.setValue(adminTokenSchema.parse(adminToken));
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
