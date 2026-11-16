import type { ADFEntity } from "@atlaskit/adf-utils/types";
import { validator } from "@atlaskit/adf-utils/validator";
import { JiraError } from "./jira-errors.js";

// Strict mode without an error callback throws on the first invalid node. A
// callback would also hear about content candidates the validator tries and
// rejects before it accepts another, such as `text` with a `code` mark.
const validate = validator();

/** The first problem Atlassian's ADF validator finds, or undefined when valid. */
export const adfError = (document: ADFEntity): string | undefined => {
  try {
    validate(document);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Throws when a document the server built is not valid ADF (SPEC-021). That
 * is a server bug, so it is logged and never sent to Jira.
 */
export const assertValidAdf = (document: ADFEntity): void => {
  const problem = adfError(document);
  if (problem === undefined) return;
  console.error("Invalid ADF description:", problem);
  throw new JiraError(
    "jira-description-invalid",
    "The server built an invalid ticket description.",
  );
};
