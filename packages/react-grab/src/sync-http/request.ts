import {
  type SyncRequestInit,
  assertNoDotSegments,
} from "../generated/custom-fetch.js";
import type { SyncServerConnection } from "./types.js";
import { WriteRefusedError } from "../features/sync/business/write-refused-error.js";

const HTTP_STATUS_OK = 200;
// The server's answer for a write that a rule forbids (ADR-0008).
const HTTP_STATUS_CONFLICT = 409;

/** A response the sync server answered with something other than 200. */
export class SyncHttpError extends Error {
  readonly status: number;

  constructor(operation: string, status: number, serverMessage?: string) {
    super(serverMessage ?? `${operation} failed: ${status}`);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

interface GeneratedResponse {
  status: number;
  data: unknown;
}

type SuccessOf<Response extends GeneratedResponse> = Extract<
  Response,
  { status: typeof HTTP_STATUS_OK }
>;

interface ErrorBody {
  error: string;
}

const isErrorBody = (data: unknown): data is ErrorBody =>
  typeof data === "object" &&
  data !== null &&
  "error" in data &&
  typeof data.error === "string";

const isSuccess = <Response extends GeneratedResponse>(
  response: Response,
): response is SuccessOf<Response> => response.status === HTTP_STATUS_OK;

/**
 * The data of a 200 response from a generated function, or a SyncHttpError
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

/** The one place that knows how to reach the sync server (ADR-0020, ADR-0023). */
export const createSyncRequest = (
  connection: SyncServerConnection,
): SyncRequest => {
  const serverUrl = connection.serverUrl.replace(/\/+$/, "");
  const authorization = `Bearer ${connection.apiToken}`;

  return {
    options: () => ({ serverUrl, headers: { Authorization: authorization } }),

    raw: async (operation, path, request) => {
      assertNoDotSegments(path);
      const headers = new Headers({ Authorization: authorization });
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
      );
    },
  };
};
