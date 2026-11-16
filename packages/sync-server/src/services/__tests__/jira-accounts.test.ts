import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJiraAccountsHarness } from "../../test/jira-accounts-setup.js";
import { JiraError, JiraHttpError } from "../jira-errors.js";
import { JiraService } from "../jira.service.js";
import { CredentialVault } from "../credential-vault.js";

/*
 * ADR-0027 over real D1, with Jira stubbed. Each Jira user is named by its
 * token: "token-ada" signs in as Ada, "token-bob" as Bob, "bad" is refused.
 */

const ADA_SITE = "https://ada.atlassian.net";
const BOB_SITE = "https://bob.atlassian.net";

const USERS: Record<string, { accountId: string; displayName: string }> = {
  "token-ada": { accountId: "atl-ada", displayName: "Ada" },
  "token-ada-new": { accountId: "atl-ada", displayName: "Ada" },
  "token-bob": { accountId: "atl-bob", displayName: "Bob" },
};

let harness: ReturnType<typeof createJiraAccountsHarness>;
let workspaceId: string;

const expectJiraError = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(JiraError);
  expect(error).toMatchObject({ code });
};

beforeEach(() => {
  harness = createJiraAccountsHarness();
  workspaceId = `ws-${crypto.randomUUID()}`;
  vi.spyOn(JiraService.prototype, "getMyself").mockImplementation(
    async function (this: JiraService) {
      const user = USERS[harness.configOf(this).apiToken];
      if (!user) throw new JiraHttpError(401, "Unauthorized");
      return user;
    },
  );
  vi.spyOn(JiraService.prototype, "hasProject").mockImplementation(
    async (projectKey) => projectKey === "SCRUM" || projectKey === "OPS",
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const addAda = () =>
  harness.accountService.add({
    siteUrl: ADA_SITE,
    email: "ada@example.com",
    apiToken: "token-ada",
  });

const addBob = () =>
  harness.accountService.add({
    siteUrl: BOB_SITE,
    email: "bob@example.com",
    apiToken: "token-bob",
  });

describe("JiraAccountService", () => {
  it("saves an account only after Jira accepts it, and never in the clear", async () => {
    const summary = await addAda();
    expect(summary).toMatchObject({
      siteUrl: ADA_SITE,
      displayName: "Ada",
      workspaceCount: 0,
    });
    expect(JSON.stringify(summary)).not.toContain("token-ada");

    const stored = await harness.accounts.find(summary.id);
    expect(stored?.credential.ciphertext).not.toContain("token-ada");
    expect(await harness.vault.open(summary.id, stored!.credential)).toEqual({
      kind: "api-token",
      token: "token-ada",
    });
  });

  it("refuses a credential Jira does not accept, and saves nothing", async () => {
    const before = (await harness.accountService.list()).length;
    await expectJiraError(
      harness.accountService.add({
        siteUrl: "https://nobody.atlassian.net",
        email: "x@example.com",
        apiToken: "bad",
      }),
      "jira-credential-invalid",
    );
    expect(await harness.accountService.list()).toHaveLength(before);
  });

  it("refuses the same Jira user on the same site twice", async () => {
    await addBob();
    await expectJiraError(addBob(), "jira-account-duplicate");
  });

  it("replaces a token only with one for the same Jira user", async () => {
    const ada = await harness.accountService.add({
      siteUrl: "https://replace.atlassian.net",
      email: "ada@example.com",
      apiToken: "token-ada",
    });
    await harness.accountService.replaceCredential(ada.id, "token-ada-new");
    const stored = await harness.accounts.find(ada.id);
    expect(await harness.vault.open(ada.id, stored!.credential)).toEqual({
      kind: "api-token",
      token: "token-ada-new",
    });
    await expectJiraError(
      harness.accountService.replaceCredential(ada.id, "token-bob"),
      "jira-account-mismatch",
    );
  });

  it("will not remove an account a workspace or a ticket uses", async () => {
    const account = await harness.accountService.add({
      siteUrl: "https://carol.atlassian.net",
      email: "carol@example.com",
      apiToken: "token-ada",
    });
    await harness.workspaceService.setDestination(
      workspaceId,
      account.id,
      "SCRUM",
    );
    await expectJiraError(
      harness.accountService.remove(account.id),
      "jira-account-in-use",
    );

    await harness.workspaceService.clearDestination(workspaceId);
    await harness.repo.upsertGroup(workspaceId, {
      id: "g-1",
      name: "G",
      createdAt: 1,
    });
    await harness.repo.updateGroupJira(
      workspaceId,
      "g-1",
      "SCRUM-1",
      account.id,
    );
    await expectJiraError(
      harness.accountService.remove(account.id),
      "jira-account-in-use",
    );
  });

  it("removes an unused account", async () => {
    const account = await harness.accountService.add({
      siteUrl: "https://dave.atlassian.net",
      email: "dave@example.com",
      apiToken: "token-bob",
    });
    await harness.accountService.remove(account.id);
    expect(await harness.accounts.find(account.id)).toBeUndefined();
  });
});

describe("key rotation (ADR-0027)", () => {
  it("re-seals credentials from an older key version, and leaves current ones", async () => {
    const account = await harness.accountService.add({
      siteUrl: "https://rotate.atlassian.net",
      email: "rot@example.com",
      apiToken: "token-ada",
    });
    const stored = await harness.accounts.find(account.id);
    // Pretend an older key sealed it: v0 holds the same bytes as v1.
    const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    const older = new CredentialVault({
      JIRA_CREDENTIAL_KEYS: { v0: KEY, v1: KEY },
      JIRA_CREDENTIAL_KEY_CURRENT: "v0",
    });
    await harness.accounts.updateCredential(
      account.id,
      await older.seal(account.id, { kind: "api-token", token: "token-ada" }),
    );
    expect(stored?.credential.keyVersion).toBe("v1");

    const rotated = createJiraAccountsHarness({
      JIRA_CREDENTIAL_KEYS: { v0: KEY, v1: KEY },
      JIRA_CREDENTIAL_KEY_CURRENT: "v1",
    });
    const { reencrypted } = await rotated.accountService.reencryptAll();
    expect(reencrypted).toBeGreaterThanOrEqual(1);
    const after = await rotated.accounts.find(account.id);
    expect(after?.credential.keyVersion).toBe("v1");
    expect(await rotated.vault.open(account.id, after!.credential)).toEqual({
      kind: "api-token",
      token: "token-ada",
    });
    expect((await rotated.accountService.reencryptAll()).reencrypted).toBe(0);
  });
});

describe("WorkspaceService", () => {
  it("binds a workspace only to a project the account can see", async () => {
    const account = await harness.accountService.add({
      siteUrl: "https://erin.atlassian.net",
      email: "erin@example.com",
      apiToken: "token-ada",
    });
    await expectJiraError(
      harness.workspaceService.setDestination(workspaceId, account.id, "NOPE"),
      "jira-project-not-found",
    );
    expect(
      await harness.workspaceService.setDestination(
        workspaceId,
        account.id,
        "SCRUM",
      ),
    ).toEqual({
      siteUrl: "https://erin.atlassian.net",
      projectKey: "SCRUM",
      signsInAs: "Ada",
    });
    expect(await harness.workspaceService.getDestination(workspaceId)).toEqual({
      siteUrl: "https://erin.atlassian.net",
      projectKey: "SCRUM",
      signsInAs: "Ada",
    });
  });

  it("has no destination until one is set", async () => {
    await expectJiraError(
      harness.workspaceService.getDestination(workspaceId),
      "jira-destination-missing",
    );
  });
});

describe("JiraTicketService", () => {
  it("creates the ticket in the destination and records its origin", async () => {
    const account = await harness.accountService.add({
      siteUrl: "https://gina.atlassian.net",
      email: "gina@example.com",
      apiToken: "token-ada",
    });
    await harness.workspaceService.setDestination(
      workspaceId,
      account.id,
      "SCRUM",
    );
    await harness.repo.upsertGroup(workspaceId, {
      id: "g-1",
      name: "G",
      createdAt: 1,
    });
    const create = vi
      .spyOn(JiraService.prototype, "createTicketFromGroup")
      .mockImplementation(
        async function (
          this: JiraService,
          params,
          workspace,
          groupId,
          repo,
          _screenshots,
          jiraAccountId,
        ) {
          await repo.updateGroupJira(
            workspace,
            groupId,
            `${params.projectKey}-1`,
            jiraAccountId,
          );
          return {
            jiraTicketId: `${params.projectKey}-1`,
            jiraUrl: `${harness.configOf(this).baseUrl}/browse/${params.projectKey}-1`,
          };
        },
      );

    const result = await harness.ticketService.createTicket(
      workspaceId,
      "g-1",
      {
        issueType: "Bug",
        priority: "Medium",
        summary: "S",
        description: "D",
      },
    );
    expect(result).toEqual({
      jiraTicketId: "SCRUM-1",
      jiraUrl: "https://gina.atlassian.net/browse/SCRUM-1",
    });
    expect(await harness.repo.findTicketOrigin(workspaceId, "g-1")).toEqual({
      jiraTicketId: "SCRUM-1",
      jiraAccountId: account.id,
    });

    // A second create returns the same ticket and makes no new one.
    await harness.ticketService.createTicket(workspaceId, "g-1", {
      issueType: "Bug",
      priority: "Medium",
      summary: "S",
      description: "D",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reads a ticket through the account that created it, after the workspace moves", async () => {
    const first = await harness.accountService.add({
      siteUrl: "https://hank.atlassian.net",
      email: "hank@example.com",
      apiToken: "token-ada",
    });
    const second = await harness.accountService.add({
      siteUrl: "https://ivy.atlassian.net",
      email: "ivy@example.com",
      apiToken: "token-bob",
    });
    await harness.repo.upsertGroup(workspaceId, {
      id: "g-1",
      name: "G",
      createdAt: 1,
    });
    await harness.repo.updateGroupJira(workspaceId, "g-1", "SCRUM-1", first.id);
    await harness.workspaceService.setDestination(
      workspaceId,
      second.id,
      "OPS",
    );

    const sites: string[] = [];
    const paths: string[] = [];
    vi.spyOn(JiraService.prototype, "getIssueStatus").mockImplementation(
      async function (this: JiraService, ticketId, attachmentPath) {
        sites.push(harness.configOf(this).baseUrl);
        paths.push(attachmentPath("10"));
        return {
          status: "To Do",
          statusCategory: "To Do",
          assignee: null,
          reporter: null,
          assigneeAvatar: null,
          reporterAvatar: null,
          jiraUrl: `x/${ticketId}`,
          labels: [],
          comments: [],
          flagged: false,
          flaggedAt: null,
          flaggedBy: null,
          flaggedByAvatar: null,
          priority: null,
          issueType: null,
          dueDate: null,
        };
      },
    );
    await harness.ticketService.getStatus(workspaceId, "g-1");
    expect(sites).toEqual(["https://hank.atlassian.net"]);
    expect(paths).toEqual([
      `/workspaces/${workspaceId}/groups/g-1/jira-attachments/10`,
    ]);
  });

  it("refuses a ticket that has no origin", async () => {
    await expectJiraError(
      harness.clients.forTicket({ jiraTicketId: "OLD-1", jiraAccountId: null }),
      "jira-account-not-found",
    );
  });

  it("names a group without a ticket", async () => {
    await expectJiraError(
      harness.ticketService.getStatus(workspaceId, "none"),
      "jira-ticket-missing",
    );
  });

  it("maps Jira refusing the account to jira-account-rejected", async () => {
    await harness.repo.upsertGroup(workspaceId, {
      id: "g-1",
      name: "G",
      createdAt: 1,
    });
    const account = await harness.accountService.add({
      siteUrl: "https://ivy.atlassian.net",
      email: "ivy@example.com",
      apiToken: "token-ada",
    });
    await harness.repo.updateGroupJira(workspaceId, "g-1", "OLD-1", account.id);
    vi.spyOn(JiraService.prototype, "getIssueStatus").mockRejectedValue(
      new JiraHttpError(401, "Unauthorized"),
    );
    await expectJiraError(
      harness.ticketService.getStatus(workspaceId, "g-1"),
      "jira-account-rejected",
    );
  });
});
