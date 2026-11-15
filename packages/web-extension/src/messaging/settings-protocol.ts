import type { SiteSettings } from "../settings/types.js";

export interface SaveSiteRequest {
  origin: string;
  site: SiteSettings;
}

export interface SettingsProtocol {
  saveSite(request: SaveSiteRequest): void;
  removeSites(origins: string[]): void;
}
