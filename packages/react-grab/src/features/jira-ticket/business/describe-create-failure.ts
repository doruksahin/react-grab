export const CONNECTION_FAILURE_HINT = "Check your connection and try again.";

/**
 * What the create dialog shows after a failed submit. `fetch` rejects with a
 * TypeError when the request never got an answer (Fetch standard), and that
 * name survives structured cloning; any other error carries the server's
 * reason as its message.
 */
export const describeCreateFailure = (error: unknown): string => {
  if (error instanceof TypeError) return CONNECTION_FAILURE_HINT;
  if (error instanceof Error && error.message) return error.message;
  return CONNECTION_FAILURE_HINT;
};
