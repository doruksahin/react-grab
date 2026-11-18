import type { SiteSettings, SiteSettingsByOrigin } from "./types.js";

export const findSite = (
  sites: SiteSettingsByOrigin,
  origin: string,
): SiteSettings | null =>
  Object.hasOwn(sites, origin) ? (sites[origin] ?? null) : null;
