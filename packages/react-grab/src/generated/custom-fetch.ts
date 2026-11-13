// Custom fetch mutator for Orval-generated API functions.
// Prepends the sync-server base URL (set at runtime) to relative paths.

let _baseUrl = "";
let _apiToken = "";

/** Call once during init to set the sync-server URL for all generated API calls. */
export const setApiBaseUrl = (url: string) => {
  _baseUrl = url.replace(/\/$/, ""); // strip trailing slash
};

export const getApiBaseUrl = () => _baseUrl;

/** Call once during init. Every request to the sync server carries it (ADR-0020). */
export const setApiToken = (token: string) => {
  _apiToken = token;
};

/** The Authorization header for sync-server requests, or none before init. */
export const apiAuthHeaders = (): Record<string, string> =>
  _apiToken ? { Authorization: `Bearer ${_apiToken}` } : {};

/** Orval custom mutator — wraps fetch with the runtime base URL and token. */
export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const fullUrl = url.startsWith("/") ? `${_baseUrl}${url}` : url;
  const headers = new Headers(options.headers);
  for (const [name, value] of Object.entries(apiAuthHeaders())) {
    headers.set(name, value);
  }
  const response = await fetch(fullUrl, { ...options, headers });
  const body = await response.text();
  const data = body ? JSON.parse(body) : {};
  return { data, status: response.status, headers: response.headers } as T;
};

export default customFetch;
