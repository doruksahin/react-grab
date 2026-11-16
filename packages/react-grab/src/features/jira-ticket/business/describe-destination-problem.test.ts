import { describe, expect, it } from "vitest";
import {
  describeDestinationProblem,
  jiraErrorCodeOf,
} from "./describe-destination-problem.js";
import { CONNECTION_FAILURE_HINT } from "./describe-create-failure.js";

const coded = (code: string, message = "server message") =>
  Object.assign(new Error(message), { code });

describe("jiraErrorCodeOf (ADR-0027)", () => {
  it("reads the server's code from an error, whatever its class", () => {
    expect(jiraErrorCodeOf(coded("jira-account-rejected"))).toBe(
      "jira-account-rejected",
    );
    expect(jiraErrorCodeOf({ code: "jira-destination-missing" })).toBe(
      "jira-destination-missing",
    );
  });

  it("ignores codes the server does not send", () => {
    expect(jiraErrorCodeOf(coded("ECONNRESET"))).toBeNull();
    expect(jiraErrorCodeOf(new Error("plain"))).toBeNull();
    expect(jiraErrorCodeOf(null)).toBeNull();
  });
});

describe("describeDestinationProblem", () => {
  it("points a rejected account to the extension's settings", () => {
    expect(describeDestinationProblem(coded("jira-account-rejected"))).toEqual({
      code: "jira-account-rejected",
      title: "Jira rejected the account",
      detail:
        "Replace its API token. Open the React Grab extension's settings.",
    });
  });

  it("asks for a destination when the workspace has none", () => {
    expect(
      describeDestinationProblem(coded("jira-destination-missing")).title,
    ).toBe("This workspace has no Jira destination");
  });

  it("falls back to the server's message, or a connection hint", () => {
    expect(
      describeDestinationProblem(coded("jira-request-failed", "Jira is down")),
    ).toMatchObject({ code: "jira-request-failed", detail: "Jira is down" });
    expect(
      describeDestinationProblem(new TypeError("Failed to fetch")).detail,
    ).toBe(CONNECTION_FAILURE_HINT);
  });
});
