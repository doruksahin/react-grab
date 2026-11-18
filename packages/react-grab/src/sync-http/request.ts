import {
  type SyncRequestInit,
  assertNoDotSegments,
} from "../generated/custom-fetch.js";
import type { SyncServerConnection } from "./types.js";
import { WriteRefusedError } from "../features/sync/business/write-refused-error.js";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_NO_CONTENT = 204;
type SuccessStatus =
  | typeof HTTP_STATUS_OK
  | typeof HTTP_STATUS_CREATED
  | typeof HTTP_STATUS_NO_CONTENT;
const SUCCESS_STATUSES: ReadonlySet<number> = new Set<SuccessStatus>([
  HTTP_STATUS_OK,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_NO_CONTENT,
]);
// The server's answer for a write that a rule forbids (ADR-0008).
const HTTP_STATUS_CONFLICT = 409;

/** A response the sync server answered with something other than 2xx. */
export class SyncHttpError extends Error {
  readonly status: number;
  /**
   * The server's reason, for a Jira failure (ADR-0027). An own property, so
   * it survives the extension's message channels, which drop the class.
   */
  readonly code?: string;

  constructor(
    operation: string,
    status: number,
    serverMessage?: string,
    code?: string,
  ) {
    super(serverMessage ?? `${operation} failed: ${status}`);
    this.name = "SyncHttpError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

interface GeneratedResponse {
  status: number;
  data: unknown;
}

type SuccessOf<Response extends GeneratedResponse> = Extract<
  Response,
  { status: SuccessStatus }
>;

interface ErrorBody {
  error: string;
  code?: unknown;
}

const isErrorBody = (data: unknown): data is ErrorBody =>
  typeof data === "object" &&
  data !== null &&
  "error" in data &&
  typeof data.error === "string";

const isSuccess = <Response extends GeneratedResponse>(
  response: Response,
): response is SuccessOf<Response> => SUCCESS_STATUSES.has(response.status);

/**
 * The data of a 2xx response from a generated function, or a SyncHttpError
 * carrying the server's `{ error }` message when it sent one.
 */
export const successData = <Response extends GeneratedResponse>(
  operation: string,
  response: Response,
): SuccessOf<Response>["data"] => {
  if (isSuccess(response)) return response.data;
  const serverMessage = isErrorBody(response.data)
    ? response.data.error
    : undefined;
  const code =
    isErrorBody(response.data) && typeof response.data.code === "string"
      ? response.data.code
      : undefined;
  // A coded answer is a Jira failure, even a 409 (no destination), not a refused write.
  if (code !== undefined) {
    throw new SyncHttpError(operation, response.status, serverMessage, code);
  }
  if (response.status === HTTP_STATUS_CONFLICT) {
    throw new WriteRefusedError(serverMessage ?? `${operation} was refused`);
  }
  throw new SyncHttpError(
    operation,
    response.status,
    isErrorBody(response.data) ? response.data.error : undefined,
  );
};

interface RawRequest {
  method: "GET" | "PUT";
  body?: Blob;
  contentType?: string;
}

export interface SyncRequest {
  /** Options for a generated function: the server URL and the token. */
  options: () => SyncRequestInit;
  /**
   * A request with a binary body or response, which the generated client
   * cannot carry: Orval's fetch client JSON-encodes bodies and parses
   * responses as JSON. `path` comes from a generated `get…Url` function.
   */
  raw: (
    operation: string,
    path: string,
    request: RawRequest,
  ) => Promise<Response>;
}

export const JIRA_CREDENTIAL_HEADER = "X-Jira-Credential";

/** The sync token, plus the caller's own Jira credential when there is one (ADR-0031). */
const syncAuthHeaders = (
  connection: SyncServerConnection,
): Record<string, string> => ({
  Authorization: `Bearer ${connection.apiToken}`,
  ...(connection.jiraCredential
    ? { [JIRA_CREDENTIAL_HEADER]: connection.jiraCredential }
    : {}),
});

/** The one place that knows how to reach the sync server (ADR-0020, ADR-0023). */
export const createSyncRequest = (
  connection: SyncServerConnection,
): SyncRequest => {
  const serverUrl = connection.serverUrl.replace(/\/+$/, "");
  const authHeaders = syncAuthHeaders(connection);

  return {
    options: () => ({ serverUrl, headers: authHeaders }),

    raw: async (operation, path, request) => {
      assertNoDotSegments(path);
      const headers = new Headers(authHeaders);
      if (request.contentType) headers.set("Content-Type", request.contentType);
      const response = await fetch(`${serverUrl}${path}`, {
        method: request.method,
        headers,
        body: request.body,
      });
      if (response.ok) return response;
      const data: unknown = await response.json().catch(() => undefined);
      throw new SyncHttpError(
        operation,
        response.status,
        isErrorBody(data) ? data.error : undefined,
        isErrorBody(data) && typeof data.code === "string"
          ? data.code
          : undefined,
      );
    },
  };
};
