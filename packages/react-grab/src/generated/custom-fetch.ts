/**
 * Request options for the Orval-generated functions. The fetch client types
 * its options argument as `RequestInit`, so the server URL rides along as an
 * extra field that the generated functions spread through to this mutator.
 * Callers build it with `createSyncRequest` (src/sync-http/request.ts), which
 * also adds the Authorization header (ADR-0020). Nothing is kept in module
 * state: every call names its own server and token (ADR-0023).
 */
export interface SyncRequestInit extends RequestInit {
  serverUrl?: string;
}

/**
 * The response body as JSON. A body that is not JSON (an HTML error page from
 * a proxy, say) becomes undefined, so the caller still sees the status and
 * reports it as a failed request instead of a SyntaxError.
 */
const parseBody = (body: string): unknown => {
  if (!body) return {};
  try {
    const data: unknown = JSON.parse(body);
    return data;
  } catch {
    return undefined;
  }
};

/** Orval custom mutator: resolves the relative path against the caller's server URL. */
export const customFetch = async <T>(
  path: string,
  options: SyncRequestInit,
): Promise<T> => {
  const { serverUrl, ...init } = options;
  if (!serverUrl) {
    throw new Error(
      `react-grab: no sync server URL for ${path}; call the generated functions through createSyncRequest()`,
    );
  }
  const response = await fetch(`${serverUrl}${path}`, init);
  const data = parseBody(await response.text());
  // HACK: Orval's mutator contract returns the generated response union `T`,
  // which it cannot express in the mutator's own signature.
  return { data, status: response.status, headers: response.headers } as T;
};

export default customFetch;
