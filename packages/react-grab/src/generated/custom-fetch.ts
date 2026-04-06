// Custom fetch mutator for Orval-generated API functions.
// Prepends the sync-server base URL (set at runtime) to relative paths.

let _baseUrl = "";

/** Call once during init to set the sync-server URL for all generated API calls. */
export const setApiBaseUrl = (url: string) => {
  _baseUrl = url.replace(/\/$/, ""); // strip trailing slash
};

export const getApiBaseUrl = () => _baseUrl;

/** Orval custom mutator — wraps fetch with the runtime base URL. */
export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const fullUrl = url.startsWith("/") ? `${_baseUrl}${url}` : url;
  const response = await fetch(fullUrl, options);
  const body = await response.text();
  const data = body ? JSON.parse(body) : {};
  return { data, status: response.status, headers: response.headers } as T;
};

export default customFetch;
