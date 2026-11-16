const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * A URL that is a web page (http or https), or undefined. Other schemes
 * (`javascript:`, `data:`, `file:`, `blob:`) are never treated as pages, so
 * a stored URL can never run script or leave the web (ADR-0024, ADR-0026).
 */
export const parseWebUrl = (value: string | undefined): URL | undefined => {
  if (!value || !URL.canParse(value)) return undefined;
  const url = new URL(value);
  return WEB_PROTOCOLS.has(url.protocol) ? url : undefined;
};
