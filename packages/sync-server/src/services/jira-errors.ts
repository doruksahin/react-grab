import type { z } from "@hono/zod-openapi";
import type { JiraErrorCode } from "../schemas/jira-account.js";

export type JiraErrorCodeValue = z.infer<typeof JiraErrorCode>;

const STATUS_BY_CODE = {
  "jira-account-rejected": 502,
  "jira-credential-invalid": 422,
  "jira-project-forbidden": 502,
  "jira-ticket-missing": 404,
  "jira-request-failed": 502,
  "jira-destination-missing": 409,
  "jira-account-duplicate": 409,
  "jira-account-in-use": 409,
  "jira-account-mismatch": 409,
  "jira-account-not-found": 404,
  "jira-project-not-found": 422,
  "jira-description-invalid": 500,
} as const satisfies Record<JiraErrorCodeValue, number>;

export type JiraErrorStatus = (typeof STATUS_BY_CODE)[JiraErrorCodeValue];

/** A Jira or binding failure the client can name (ADR-0027). */
export class JiraError extends Error {
  constructor(
    readonly code: JiraErrorCodeValue,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "JiraError";
  }

  get status(): JiraErrorStatus {
    return STATUS_BY_CODE[this.code];
  }
}

/** A Jira answer that was not OK, from a call made with fetch rather than jira.js. */
export class JiraHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "JiraHttpError";
  }
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

/** jira.js throws an HttpException with `status`; raw fetch callers throw one too. */
export const httpStatusOf = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  return typeof error.status === "number" ? error.status : undefined;
};

/** Maps any failure from a Jira call to one typed error. The one place this is decided. */
export const toJiraError = (error: unknown, fallback: string): JiraError => {
  if (error instanceof JiraError) return error;
  const status = httpStatusOf(error);
  if (status === HTTP_UNAUTHORIZED) {
    return new JiraError(
      "jira-account-rejected",
      "Jira rejected the account. Replace its API token in the extension's settings.",
      { cause: error },
    );
  }
  if (status === HTTP_FORBIDDEN) {
    return new JiraError(
      "jira-project-forbidden",
      "The Jira account has no access to this project.",
      { cause: error },
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new JiraError("jira-request-failed", `${fallback}: ${detail}`, {
    cause: error,
  });
};

/** Runs a Jira call and turns any failure into a JiraError. */
export const withJiraErrors = async <Result>(
  call: () => Promise<Result>,
  fallback: string,
): Promise<Result> => {
  try {
    return await call();
  } catch (error) {
    throw toJiraError(error, fallback);
  }
};
