const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether a browser page on `origin` may call the API (ADR-0020).
 *
 * Local dev servers are always allowed: the overlay only runs in development
 * builds (`initSync()` sits behind `import.meta.env.DEV`). Any other origin
 * must be listed explicitly in `ALLOWED_ORIGINS`, compared exactly.
 *
 * This only limits which pages a browser lets use the API. The bearer token
 * is what actually guards it.
 */
export const isAllowedOrigin = (
  origin: string,
  allowedOrigins: string | undefined,
): boolean => {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (LOCAL_HOSTNAMES.has(url.hostname)) return true;

  const listed = (allowedOrigins ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return listed.includes(url.origin);
};
