import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ADFEntity } from "@atlaskit/adf-utils/types";
import { markdownToAdf } from "marklassian";
import { createJiraAccountsHarness } from "../../test/jira-accounts-setup.js";
import { adfError } from "../adf-validation.js";

/*
 * SPEC-021 over real D1 and the real jira.js client. Only fetch is stubbed:
 * it answers Jira's create-issue call and records the body it was sent.
 */

const ENV_SITE = "https://env.atlassian.net";
const TICKET_KEY = "SCRUM-7";

let harness: ReturnType<typeof createJiraAccountsHarness>;
let workspaceId: string;
let issueBodies: Array<{ fields: { description: ADFEntity } }>;

beforeEach(async () => {
  harness = createJiraAccountsHarness({
    baseUrl: ENV_SITE,
    email: "env@example.com",
    apiToken: "token-env",
  });
  workspaceId = `ws-${crypto.randomUUID()}`;
  issueBodies = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    if (
      request.method === "POST" &&
      request.url === `${ENV_SITE}/rest/api/3/issue`
    ) {
      issueBodies.push(await request.json());
      return Response.json({ id: "10001", key: TICKET_KEY });
    }
    return new Response("unexpected request", { status: 500 });
  });
  await harness.repo.upsertGroup(workspaceId, {
    id: "g-1",
    name: "Checkout",
    createdAt: 1,
  });
  await harness.repo.upsertComment(workspaceId, {
    id: "c-1",
    groupId: "g-1",
    content: "<button>Pay</button>",
    elementName: "button",
    tagName: "button",
    componentName: "PayButton",
    commentText: "Too small on mobile",
    timestamp: 1,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ticketInput = {
  projectKey: "SCRUM",
  issueType: "Bug",
  priority: "Medium",
  summary: "Pay button",
};

const sentDescription = () => {
  expect(issueBodies).toHaveLength(1);
  return issueBodies[0].fields.description;
};

describe("Jira ticket description (SPEC-021)", () => {
  it("builds the description from D1, with the note first", async () => {
    const result = await harness.ticketService.createTicket(
      workspaceId,
      "g-1",
      { ...ticketInput, note: "Only on Safari." },
    );

    expect(result.jiraTicketId).toBe(TICKET_KEY);
    const description = sentDescription();
    expect(adfError(description)).toBeUndefined();
    expect(description).toMatchObject({
      type: "doc",
      content: [
        markdownToAdf("Only on Safari.").content[0],
        { type: "paragraph" },
        { type: "heading", attrs: { level: 2 } },
        { type: "panel", attrs: { panelType: "note" } },
        { type: "expand" },
      ],
    });
  });

  it("keeps an old client's markdown description as it is", async () => {
    await harness.ticketService.createTicket(workspaceId, "g-1", {
      ...ticketInput,
      description: "## Old **template**",
    });

    expect(sentDescription()).toEqual(markdownToAdf("## Old **template**"));
  });
});
