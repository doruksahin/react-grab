import { readSyncSettings } from "../settings/settings-items.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";

export interface OptionsState {
  serverUrl: string;
  hasApiToken: boolean;
  sites: SiteSettingsByOrigin;
}

export const loadOptionsState = async (): Promise<OptionsState> => {
  const settings = await readSyncSettings();
  return {
    serverUrl: settings.serverUrl ?? "",
    hasApiToken: Boolean(settings.apiToken),
    sites: settings.sites,
  };
};
