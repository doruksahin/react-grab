const WRITE_REFUSED_ERROR_NAME = "WriteRefusedError";

/**
 * A storage write the server refused by rule, not by failure: for example
 * deleting a selection with a ticket (ADR-0008). The write will never
 * succeed, so the caller reloads instead of keeping its local change.
 */
export class WriteRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = WRITE_REFUSED_ERROR_NAME;
  }
}

/**
 * Recognized by name: an error that crossed the browser extension's message
 * channel arrives as a plain Error that keeps its name.
 */
export const isWriteRefused = (error: unknown): boolean =>
  error instanceof Error && error.name === WRITE_REFUSED_ERROR_NAME;
