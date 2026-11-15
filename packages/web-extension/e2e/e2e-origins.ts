export const ENABLED_SITE_ORIGIN = "https://react-grab-extension.test";
export const DISABLED_SITE_ORIGIN = "https://disabled-site.test";
export const SYNC_SERVER_URL = "https://sync.react-grab-extension.test";
export const LOCALHOST_SITE_ORIGIN = "http://localhost:4319";

export const E2E_HOST_PERMISSIONS = [
  ENABLED_SITE_ORIGIN,
  DISABLED_SITE_ORIGIN,
  SYNC_SERVER_URL,
  LOCALHOST_SITE_ORIGIN,
].map((origin) => `${origin}/*`);
